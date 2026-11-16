const router = require('express').Router();
const { validate } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');
const api = require('../controllers/apiController');
const journeys = require('../controllers/journeyController');
const quiz = require('../controllers/quizController');
const saves = require('../controllers/saveController');
const lifeScores = require('../controllers/lifeScoreController');

router.get('/events', validate('events', 'query'), api.events);
router.get('/events/:id', api.event);
router.get('/destinations', api.destinations);
router.get('/destinations/:id', api.destination);
router.get('/timeline', validate('events', 'query'), api.timeline);
router.get('/predictions', api.predictions);
router.get('/search', api.search);
router.get('/globe', require('../controllers/globeController').apiGlobe);

router.post('/journeys', requireAuth, validate('journey'), journeys.apiCreate);
router.get('/journeys', requireAuth, journeys.apiList);
router.delete('/journeys/:id', requireAuth, journeys.apiDelete);

router.get('/load', requireAuth, saves.load);
router.post('/save', requireAuth, saves.save);
router.delete('/save', requireAuth, saves.clear);

router.post('/life-score', requireAuth, lifeScores.submit);
router.get('/life-scores', lifeScores.top);

router.get('/quiz', quiz.apiQuestions);
router.post('/quiz/submit', validate('quizSubmit'), quiz.apiSubmit);

module.exports = router;
