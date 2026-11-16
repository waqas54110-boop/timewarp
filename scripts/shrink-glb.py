#!/usr/bin/env python3
"""Makes Mixamo .glb files light enough for the browser: shrinks the textures inside (4096 px -> 1024 px by default).
   python3 scripts/shrink-glb.py public/media/models/woman.glb public/media/models/woman2.glb
   python3 scripts/shrink-glb.py --size 2048 file.glb        (bigger = sharper, but more memory)
Needs Pillow:  pip install pillow   (or: sudo apt install python3-pil)
The files are rewritten in place; the first time a copy is kept as <name>.orig.glb."""
import io, json, os, shutil, struct, sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is missing. Run:  pip install pillow   (or: sudo apt install python3-pil)')

def read_glb(path):
    d = open(path, 'rb').read()
    magic, ver, _ = struct.unpack('<4sII', d[:12])
    if magic != b'glTF' or ver != 2:
        raise ValueError('not a binary glTF 2.0 file')
    off, js, binc = 12, None, b''
    while off < len(d):
        n, t = struct.unpack('<II', d[off:off + 8]); body = d[off + 8:off + 8 + n]; off += 8 + n
        if t == 0x4E4F534A: js = json.loads(body.decode('utf8'))
        elif t == 0x004E4942 and not binc: binc = body
    return js, binc

def write_glb(path, js, binc):
    j = json.dumps(js, separators=(',', ':')).encode('utf8'); j += b' ' * (-len(j) % 4)
    binc += b'\0' * (-len(binc) % 4)
    total = 12 + 8 + len(j) + 8 + len(binc)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
        f.write(struct.pack('<II', len(binc), 0x004E4942)); f.write(binc)

def shrink(path, size):
    js, binc = read_glb(path)
    views = js.get('bufferViews', []); images = js.get('images', [])
    new_bytes = {}
    for im in images:
        if 'bufferView' not in im: continue          # image stored as a separate file: leave it
        bv = im['bufferView']; v = views[bv]; raw = binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        img = Image.open(io.BytesIO(raw)); img.load()
        if max(img.size) > size:
            r = size / max(img.size); img = img.resize((max(1, round(img.width * r)), max(1, round(img.height * r))), Image.LANCZOS)
        buf = io.BytesIO()
        alpha = img.mode in ('RGBA', 'LA') and img.getchannel('A').getextrema()[0] < 250
        if alpha: img.convert('RGBA').save(buf, 'PNG', optimize=True); im['mimeType'] = 'image/png'     # hair / lashes need transparency
        else: img.convert('RGB').save(buf, 'JPEG', quality=88); im['mimeType'] = 'image/jpeg'
        new_bytes[bv] = buf.getvalue()
    out = bytearray()
    for i, v in enumerate(views):
        data = new_bytes.get(i, binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])
        out += b'\0' * (-len(out) % 4)
        v['byteOffset'] = len(out); v['byteLength'] = len(data); out += data
    js['buffers'] = [{'byteLength': len(out)}]
    keep = path[:-4] + '.orig.glb'
    if not os.path.exists(keep): shutil.copy(path, keep)
    before = os.path.getsize(path); write_glb(path, js, bytes(out))
    print(f'{path}: {before / 1e6:.1f} MB -> {os.path.getsize(path) / 1e6:.1f} MB ({len(new_bytes)} textures)')

if __name__ == '__main__':
    a = sys.argv[1:]; size = 1024
    if '--size' in a: i = a.index('--size'); size = int(a[i + 1]); del a[i:i + 2]
    if not a: sys.exit(__doc__)
    for f in a: shrink(f, size)
