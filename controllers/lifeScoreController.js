const { wrap } = require('../utils/helpers');
const scores = require('../models/lifeScoreModel');
const { entry } = require('../services/lifeScoreService');

// POST /api/life-score { life } (login + CSRF) -> { ok, score, improved }
exports.submit = wrap(async (req, res) => {
  const e = entry(req.body);
  const row = await scores.submit(req.session.user.id, req.session.user.username, e);
  res.json({ ok: true, score: e.score, improved: !!row, best: row ? row.score : (await scores.mine(req.session.user.id)).score });
});

// GET /api/life-scores (public) -> { scores: [...] }
exports.top = wrap(async (req, res) => {
  res.json({ scores: await scores.top(20) });
});
