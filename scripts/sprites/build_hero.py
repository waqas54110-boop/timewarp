"""Builds public/media/sprites/hero.png from the GIF walk cycle in scripts/sprites/sheets/hero_walk.gif.

    pip install pillow numpy scipy
    python3 scripts/sprites/build_hero.py

The GIF (side view, green background, 8 frames) is keyed like the other people, every frame is scaled the same,
the feet stay on one line and the torso stays in the middle of its 320 px cell (same atlas layout as male/female/police).
Order of the cells: idle, walk1 ... walk8  (must match FRAMES.hero in public/js/sprite-data.js).
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from build_sprites import key, OUT, CELL_W, CELL_H, STAND_H, PAD_B, COLS

HERE = os.path.dirname(os.path.abspath(__file__))
GIF = os.path.join(HERE, 'sheets', 'hero_walk.gif')


def main():
    gif = Image.open(GIF)
    shots = []
    for i in range(gif.n_frames):
        gif.seek(i)
        tmp = os.path.join(HERE, '_hero_tmp.png'); gif.convert('RGB').save(tmp)
        rgba = key(tmp); os.remove(tmp)
        a = ndi.binary_opening(rgba[..., 3] > 40, iterations=1)
        lab, n = ndi.label(ndi.binary_dilation(a, iterations=5))
        sizes = ndi.sum(a, lab, range(1, n + 1)); comp = (lab == (int(np.argmax(sizes)) + 1)) & a   # the person = biggest blob
        ys, xs = np.where(comp)
        shots.append((rgba, comp, xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = STAND_H / float(np.median([s[5] - s[3] for s in shots]))
    ground = float(np.median([s[5] for s in shots]))
    order = [0] + list(range(len(shots)))                       # idle = the frame with the feet together, then the 8 walk frames
    atlas = Image.new('RGBA', (COLS * CELL_W, ((len(order) + COLS - 1) // COLS) * CELL_H), (0, 0, 0, 0))
    for cell, si in enumerate(order):
        rgba, comp, x0, y0, x1, y1 = shots[si]
        crop = rgba[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(comp[y0:y1, x0:x1], crop[..., 3], 0)
        w, h = int(round(crop.shape[1] * scale)), int(round(crop.shape[0] * scale))
        im = Image.fromarray(crop).resize((w, h), Image.LANCZOS)
        band = (np.asarray(im)[..., 3] > 60)[int(h * 0.12):int(h * 0.55)]
        xs = np.where(band)[1]; ax = float(xs.mean()) if len(xs) else w / 2        # torso centre stays put while the legs swing
        bottom = CELL_H - PAD_B - (ground - y1) * scale
        px = max(0, min(CELL_W - w, int(round(CELL_W / 2 - ax)))); py = max(0, int(round(bottom - h)))
        atlas.alpha_composite(im, ((cell % COLS) * CELL_W + px, (cell // COLS) * CELL_H + py))
    atlas.save(os.path.join(OUT, 'hero.png'), optimize=True)
    print('hero', atlas.size, len(order), 'cells')


if __name__ == '__main__':
    main()
