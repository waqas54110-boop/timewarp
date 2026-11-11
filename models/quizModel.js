const db = require('../config/database');

// Public shape: never includes correct_answer or explanation.
async function publicQuestions({ difficulty, limit = 10 } = {}) {
  const params = [];
  let where = '';
  if (difficulty) { params.push(difficulty); where = 'WHERE difficulty = $1'; }
  params.push(limit);
  return (
    await db.query(
      `SELECT id, question, options, difficulty FROM quiz_questions ${where}
       ORDER BY RANDOM() LIMIT $${params.length}`,
      params
    )
  ).rows;
}

async function byIds(ids) {
  return (await db.query('SELECT * FROM quiz_questions WHERE id = ANY($1::bigint[])', [ids])).rows;
}

module.exports = { publicQuestions, byIds };
