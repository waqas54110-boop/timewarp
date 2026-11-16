// Turns a Mixamo .fbx (character "With Skin", or an animation "Without Skin") into a .glb the Live World can load.
//   node scripts/convert-fbx.js Walking.fbx public/media/models/anims/walk.glb
//   node scripts/convert-fbx.js MyMan.fbx   public/media/models/man.glb
// It installs the converter (fbx2gltf) in a temporary folder the first time (needs internet once).
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.log('Usage: node scripts/convert-fbx.js <input.fbx> <output.glb>'); process.exit(1); }
const tool = path.join(os.tmpdir(), 'tw-fbx2gltf');
const exe = path.join(tool, 'node_modules', 'fbx2gltf', 'bin', process.platform === 'win32' ? 'Windows_NT/FBX2glTF.exe' : process.platform === 'darwin' ? 'Darwin/FBX2glTF' : 'Linux/FBX2glTF');
if (!fs.existsSync(exe)) {
  fs.mkdirSync(tool, { recursive: true });
  fs.writeFileSync(path.join(tool, 'package.json'), '{"name":"tw-fbx2gltf","private":true}');
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', 'fbx2gltf', '--no-audit', '--no-fund'], { cwd: tool, stdio: 'inherit' });
}
if (process.platform !== 'win32') fs.chmodSync(exe, 0o755);
fs.mkdirSync(path.dirname(path.resolve(dst)), { recursive: true });
const out = path.resolve(dst).replace(/\.glb$/i, '');
execFileSync(exe, ['--binary', '--input', path.resolve(src), '--output', out], { stdio: 'inherit' });
console.log('Wrote', out + '.glb');
