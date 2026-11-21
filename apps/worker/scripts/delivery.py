"""How each line was said: loudness and pitch, relative to the speaker's usual delivery.

Reads the separated voice track and the spoken lines, tracks the pitch every 10 ms with a normalized autocorrelation,
and reports for each line, against the median line:
- loudnessDb: dB louder (+) or softer (-) than usual
- pitchSt: semitones higher (+) or lower (-) than the usual pitch
- pitchRangeSt: how far the pitch moves within the line (15th to 85th percentile of the smoothed contour), in semitones
The translator reads these numbers with the words to direct the dubbed performance: a line that is louder, higher and
livelier than usual is likely excited or panicked, whatever the language.

Usage: python delivery.py VOICE.wav LINES.json OUTPUT.json
LINES.json is [{"idx": 0, "startMs": 0, "endMs": 1000}, ...]. Needs only numpy.
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
    """Pitch in Hz (NaN when unvoiced) and level in dB for every hop."""
    frame, hop = int(rate * FRAME_SEC), int(rate * HOP_SEC)
    count = 0 if len(x) < frame else 1 + (len(x) - frame) // hop
    min_lag, max_lag = int(rate / F0_MAX), min(frame - 1, int(rate / F0_MIN))
    window = np.hanning(frame)
    nfft = 1 << (2 * frame - 1).bit_length()
    # A windowed frame's autocorrelation fades with lag; dividing by the window's own autocorrelation undoes that.
    window_ac = np.fft.irfft(np.abs(np.fft.rfft(window, n=nfft)) ** 2, n=nfft)[: max_lag + 1]
    window_ac = np.maximum(window_ac / window_ac[0], 1e-3)

    f0 = np.full(count, np.nan)
    level = np.full(count, -np.inf)
    for start in range(0, count, CHUNK):
        rows = np.arange(start, min(count, start + CHUNK))
        frames = np.stack([x[r * hop : r * hop + frame] for r in rows])
        frames = frames - frames.mean(axis=1, keepdims=True)
        level[rows] = 20 * np.log10(np.sqrt(np.mean(frames**2, axis=1)) + 1e-12)
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


def measure(rate, voice, lines):
    x, rate = downsample(voice, rate)
    times_ms, f0, level = track(x, rate)
    rows = []
    for line in lines:
        inside = (times_ms >= line["startMs"]) & (times_ms < line["endMs"])
        levels = level[inside]
        loud = 10 * np.log10(np.mean(10 ** (levels / 10))) if levels.size else None
        semitones = smoothed(12 * np.log2(f0[inside][~np.isnan(f0[inside])] / 100.0))
        enough = semitones.size >= MIN_VOICED_FRAMES
        rows.append(
            {
                "idx": line["idx"],
                "loud": loud,
                "pitch": float(np.median(semitones)) if enough else None,
                "range": float(np.percentile(semitones, 85) - np.percentile(semitones, 15)) if enough else None,
            }
        )
    usual_loud = np.median([r["loud"] for r in rows if r["loud"] is not None] or [0.0])
    usual_pitch = np.median([r["pitch"] for r in rows if r["pitch"] is not None] or [0.0])

    def rounded(value):
        return None if value is None else round(float(value), 1)

    return [
        {
            "idx": r["idx"],
            "loudnessDb": rounded(None if r["loud"] is None else r["loud"] - usual_loud),
            "pitchSt": rounded(None if r["pitch"] is None else r["pitch"] - usual_pitch),
            "pitchRangeSt": rounded(r["range"]),
        }
        for r in rows
    ]


def main(argv):
    if len(argv) != 4:
        raise SystemExit(__doc__)
    voice_path, lines_path, output_path = argv[1:]
    rate, voice = read_mono(voice_path)
    with open(lines_path, encoding="utf-8") as f:
        lines = json.load(f)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(measure(rate, voice, lines), f)


if __name__ == "__main__":
    main(sys.argv)
