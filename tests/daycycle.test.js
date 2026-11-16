const test = require('node:test');
const assert = require('node:assert');
const D = require('../public/js/daycycle.js');
const { lat, lng } = D.KARACHI;
const pk = (d) => new Date(d.getTime() + 5 * 3600000);   // Pakistan time as UTC fields
const hm = (d) => { const p = pk(d); return p.getUTCHours() + p.getUTCMinutes() / 60; };

test('sun: noon is high, midnight is below the horizon, and the day length is sensible', () => {
  assert.ok(D.sun(new Date('2026-06-21T07:30:00Z'), lat, lng).alt > 80, 'summer noon in Karachi');
  assert.ok(D.sun(new Date('2026-12-21T07:30:00Z'), lat, lng).alt > 40 && D.sun(new Date('2026-12-21T07:30:00Z'), lat, lng).alt < 50, 'winter noon');
  assert.ok(D.sun(new Date('2026-11-07T20:00:00Z'), lat, lng).alt < -20);
  assert.ok(Math.abs(D.sun(new Date('2026-11-07T07:00:00Z'), lat, lng).eqt - 16) < 2, 'equation of time in early November is about +16 minutes');
  assert.ok(Math.abs(D.sun(new Date('2026-02-11T07:00:00Z'), lat, lng).eqt + 14) < 2, 'and about -14 in mid February');
});

test('prayer times for Karachi in November are in order and near the known times', () => {
  const t = D.prayerTimes(new Date('2026-11-07T05:00:00Z'), lat, lng);
  const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (let i = 1; i < order.length; i++) assert.ok(t[order[i]] > t[order[i - 1]], order[i]);
  const within = (key, want, tol) => assert.ok(Math.abs(hm(t[key]) - want) < tol, key + ' ' + hm(t[key]));
  within('fajr', 5.4, 0.3); within('sunrise', 6.65, 0.2); within('dhuhr', 12.27, 0.12); within('asr', 16.2, 0.2); within('maghrib', 17.62, 0.2); within('isha', 18.85, 0.3);
  const shafi = D.prayerTimes(new Date('2026-11-07T05:00:00Z'), lat, lng, { hanafi: false });
  assert.ok(shafi.asr < t.asr, 'the Shafi Asr is earlier than the Hanafi Asr');
});

test('prayer times also work in the west and in summer, and give null near the pole', () => {
  const london = D.prayerTimes(new Date('2026-03-20T12:00:00Z'), 51.5, -0.12);
  assert.ok(london.dhuhr.getUTCHours() === 12 && london.maghrib > london.asr && london.isha > london.maghrib);
  const june = D.prayerTimes(new Date('2026-06-21T05:00:00Z'), lat, lng); assert.ok(june.fajr < june.sunrise);
  const pole = D.prayerTimes(new Date('2026-06-21T12:00:00Z'), 80, 10); assert.strictEqual(pole.sunrise, null);
});

test('nextPrayer and crossed', () => {
  const t = D.prayerTimes(new Date('2026-11-07T05:00:00Z'), lat, lng);
  assert.strictEqual(D.nextPrayer(t, new Date(t.dhuhr.getTime() - 60000)).key, 'dhuhr');
  assert.strictEqual(D.nextPrayer(t, new Date(t.dhuhr.getTime() + 60000)).key, 'asr');
  const after = D.nextPrayer(t, new Date(t.isha.getTime() + 60000)); assert.strictEqual(after.key, 'fajr'); assert.ok(after.at > t.isha);
  assert.strictEqual(D.crossed(t, new Date(t.asr.getTime() - 500), new Date(t.asr.getTime() + 500)).name, 'Asr');
  assert.strictEqual(D.crossed(t, new Date(t.asr.getTime() + 1), new Date(t.asr.getTime() + 2000)), null, 'it rings only once');
});

test('light and tint follow the sun', () => {
  const noon = new Date('2026-11-07T07:30:00Z'), night = new Date('2026-11-07T21:00:00Z'), dusk = new Date(D.prayerTimes(noon, lat, lng).maghrib.getTime() - 5 * 60000);
  assert.strictEqual(D.light(noon, lat, lng), 1); assert.ok(D.light(night, lat, lng) < 0.2);
  assert.ok(D.light(dusk, lat, lng) > 0.25 && D.light(dusk, lat, lng) < 1);
  assert.strictEqual(D.tint(noon, lat, lng).phase, 'day'); assert.strictEqual(D.tint(noon, lat, lng).color, '');
  assert.strictEqual(D.tint(night, lat, lng).phase, 'night'); assert.match(D.tint(night, lat, lng).color, /^rgba\(12,22,80,/);
  assert.strictEqual(D.tint(dusk, lat, lng).phase, 'twilight');
  for (let h = 0; h < 24; h += 0.25) { const l = D.light(new Date(Date.UTC(2026, 10, 7, h)), lat, lng); assert.ok(l >= 0.15 && l <= 1); }
});

test('weather is repeatable, varied, and kinds are all reachable', () => {
  const d = new Date('2026-11-07T10:00:00Z');
  assert.strictEqual(D.weather(d, 'Karachi', 'present').kind, D.weather(d, 'Karachi', 'present').kind);
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(D.weather(new Date(d.getTime() + i * 8 * 3600000), 'Town' + (i % 7), 'present').kind);
  assert.strictEqual(seen.size, 5);
  for (let i = 0; i < 400; i++) assert.notStrictEqual(D.weather(new Date(d.getTime() + i * 8 * 3600000), 'T' + i, 'future').kind, 'fog');
  D.WEATHER.forEach((w) => { assert.ok(w.fog >= 1 && w.light > 0 && w.light <= 1 && w.label && w.icon); });
  assert.match(D.fmtClock(new Date(2026, 0, 1, 7, 5)), /^07:05$/);
});
