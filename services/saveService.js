// Save System rules (pure, no database): turns whatever the browser sends into a clean save, or throws a 400-style error.
// One save slot has two parts that are saved separately: the Life Mode life, and the Live World progress.
const Life = require('../public/js/life.js');
const Meta = require('../public/js/meta.js');

const ERAS = ['past', 'present', 'future'];
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const int = (v, a, b, name) => {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.round(n) < a || Math.round(n) > b) throw bad(name + ' is out of range');
  return Math.round(n);
};

// body: { era?, year?, life?, world?: {mode, year, destinationId, x, z, money, mission} }
// returns the columns to write; a part that is missing in the body is left untouched (undefined).
function sanitize(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.life === undefined && b.world === undefined && b.meta === undefined) throw bad('Nothing to save');
  const out = {};
  if (b.life !== undefined) {
    const life = Life.restore(b.life);
    if (!life) throw bad('life is not a valid TimeWarp life');
    out.life = life;
    out.lastMode = 'life';
    out.era = life.era;
    out.year = null;
  }
  if (b.meta !== undefined) out.meta = Meta.sanitize(b.meta, Life.PERKS);
  if (b.world !== undefined) {
    const w = b.world;
    if (!w || typeof w !== 'object') throw bad('world must be an object');
    if (!ERAS.includes(w.mode)) throw bad('world.mode must be past, present or future');
    out.lastMode = 'world';
    out.era = w.mode;
    out.year = int(w.year, -5000, 3000, 'world.year');
    out.destinationId = w.destinationId ? int(w.destinationId, 1, 1e12, 'world.destinationId') : null;
    out.position = { mode: w.mode, x: int(w.x === undefined ? 0 : w.x, -2000, 2000, 'world.x'), z: int(w.z === undefined ? 0 : w.z, -2000, 2000, 'world.z') };
    out.money = int(w.money === undefined ? 0 : w.money, 0, 1e9, 'world.money');
    out.mission = int(w.mission === undefined ? 0 : w.mission, 0, 1000, 'world.mission');
  }
  return out;
}

// what the browser needs to continue: where to go and the data itself
function present(row) {
  if (!row) return null;
  const world = row.year === null || row.year === undefined || !row.position ? null : {
    mode: row.position.mode || row.era, year: row.year, destinationId: row.destination_id || null, x: row.position.x, z: row.position.z, money: row.money, mission: row.mission_progress,
  };
  return { lastMode: row.last_mode, life: row.life || null, world, meta: row.meta ? Meta.sanitize(row.meta, Life.PERKS) : null, savedAt: row.saved_at };
}

// the link behind the home page "Continue" button
function continueUrl(save) {
  if (!save) return null;
  if (save.lastMode === 'world' && save.world) {
    const w = save.world;
    return '/world?mode=' + w.mode + '&year=' + w.year + (w.destinationId ? '&destinationId=' + w.destinationId : '') + '&continue=1';
  }
  return save.life ? '/life?continue=1' : null;
}

module.exports = { sanitize, present, continueUrl };
