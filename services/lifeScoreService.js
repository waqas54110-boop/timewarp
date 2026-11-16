// Life leaderboard rules (pure, no database). A score is accepted only if the whole life can be replayed from its saved decisions.
const Life = require('../public/js/life.js');
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

// body: { life } -> { score, title, age, era, job }
function entry(body) {
  const raw = body && typeof body === 'object' ? body.life : null;
  const life = raw ? Life.restore(raw) : null;
  if (!life) throw bad('life is not a valid TimeWarp life');
  if (!life.over) throw bad('Only a finished life can be submitted');
  if (!Life.verify(life)) throw bad('This life could not be verified (its decisions do not replay to the same result)');
  const sum = Life.summary(life);
  return { score: sum.score, title: String(sum.title).slice(0, 80), age: sum.ageAtEnd, era: life.era, job: String(sum.job || '').slice(0, 30) };
}
module.exports = { entry };
