const db = require('../config/database');

// Fixed badges. Era badges are generated per era: code "era_<id>".
const BADGES = {
  first_journey: { name: 'First Jump', icon: '🚀', desc: 'Complete your first time-travel journey.' },
  time_traveler: { name: 'Past, Present & Future', icon: '🌀', desc: 'Visit the past, the present and the future.' },
  journeys_10: { name: 'Frequent Traveller', icon: '🧭', desc: 'Complete 10 journeys.' },
  streak_3: { name: '3-Day Streak', icon: '🔥', desc: 'Travel on 3 days in a row.' },
  streak_7: { name: '7-Day Streak', icon: '⚡', desc: 'Travel on 7 days in a row.' },
  quiz_ace: { name: 'Quiz Ace', icon: '🎓', desc: 'Score at least 80% on a quiz of 5 or more questions.' },
  quiz_perfect: { name: 'Perfect Score', icon: '🏆', desc: 'Answer every question of a 5+ question quiz correctly.' },
};

const dayNum = (s) => Math.floor(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000);

// days: array of 'YYYY-MM-DD' (any order, duplicates ok). today: 'YYYY-MM-DD'.
// current = consecutive days ending today or yesterday; longest = best run ever.
function streaks(days, today) {
  const set = [...new Set(days)].map(dayNum).sort((a, b) => a - b);
  let longest = 0, run = 0, prev = null;
  for (const d of set) { run = prev !== null && d === prev + 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = d; }
  let current = 0;
  const t = dayNum(today);
  let cursor = set.includes(t) ? t : set.includes(t - 1) ? t - 1 : null;
  while (cursor !== null && set.includes(cursor)) { current++; cursor--; }
  return { current, longest };
}

// Pure: which badge codes does this progress deserve?
function evaluate({ journeys = 0, modes = [], eraIds = [], longestStreak = 0, quiz = null }) {
  const out = [];
  if (journeys >= 1) out.push('first_journey');
  if (['past', 'present', 'future'].every((m) => modes.includes(m))) out.push('time_traveler');
  if (journeys >= 10) out.push('journeys_10');
  if (longestStreak >= 3) out.push('streak_3');
  if (longestStreak >= 7) out.push('streak_7');
  eraIds.forEach((id) => out.push(`era_${id}`));
  if (quiz && quiz.total >= 5) {
    if (quiz.score / quiz.total >= 0.8) out.push('quiz_ace');
    if (quiz.score === quiz.total) out.push('quiz_perfect');
  }
  return out;
}

async function describe(codes) {
  const eras = codes.some((c) => c.startsWith('era_')) ? (await db.query('SELECT id, name FROM eras')).rows : [];
  return codes.map((code) => {
    if (code.startsWith('era_')) {
      const era = eras.find((e) => `era_${e.id}` === code);
      return { code, name: era ? `${era.name} Explorer` : 'Era Explorer', icon: '🗺️', desc: era ? `Travel to the ${era.name}.` : 'Travel to an era.' };
    }
    return { code, ...(BADGES[code] || { name: code, icon: '🏅', desc: '' }) };
  });
}

async function award(userId, codes) {
  if (!codes.length) return [];
  const r = await db.query(
    `INSERT INTO user_badges (user_id, badge_code) SELECT $1::bigint, UNNEST($2::text[]) ON CONFLICT DO NOTHING RETURNING badge_code`,
    [userId, codes]
  );
  return describe(r.rows.map((x) => x.badge_code));
}

