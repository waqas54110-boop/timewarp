const { wrap } = require('../utils/helpers');
const journeyModel = require('../models/journeyModel');
const destinationModel = require('../models/destinationModel');
const service = require('../services/timeTravelService');
const achievements = require('../services/achievementService');

exports.dashboard = wrap(async (req, res) => {
  const [journeys, profile] = await Promise.all([journeyModel.listForUser(req.session.user.id), achievements.profile(req.session.user.id)]);
  res.render('user/dashboard', { title: 'My journeys', journeys, profile });
});

// user_id always comes from the session, never from the request body.
exports.apiCreate = wrap(async (req, res) => {
  const { selectedYear, travelType, destinationId } = req.valid;
  const check = service.validateSelection({ mode: travelType, year: selectedYear, destinationId });
  if (!check.ok) return res.status(400).json({ error: 'Validation failed', issues: check.errors });
  if (destinationId != null && !(await destinationModel.exists(destinationId))) {
    return res.status(400).json({ error: 'Destination does not exist' });
  }
  const j = await journeyModel.create({ userId: req.session.user.id, destinationId, selectedYear: check.value.year, travelType });
  res.status(201).json({ data: j });
});

exports.apiList = wrap(async (req, res) => res.json({ data: await journeyModel.listForUser(req.session.user.id) }));

exports.apiDelete = wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || !(await journeyModel.deleteOwned(id, req.session.user.id))) return res.status(404).json({ error: 'Not found' });
  res.json({ data: { deleted: id } });
});
