// Builds the avatar's head texture from the visitor's own photo. Runs only in the browser:
// the photo is never uploaded or stored anywhere.
(function (root) {
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  // Average colour of a small patch around the middle of the face (cheeks/nose), used to match neck and hands.
  function averageSkin(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s = Math.min(iw, ih);
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d', { willReadFrequently: true });
    const side = s * 0.18;
    g.drawImage(img, iw / 2 - side / 2, ih / 2 - s * 0.03 - side / 2, side, side, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    return n ? hex(r / n, gg / n, b / n) : '#d9a37e';
  }

  // 1024x512 equirectangular canvas for a sphere head: skin colour everywhere, the photo as a soft oval
  // centred on the front of the head (u = 0.25 on a three.js SphereGeometry looks toward +z).
  // opts.zoom: share of the (square) photo shown, smaller = closer on the face; opts.dx/dy: shift, -0.3..0.3 of the photo.
  function buildHeadCanvas(img, skin, opts) {
    const o = Object.assign({ zoom: 0.62, dx: 0, dy: 0 }, opts || {});
    const W = 1024, H = 512, out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d');
    g.fillStyle = skin || '#d9a37e'; g.fillRect(0, 0, W, H);

    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.min(iw, ih), cs = s * Math.max(0.25, Math.min(1, o.zoom));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const sx = clamp((iw - s) / 2 + (s - cs) / 2 + o.dx * s, 0, iw - cs);
    const sy = clamp((ih - s) * 0.3 + (s - cs) * 0.4 + o.dy * s, 0, ih - cs);
    const F = 320, f = document.createElement('canvas'); f.width = f.height = F;
    const fg = f.getContext('2d');
    fg.drawImage(img, sx, sy, cs, cs, 0, 0, F, F);
    fg.globalCompositeOperation = 'destination-in';                         // feathered oval mask
    fg.translate(F / 2, F / 2); fg.scale(0.82, 1);
    const grad = fg.createRadialGradient(0, 0, 0, 0, 0, F / 2);
    grad.addColorStop(0, '#000'); grad.addColorStop(0.78, '#000'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    fg.fillStyle = grad; fg.fillRect(-F / 2, -F / 2, F, F);
    g.drawImage(f, W * 0.25 - F / 2, H / 2 - F / 2);
    return out;
  }

  // Friendly default face when no photo was chosen.
  function buildDefaultHead(skin) {
    const W = 1024, H = 512, out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d');
    g.fillStyle = skin || '#d9a37e'; g.fillRect(0, 0, W, H);
    const cx = W * 0.25, cy = H / 2;
    g.fillStyle = '#2a1c14';
    [-34, 34].forEach((dx) => { g.beginPath(); g.ellipse(cx + dx, cy - 14, 8, 11, 0, 0, 6.29); g.fill(); });
    g.strokeStyle = '#2a1c14'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy + 22, 26, 0.2, Math.PI - 0.2); g.stroke();
    return out;
  }

  const api = { averageSkin, buildHeadCanvas, buildDefaultHead };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TimeWarpFace = api;
})(typeof window !== 'undefined' ? window : globalThis);
