"""How a voice track was performed, line by line, and what else the voice did between the words.

Usage: python voice_analysis.py VOICE.wav INPUT.json OUTPUT.json

INPUT.json:
  {"lines": [{"idx": 0, "spans": [[startMs, endMs], ...]}, ...],   what to measure: a line's words, or the whole line
   "words": [[startMs, endMs], ...],                                every spoken word, skipped by the sound search
   "events": [[startMs, endMs], ...]}                               sounds already tagged, also skipped

OUTPUT.json:
  {"usual": {"loudnessDb": ..., "pitchSt": ...},                    medians over the lines: the speaker's usual
   "lines": [{"idx", "loudnessDb", "pitchSt", "rangeSt", "peakSt", "endingSt", "voiced"}, ...],
   "sounds": [{"startMs", "endMs", "loudnessDb", "pitchSt", "voiced"}, ...],
   "envelope": {"stepMs": 10, "db": [...]}}

Pitch values are semitones above 100 Hz, loudness is dBFS; every value is absolute, so tracks can be compared.
- rangeSt: how far the pitch moves in the line (15th to 85th percentile of the smoothed contour)
- peakSt: the top of the line (95th percentile), for screams and shouted words
- endingSt: the last third of the line against the rest: + rises at the end, - falls
- sounds: stretches of voice without words that no tag explains, like crying, screaming or laughing
- envelope: the level every 10 ms, so edits can cut where the track is quiet
Needs only numpy.
"""

import json
import sys
import wave

import numpy as np

TARGET_RATE = 16000
FRAME_SEC = 0.040
HOP_SEC = 0.010
F0_MIN, F0_MAX = 70.0, 700.0  # from low voices to children and shouting
VOICED_CORRELATION = 0.5
OCTAVE_TOLERANCE = 0.9  # prefer the shortest period whose peak is nearly as strong: avoids reading half the pitch
SILENCE_DB = 40.0  # frames this far below the loudest are silence
MIN_VOICED_FRAMES = 5
SMOOTH_FRAMES = 5  # a running median over 50 ms removes single-frame octave jumps from noisy recordings
CHUNK = 4096

SOUND_BELOW_USUAL_DB = 20.0  # a wordless stretch this much softer than the usual line is not a voice sound
SOUND_MIN_MS = 250
SOUND_BRIDGE_MS = 60  # tiny dips inside a sob or a laugh do not split it
SOUND_MIN_VOICED = 0.3  # crying, screams and laughs are partly voiced; breath and most noises are not
SPEECH_GUARD_MS = 80


def smoothed(semitones):
    if semitones.size < SMOOTH_FRAMES:
        return semitones
    return np.median(np.lib.stride_tricks.sliding_window_view(semitones, SMOOTH_FRAMES), axis=1)


def read_mono(path):
    with wave.open(path, "rb") as f:
        if f.getsampwidth() != 2:
            raise SystemExit(f"{path}: expected 16-bit PCM")
        rate, channels = f.getframerate(), f.getnchannels()
        samples = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2")
    return rate, samples.reshape(-1, channels).astype(np.float64).mean(axis=1) / 32768.0


