// Live World sky (Phase 5): day and night from the real clock, weather, rain and the five prayer times with a notification.
//   - Light: the sun and the ambient light get dimmer at night, the screen gets an orange tint at dawn / dusk and a blue one at night.
//   - Weather: clear, cloudy, haze, rain or fog. It is chosen from the place and the date, so it is the same for everyone there.
//   - Prayer times: calculated from the place's latitude and longitude (Karachi if the place has none). At each time the page shows a message and a soft chime.
//     There is no recorded azan: no audio file is shipped, so nothing has to be licensed.
//   - The clock chip also works as a button: click it to switch between "real time" and "fast day" (one day in 6 minutes) to watch the whole cycle.
const D = window.TimeWarpDay;

export function createSky(c) {
  const { scene, sun, amb, root, mode, place } = c;
  const lat = Number.isFinite(c.lat) ? c.lat : D.KARACHI.lat, lng = Number.isFinite(c.lng) ? c.lng : D.KARACHI.lng;
  const base = { sunI: sun ? sun.intensity : 1, ambI: amb ? amb.intensity : 1, fogD: scene && scene.fog ? scene.fog.density : 0 };
  const chip = document.getElementById('sky-chip'), toastEl = document.getElementById('sky-toast');
  const tintEl = document.createElement('div'); tintEl.id = 'sky-tint'; tintEl.className = 'sky-tint';
  const after = c.canvas && c.canvas.nextSibling; root.insertBefore(tintEl, after || null);   // right above the 3D view, below every button
  const rainCv = document.createElement('canvas'); rainCv.id = 'sky-rain'; rainCv.className = 'sky-rain'; rainCv.hidden = true; root.insertBefore(rainCv, after || null);
  const rctx = rainCv.getContext('2d');

  let fast = false, clock = (c.now ? c.now() : new Date()).getTime(), acc = 0, times = null, timesDay = '', lastClock = clock, wx = null, ac = null, drops = null, toastT = 0;

  function chime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = ac || new AC(); if (ac.state === 'suspended') ac.resume();
      [0, 0.5, 1.0].forEach((d, i) => { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + d; o.type = 'sine'; o.frequency.value = [392, 523.25, 659.25][i]; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 1.7); });
    } catch (e) { /* no audio */ }
  }
  function toast(text) { if (!toastEl) return; toastEl.textContent = text; toastEl.hidden = false; toastT = 8; }

  function apply() {
    const now = new Date(clock), day = new Date(clock + (lng / 15) * 3600000).toISOString().slice(0, 10);   // the solar day of this place
    if (day !== timesDay || !times) { times = D.prayerTimes(now, lat, lng); timesDay = day; }
    wx = D.weather(now, place, mode);
    const l = D.light(now, lat, lng), t = D.tint(now, lat, lng), eff = l * wx.light;
    if (sun) sun.intensity = base.sunI * eff;
    if (amb) amb.intensity = base.ambI * (0.45 + 0.55 * eff);
    if (scene && scene.fog) scene.fog.density = base.fogD * wx.fog * (1 + (1 - l) * 0.5);
    tintEl.style.background = t.color; tintEl.style.opacity = t.color ? '1' : '0';
    rainCv.hidden = !wx.rain;
    const next = D.nextPrayer(times, now), mins = Math.max(0, Math.round((next.at - now) / 60000));
    if (chip) chip.textContent = D.fmtClock(now) + ' · ' + wx.icon + ' ' + wx.label + ' · ' + next.name + ' ' + (mins >= 60 ? Math.floor(mins / 60) + ' ghanta ' + (mins % 60) + ' min' : mins + ' min');
    if (chip) chip.title = fast ? 'Tez din chal raha hai. Asli waqt par wapas jane ke liye dabayen.' : 'Asli waqt. Tez din dekhne ke liye dabayen.';
    return now;
  }
  function drawRain(dt) {
    if (rainCv.hidden) return;
    const w = (rainCv.width = rainCv.clientWidth || 600), h = (rainCv.height = rainCv.clientHeight || 400);
    if (!drops) drops = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: 0.8 + Math.random() }));
    rctx.clearRect(0, 0, w, h); rctx.strokeStyle = 'rgba(200,220,255,.55)'; rctx.lineWidth = 1.2; rctx.beginPath();
    drops.forEach((d) => { d.y += dt * 1.1 * d.s; d.x -= dt * 0.12; if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.1; } const x = d.x * w, y = d.y * h; rctx.moveTo(x, y); rctx.lineTo(x - 4, y + 14 * d.s); });
    rctx.stroke();
  }
  function update(dt) {
    clock += dt * 1000 * (fast ? 240 : 1); acc += dt;
    if (toastT > 0 && (toastT -= dt) <= 0 && toastEl) toastEl.hidden = true;
    drawRain(dt);
    if (acc < 0.5 && !c.always) return; acc = 0;
    const now = apply(), p = times && D.crossed(times, new Date(lastClock), now);
    if (p && !fast) { toast('🕌 ' + p.name + ' ka waqt ho gaya (' + D.fmtClock(p.at) + ')'); chime(); }
    lastClock = clock;
  }
  if (chip) chip.addEventListener('click', () => { fast = !fast; apply(); });
  apply();
  return { update, apply, get fast() { return fast; }, set fast(v) { fast = !!v; }, setClock: (ms) => { clock = ms; lastClock = ms; apply(); }, get times() { return times; }, get weather() { return wx; } };
}
