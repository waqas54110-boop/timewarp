const { wrap, parsePage, buildPager } = require('../utils/helpers');
const eventModel = require('../models/eventModel');
const destinationModel = require('../models/destinationModel');
const timelineService = require('../services/timelineService');
const searchService = require('../services/searchService');

async function filterData() {
  const [destinations, categories, countries, eras] = await Promise.all([
    destinationModel.all(), eventModel.categories(), eventModel.countries(), destinationModel.eras(),
  ]);
  return { destinations, categories, countries, eras };
}

async function listPage(req, res, view, title, limit) {
  const f = req.valid || { page: 1 };
  const page = f.page || 1;
  const { page: _p, ...filters } = f;
  const [{ rows, total }, extra] = await Promise.all([timelineService.timeline(filters, page, limit), filterData()]);
  res.render(view, { title, events: rows, filters, errors: req.validationErrors || [], pager: buildPager(req, total, limit, page), ...extra });
}

exports.past = wrap((req, res) => {
  const nowYear = new Date().getFullYear();
  if (req.valid && req.valid.to === undefined) req.valid.to = nowYear - 1;
  return listPage(req, res, 'pages/past', 'Past Explorer', 10);
});
exports.timeline = wrap((req, res) => listPage(req, res, 'pages/timeline', 'Timeline', 15));

exports.show = wrap(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const event = Number.isInteger(id) ? await eventModel.findById(id) : null;
  if (!event) return next();
  const related = event.destination_id ? (await eventModel.list({ destinationId: event.destination_id }, { limit: 6 })).rows.filter((e) => e.id !== event.id) : [];
  res.render('pages/event', { title: event.title, event, media: await eventModel.mediaFor(id), related });
});

exports.search = wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const results = q ? await searchService.search(q) : null;
  res.render('pages/search', { title: q ? `Search: ${q}` : 'Search', q, results });
});
