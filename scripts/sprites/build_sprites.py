"""Builds public/media/sprites/* from the green-screen sheets in scripts/sprites/sheets/.

    pip install pillow numpy scipy
    python3 scripts/sprites/build_sprites.py

People: every pose is cut out, the green is keyed away, all poses of one person are scaled the same and
packed into one atlas (6 columns of 320 px cells, feet on the same line, torso centred) -> male.png, female.png, police.png.
Vehicles: each one is cut out on its own -> v-<name>.png.
The pose ORDER below must match FRAMES in public/js/sprite-data.js.
New sheet? Put it in sheets/, add its row layout to NAMES (people) or its window to VEHICLES, rebuild.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
SHEETS = os.path.join(HERE, 'sheets')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'media', 'sprites'))
CELL_W, CELL_H, STAND_H, PAD_B, COLS = 320, 320, 252, 14, 6

NAMES = {   # rows of the sheet, left to right
    'male': [['idle', 'walk1', 'run1', 'run2', 'run3'], ['guard', 'punch', 'kick', 'slide', 'flykick'], ['hit', 'kneel', 'arms', 'turn', 'back']],
    'female': [['idle', 'walk1', 'walk2', 'walk3', 'run1', 'run2', 'run3'], ['guard', 'guard2', 'punch', 'kick', 'slide', 'flykick'], ['hit', 'kneel', 'arms', 'turn', 'back']],
    'police': [['idle', 'walk1', 'walk2', 'run1', 'run2', 'aim'], ['point', 'radio', 'guard', 'kick', 'kneelaim'], ['back', 'backwalk', 'crawl', 'stop', 'run3']],
}
VEHICLES = {  # name: search window (x0, y0, x1, y1) on vehicles.png
    'sports': (10, 40, 420, 260), 'sedan': (422, 40, 818, 260), 'taxi': (820, 30, 1225, 260), 'police': (1228, 20, 1665, 260),
    'citybus': (20, 290, 592, 590), 'coach': (594, 280, 1172, 590), 'doubledecker': (1174, 270, 1665, 590),
    'rescue': (10, 610, 561, 900), 'military': (562, 610, 1150, 900), 'bluecopter': (1170, 610, 1665, 900),
}


def key(path):
    """Green screen -> transparent. Also removes the dark green floor shadows (the game draws its own shadow)."""
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    m = np.maximum(r, b)
    a1 = np.clip(1.0 - ((g - m) - 40) / 90.0, 0, 1)             # bright screen
    a2 = np.clip(1.0 - ((g / (m + 8.0)) - 1.5) / 1.2, 0, 1)     # dark green (shadows)
    a = np.minimum(a1, a2)
    g2 = np.where(a < 0.999, np.minimum(g, m + 6), g)           # despill the edge
    rgba = np.dstack([r, g2, b, a * 255]).clip(0, 255).astype(np.uint8)
    r, g, b, al = [rgba[..., i].astype(np.float32) for i in range(4)]
    m = np.maximum(r, b)
    edge = ndi.binary_dilation(al < 200, iterations=3) & (al > 0)
    g = np.where(edge, np.minimum(g, m + 2), g)
    g = np.where((g > m + 28) & (al > 0) & edge, m, g)
    rgba[..., 1] = g.clip(0, 255).astype(np.uint8)
    return rgba


def frames(rgba, dil=5, min_area=4000):
    alpha = ndi.binary_opening(rgba[..., 3] > 40, iterations=1)
    lab, _ = ndi.label(ndi.binary_dilation(alpha, iterations=dil))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if (lab[sl] == i + 1).sum() < min_area:
            continue
        comp = (lab == i + 1) & alpha
        ys, xs = np.where(comp)
        out.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, comp))
    return out


def rows_of(fr):
    fr = sorted(fr, key=lambda f: (f[1] + f[3]) / 2)
    rows, cur = [], [fr[0]]
    for f in fr[1:]:
        if (f[1] + f[3]) / 2 - (cur[-1][1] + cur[-1][3]) / 2 > 150:
            rows.append(cur); cur = [f]
        else:
            cur.append(f)
    rows.append(cur)
    return [sorted(r, key=lambda f: f[0]) for r in rows]


def build_person(name, grid):
    rgba = key(os.path.join(SHEETS, f'{name}.png'))
    rows = rows_of(frames(rgba))
    assert [len(r) for r in rows] == [len(g) for g in grid], (name, [len(r) for r in rows])
    scale = STAND_H / (rows[0][0][3] - rows[0][0][1])            # the idle pose is the height reference
    flat = [(nm, f, ri) for ri, (r, g) in enumerate(zip(rows, grid)) for f, nm in zip(r, g)]
    ground = [float(np.median([f[3] for f in r])) for r in rows]  # feet line of each row (jumps stay above it)
    nrows = (len(flat) + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * CELL_W, nrows * CELL_H), (0, 0, 0, 0))
    for i, (nm, f, ri) in enumerate(flat):
        x0, y0, x1, y1, comp = f
        crop = rgba[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(comp[y0:y1, x0:x1], crop[..., 3], 0)
        im = Image.fromarray(crop)
        w, h = max(1, int(round(im.width * scale))), max(1, int(round(im.height * scale)))
        im = im.resize((w, h), Image.LANCZOS)
        band = (np.asarray(im)[..., 3] > 60)[int(h * 0.12):int(h * 0.55)]
        xs = np.where(band)[1]
        ax = float(xs.mean()) if len(xs) else w / 2               # torso centre stays put while arms and legs swing
        bottom = CELL_H - PAD_B - (ground[ri] - y1) * scale
        px = max(0, min(CELL_W - w, int(round(CELL_W / 2 - ax)))); py = max(0, int(round(bottom - h)))
        atlas.alpha_composite(im, ((i % COLS) * CELL_W + px, (i // COLS) * CELL_H + py))
    atlas.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(name, atlas.size, len(flat), 'poses')


def build_vehicles():
    rgba = key(os.path.join(SHEETS, 'vehicles.png'))
    meta = {}
    for name, (x0, y0, x1, y1) in VEHICLES.items():
        sub = rgba[y0:y1, x0:x1]
        ys, xs = np.where(sub[..., 3] > 40)
        crop = Image.fromarray(sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy())
        crop = crop.resize((int(crop.width * 1.5), int(crop.height * 1.5)), Image.LANCZOS)
        crop.save(os.path.join(OUT, f'v-{name}.png'), optimize=True)
        meta[name] = {'w': crop.width, 'h': crop.height}
    json.dump(meta, open(os.path.join(OUT, 'vehicles.json'), 'w'))
    print('vehicles', len(meta))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n, g in NAMES.items():
        build_person(n, g)
    build_vehicles()
