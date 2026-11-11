const { wrap } = require('../utils/helpers');
const achievements = require('../services/achievementService');

exports.leaderboard = wrap(async (req, res) => {
  const season = req.query.season === 'month' ? 'month' : 'all';
  const since = season === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : null;
  const rows = await achievements.leaderboard({ since });
  res.render('pages/leaderboard', { title: 'Leaderboard', rows, season, me: req.session.user ? req.session.user.username : null });
});
