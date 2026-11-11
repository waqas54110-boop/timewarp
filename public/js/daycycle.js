// Day and night, weather and prayer times for the Live World (pure maths, no libraries, nothing downloaded).
// The sun's position comes from the standard astronomical formulas; prayer times use the Muslim World League angles
// (Fajr 18 degrees, Isha 17 degrees) and the Hanafi Asr by default. Times are only as exact as such a formula can be: check your local masjid before you rely on them.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpDay = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = (d, m) => ((d % m) + m) % m;
  const KARACHI = { lat: 24.8607, lng: 67.0011 };

  // sun(date, lat, lng) -> { alt (degrees above the horizon), dec (degrees), eqt (equation of time, minutes) }
  function sun(date, lat, lng) {
    const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    const L = norm(280.460 + 0.9856474 * n, 360), g = norm(357.528 + 0.9856003 * n, 360) * RAD;
    const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, eps = (23.439 - 0.0000004 * n) * RAD;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / RAD, dec = Math.asin(Math.sin(eps) * Math.sin(lam)) / RAD;
    const gmst = norm(18.697374558 + 24.06570982441908 * n, 24), ha = norm(gmst * 15 + lng - ra + 180, 360) - 180;
    const alt = Math.asin(Math.sin(lat * RAD) * Math.sin(dec * RAD) + Math.cos(lat * RAD) * Math.cos(dec * RAD) * Math.cos(ha * RAD)) / RAD;
    let e = norm(L - ra + 180, 360) - 180; // degrees of difference between mean and true sun
    return { alt, dec, eqt: e * 4 };
  }
  // hours before / after solar noon when the sun is at `angle` degrees (negative = below the horizon); null if it never gets there
  function hourAngle(angle, lat, dec) {
    const c = (Math.sin(angle * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD)) / (Math.cos(lat * RAD) * Math.cos(dec * RAD));
    return c < -1 || c > 1 ? null : Math.acos(c) / RAD / 15;
  }
  // prayerTimes(date, lat, lng, {fajr, isha, hanafi}) -> Dates for the solar day that contains `date`
  function prayerTimes(date, lat, lng, o) {
    const opt = Object.assign({ fajr: 18, isha: 17, hanafi: true }, o);
    const solarDay = new Date(date.getTime() + (lng / 15) * 3600000);
    const base = Date.UTC(solarDay.getUTCFullYear(), solarDay.getUTCMonth(), solarDay.getUTCDate(), 12);
    let noon = base - (lng / 15) * 3600000;
    for (let i = 0; i < 2; i++) { const p = sun(new Date(noon), lat, lng); noon = base - (lng / 15) * 3600000 - p.eqt * 60000; }
    const p = sun(new Date(noon), lat, lng), at = (h, sign) => (h === null ? null : new Date(noon + sign * h * 3600000));
    const asrAlt = Math.atan(1 / ((opt.hanafi ? 2 : 1) + Math.tan(Math.abs(lat - p.dec) * RAD))) / RAD;
    return {
      fajr: at(hourAngle(-opt.fajr, lat, p.dec), -1), sunrise: at(hourAngle(-0.833, lat, p.dec), -1), dhuhr: new Date(noon),
      asr: at(hourAngle(asrAlt, lat, p.dec), 1), maghrib: at(hourAngle(-0.833, lat, p.dec), 1), isha: at(hourAngle(-opt.isha, lat, p.dec), 1),
    };
  }
  const NAMES = { fajr: 'Fajr', dhuhr: 'Zuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  // nextPrayer(times, now) -> { key, name, at } the next of the five prayers (tomorrow's Fajr is estimated as 24 h after today's)
  function nextPrayer(times, now) {
    for (const k of Object.keys(NAMES)) if (times[k] && times[k] > now) return { key: k, name: NAMES[k], at: times[k] };
    return times.fajr ? { key: 'fajr', name: NAMES.fajr, at: new Date(times.fajr.getTime() + 86400000) } : null;
  }
  // which prayer has just started between two moments (used to ring the notification once); null if none
  function crossed(times, from, to) {
    for (const k of Object.keys(NAMES)) if (times[k] && times[k] > from && times[k] <= to) return { key: k, name: NAMES[k], at: times[k] };
    return null;
  }
  // light(date, lat, lng) -> 0.15 (deep night) .. 1 (full day); smooth through dawn and dusk
  function light(date, lat, lng) { const a = sun(date, lat, lng).alt; const x = clamp((a + 6) / 24, 0, 1); return 0.15 + 0.85 * x * x * (3 - 2 * x); }
  // tint(date, lat, lng) -> { color: 'rgba(...)' or '' } a screen overlay: orange near sunrise and sunset, blue at night
  function tint(date, lat, lng) {
    const a = sun(date, lat, lng).alt;
    if (a < -4) return { color: 'rgba(12,22,80,' + (0.18 + 0.32 * clamp((-4 - a) / 14, 0, 1)).toFixed(2) + ')', phase: 'night' };
    if (a < 9) return { color: 'rgba(255,130,50,' + (0.20 * (1 - clamp((a + 4) / 13, 0, 1))).toFixed(2) + ')', phase: 'twilight' };
    return { color: '', phase: 'day' };
  }

  // ---------- weather: the same place on the same day always has the same sky, changing every 8 hours ----------
  const WEATHER = [
    { kind: 'clear', icon: '☀️', label: 'Saaf mausam', w: 45, fog: 1, light: 1, rain: false },
    { kind: 'cloudy', icon: '⛅', label: 'Badal chhaye hain', w: 25, fog: 1.15, light: 0.82, rain: false },
    { kind: 'haze', icon: '🌫️', label: 'Dhund / gard', w: 10, fog: 1.7, light: 0.9, rain: false },
    { kind: 'rain', icon: '🌧️', label: 'Baarish', w: 15, fog: 1.5, light: 0.65, rain: true },
    { kind: 'fog', icon: '🌁', label: 'Dhund', w: 5, fog: 2.6, light: 0.75, rain: false },
  ];
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function weather(date, placeKey, mode) {
    const d = new Date(date.getTime()), key = String(placeKey || 'x') + '|' + d.toISOString().slice(0, 10) + '|' + Math.floor(d.getUTCHours() / 8);
    let r = hash(key) * WEATHER.reduce((a, w) => a + w.w, 0), pick = WEATHER[0];
    for (const w of WEATHER) { r -= w.w; if (r < 0) { pick = w; break; } }
    if (mode === 'future' && pick.kind === 'fog') pick = WEATHER[1];   // clean future air
    return pick;
  }
  const fmtClock = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return { KARACHI, NAMES, WEATHER, sun, prayerTimes, nextPrayer, crossed, light, tint, weather, fmtClock, hash };
});
