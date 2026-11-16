const db = require('../config/database');
const { escapeLike } = require('../utils/helpers');

async function search(q, limit = 10) {
  const term = `%${escapeLike(q)}%`;
  const [events, destinations, predictions] = await Promise.all([
    db.query(
      `SELECT e.id, e.title, e.event_year, e.category, e.description FROM events e
       WHERE e.title ILIKE $1 OR e.description ILIKE $1 OR e.category ILIKE $1
       ORDER BY e.event_year LIMIT $2`,
      [term, limit]
    ),
    db.query(
      `SELECT id, name, country, description FROM destinations
       WHERE name ILIKE $1 OR description ILIKE $1 OR country ILIKE $1 ORDER BY name LIMIT $2`,
      [term, limit]
    ),
    db.query(
      `SELECT id, title, target_year, category, description FROM predictions
       WHERE title ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 ORDER BY target_year LIMIT $2`,
      [term, limit]
    ),
  ]);
  return { events: events.rows, destinations: destinations.rows, predictions: predictions.rows };
}

// Scores answers on the server; correct answers are only revealed after submission.
async function scoreQuiz(answers, quizModel) {
  const rows = await quizModel.byIds(answers.map((a) => a.id));
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  let score = 0;
  const results = answers
    .filter((a) => byId.has(a.id))
    .map((a) => {
      const q = byId.get(a.id);
      const correct = q.correct_answer === a.answer;
      if (correct) score += 1;
      return { id: a.id, correct, correctAnswer: q.correct_answer, explanation: q.explanation };
    });
  return { score, total: results.length, results };
}

module.exports = { search, scoreQuiz };
