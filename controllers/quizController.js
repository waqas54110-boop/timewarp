const { wrap } = require('../utils/helpers');
const quizModel = require('../models/quizModel');
const searchService = require('../services/searchService');
const achievements = require('../services/achievementService');

exports.page = (req, res) => res.render('pages/quiz', { title: 'Time Quiz' });

exports.apiQuestions = wrap(async (req, res) => {
  const difficulty = ['easy', 'medium', 'hard'].includes(req.query.difficulty) ? req.query.difficulty : undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
  res.json({ data: await quizModel.publicQuestions({ difficulty, limit }) });
});

exports.apiSubmit = wrap(async (req, res) => {
  const out = await searchService.scoreQuiz(req.valid.answers, quizModel);
  const newBadges = req.session.user ? await achievements.recordQuiz(req.session.user.id, out.score, out.total) : [];
  res.json({ data: { ...out, newBadges } });
});
