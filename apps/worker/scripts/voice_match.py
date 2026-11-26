"""Makes the dubbed voice sound recorded where the original was: same tone, same frequency range, same room.

Usage: python voice_match.py ORIGINAL_VOICE.wav DUB_VOICE.wav SPANS.json OUTPUT.wav REPORT.json

SPANS.json: {"original": [[startMs, endMs], ...], "dub": [[startMs, endMs], ...]}, where each voice speaks.

- Tone: the long-term spectrum of the dub's speech is matched to the original's with a linear-phase filter, smoothed
  to third octaves and kept within -24..+6 dB, so a bright studio voice takes on the colour of a phone recording.
- Range: above the original's highest useful frequency (phones and messaging apps often cut above 7 to 10 kHz) the
  dub is cut too.
- Room: when the original voice rings on after its phrases and the dub stops dead, a short reverb with a matching
  decay is added, chosen by trying a few rooms on the dub's own phrase ends. What follows a phrase in the original is
  partly its background noise, not the room: the typical noise level is taken out first, so a noisy recording does
  not make the dub echo (the noise itself comes back under the dub with the noise fill).
The timing is untouched: the filter's delay is taken back out. Needs only numpy.
"""

import json
import sys
import wave

import numpy as np

N_FFT = 4096
THIRD_OCTAVE = 1 / 3
EQ_MIN_DB, EQ_MAX_DB = -24.0, 6.0
CUT_DB = -40.0
BANDWIDTH_DROP_DB = 45.0  # the highest frequency still within this much of the strongest band is the range
FIR_TAPS = 2049
BLOCK = 1 << 16
DECAYS_SEC = (0.15, 0.25, 0.35, 0.5, 0.7)
WETS_DB = (-30.0, -24.0, -20.0, -16.0, -12.0)
DRIER_DB = 2.0  # a room is added only when the dub dies away at least this much faster than the original
PHRASE_GAP_MS = 300
SEED = 11


def read_wav(path):
    with wave.open(path, "rb") as f:
        if f.getsampwidth() != 2:
            raise SystemExit(f"{path}: expected 16-bit PCM")
        rate, channels = f.getframerate(), f.getnchannels()
        samples = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2")
    return rate, samples.reshape(-1, channels).astype(np.float64).mean(axis=1) / 32768.0


