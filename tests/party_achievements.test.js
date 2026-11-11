const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// These tests need no database: stub the DB module so only pure logic is loaded.
const orig = Module._load;
Module._load = function (req, ...a) { return req.endsWith('config/database') ? { query: async () => ({ rows: [] }) } : orig.call(this, req, ...a); };
const ach = require('../services/achievementService');
const hub = require('../services/partyHub');
Module._load = orig;

test('streaks: current and longest', () => {
  assert.deepStrictEqual(ach.streaks([], '2026-11-04'), { current: 0, longest: 0 });
  assert.deepStrictEqual(ach.streaks(['2026-11-04', '2026-11-03', '2026-11-02', '2026-10-20'], '2026-11-04'), { current: 3, longest: 3 });
  assert.strictEqual(ach.streaks(['2026-11-03', '2026-11-02'], '2026-11-04').current, 2); // yesterday still counts
  assert.strictEqual(ach.streaks(['2026-11-01'], '2026-11-04').current, 0);              // broken streak
  assert.strictEqual(ach.streaks(['2026-02-28', '2026-03-01'], '2026-03-01').current, 2); // month boundary
});

test('badges are awarded from progress', () => {
  assert.deepStrictEqual(ach.evaluate({}), []);
  const all = ach.evaluate({ journeys: 10, modes: ['past', 'present', 'future'], eraIds: [5], longestStreak: 7, quiz: { score: 5, total: 5 } });
  for (const c of ['first_journey', 'time_traveler', 'journeys_10', 'streak_3', 'streak_7', 'era_5', 'quiz_ace', 'quiz_perfect']) assert.ok(all.includes(c), c);
  assert.ok(!ach.evaluate({ journeys: 1, quiz: { score: 2, total: 2 } }).includes('quiz_ace')); // quiz too short
});

function fakeSocket() {
  const handlers = {}, sent = [];
  return { readyState: 1, sent, closed: null, on(ev, fn) { handlers[ev] = fn; }, send(s) { sent.push(JSON.parse(s)); }, close(code) { this.closed = code; }, emit(ev, d) { handlers[ev](d); } };
}

test('party: join, move, chat, leave, limits', () => {
  hub.rooms.clear();
  let t = 1000; const now = () => t;
  const a = fakeSocket(), b = fakeSocket();
  const ca = hub.join(a, 'abcde', { username: 'Waqas' }, now), cb = hub.join(b, 'ABCDE', null, now);
  assert.strictEqual(a.sent[0].t, 'hello'); assert.strictEqual(a.sent[0].you.name, 'Waqas');
  assert.match(b.sent[0].you.name, /^Guest-/); assert.strictEqual(b.sent[0].users.length, 2);
  assert.strictEqual(a.sent.at(-1).t, 'join');

  a.emit('message', JSON.stringify({ t: 'move', x: 5, y: -2 }));             // clamped
  assert.deepStrictEqual([b.sent.at(-1).x, b.sent.at(-1).y], [1, 0]);
  assert.ok(!a.sent.some((m) => m.t === 'move'));                              // not echoed to sender

  t += 1000; a.emit('message', JSON.stringify({ t: 'chat', text: '  hello \n <b>x</b> ' }));
  assert.strictEqual(b.sent.at(-1).text, 'hello <b>x</b>');                   // raw text only; client uses textContent
  assert.ok(a.sent.some((m) => m.t === 'chat'));                               // sender sees own chat
  const n = b.sent.length; t += 100; a.emit('message', JSON.stringify({ t: 'chat', text: 'too fast' }));
  assert.strictEqual(b.sent.length, n);                                        // chat rate limit
  a.emit('message', 'not json'); a.emit('message', '"str"'); a.emit('message', JSON.stringify({ t: 'chat', text: 123 })); // garbage is ignored

  a.emit('close'); assert.strictEqual(b.sent.at(-1).t, 'leave');
  b.emit('close'); assert.strictEqual(hub.rooms.size, 0);
});

test('party: bad code and full room are refused', () => {
  hub.rooms.clear();
  const bad = fakeSocket(); assert.strictEqual(hub.join(bad, '../x'), null); assert.strictEqual(bad.closed, 1008);
  for (let i = 0; i < hub.MAX_ROOM; i++) assert.ok(hub.join(fakeSocket(), 'FULL1', null));
  const extra = fakeSocket(); assert.strictEqual(hub.join(extra, 'FULL1', null), null); assert.strictEqual(extra.sent[0].message, 'This party is full.');
  hub.rooms.clear();
});

test('party: origin must match host', () => {
  assert.ok(hub.originOk({ headers: { host: 'localhost:3002', origin: 'http://localhost:3002' } }));
  assert.ok(!hub.originOk({ headers: { host: 'localhost:3002', origin: 'http://evil.example' } }));
  assert.ok(hub.originOk({ headers: { host: 'x' } }));
});
