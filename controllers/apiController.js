const { wrap } = require('../utils/helpers');
const eventModel = require('../models/eventModel');
const destinationModel = require('../models/destinationModel');
const predictionModel = require('../models/predictionModel');
const searchService = require('../services/searchService');


exports.events = wrap(async (req, res) => {
  const { page, ...filters } = req.valid;
  const limit = 20;
  const { rows, total } = await eventModel.list(filters, { limit, offset: (page - 1) * limit });
  res.json({ data: rows, meta: { page, limit, total } });
});

exports.timeline = exports.events;

exports.event = wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const e = Number.isInteger(id) ? await eventModel.findById(id) : null;
  if (!e) return res.status(404).json({ error: 'Not found' });
  res.json({ data: { ...e, media: await eventModel.mediaFor(id) } });
});

exports.destinations = wrap(async (req, res) => res.json({ data: await destinationModel.all() }));

exports.destination = wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const d = Number.isInteger(id) ? await destinationModel.findById(id) : null;
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json({ data: d });
});

exports.predictions = wrap(async (req, res) => {
  const category = String(req.query.category || '').slice(0, 60) || undefined;
  res.json({ data: await predictionModel.list({ category }), meta: { speculative: true, note: 'Scenarios are speculative, not verified facts.' } });
});

exports.search = wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q || q.length > 100) return res.status(400).json({ error: 'q is required (1-100 characters)' });
  res.json({ data: await searchService.search(q) });
});