def downsample(x, rate):
    """Averages blocks of samples: a crude low-pass that is plenty for voice pitch, and much faster to analyse."""
    factor = max(1, int(rate // TARGET_RATE))
    usable = len(x) - len(x) % factor
    return x[:usable].reshape(-1, factor).mean(axis=1), rate / factor


def track(x, rate):
    """Times (ms), pitch in Hz (NaN when unvoiced) and level in dB, every 10 ms."""
    frame, hop = int(rate * FRAME_SEC), int(rate * HOP_SEC)
    count = 0 if len(x) < frame else 1 + (len(x) - frame) // hop
    min_lag, max_lag = int(rate / F0_MAX), min(frame - 1, int(rate / F0_MIN))
    window = np.hanning(frame)
    nfft = 1 << (2 * frame - 1).bit_length()
    # A windowed frame's autocorrelation fades with lag; dividing by the window's own autocorrelation undoes that.
    window_ac = np.fft.irfft(np.abs(np.fft.rfft(window, n=nfft)) ** 2, n=nfft)[: max_lag + 1]
    window_ac = np.maximum(window_ac / window_ac[0], 1e-3)

    f0 = np.full(count, np.nan)
    level = np.full(count, -120.0)
    for start in range(0, count, CHUNK):
        rows = np.arange(start, min(count, start + CHUNK))
        frames = np.stack([x[r * hop : r * hop + frame] for r in rows])
        frames = frames - frames.mean(axis=1, keepdims=True)
        level[rows] = 20 * np.log10(np.sqrt(np.mean(frames**2, axis=1)) + 1e-6)
        spectrum = np.fft.rfft(frames * window, n=nfft, axis=1)
        ac = np.fft.irfft(np.abs(spectrum) ** 2, n=nfft, axis=1)[:, : max_lag + 1]
        ac = ac / np.maximum(ac[:, :1], 1e-12) / window_ac
        search = ac[:, min_lag:]
        strongest = search.max(axis=1, keepdims=True)
        first = np.argmax(search >= OCTAVE_TOLERANCE * strongest, axis=1)
        # Settle on the top of the peak that starts there.
        offsets = np.clip(first[:, None] + np.arange(0, max(2, min_lag // 2)), 0, search.shape[1] - 1)
        best = np.take_along_axis(offsets, np.argmax(np.take_along_axis(search, offsets, axis=1), axis=1)[:, None], 1)[:, 0]
        peak = search[np.arange(len(rows)), best]
        f0[rows] = np.where(peak > VOICED_CORRELATION, rate / (best + min_lag), np.nan)
    if count:
        f0[level < level.max() - SILENCE_DB] = np.nan
    times_ms = (np.arange(count) * hop + frame / 2) / rate * 1000
    return times_ms, f0, level


def mask(times_ms, spans, guard_ms=0.0):
    inside = np.zeros(times_ms.size, bool)
    for start, end in spans:
        inside |= (times_ms >= start - guard_ms) & (times_ms < end + guard_ms)
    return inside


def rounded(value):
    return None if value is None or not np.isfinite(value) else round(float(value), 1)


def measure(times_ms, f0, level, spans, silence_db):
    inside = mask(times_ms, spans)
    levels = level[inside]
    if levels.size == 0:
        return dict(loudnessDb=None, pitchSt=None, rangeSt=None, peakSt=None, endingSt=None, voiced=None)
    loud = 10 * np.log10(np.mean(10 ** (levels / 10)))
    audible = levels >= silence_db
    voiced_mask = ~np.isnan(f0[inside])
    voiced = voiced_mask.sum() / max(1, audible.sum())
    st = smoothed(12 * np.log2(f0[inside][voiced_mask] / 100.0))
    if st.size < MIN_VOICED_FRAMES:
        return dict(loudnessDb=rounded(loud), pitchSt=None, rangeSt=None, peakSt=None, endingSt=None, voiced=rounded(voiced))
    third = max(1, st.size // 3)
    return dict(
        loudnessDb=rounded(loud),
        pitchSt=rounded(np.median(st)),
        rangeSt=rounded(np.percentile(st, 85) - np.percentile(st, 15)),
        peakSt=rounded(np.percentile(st, 95)),
        endingSt=rounded(np.median(st[-third:]) - np.median(st[:-third])) if st.size > third else None,
        voiced=rounded(voiced),
    )


def wordless_voice(times_ms, f0, level, words, events, usual_loudness):
    """Stretches of voice without words or tags: candidates the dub can perform, like crying or a scream."""
    if usual_loudness is None or times_ms.size == 0:
        return []
    busy = mask(times_ms, words, SPEECH_GUARD_MS) | mask(times_ms, events, SPEECH_GUARD_MS)
    loud = (level >= usual_loudness - SOUND_BELOW_USUAL_DB) & ~busy
    step = HOP_SEC * 1000
    bridge = int(SOUND_BRIDGE_MS / step)
    regions, start, quiet = [], None, 0
    for i, on in enumerate(loud):
        if on:
            start = i if start is None else start
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet > bridge:
                regions.append((start, i - quiet))
                start, quiet = None, 0
    if start is not None:
        regions.append((start, len(loud) - 1 - quiet))
    sounds = []
    for a, b in regions:
        if (b - a + 1) * step < SOUND_MIN_MS:
            continue
        pitches = f0[a : b + 1]
        voiced = np.mean(~np.isnan(pitches))
        if voiced < SOUND_MIN_VOICED:
            continue
        levels = level[a : b + 1]
        st = 12 * np.log2(pitches[~np.isnan(pitches)] / 100.0)
        sounds.append(
            dict(
                startMs=int(round(times_ms[a] - step / 2)),
                endMs=int(round(times_ms[b] + step / 2)),
                loudnessDb=rounded(10 * np.log10(np.mean(10 ** (levels / 10)))),
                pitchSt=rounded(np.median(st)) if st.size else None,
                voiced=rounded(voiced),
            )
        )
    return sounds


def analyse(rate, voice, request):
    x, rate = downsample(voice, rate)
    times_ms, f0, level = track(x, rate)
    silence_db = (level.max() - SILENCE_DB) if level.size else 0.0
    lines = [dict(idx=line["idx"], **measure(times_ms, f0, level, line["spans"], silence_db)) for line in request["lines"]]

    def median(key):
        values = [line[key] for line in lines if line[key] is not None]
        return float(np.median(values)) if values else None

    usual = dict(loudnessDb=rounded(median("loudnessDb")), pitchSt=rounded(median("pitchSt")))
    sounds = wordless_voice(times_ms, f0, level, request.get("words", []), request.get("events", []), usual["loudnessDb"])
    envelope = [int(max(-99, min(0, round(v)))) for v in level]
    return dict(usual=usual, lines=lines, sounds=sounds, envelope=dict(stepMs=int(HOP_SEC * 1000), db=envelope))


def main(argv):
    if len(argv) != 4:
        raise SystemExit(__doc__)
    voice_path, input_path, output_path = argv[1:]
    rate, voice = read_mono(voice_path)
    with open(input_path, encoding="utf-8") as f:
        request = json.load(f)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(analyse(rate, voice, request), f)


if __name__ == "__main__":
    main(sys.argv)
