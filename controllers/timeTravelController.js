const { wrap } = require('../utils/helpers');
const service = require('../services/timeTravelService');
const destinationModel = require('../models/destinationModel');
const predictionModel = require('../models/predictionModel');
const achievements = require('../services/achievementService');
const sceneModel = require('../models/sceneModel');

exports.travel = wrap(async (req, res) => {
  const check = service.validateSelection(req.query);
  const destinations = await destinationModel.all();
  if (!check.ok) {
    return res.status(400).render('pages/travel', { title: 'Time Travel', journey: null, errors: check.errors, destinations, newBadges: [] });
  }
  const journey = await service.buildJourney(check.value);
  if (journey.error) return res.status(400).render('pages/travel', { title: 'Time Travel', journey: null, errors: [journey.error], destinations, newBadges: [] });
  const label = journey.destination ? journey.destination.name : 'the world';
  const newBadges = req.session.user ? await achievements.recordJourney(req.session.user.id, journey) : [];
  res.render('pages/travel', { title: `${label}, ${journey.year}`, journey, errors: [], destinations, newBadges });
});

exports.future = wrap(async (req, res) => {
  const category = String(req.query.category || '').trim().slice(0, 60) || undefined;
  const ty = parseInt(req.query.year, 10);
  const [predictions, categories] = await Promise.all([
    predictionModel.list({ category, targetYear: Number.isInteger(ty) ? ty : undefined }),
    predictionModel.categories(),
  ]);
  res.render('pages/future', { title: 'Future Explorer', predictions, categories, category, year: Number.isInteger(ty) ? ty : '' });
});

// 3D pages share one handler: /explore (first-person generated city or .glb) and /world (third-person Live World).
async function render3d(view, req, res) {
  const check = service.validateSelection(req.query);
  const destinations = await destinationModel.all();
  const fail = (errors) => res.status(400).render('pages/travel', { title: 'Time Travel', journey: null, errors, destinations, newBadges: [] });
  if (!check.ok) return fail(check.errors);
  const { mode, year, destinationId } = check.value;
  const destination = destinationId ? await destinationModel.findById(destinationId) : null;
  if (destinationId && !destination) return fail(['That destination does not exist.']);
  const row = await sceneModel.pick({ mode, year, destinationId });
  const back = `/travel?mode=${mode}&year=${year}${destinationId ? '&destinationId=' + destinationId : ''}`;
  res.render(view, {
    title: `${view === 'pages/world' ? 'Live World' : 'Explore'}: ${destination ? destination.name : 'the world'}`,
    mode, year, destination, backHref: back, modelUrl: row ? service.safeUrl(row.model_url) : null,
  });
}

exports.explore = wrap((req, res) => render3d('pages/explore', req, res));
exports.world = wrap((req, res) => render3d('pages/world', req, res));
