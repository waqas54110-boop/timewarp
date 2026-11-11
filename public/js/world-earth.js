// Live World planet: the whole Earth around the town. Real coastlines and countries, sea, desert, jungle, snow and mountains.
//   media/world-ids.png  R biome, G country, B height hint        media/world-sdf.png  smooth coastline
//   data/countries.json  names + capitals                           data/cities.json     big cities
// Coordinates: x = east, z = south, 1 degree = S units. The town sits at (0,0) = the destination's latitude / longitude.
import { mergeGeometries } from '/vendor/three-addons/utils/BufferGeometryUtils.js';

export const S = 50, HMAX = 160, TW = 4096, TH2 = 2048;
export const BIOME = { sea: 0, grass: 1, forest: 2, jungle: 3, savanna: 4, desert: 5, rock: 6, snow: 7, tundra: 8 };
const BIOME_NAMES = ['sea', 'grassland', 'forest', 'jungle', 'savanna', 'desert', 'mountains', 'snow and ice', 'tundra'];

export async function createEarth(c) {
  const { THREE, scene, camera, renderer, root, mode, solids, tickerEl } = c;
  const lat0 = Number.isFinite(c.lat) ? c.lat : 31.55, lng0 = Number.isFinite(c.lng) ? c.lng : 74.34;
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });
  const [idImg, sdfImg, countries, cities] = await Promise.all([loadImg('/media/world-ids.png'), loadImg('/media/world-sdf.png'), fetch('/data/countries.json').then((r) => r.json()), fetch('/data/cities.json').then((r) => r.json())]);
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH2; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(idImg, 0, 0);
  const ids = new Uint8Array(cx.getImageData(0, 0, TW, TH2).data.buffer.slice(0));
  const idTex = new THREE.DataTexture(ids, TW, TH2, THREE.RGBAFormat); idTex.magFilter = idTex.minFilter = THREE.NearestFilter; idTex.wrapS = THREE.RepeatWrapping; idTex.needsUpdate = true;
  const sdfTex = new THREE.Texture(sdfImg); sdfTex.magFilter = sdfTex.minFilter = THREE.LinearFilter; sdfTex.wrapS = THREE.RepeatWrapping; sdfTex.generateMipmaps = false; sdfTex.flipY = false; sdfTex.needsUpdate = true;

  // ---------- coordinate helpers + lookups (the same maths as the shader) ----------
  const toLat = (z) => lat0 - z / S, toLng = (x) => lng0 + x / S, fromLat = (la) => -(la - lat0) * S, fromLng = (lo) => (lo - lng0) * S;
  const WX0 = fromLng(-180), WX1 = fromLng(180), WZ0 = fromLat(90), WZ1 = fromLat(-90);
  const clampWorld = (p) => { p.x = Math.max(WX0 + 5, Math.min(WX1 - 5, p.x)); p.z = Math.max(WZ0 + 5, Math.min(WZ1 - 5, p.z)); };
  const texel = (x, z) => { const u = (toLng(x) + 180) / 360 * TW - 0.5, v = (90 - toLat(z)) / 180 * TH2 - 0.5; return [u, v]; };
  const px = (i, j) => { i = ((i % TW) + TW) % TW; j = Math.max(0, Math.min(TH2 - 1, j)); return (j * TW + i) * 4; };
  function at(x, z) { const [u, v] = texel(x, z), k = px(Math.round(u), Math.round(v)); return { biome: ids[k], country: ids[k + 1] }; }
  const isWater = (x, z) => at(x, z).biome === 0;
  function heightAt(x, z) {
    const [u, v] = texel(x, z), i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, g = (a, b) => ids[px(a, b) + 2] / 255;
    let h = (g(i, j) * (1 - fx) + g(i + 1, j) * fx) * (1 - fy) + (g(i, j + 1) * (1 - fx) + g(i + 1, j + 1) * fx) * fy;
    h = Math.max(0, Math.min(1, (h - 0.14) / 0.86)); const r = Math.hypot(x, z), t = Math.max(0, Math.min(1, (r - 300) / 600));
    return h * HMAX * t * t * (3 - 2 * t);
  }
  const countryName = (id) => (id ? countries[id - 1].n : '');
  const flatOf = (id) => (id ? countries[id - 1].f : '');

  // ---------- terrain: displaced clip-map grids that follow you + one huge flat plane for the rest of the planet ----------
  const tint = mode === 'past' ? [1.0, 0.9, 0.74] : mode === 'future' ? [0.55, 0.62, 0.95] : [1, 1, 1];
  const U = { tIds: { value: idTex }, tSdf: { value: sdfTex }, uOrg: { value: new THREE.Vector2(lng0, lat0) }, uS: { value: S }, uTime: { value: 0 }, uTint: { value: new THREE.Vector3(...tint) }, uH: { value: HMAX } };
  const GL_COMMON = `
    uniform highp sampler2D tIds; uniform sampler2D tSdf; uniform vec2 uOrg; uniform float uS, uTime, uH;
    vec2 toUV(vec2 p){ float lng=uOrg.x+p.x/uS, lat=uOrg.y-p.y/uS; return vec2((lng+180.)/360.,(90.-lat)/180.); }
    vec4 idAt(ivec2 i){ i.x=((i.x%4096)+4096)%4096; i.y=clamp(i.y,0,2047); return texelFetch(tIds,i,0); }
    float hAt(vec2 p){
      vec2 tc=toUV(p)*vec2(4096.,2048.)-0.5; ivec2 i=ivec2(floor(tc)); vec2 f=fract(tc);
      float h=mix(mix(idAt(i).b,idAt(i+ivec2(1,0)).b,f.x),mix(idAt(i+ivec2(0,1)).b,idAt(i+ivec2(1,1)).b,f.x),f.y);
      h=clamp((h-0.14)/0.86,0.,1.); float t=clamp((length(p)-300.)/600.,0.,1.); return h*uH*t*t*(3.-2.*t);
    }`;
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = GL_COMMON + 'varying vec3 vW; varying float vH;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec2 wp0=(modelMatrix*vec4(position,1.)).xz; float e=3.;
        float hc=hAt(wp0); vec3 objectNormal=normalize(vec3(hAt(wp0-vec2(e,0.))-hAt(wp0+vec2(e,0.)),2.*e,hAt(wp0-vec2(0.,e))-hAt(wp0+vec2(0.,e))));`)
      .replace('#include <begin_vertex>', 'vec3 transformed=vec3(position.x,position.y+hc,position.z); vH=hc;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = GL_COMMON + `
      uniform vec3 uTint; varying vec3 vW; varying float vH;
      float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ return vn(p)*.5+vn(p*2.1)*.3+vn(p*4.3)*.2; }
      vec3 biomeCol(int b, vec2 p, float n1, float n2, float h){
        if(b==1) return mix(vec3(.30,.52,.20),vec3(.42,.60,.24),n1)*(.85+.3*n2);
        if(b==2) return mix(vec3(.10,.28,.12),vec3(.17,.38,.15),n1)*(.7+.5*vn(p*1.7));
        if(b==3) return mix(vec3(.03,.22,.07),vec3(.07,.33,.10),n1)*(.6+.6*vn(p*1.3));
        if(b==4) return mix(vec3(.56,.50,.25),vec3(.42,.47,.20),n1)*(.85+.3*n2);
        if(b==5){ float d=sin((p.x*.9+p.y*.4)*.06+n1*7.)*.5+.5; return mix(vec3(.82,.66,.38),vec3(.93,.80,.55),d)*(.9+.2*n2); }
        if(b==6){ float s=sin(h*.35+n2*3.)*.5+.5; return mix(vec3(.36,.32,.29),vec3(.55,.50,.45),s*n1+n2*.3); }
        if(b==7) return mix(vec3(.88,.92,.97),vec3(1.),n1);
        return mix(vec3(.42,.45,.34),vec3(.55,.56,.45),n1)*(.9+.2*n2);
      }
      ` + sh.fragmentShader.replace('#include <color_fragment>', `
        vec2 wp=vW.xz; float n1=fbm(wp*.012), n2=fbm(wp*.09);
        vec2 jit=(vec2(vn(wp*.7),vn(wp*.7+9.))-.5)*1.3;
        vec2 tc=toUV(wp)*vec2(4096.,2048.)-0.5+jit; ivec2 i0=ivec2(floor(tc)); vec2 f=fract(tc); f=f*f*(3.-2.*f);
        vec3 acc=vec3(0.); float wsum=0.; float cids[4];
        for(int k=0;k<4;k++){ ivec2 o=ivec2(k&1,k>>1); vec4 d=idAt(i0+o); int bb=int(d.r*255.+.5); cids[k]=d.g*255.;
          float w=(o.x==1?f.x:1.-f.x)*(o.y==1?f.y:1.-f.y); if(bb>0){ acc+=w*biomeCol(bb,wp,n1,n2,vH); wsum+=w; } }
        vec3 land=wsum>.01?acc/wsum:biomeCol(1,wp,n1,n2,vH);
        vec2 fr=fract(tc);
        bool bx0=cids[0]!=cids[1]&&cids[0]>0.&&cids[1]>0., bx1=cids[2]!=cids[3]&&cids[2]>0.&&cids[3]>0.;
        bool by0=cids[0]!=cids[2]&&cids[0]>0.&&cids[2]>0., by1=cids[1]!=cids[3]&&cids[1]>0.&&cids[3]>0.;
        float edge=0.;
        if(fr.y<.5?bx0:bx1) edge=max(edge,1.-smoothstep(0.,.08,abs(fr.x-.5)));
        if(fr.x<.5?by0:by1) edge=max(edge,1.-smoothstep(0.,.08,abs(fr.y-.5)));
        land=mix(land,vec3(.55,.18,.15),edge*.5);
        vec2 suv=toUV(wp); float sd=texture(tSdf,suv).r; float shore=1.-smoothstep(.49,.5,sd);
        float wv=vn(wp*.35+uTime*.6)+vn(wp*.9-uTime*.4);
        vec3 deep=vec3(.03,.16,.36), shal=vec3(.10,.50,.62);
        vec3 sea=mix(shal,deep,1.-smoothstep(.30,.5,sd))*(.9+.18*wv);
        float foam=(1.-smoothstep(.50,.52,sd))*smoothstep(.47,.50,sd)*(.6+.4*sin(uTime*2.+wv*6.));
        sea=mix(sea,vec3(1.),foam*.55);
        vec3 col=mix(land,sea,shore);
        diffuseColor.rgb*=col*uTint*.8; `);
  };
  const mkGrid = (size, seg) => { const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2); return g; };
  const lv0 = new THREE.Mesh(mkGrid(900, 180), mat), lv1 = new THREE.Mesh(mkGrid(5000, 200), mat);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(WX1 - WX0 + 4000, WZ1 - WZ0 + 4000, 1, 1).rotateX(-Math.PI / 2), mat);
  far.position.set((WX0 + WX1) / 2, -2.2, (WZ0 + WZ1) / 2); lv1.position.y = -1.1; lv0.position.y = -0.3;
  [lv0, lv1, far].forEach((m) => { m.frustumCulled = false; m.matrixAutoUpdate = true; scene.add(m); });
  const snap = (m, step, p) => { m.position.x = Math.round(p.x / step) * step; m.position.z = Math.round(p.z / step) * step; };

  // ---------- labels (sprites made on demand) ----------
  const labelCache = new Map();
  function label(text, big) {
    if (!labelCache.has(text)) {
      const w = 512, h = 96, cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h; const g = cvs.getContext('2d');
      g.font = `bold ${big ? 54 : 44}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 9; g.strokeStyle = '#0b1220'; g.strokeText(text, w / 2, h / 2, 500); g.fillStyle = big ? '#fde68a' : '#fff'; g.fillText(text, w / 2, h / 2, 500);
      const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; labelCache.set(text, new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    }
    const sp = new THREE.Sprite(labelCache.get(text)); sp.scale.set(big ? 420 : 240, big ? 79 : 45, 1); sp.renderOrder = 5; return sp;
  }
  const labels = new Map();   // key -> sprite
  const countryList = countries.filter((q) => q.la !== null && q.px > 90).map((q) => ({ key: 'c' + q.i, text: q.f + ' ' + q.n, x: fromLng(q.lo), z: fromLat(q.la), big: true }));
  const cityList = cities.map((q) => ({ key: 'k' + q.n, text: q.n, x: fromLng(q.lng), z: fromLat(q.lat), big: false, s: q.s }));
  const capList = countries.filter((q) => q.c && q.lat !== null).map((q) => ({ n: q.c, cc: q.n, x: fromLng(q.lng), z: fromLat(q.lat), s: 2, cap: true }));

  // ---------- cities: skyline boxes (also solid for aeroplanes), runway, streamed in when you are near ----------
  const allCities = [...cities.map((q) => ({ n: q.n, x: fromLng(q.lng), z: fromLat(q.lat), s: q.s })), ...capList.filter((q) => !cities.some((k) => Math.hypot(fromLng(k.lng) - q.x, fromLat(k.lat) - q.z) < 60))];
  const hash = (a, b) => { let h = (Math.imul(Math.floor(a) | 0, 374761393) + Math.imul(Math.floor(b) | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const rngOf = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const winTex = (() => { const k = document.createElement('canvas'); k.width = 64; k.height = 128; const g = k.getContext('2d'); g.fillStyle = '#9aa7b8'; g.fillRect(0, 0, 64, 128); for (let y = 6; y < 124; y += 12) for (let x = 5; x < 60; x += 12) { g.fillStyle = Math.random() < 0.6 ? '#3b5878' : '#e8d9a0'; g.fillRect(x, y, 7, 7); } const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const cityMat = new THREE.MeshLambertMaterial({ map: winTex, color: 0xffffff });
  const rwTex = (() => { const k = document.createElement('canvas'); k.width = 64; k.height = 512; const g = k.getContext('2d'); g.fillStyle = '#2c2f36'; g.fillRect(0, 0, 64, 512); g.fillStyle = '#f5f5f5'; for (let y = 20; y < 500; y += 44) g.fillRect(30, y, 4, 24); g.fillRect(3, 0, 3, 512); g.fillRect(58, 0, 3, 512); const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const rwMat = new THREE.MeshLambertMaterial({ map: rwTex });
  const loadedCities = new Map();
  function buildCity(ct) {
    const r = rngOf(Math.floor(ct.x * 7 + ct.z * 13)), grp = new THREE.Group(), n = 16 + ct.s * 26, R = 26 + ct.s * 16, mine = [];
    const im = new THREE.InstancedMesh(boxG, cityMat, n), m4 = new THREE.Matrix4(), col = new THREE.Color();
    const pal = [0xcbd5e1, 0xb8c2d0, 0xd6c7ad, 0x9fb3c8, 0xe2e8f0];
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * R, w = 5 + r() * 8, dd = 5 + r() * 8, core = 1 - d / R;
      const h = 8 + r() * 14 + (r() * r) * ct.s * 55 * core * core, x = ct.x + Math.cos(a) * d, z = ct.z + Math.sin(a) * d;
      m4.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, dd)); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(pal[(r() * pal.length) | 0]));
      const so = { minX: x - w / 2, maxX: x + w / 2, minZ: z - dd / 2, maxZ: z + dd / 2, h, roof: true }; solids.push(so); mine.push(so);
    }
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; grp.add(im);
    const ang = r() * 3.14, wrap = new THREE.Group(), rw = new THREE.Mesh(new THREE.PlaneGeometry(26, 420), rwMat); rw.rotation.x = -Math.PI / 2; wrap.add(rw);
    wrap.position.set(ct.x + Math.cos(ang) * (R + 150), 0.06, ct.z + Math.sin(ang) * (R + 150)); wrap.rotation.y = ang; grp.add(wrap);
    const ax = Math.sin(ang), az = Math.cos(ang), rideList = [];
    if (c.spawnRide) { rideList.push(c.spawnRide('plane', wrap.position.x - ax * 170, wrap.position.z - az * 170, ang - Math.PI / 2)); rideList.push(c.spawnRide('heli', wrap.position.x + az * 40 - ax * 150, wrap.position.z - ax * 40 - az * 150, ang - Math.PI / 2)); }
    scene.add(grp); return { grp, mine, rideList };
  }

  // ---------- trees, cactus, rocks, villages around you ----------
  const CELL = 300, TREE_R = 650;
  const colG = (geo, hex) => { const g = geo.clone(), n = g.attributes.position.count, a = new Float32Array(n * 3), k = new THREE.Color(hex); for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
  const T = (g, x, y, z) => g.translate(x, y, z);
  const prop = {
    broad: mergeGeometries([T(colG(new THREE.CylinderGeometry(0.4, 0.55, 5, 5), 0x5b3f26), 0, 2.5, 0), T(colG(new THREE.SphereGeometry(3, 7, 5), 0x3f8f3a), 0, 7, 0)]),
    pine: mergeGeometries([T(colG(new THREE.CylinderGeometry(0.3, 0.45, 3, 5), 0x4a3320), 0, 1.5, 0), T(colG(new THREE.ConeGeometry(2.6, 9, 6), 0x1f5a34), 0, 7, 0)]),
    palm: mergeGeometries([T(colG(new THREE.CylinderGeometry(0.4, 0.7, 14, 5), 0x6b4a2a), 0, 7, 0), T(colG(new THREE.SphereGeometry(4.5, 7, 4), 0x1a7a2e), 0, 14.5, 0)]),
    acacia: mergeGeometries([T(colG(new THREE.CylinderGeometry(0.3, 0.5, 5, 5), 0x6b5030), 0, 2.5, 0), T(colG(new THREE.CylinderGeometry(4.2, 3, 1.2, 8), 0x6f8f35), 0, 5.4, 0)]),
    cactus: mergeGeometries([T(colG(new THREE.CylinderGeometry(0.5, 0.6, 5, 6), 0x3f7a3a), 0, 2.5, 0), T(colG(new THREE.CylinderGeometry(0.3, 0.3, 2, 5), 0x3f7a3a), 1, 3.2, 0)]),
    rock: colG(new THREE.DodecahedronGeometry(1.6, 0), 0x8a8379),
  };
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cells = new Map();
  const DENS = { 1: [['broad', 0.05]], 2: [['broad', 0.35], ['pine', 0.35]], 3: [['palm', 0.9], ['broad', 0.25]], 4: [['acacia', 0.05]], 5: [['cactus', 0.012], ['rock', 0.015]], 6: [['rock', 0.2], ['pine', 0.05]], 7: [['pine', 0.03]], 8: [['pine', 0.03], ['rock', 0.02]] };
  function buildCell(ix, iz) {
    const r = rngOf(ix * 73856093 ^ iz * 19349663), buckets = {}, grp = new THREE.Group(), houses = [];
    const x0 = ix * CELL, z0 = iz * CELL;
    for (let k = 0; k < 520; k++) {
      const x = x0 + r() * CELL, z = z0 + r() * CELL; if (Math.hypot(x, z) < 260) continue;
      const a = at(x, z), t = DENS[a.biome]; if (!t) continue;
      for (const [name, p] of t) if (r() < p) { (buckets[name] = buckets[name] || []).push([x, z, 0.7 + r() * 0.9, r()]); break; }
    }
    const a0 = at(x0 + CELL / 2, z0 + CELL / 2).biome, vh = hash(ix, iz);
    if (a0 !== 0 && a0 !== 7 && a0 !== 6 && vh < 0.12 && Math.hypot(x0, z0) > 400) for (let i = 0; i < 5 + ((vh * 80) | 0); i++) { const x = x0 + 60 + r() * (CELL - 120), z = z0 + 60 + r() * (CELL - 120); if (at(x, z).biome) houses.push([x, z, 5 + r() * 3, 3 + r() * 2.5, 5 + r() * 3]); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (const [name, list] of Object.entries(buckets)) {
      const im = new THREE.InstancedMesh(prop[name], propMat, list.length);
      list.forEach(([x, z, s, v], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), v * 6.28); m4.compose(new THREE.Vector3(x, heightAt(x, z), z), q, new THREE.Vector3(s, s * (0.8 + v * 0.5), s)); im.setMatrixAt(i, m4); im.setColorAt(i, c.setScalar(0.8 + v * 0.35)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = true; grp.add(im);
    }
    if (houses.length) {
      const im = new THREE.InstancedMesh(boxG, cityMat, houses.length);
      houses.forEach(([x, z, w, h, d], i) => { m4.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); im.setMatrixAt(i, m4); im.setColorAt(i, c.set([0xe8d5b0, 0xd9a88a, 0xcfd8dc, 0xe9e1c9][(hash(x, z) * 4) | 0])); });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; grp.add(im);
    }
    scene.add(grp); return grp;
  }

  // ---------- waypoint + HUD + world map ----------
  let wp = null;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3000, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.35, fog: false, depthWrite: false, side: THREE.DoubleSide })); beam.visible = false; scene.add(beam);
  const chip = document.createElement('div'); chip.className = 'earth-chip'; chip.setAttribute('role', 'status');
  chip.style.cssText = 'position:absolute;left:50%;top:62px;transform:translateX(-50%);z-index:6;background:#0b1230d9;color:#fff;border:1px solid #ffffff33;border-radius:999px;padding:6px 14px;font:600 14px/1.3 system-ui,sans-serif;pointer-events:none;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis';
  root.appendChild(chip);
  const mapBtn = document.createElement('button'); mapBtn.type = 'button'; mapBtn.className = 'btn ghost'; mapBtn.textContent = '🌍 Map (M)'; const top = root.querySelector('.explore-top'); (top || root).appendChild(mapBtn);
  const ov = document.createElement('div'); ov.hidden = true; ov.style.cssText = 'position:absolute;inset:0;z-index:30;background:#050a1ae6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px';
  const mc = document.createElement('canvas'); mc.width = 2048; mc.height = 1024; mc.style.cssText = 'max-width:96vw;max-height:78vh;aspect-ratio:2/1;border-radius:10px;cursor:crosshair;background:#1d4e9a';
  const mi = document.createElement('p'); mi.style.cssText = 'margin:0;color:#fff;font:600 15px system-ui,sans-serif;text-align:center'; mi.textContent = 'Click a country or a city to set your GPS. Press M or Esc to close.';
  const mclose = document.createElement('button'); mclose.type = 'button'; mclose.className = 'btn ghost'; mclose.textContent = 'Close map';
  ov.append(mc, mi, mclose); root.appendChild(ov);
  const PAL = [[29, 78, 154], [110, 160, 70], [40, 100, 50], [10, 70, 30], [170, 170, 80], [225, 200, 130], [130, 120, 110], [245, 250, 255], [150, 160, 130]];
  let mapBase = null, mapPlayer = { x: 0, z: 0 };
  function drawMapBase() {
    if (mapBase) return; mapBase = document.createElement('canvas'); mapBase.width = 2048; mapBase.height = 1024; const g = mapBase.getContext('2d'), im = g.createImageData(2048, 1024);
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 2048; x++) { const k = ((y * 2) * TW + x * 2) * 4, p = PAL[ids[k]] || PAL[0], o = (y * 2048 + x) * 4; im.data[o] = p[0]; im.data[o + 1] = p[1]; im.data[o + 2] = p[2]; im.data[o + 3] = 255; }
    g.putImageData(im, 0, 0); g.font = 'bold 20px Arial'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#0008'; g.fillStyle = '#fff';
    countries.forEach((q) => { if (q.la !== null && q.px > 1500) { const X = (q.lo + 180) / 360 * 2048, Y = (90 - q.la) / 180 * 1024; g.strokeText(q.n, X, Y); g.fillText(q.n, X, Y); } });
  }
  function paintMap() {
    drawMapBase(); const g = mc.getContext('2d'); g.drawImage(mapBase, 0, 0);
    const P = (x, z) => [(toLng(x) + 180) / 360 * 2048, (90 - toLat(z)) / 180 * 1024];
    g.fillStyle = '#fde68a'; cities.forEach((q) => { const X = (q.lng + 180) / 360 * 2048, Y = (90 - q.lat) / 180 * 1024; g.fillRect(X - 2, Y - 2, 4, 4); });
    const [X, Y] = P(mapPlayer.x, mapPlayer.z); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.arc(X, Y, 9, 0, 7); g.fill(); g.stroke();
    if (wp) { const [a, b] = P(wp.x, wp.z); g.strokeStyle = '#facc15'; g.lineWidth = 4; g.beginPath(); g.arc(a, b, 14, 0, 7); g.stroke(); g.setLineDash([10, 8]); g.beginPath(); g.moveTo(X, Y); g.lineTo(a, b); g.stroke(); g.setLineDash([]); }
  }
  function setWaypoint(x, z, name) { wp = { x, z, name }; beam.position.set(x, 1500, z); beam.visible = true; tickerEl && (tickerEl.textContent = `GPS set: ${name}. Fly there with the helicopter or aeroplane.`); }
  function clearWaypoint() { wp = null; beam.visible = false; }
  mc.addEventListener('click', (e) => {
    const r = mc.getBoundingClientRect(), lng = (e.clientX - r.left) / r.width * 360 - 180, lat = 90 - (e.clientY - r.top) / r.height * 180;
    let best = null, bd = 3.2; cities.forEach((q) => { const d = Math.hypot(q.lat - lat, (q.lng - lng) * Math.cos(lat * Math.PI / 180)); if (d < bd) { bd = d; best = { n: q.n, x: fromLng(q.lng), z: fromLat(q.lat) }; } });
    if (!best) { const a = at(fromLng(lng), fromLat(lat)), q = a.country ? countries[a.country - 1] : null; if (q) best = { n: `${q.c || q.n}, ${q.n}`, x: fromLng(q.lng ?? lng), z: fromLat(q.lat ?? lat) }; else { best = { n: 'open sea', x: fromLng(lng), z: fromLat(lat) }; } }
    setWaypoint(best.x, best.z, best.n); paintMap();
  });
  const toggleMap = (v) => { ov.hidden = v === undefined ? !ov.hidden : !v; if (!ov.hidden) paintMap(); };
  mapBtn.addEventListener('click', () => toggleMap()); mclose.addEventListener('click', () => toggleMap(false));
  addEventListener('keydown', (e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return; if (e.code === 'KeyM') toggleMap(); else if (e.key === 'Escape' && !ov.hidden) toggleMap(false); else if (e.code === 'KeyG') clearWaypoint(); });

  // ---------- per frame ----------
  let tt = 0, hudT = 0, cellT = 0, labelT = 0, nearC = null, lastNear = 0, baseFog = null, lastNearPlane = 0.1;
  const dirName = (dx, dz) => ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  function update(dt, p, alt) {
    tt += dt; U.uTime.value = tt; mapPlayer = p;
    snap(lv0, 30, p); snap(lv1, 100, p);
    // streaming: cells, cities, labels (a little each frame so nothing stutters)
    if ((cellT -= dt) <= 0) {
      cellT = 0.35; const ix = Math.floor(p.x / CELL), iz = Math.floor(p.z / CELL), rr = Math.ceil(TREE_R / CELL), want = new Set();
      if (alt < 250) for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) want.add(a + ix + ',' + (b + iz));
      for (const [k, g] of cells) if (!want.has(k)) { scene.remove(g); g.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); cells.delete(k); }
      for (const k of want) if (!cells.has(k)) { const [a, b] = k.split(',').map(Number); cells.set(k, buildCell(a, b)); break; }   // one cell per tick
      for (const ct of allCities) {
        const d = Math.hypot(ct.x - p.x, ct.z - p.z), has = loadedCities.has(ct);
        if (d < 2600 && !has && Math.hypot(ct.x, ct.z) > 420) { loadedCities.set(ct, buildCity(ct)); break; }
        if (d > 3600 && has) { const L = loadedCities.get(ct); scene.remove(L.grp); L.rideList.forEach((r) => c.removeRide && c.removeRide(r)); L.mine.forEach((s) => { const i = solids.indexOf(s); if (i >= 0) solids.splice(i, 1); }); loadedCities.delete(ct); }
      }
    }
    if ((labelT -= dt) <= 0) {
      labelT = 0.6; const want = new Map();
      [...countryList, ...cityList].forEach((l) => { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < (l.big ? 2600 : 1600)) want.set(l.key, [l, d]); });
      for (const [k, sp] of labels) if (!want.has(k)) { scene.remove(sp); labels.delete(k); }
      for (const [k, [l]] of want) if (!labels.has(k) && labels.size < 16) { const sp = label(l.text, l.big); sp.position.set(l.x, l.big ? 380 : 160 + (l.s || 1) * 20, l.z); scene.add(sp); labels.set(k, sp); }
    }
    if ((hudT -= dt) <= 0) {
      hudT = 0.25; const a = at(p.x, p.z), la = toLat(p.z), lo = toLng(p.x);
      let place = a.biome === 0 ? 'Open sea' : `${flatOf(a.country)} ${countryName(a.country)}`; let near = null, nd = 1e9;
      allCities.forEach((ct) => { const d = Math.hypot(ct.x - p.x, ct.z - p.z); if (d < nd) { nd = d; near = ct; } });
      const inTown = Math.hypot(p.x, p.z) < 260, bn = a.biome === 0 ? '' : ` · ${BIOME_NAMES[a.biome]}`, cityTxt = inTown ? ` · ${c.place || 'Town'}` : near && nd < 140 ? ` · ${near.n}` : '';
      let txt = `${place}${cityTxt}${bn} · ${Math.abs(la).toFixed(1)}°${la >= 0 ? 'N' : 'S'} ${Math.abs(lo).toFixed(1)}°${lo >= 0 ? 'E' : 'W'}${alt > 3 ? ` · ${Math.round(alt)} m` : ''}`;
      if (wp) { const d = Math.hypot(wp.x - p.x, wp.z - p.z); txt += ` · ➤ ${wp.name} ${d > 1000 ? (d / 1000).toFixed(1) + 'k' : Math.round(d)} (${dirName(wp.x - p.x, wp.z - p.z)})`; if (d < 40) { clearWaypoint(); tickerEl && (tickerEl.textContent = 'You reached your GPS destination!'); } }
      chip.textContent = txt;
    }
    const np = alt > 60 ? 1.2 : 0.1; if (np !== lastNearPlane) { lastNearPlane = np; camera.near = np; camera.updateProjectionMatrix(); }
    if (camera.far < 9000) { camera.far = 9000; camera.updateProjectionMatrix(); }
  }
  let sceneFog = 0;   // fog thins out when you fly high so you can see the planet
  const beforeRender = (alt) => { if (!scene.fog) return; sceneFog = scene.fog.density; scene.fog.density = sceneFog * (1 - 0.86 * Math.max(0, Math.min(1, (alt - 20) / 220))); };
  const afterRender = () => { if (scene.fog) scene.fog.density = sceneFog; };
  const cityAt = (x, z) => { let b = null, bd = 1e9; allCities.forEach((ct) => { const d = Math.hypot(ct.x - x, ct.z - z); if (d < bd) { bd = d; b = ct; } }); return { city: b, d: bd }; };
  return { S, lat0, lng0, WX0, WX1, WZ0, WZ1, clampWorld, at, isWater, heightAt, toLat, toLng, fromLat, fromLng, countryName, update, beforeRender, afterRender, setWaypoint, clearWaypoint, toggleMap, cityAt, allCities, countries, cities, ids, loadedCities, get waypoint() { return wp; } };
}
