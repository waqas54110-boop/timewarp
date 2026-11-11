// Requires a migrated + seeded database (see README). Uses DATABASE_URL from .env.
require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');
const { pool } = require('../config/database');

const token = (res) => /data-csrf="([^"]+)"/.exec(res.text)[1];
const email = (n) => `${n}-${Date.now()}@example.com`;

async function signup(agent, name) {
  const t = token(await agent.get('/auth/register'));
  const res = await agent.post('/auth/register').type('form').send({ _csrf: t, username: name, email: email(name), password: 'correct-horse-9' });
  assert.strictEqual(res.status, 302);
}

test.after(() => pool.end());

test('public pages render', async () => {
  for (const p of ['/', '/past', '/present', '/future', '/timeline', '/compare', '/quiz', '/search?q=lahore', '/about', '/privacy', '/destinations/1', '/events/1']) {
    const res = await request(app).get(p);
    assert.strictEqual(res.status, 200, p);
  }
  assert.strictEqual((await request(app).get('/nope')).status, 404);
  assert.strictEqual((await request(app).get('/health')).status, 200);
});

test('travel: Lahore 1947 and validation errors', async () => {
  const ok = await request(app).get('/travel?mode=past&year=1947&destinationId=1');
  assert.strictEqual(ok.status, 200);
  assert.match(ok.text, /Partition of British India/);
  const future = await request(app).get('/travel?mode=future&year=2150&destinationId=1');
  assert.match(future.text, /Speculative/i);
  assert.strictEqual((await request(app).get('/travel?mode=past&year=2999')).status, 400);
  assert.strictEqual((await request(app).get('/travel?mode=past&year=1947&destinationId=9999')).status, 400);
});

test('public API', async () => {
  const ev = await request(app).get('/api/events?from=1900&to=1950');
  assert.strictEqual(ev.status, 200);
  assert.ok(ev.body.data.length >= 2);
  assert.strictEqual((await request(app).get('/api/events?from=abc')).status, 400);
  assert.strictEqual((await request(app).get('/api/search?q=')).status, 400);
  const s = await request(app).get("/api/search?q=100%25_'; DROP TABLE users;--");
  assert.strictEqual(s.status, 200); // injection string is just text
  assert.strictEqual((await request(app).get('/api/predictions')).body.meta.speculative, true);
});

test('quiz never exposes answers; scoring is server-side', async () => {
  const q = await request(app).get('/api/quiz?limit=3');
  assert.ok(q.body.data.length);
  assert.ok(q.body.data.every((x) => !('correct_answer' in x) && !('explanation' in x)));
  const agent = request.agent(app);
  const t = token(await agent.get('/quiz'));
  const wrong = await agent.post('/api/quiz/submit').set('x-csrf-token', t).send({ answers: q.body.data.map((x) => ({ id: Number(x.id), answer: 'zzz' })) });
  assert.strictEqual(wrong.body.data.score, 0);
});

test('CSRF is enforced on state-changing requests', async () => {
  const res = await request(app).post('/auth/login').type('form').send({ email: 'a@b.co', password: 'x' });
  assert.strictEqual(res.status, 403);
});

test('auth + journeys + ownership', async () => {
  const a = request.agent(app), b = request.agent(app);
  await signup(a, 'alice'); await signup(b, 'bob');
  const ta = token(await a.get('/dashboard'));
  const created = await a.post('/api/journeys').set('x-csrf-token', ta).send({ selectedYear: 1947, travelType: 'past', destinationId: 1, userId: 999 });
  assert.strictEqual(created.status, 201);
  assert.notStrictEqual(Number(created.body.data.user_id), 999);
  assert.strictEqual((await a.post('/api/journeys').set('x-csrf-token', ta).send({ selectedYear: 1947, travelType: 'future' })).status, 400);
  assert.strictEqual((await a.post('/api/journeys').set('x-csrf-token', ta).send({ selectedYear: 1947, travelType: 'past', destinationId: 9999 })).status, 400);
  assert.strictEqual((await request(app).get('/api/journeys')).status, 401);

  const tb = token(await b.get('/dashboard'));
  assert.strictEqual((await b.get('/api/journeys')).body.data.length, 0);
  assert.strictEqual((await b.delete('/api/journeys/' + created.body.data.id).set('x-csrf-token', tb)).status, 404);
  assert.strictEqual((await a.delete('/api/journeys/' + created.body.data.id).set('x-csrf-token', ta)).status, 200);
});

test('login rejects bad credentials and admin is role-protected', async () => {
  const agent = request.agent(app);
  let t = token(await agent.get('/auth/login'));
  const bad = await agent.post('/auth/login').type('form').send({ _csrf: t, email: 'nobody@example.com', password: 'whatever1' });
  assert.strictEqual(bad.status, 401);
  assert.strictEqual((await request(app).get('/admin').redirects(0)).status, 302); // anonymous -> login
  await signup(agent, 'carol');
  assert.strictEqual((await agent.get('/admin')).status, 403); // plain user
  assert.strictEqual((await agent.get('/api/journeys')).status, 200);
});

test('editor can create events; only admin can delete', async () => {
  const agent = request.agent(app);
  await signup(agent, 'editor');
  const u = (await pool.query("SELECT id FROM users WHERE username = 'editor' ORDER BY id DESC LIMIT 1")).rows[0];
  await pool.query("UPDATE users SET role = 'editor' WHERE id = $1", [u.id]);
  // re-login so the session picks up the role
  const lt = token(await agent.get('/dashboard'));
  await agent.post('/auth/logout').type('form').send({ _csrf: lt });
  const em = (await pool.query('SELECT email FROM users WHERE id = $1', [u.id])).rows[0].email;
  let t = token(await agent.get('/auth/login'));
  await agent.post('/auth/login').type('form').send({ _csrf: t, email: em, password: 'correct-horse-9' });
  t = token(await agent.get('/admin/events/new'));
  const bad = await agent.post('/admin/events').type('form').send({ _csrf: t, title: '', event_year: 'x' });
  assert.strictEqual(bad.status, 400);
  const ok = await agent.post('/admin/events').type('form').send({ _csrf: t, title: 'Test event', event_year: 1500, category: 'Test' });
  assert.strictEqual(ok.status, 302);
  const id = (await pool.query("SELECT id FROM events WHERE title = 'Test event'")).rows[0].id;
  assert.strictEqual((await agent.post(`/admin/events/${id}/delete`).type('form').send({ _csrf: t })).status, 403);
  assert.strictEqual((await agent.get('/admin/users')).status, 404); // unknown resource
  await pool.query('DELETE FROM events WHERE id = $1', [id]);
  await pool.query('DELETE FROM users WHERE username IN ($1,$2,$3,$4)', ['alice', 'bob', 'carol', 'editor']);
});
