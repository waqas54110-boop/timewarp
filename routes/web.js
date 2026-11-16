const router = require('express').Router();
const { validate } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');
const home = require('../controllers/homeController');
const events = require('../controllers/eventController');
const dest = require('../controllers/destinationController');
const travel = require('../controllers/timeTravelController');
const journeys = require('../controllers/journeyController');
const quiz = require('../controllers/quizController');
const globe = require('../controllers/globeController');
const achievements = require('../controllers/achievementController');

router.get('/', home.index);
router.get('/about', home.about);
router.get('/privacy', home.privacy);
router.get('/life', home.life);
router.get('/me', home.me);
router.get('/past', validate('events', 'query'), events.past);
router.get('/present', dest.present);
router.get('/future', travel.future);
router.get('/timeline', validate('events', 'query'), events.timeline);
router.get('/compare', dest.compare);
router.get('/search', events.search);
router.get('/travel', travel.travel);
router.get('/explore', travel.explore);
router.get('/world', travel.world);
router.get('/globe', globe.page);
router.get('/leaderboard', achievements.leaderboard);
router.get('/events/:id', events.show);
router.get('/destinations/:id', dest.show);
router.get('/quiz', quiz.page);
router.get('/dashboard', requireAuth, journeys.dashboard);
router.get('/health', async (req, res) => {
  try { await require('../config/database').query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'database unavailable' }); }
});

module.exports = router;
