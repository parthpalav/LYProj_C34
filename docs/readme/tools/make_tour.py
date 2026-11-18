"""Builds a README tour GIF from screenshots: each shot is held, then cross-fades into the next.

    python3 docs/readme/tools/make_tour.py OUT.gif WIDTH HOLD_MS shot1.png shot2.png ...
"""
import sys
from PIL import Image

FADE_STEPS = 2
FADE_MS = 90


def main():
    out, width, hold = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    shots = []
    for path in sys.argv[4:]:
        im = Image.open(path).convert('RGB')
        shots.append(im.resize((width, round(im.height * width / im.width)), Image.LANCZOS))
    size = shots[0].size
    # Shots of another aspect ratio are cropped from the top (or padded) instead of stretched.
    def fit(s):
        if s.size == size:
            return s
        canvas = Image.new('RGB', size, s.getpixel((0, s.height - 1)))
        canvas.paste(s.crop((0, 0, size[0], min(s.height, size[1]))), (0, 0))
        return canvas
    shots = [fit(s) for s in shots]
    frames, durations = [], []
    for i, shot in enumerate(shots):
        nxt = shots[(i + 1) % len(shots)]
        frames.append(shot)
        durations.append(hold)
        for k in range(1, FADE_STEPS + 1):
            frames.append(Image.blend(shot, nxt, k / (FADE_STEPS + 1)))
            durations.append(FADE_MS)
    palette = [f.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for f in frames]
    palette[0].save(out, save_all=True, append_images=palette[1:], duration=durations, loop=0, optimize=True, disposal=1)
    print(f'{out}: {len(frames)} frames, {size[0]}x{size[1]}')


if __name__ == '__main__':
    main()
