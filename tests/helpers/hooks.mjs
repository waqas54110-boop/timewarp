// Test-only module loader: lets sprites.js run in plain Node (no browser, no real Three.js).
const pub = new URL('../../public', import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === '/vendor/three/three.module.js') return { url: new URL('./three-stub.mjs', import.meta.url).href, shortCircuit: true };
  if (spec.startsWith('/js/models.js')) return { url: new URL('./models-stub.mjs', import.meta.url).href, shortCircuit: true };   // real 3D people need WebGL; the tests use the pictures
  if (spec.startsWith('/js/')) return { url: pub + spec.split('?')[0], shortCircuit: true };
  return next(spec, ctx);
}
