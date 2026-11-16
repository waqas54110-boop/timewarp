const { wrap } = require('../utils/helpers');
const saves = require('../models/saveModel');
const { sanitize, present } = require('../services/saveService');

// GET /api/load -> { save: {...} | null }
exports.load = wrap(async (req, res) => {
  res.json({ save: present(await saves.get(req.session.user.id)) });
});

// POST /api/save  (CSRF header required, like every other POST)
exports.save = wrap(async (req, res) => {
  const row = await saves.upsert(req.session.user.id, sanitize(req.body));
  res.json({ ok: true, savedAt: row.saved_at });
});

// DELETE /api/save?part=life|world  (no part = everything)
exports.clear = wrap(async (req, res) => {
  const part = req.query.part;
  if (part !== undefined && !['life', 'world'].includes(part)) return res.status(400).json({ error: 'part must be life or world' });
  await saves.clear(req.session.user.id, part);
  res.json({ ok: true });
});
