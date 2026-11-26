"""The original room under the dub: what the voice track carried besides the voice, carried on while the new voice speaks.

Usage: python noise_fill.py ORIGINAL.wav BACKGROUND.wav VOICE.wav REQUEST.json OUTPUT.wav

REQUEST.json: {"windows": [[startMs, endMs], ...], "busy": [[startMs, endMs], ...]}
  windows: where the original voice track is muted for the dub
  busy:    every word and voice sound of the original, which must never be copied

The separator files some sounds under the voice: a phone's hiss and bursts, breathing, the hum of a room. They
vanish wherever the voice track is muted, and come back between lines, which sounds like the room switching on and
off. Inside each window this copies short stretches of the voice track from nearby, where nobody speaks (at least
150 ms from any word or voice sound, and unvoiced), blends them into a texture as long as the window, and sets it to
the level just around the window. Where there is not enough of that nearby, it falls back to the steady room tone of
room_tone.py, so no window is left empty. Prints {"filled": n, "toned": n}. Needs only numpy.
"""

import json
import sys

import numpy as np

from room_tone import read_wav, room_tone, write_wav

GUARD_MS = 150  # how far from a word or a voice sound a copied stretch must be
REACH_MS = 6000  # how far from a window to look for stretches to copy
MIN_MATERIAL_MS = 300
GRAIN_MS = (180, 380)
FADE_MS = 30
EDGE_MS = 80  # the texture runs a little past the window, under the fades
FRAME_MS = 20
VOICED_CORRELATION = 0.5
SEED = 5


def unvoiced(frame, rate):
    """True when a frame has no clear pitch: noise, not a voice."""
    frame = frame - frame.mean()
    energy = np.dot(frame, frame)
    if energy <= 1e-12:
        return True
    ac = np.correlate(frame, frame, "full")[len(frame) - 1 :] / energy
    lo, hi = int(rate / 700), min(len(ac) - 1, int(rate / 70))
    return ac[lo:hi].max() < VOICED_CORRELATION


def free_material(voice, rate, busy_mask, a, b):
    """Stretches of the voice track between a and b (samples) that are neither speech nor voiced."""
    frame = int(rate * FRAME_MS / 1000)
    stretches, start = [], None
    for s in range(max(0, a), min(len(voice), b) - frame, frame):
        ok = not busy_mask[s : s + frame].any() and unvoiced(voice[s : s + frame : 2], rate / 2)
        if ok and start is None:
            start = s
        elif not ok and start is not None:
            stretches.append((start, s))
            start = None
    if start is not None:
        stretches.append((start, min(len(voice), b)))
    return [(x, y) for x, y in stretches if y - x >= int(rate * 0.12)]


def texture(voice, rate, stretches, length, rng):
    """Random grains of the free stretches, crossfaded end to end."""
    fade = int(rate * FADE_MS / 1000)
    out = np.zeros(length + fade)
    ramp = np.linspace(0, 1, fade)
    at = 0
    while at < length:
        x, y = stretches[rng.integers(len(stretches))]
        grain = int(rate * rng.uniform(*GRAIN_MS) / 1000)
        grain = min(grain, y - x)
        start = rng.integers(x, y - grain + 1)
        piece = voice[start : start + grain].copy()
        if len(piece) > 2 * fade:
            piece[:fade] *= ramp
            piece[-fade:] *= ramp[::-1]
        end = min(len(out), at + len(piece))
        out[at:end] += piece[: end - at]
        at += max(1, len(piece) - fade)
    return out[:length]


def rms(x):
    return float(np.sqrt(np.mean(x**2))) if x.size else 0.0


def main(argv):
    if len(argv) != 6:
        raise SystemExit(__doc__)
    original_path, background_path, voice_path, request_path, output_path = argv[1:]
    rate, original = read_wav(original_path)
    _, background = read_wav(background_path)
    voice_rate, voice_stereo = read_wav(voice_path)
    if voice_rate != rate:
        raise SystemExit(f"sample rates differ: {rate} and {voice_rate}")
    voice = voice_stereo.mean(axis=0)
    with open(request_path, encoding="utf-8") as f:
        request = json.load(f)
    windows = request["windows"]
    length = original.shape[1]

    busy = np.zeros(len(voice), bool)
    for start, end in request.get("busy", []) + windows:
        busy[max(0, int((start - GUARD_MS) * rate / 1000)) : int((end + GUARD_MS) * rate / 1000)] = True

    fill = np.zeros(length)
    rng = np.random.default_rng(SEED)
    toned = []
    filled = 0
    edge = int(rate * EDGE_MS / 1000)
    for start, end in windows:
        a, b = max(0, int(start * rate / 1000) - edge), min(length, int(end * rate / 1000) + edge)
        reach = int(rate * REACH_MS / 1000)
        stretches = free_material(voice, rate, busy, a - reach, b + reach)
        material = sum(y - x for x, y in stretches)
        if material < int(rate * MIN_MATERIAL_MS / 1000):
            toned.append({"startMs": start, "endMs": end})
            continue
        # The level just around the window, from the closest free stretches.
        near = sorted(stretches, key=lambda s: min(abs(s[0] - b), abs(s[1] - a)))[:4]
        level = rms(np.concatenate([voice[x:y] for x, y in near]))
        grains = texture(voice, rate, stretches, b - a, rng)
        fill[a:b] += grains * (level / max(rms(grains), 1e-9))
        filled += 1

    if toned:
        tone = room_tone(original, background, toned, rate)
        if tone is not None:
            for w in toned:
                a, b = max(0, int(w["startMs"] * rate / 1000) - edge), min(length, int(w["endMs"] * rate / 1000) + edge)
                fill[a:b] += tone[a:b]

    write_wav(output_path, rate, np.tile(fill, (original.shape[0], 1)))
    print(json.dumps({"filled": filled, "toned": len(toned)}))


if __name__ == "__main__":
    main(sys.argv)
