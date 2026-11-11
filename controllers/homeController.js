const { wrap } = require('../utils/helpers');
const destinationModel = require('../models/destinationModel');
const eventModel = require('../models/eventModel');
const predictionModel = require('../models/predictionModel');
const saveModel = require('../models/saveModel');
const { present, continueUrl } = require('../services/saveService');

// the signed-in player's save, for the Continue button; a save problem must never break the home page
async function savedGame(req) {
  if (!req.session.user) return null;
  try {
    const save = present(await saveModel.get(req.session.user.id));
    const url = continueUrl(save);
    return url ? { url, mode: save.lastMode, savedAt: save.savedAt } : null;
  } catch (e) { return null; }
}

exports.index = wrap(async (req, res) => {
  const [destinations, preview, predictions] = await Promise.all([
    destinationModel.all(),
    eventModel.list({}, { limit: 6, order: 'DESC' }),
    predictionModel.list(),
  ]);
  res.render('pages/home', {
    title: 'Explore the Past. Experience the Present. Discover the Future.',
    destinations,
    featured: destinations.slice(0, 6),
    timelinePreview: preview.rows,
    predictions: predictions.slice(0, 3),
    nowYear: new Date().getFullYear(),
    savedGame: await savedGame(req),
  });
});

exports.privacy = (req, res) => res.render('pages/privacy', { title: 'Privacy' });
exports.about = (req, res) => res.render('pages/about', { title: 'About & Sources' });
exports.life = (req, res) => res.render('pages/life', { title: 'Life Mode' });
exports.me = (req, res) => res.render('pages/me', { title: 'Meri Duniya' });
