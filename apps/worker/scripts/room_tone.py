"""Room tone for the dub: the steady noise of the original recording, recreated under the new voice.

Many recordings carry a noise floor while someone speaks (a phone microphone, a room, a fan). Voice separation often
files it under the voice, so it vanishes when the dub replaces the voice. This script measures that floor inside the
speech windows, frequency by frequency: a voice fills only some frequencies at any moment, so the level a frequency
stays above most of the time is the noise there. It subtracts what the separated background already carries and writes
steady noise with the missing spectrum for the whole video. The worker fades it in only where the dub speaks, so no
trace of the original voice comes along.

Usage: python room_tone.py ORIGINAL.wav BACKGROUND.wav WINDOWS.json OUTPUT.wav
Inputs are 16-bit PCM WAV files at one sample rate; WINDOWS.json is [{"startMs": 0, "endMs": 1000}, ...].
Needs only numpy, which the worker images ship for Demucs.
"""

import json
import sys
import wave

import numpy as np

N_FFT = 2048
HOP = N_FFT // 4
PERCENTILE = 20  # per frequency: the level it stays above 80% of the time while someone speaks
MAX_FRAMES = 6000  # a sample is plenty for a floor estimate, and it caps time and memory on long videos
MIN_FRAMES = 20
# Frames this far below the typical frame are true silence, not room tone: phones and apps often gate the microphone
# between words, so the floor exists only while someone talks. Those frames are left out of the estimate.
GATE_DB = 30.0
SEED = 7


def read_wav(path):
    with wave.open(path, "rb") as f:
        if f.getsampwidth() != 2:
            raise SystemExit(f"{path}: expected 16-bit PCM")
        rate, channels = f.getframerate(), f.getnchannels()
        samples = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2")
    return rate, samples.reshape(-1, channels).T.astype(np.float64) / 32768.0


def write_wav(path, rate, audio):
    pcm = (np.clip(audio, -1.0, 1.0) * 32767.0).round().astype("<i2")
    with wave.open(path, "wb") as f:
        f.setnchannels(audio.shape[0])
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(pcm.T.tobytes())


def speech_frame_starts(windows, rate, length):
    starts = []
    for w in windows:
        first = max(0, int(w["startMs"] * rate / 1000))
        last = min(length, int(w["endMs"] * rate / 1000))
        starts.extend(range(first, last - N_FFT + 1, HOP))
    return np.array(starts, dtype=np.int64)


def spectra(mono, starts, window):
    frames = np.stack([mono[s : s + N_FFT] for s in starts]) * window
    return np.abs(np.fft.rfft(frames, axis=1))


def shaped_noise(length, gain, window, rng):
    """Weighted overlap-add of white-noise frames, each shaped by `gain` in the frequency domain."""
    out = np.zeros(length + N_FFT)
    norm = np.zeros(length + N_FFT)
    starts = np.arange(0, length, HOP)
    for block in range(0, len(starts), 1024):
        chunk = starts[block : block + 1024]
        frames = rng.standard_normal((len(chunk), N_FFT)) * window
        frames = np.fft.irfft(np.fft.rfft(frames, axis=1) * gain, n=N_FFT, axis=1) * window
        for start, frame in zip(chunk, frames):
            out[start : start + N_FFT] += frame
            norm[start : start + N_FFT] += window**2
    return out[:length] / np.maximum(norm[:length], 1e-9)


def room_tone(original, background, windows, rate):
    """Mono room tone for the whole video, or None when the background already carries the floor."""
    length = min(original.shape[1], background.shape[1])
    starts = speech_frame_starts(windows, rate, length)
    if len(starts) < MIN_FRAMES:
        return None
    rng = np.random.default_rng(SEED)
    if len(starts) > MAX_FRAMES:
        starts = np.sort(rng.choice(starts, MAX_FRAMES, replace=False))
    window = np.hanning(N_FFT + 1)[:-1]
    mono = original.mean(axis=0)
    energy_db = 10 * np.log10(np.array([np.sum((mono[s : s + N_FFT] * window) ** 2) for s in starts]) + 1e-20)
    live = energy_db > np.median(energy_db) - GATE_DB
    if np.count_nonzero(live) >= MIN_FRAMES:
        starts = starts[live]

    target = np.percentile(spectra(mono, starts, window), PERCENTILE, axis=0)
    present = np.percentile(spectra(background.mean(axis=0), starts, window), PERCENTILE, axis=0)
    missing = np.sqrt(np.maximum(target**2 - present**2, 0.0))
    if not np.any(missing > 1e-6):
        return None

    noise = shaped_noise(original.shape[1], missing, window, rng)
    # Scale the steady noise so its typical level per frequency lands on the floor measured under the voice.
    probe = np.arange(0, len(noise) - N_FFT, HOP)[:: max(1, (len(noise) // HOP) // 2000)]
    measured = np.median(spectra(noise, probe, window), axis=0)
    useful = missing > missing.max() * 1e-3
    return noise * np.median(missing[useful] / np.maximum(measured[useful], 1e-12))


def main(argv):
    if len(argv) != 5:
        raise SystemExit(__doc__)
    original_path, background_path, windows_path, output_path = argv[1:]
    rate, original = read_wav(original_path)
    background_rate, background = read_wav(background_path)
    if background_rate != rate:
        raise SystemExit(f"sample rates differ: {rate} and {background_rate}")
    with open(windows_path, encoding="utf-8") as f:
        windows = json.load(f)

    tone = room_tone(original, background, windows, rate)
    channels = original.shape[0]
    audio = np.zeros((channels, original.shape[1])) if tone is None else np.tile(tone, (channels, 1))
    write_wav(output_path, rate, audio)
    level = -np.inf if tone is None else 20 * np.log10(max(np.sqrt(np.mean(tone**2)), 1e-12))
    print(json.dumps({"roomToneDb": None if tone is None else round(float(level), 1)}))


if __name__ == "__main__":
    main(sys.argv)