async function stats(userId) {
  const [v, d, e, q] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS n FROM visits WHERE user_id = $1', [userId]),
    db.query(`SELECT to_char(visited_on, 'YYYY-MM-DD') AS d, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today FROM visits WHERE user_id = $1 GROUP BY visited_on`, [userId]),
    db.query('SELECT ARRAY_AGG(DISTINCT mode) AS modes, ARRAY_REMOVE(ARRAY_AGG(DISTINCT era_id), NULL) AS eras FROM visits WHERE user_id = $1', [userId]),
    db.query('SELECT score, total FROM quiz_attempts WHERE user_id = $1 ORDER BY score::float / GREATEST(total, 1) DESC, total DESC LIMIT 1', [userId]),
  ]);
  const today = d.rows[0] ? d.rows[0].today : new Date().toISOString().slice(0, 10);
  const s = streaks(d.rows.map((x) => x.d), today);
  return { journeys: v.rows[0].n, modes: e.rows[0].modes || [], eraIds: e.rows[0].eras || [], currentStreak: s.current, longestStreak: s.longest, quiz: q.rows[0] || null };
}

// Never throws: achievements must not break the page they are attached to.
async function safe(fn, fallback) {
  try { return await fn(); } catch (e) {
    if (e.code !== '42P01') console.error('achievements:', e.message);
    return fallback;
  }
}

// Called when a signed-in user opens a journey. One visit per user/day/mode/year/destination.
function recordJourney(userId, journey) {
  return safe(async () => {
    // Explicit casts: a bare $n in a SELECT list is untyped, and Postgres rejects reusing it with another type.
    await db.query(
      `INSERT INTO visits (user_id, mode, year, destination_id, era_id)
       SELECT $1::bigint, $2::varchar, $3::int, $4::bigint, $5::bigint
       WHERE NOT EXISTS (SELECT 1 FROM visits WHERE user_id = $1::bigint AND mode = $2::varchar AND year = $3::int
                         AND destination_id IS NOT DISTINCT FROM $4::bigint AND visited_on = CURRENT_DATE)`,
      [userId, journey.mode, journey.year, journey.destination ? journey.destination.id : null, journey.era ? journey.era.id : null]
    );
    return award(userId, evaluate(await stats(userId)));
  }, []);
}

function recordQuiz(userId, score, total) {
  return safe(async () => {
    await db.query('INSERT INTO quiz_attempts (user_id, score, total) VALUES ($1, $2, $3)', [userId, score, total]);
    return award(userId, evaluate(await stats(userId)));
  }, []);
}

function profile(userId) {
  return safe(async () => {
    const [st, b] = await Promise.all([stats(userId), db.query('SELECT badge_code FROM user_badges WHERE user_id = $1 ORDER BY earned_at', [userId])]);
    return { stats: st, badges: await describe(b.rows.map((x) => x.badge_code)) };
  }, { stats: null, badges: [] });
}

// points = 10 per badge + 5 per best quiz score + 1 per journey. since: Date or null (all time).
function leaderboard({ since = null, limit = 20 } = {}) {
  return safe(async () => (await db.query(
    `SELECT u.username,
            COALESCE(b.n, 0)::int AS badges, COALESCE(q.best, 0)::int AS best_quiz, COALESCE(v.n, 0)::int AS journeys,
            (COALESCE(b.n, 0) * 10 + COALESCE(q.best, 0) * 5 + COALESCE(v.n, 0))::int AS points
     FROM users u
     LEFT JOIN (SELECT user_id, COUNT(*) AS n FROM user_badges WHERE ($1::timestamptz IS NULL OR earned_at >= $1) GROUP BY user_id) b ON b.user_id = u.id
     LEFT JOIN (SELECT user_id, MAX(score) AS best FROM quiz_attempts WHERE ($1::timestamptz IS NULL OR created_at >= $1) GROUP BY user_id) q ON q.user_id = u.id
     LEFT JOIN (SELECT user_id, COUNT(*) AS n FROM visits WHERE ($1::timestamptz IS NULL OR created_at >= $1) GROUP BY user_id) v ON v.user_id = u.id
     WHERE COALESCE(b.n, 0) + COALESCE(q.best, 0) + COALESCE(v.n, 0) > 0
     ORDER BY points DESC, u.username LIMIT $2`,
    [since, limit]
  )).rows, []);
}

module.exports = { BADGES, streaks, evaluate, recordJourney, recordQuiz, profile, leaderboard };