def write_wav(path, rate, mono):
    pcm = (np.clip(mono, -1.0, 1.0) * 32767.0).round().astype("<i2")
    with wave.open(path, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(np.repeat(pcm, 2).tobytes())


def ltas(mono, rate, spans):
    """Average power spectrum while the voice speaks."""
    window = np.hanning(N_FFT)
    total = np.zeros(N_FFT // 2 + 1)
    count = 0
    for start, end in spans:
        a, b = int(start * rate / 1000), min(len(mono), int(end * rate / 1000))
        starts = range(a, b - N_FFT + 1, N_FFT // 2)
        if len(starts) == 0:
            continue
        frames = np.stack([mono[s : s + N_FFT] for s in starts]) * window
        total += np.sum(np.abs(np.fft.rfft(frames, axis=1)) ** 2, axis=0)
        count += len(starts)
    return total / max(1, count), count


def smooth(power, freqs):
    """Third-octave average around every frequency."""
    cumulative = np.concatenate([[0.0], np.cumsum(power)])
    lo = np.searchsorted(freqs, freqs * 2 ** (-THIRD_OCTAVE / 2))
    hi = np.maximum(np.searchsorted(freqs, freqs * 2 ** (THIRD_OCTAVE / 2), side="right"), lo + 1)
    return (cumulative[hi] - cumulative[lo]) / (hi - lo)


def convolve(x, h):
    """Overlap-add FFT convolution, full length."""
    size = 1 << int(np.ceil(np.log2(BLOCK + len(h) - 1)))
    spectrum = np.fft.rfft(h, size)
    y = np.zeros(len(x) + len(h) - 1)
    for start in range(0, len(x), BLOCK):
        block = x[start : start + BLOCK]
        part = np.fft.irfft(np.fft.rfft(block, size) * spectrum, size)[: len(block) + len(h) - 1]
        y[start : start + len(part)] += part
    return y


def equalizer(original, dub, rate, spans):
    p_orig, n_orig = ltas(original, rate, spans["original"])
    p_dub, n_dub = ltas(dub, rate, spans["dub"])
    freqs = np.fft.rfftfreq(N_FFT, 1 / rate)
    if n_orig < 4 or n_dub < 4:
        return None, None, None
    orig_db = 10 * np.log10(smooth(p_orig, freqs) + 1e-20)
    dub_db = 10 * np.log10(smooth(p_dub, freqs) + 1e-20)
    diff = orig_db - dub_db
    band = (freqs >= 300) & (freqs <= 3000)
    diff -= np.median(diff[band])  # the shape only: the level is matched later, by loudness
    eq = np.clip(diff, EQ_MIN_DB, EQ_MAX_DB)
    eq[freqs < 80] = np.minimum(eq[freqs < 80], 0.0)  # never boost rumble
    useful = freqs[orig_db >= orig_db.max() - BANDWIDTH_DROP_DB]
    bandwidth = float(useful.max()) if useful.size else rate / 2
    eq[freqs > bandwidth] = CUT_DB
    # A linear-phase filter: the same delay at every frequency, taken back out after filtering.
    response = np.fft.irfft(10 ** (eq / 20), n=N_FFT)
    centered = np.roll(response, N_FFT // 2)[N_FFT // 2 - FIR_TAPS // 2 : N_FFT // 2 + FIR_TAPS // 2 + 1]
    return centered * np.hanning(FIR_TAPS), eq, (freqs, bandwidth)


def phrase_ends(spans, total_ms):
    ends = []
    for i, (start, end) in enumerate(spans):
        following = spans[i + 1][0] if i + 1 < len(spans) else total_ms
        if following - end >= PHRASE_GAP_MS:
            ends.append(end)
    return ends


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-9) if x.size else -180.0


def noise_floor(mono, rate, spans):
    """The typical level where the voice is silent: the median of 50 ms frames well away from speech."""
    busy = np.zeros(len(mono), bool)
    for start, end in spans:
        busy[max(0, int((start - 150) * rate / 1000)) : int((end + 150) * rate / 1000)] = True
    step = int(0.05 * rate)
    levels = [rms_db(mono[s : s + step]) for s in range(0, len(mono) - step, step) if not busy[s : s + step].any()]
    levels = [level for level in levels if level > -90]  # digital silence is not a noise floor
    return float(np.median(levels)) if levels else None


def drop_after(mono, rate, ends, floor=None):
    """How far the voice falls from its last 150 ms to 50-250 ms after each phrase: smaller drops ring on more."""
    drops = []
    for end in ends:
        e = int(end * rate / 1000)
        word = mono[max(0, e - int(0.15 * rate)) : e]
        tail = mono[e + int(0.05 * rate) : e + int(0.25 * rate)]
        if not (word.size and tail.size):
            continue
        w, t = rms_db(word), rms_db(tail)
        if floor is not None:
            # Only what rises above the noise rings on from the room.
            excess = 10 ** (t / 10) - 10 ** (floor / 10)
            t = 10 * np.log10(excess) if excess > 10 ** ((w - 40) / 10) else w - 40
        drops.append(w - t)
    return float(np.median(drops)) if drops else None


def room_ir(rate, decay_sec, rng):
    """An exponentially fading noise burst, softened at the top as real rooms absorb highs."""
    length = int(rate * decay_sec * 1.2)
    t = np.arange(length) / rate
    ir = rng.standard_normal(length) * 10 ** (-3 * t / decay_sec)
    ir[: int(0.004 * rate)] *= np.linspace(0, 1, int(0.004 * rate))
    ir = np.convolve(ir, np.ones(4) / 4, mode="same")
    return ir / np.sqrt(np.sum(ir**2))


def choose_room(dub, rate, ends, target_drop, rng):
    """The decay and level whose reverb, added to the dub, makes its phrases die away like the original's."""
    best = None
    for decay in DECAYS_SEC:
        ir = room_ir(rate, decay, rng)
        # The tail only depends on what came just before: reverberate a short stretch around each phrase end.
        stretches = []
        for end in ends:
            e = int(end * rate / 1000)
            a = max(0, e - len(ir) - int(0.2 * rate))
            b = min(len(dub), e + int(0.3 * rate))
            dry = dub[a:b]
            stretches.append((e - a, dry, convolve(dry, ir)[: len(dry)]))
        for wet_db in WETS_DB:
            gain = 10 ** (wet_db / 20)
            drops = []
            for offset, dry, wet in stretches:
                mixed = dry + gain * wet
                word = mixed[max(0, offset - int(0.15 * rate)) : offset]
                tail = mixed[offset + int(0.05 * rate) : offset + int(0.25 * rate)]
                if word.size and tail.size:
                    drops.append(rms_db(word) - rms_db(tail))
            if not drops:
                continue
            miss = abs(float(np.median(drops)) - target_drop)
            if best is None or miss < best[0]:
                best = (miss, decay, wet_db, ir, float(np.median(drops)))
    return best


def main(argv):
    if len(argv) != 6:
        raise SystemExit(__doc__)
    original_path, dub_path, spans_path, output_path, report_path = argv[1:]
    rate, original = read_wav(original_path)
    dub_rate, dub = read_wav(dub_path)
    if dub_rate != rate:
        raise SystemExit(f"sample rates differ: {rate} and {dub_rate}")
    with open(spans_path, encoding="utf-8") as f:
        spans = json.load(f)
    report = {"eq": None, "bandwidthHz": None, "room": None}

    fir, eq, info = equalizer(original, dub, rate, spans)
    matched = dub
    if fir is not None:
        delay = FIR_TAPS // 2
        matched = convolve(dub, fir)[delay : delay + len(dub)]
        freqs, bandwidth = info
        report["eq"] = {str(hz): round(float(np.interp(hz, freqs, eq)), 1) for hz in (100, 300, 1000, 2000, 4000, 8000, 12000)}
        report["bandwidthHz"] = round(bandwidth)

    total_ms = len(dub) * 1000 / rate
    floor = noise_floor(original, rate, spans["original"])
    target = drop_after(original, rate, phrase_ends(spans["original"], len(original) * 1000 / rate), floor)
    ends = phrase_ends(spans["dub"], total_ms)
    current = drop_after(matched, rate, ends)
    report["noiseFloorDb"] = None if floor is None else round(floor, 1)
    report["dropOriginalDb"] = None if target is None else round(target, 1)
    report["dropDubDb"] = None if current is None else round(current, 1)
    if target is not None and current is not None and current - target > DRIER_DB:
        rng = np.random.default_rng(SEED)
        chosen = choose_room(matched, rate, ends, target, rng)
        if chosen is not None:
            _, decay, wet_db, ir, after = chosen
            matched = matched + 10 ** (wet_db / 20) * convolve(matched, ir)[: len(matched)]
            report["room"] = {"decaySec": decay, "wetDb": wet_db, "dropAfterDb": round(after, 1)}

    write_wav(output_path, rate, matched)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f)


if __name__ == "__main__":
    main(sys.argv)
