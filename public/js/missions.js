// TimeWarp missions: 1000 different missions, played one after another. Pure logic (no 3D): tested in tests/missions.test.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpMissions = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TOTAL = 1000;
  const TYPES = ['goto', 'run', 'drive', 'bike', 'heli', 'plane', 'coins', 'pray', 'talk', 'shop', 'buy', 'wave', 'dance', 'photo', 'race'];
  const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const ADJ = ['quick', 'careful', 'cheerful', 'sunny', 'brave', 'calm', 'lucky', 'busy', 'friendly', 'curious'];
  const WHO = ['a tourist', 'the shopkeeper', 'a student', 'an old friend', 'a courier', 'the mayor', 'a reporter', 'a neighbour'];
  const TEXT = {
    goto: (m) => `Walk to ${m.target.label}. Take a ${pick(m.r, ADJ)} stroll, no rush.`,
    run: (m) => `${m.who} needs help: run to ${m.target.label} before time runs out!`,
    drive: (m) => `Take any car (stop one with E) and drive to ${m.target.label}.`,
    bike: (m) => `Hop on a bike and ride to ${m.target.label}.`,
    heli: (m) => `Fly the helicopter and land on the spot at ${m.target.label}.`,
    plane: (m) => `Take off in the plane and fly through the ring above ${m.target.label}.`,
    coins: (m) => `Collect ${m.goal} gold coins around ${m.target.label}.`,
    pray: (m) => `Join the congregation at the mosque and pray ${m.goal} rakat.`,
    talk: (m) => `Talk to ${m.goal} different people (press E next to them).`,
    shop: (m) => `Enter ${m.goal} shop${m.goal > 1 ? 's' : ''} through their doors (E).`,
    buy: (m) => `Buy ${m.goal} item${m.goal > 1 ? 's' : ''} from shopkeepers.`,
    wave: (m) => `Wave hello (key 1) ${m.goal} time${m.goal > 1 ? 's' : ''}.`,
    dance: (m) => `Dance (key 2) ${m.goal} time${m.goal > 1 ? 's' : ''}.`,
    photo: (m) => `Take ${m.goal} photo${m.goal > 1 ? 's' : ''} with the Photo button.`,
    race: (m) => `Race by any vehicle to ${m.target.label}, the clock is running!`,
  };
  const NAMES = {
    goto: 'Stroll', run: 'Dash', drive: 'Road trip', bike: 'Bike ride', heli: 'Chopper landing', plane: 'Sky ring', coins: 'Gold hunt',
    pray: 'Prayer', talk: 'Meet the city', shop: 'Window shopping', buy: 'Shopping list', wave: 'Say hello', dance: 'Dance break', photo: 'Photographer', race: 'Street race',
  };
  const needsTarget = (t) => ['goto', 'run', 'drive', 'bike', 'heli', 'plane', 'coins', 'race'].includes(t);

  // landmarks: [{ id, label, x, z }] given by the world
  function generate(i, landmarks) {
    const n = ((i % TOTAL) + TOTAL) % TOTAL, type = TYPES[n % TYPES.length], tier = Math.floor(n / TYPES.length);
    const r = seeded(n * 7919 + 13);
    const m = { n: n + 1, type, tier, r, who: pick(r, WHO) };
    if (needsTarget(type)) {
      const pool = ['drive', 'bike', 'heli', 'plane', 'race'].includes(type) && landmarks.some((l) => l.open) ? landmarks.filter((l) => l.open) : landmarks;
      const lm = pool[Math.floor(r() * pool.length)]; m.target = { x: lm.x, z: lm.z, label: lm.label };
    }
    m.goal = ({ coins: 4 + (tier % 8), pray: 1 + (tier % 4), talk: 2 + (tier % 6), shop: 1 + (tier % 4), buy: 1 + (tier % 3), wave: 2 + (tier % 7), dance: 1 + (tier % 4), photo: 1 + (tier % 5) })[type] || 1;
    m.slack = ['run', 'race'].includes(type) ? Math.max(1.2, 2.2 - tier * 0.015) : 0;   // time = travel time * slack (computed in the world)
    m.reward = 40 + tier * 6 + (m.slack ? 20 : 0);
    m.title = `${m.n}. ${NAMES[type]}${tier ? ' · level ' + (tier + 1) : ''}`;
    m.text = TEXT[type](m);
    delete m.r;
    return m;
  }

  // st: { x, z, veh: 'foot'|'car'|'bike'|'heli'|'plane', alt }.  ev: event name or null.  Returns 'done' | 'fail' | null.
  function advance(m, st, ev, dt) {
    m.p = m.p || 0; m.t = (m.t || 0) + dt;
    if (m.time && m.t > m.time) return 'fail';
    if (ev && ['coins', 'pray', 'talk', 'shop', 'buy', 'wave', 'dance', 'photo'].includes(m.type)) {
      const want = { coins: 'coin', pray: 'rakat', talk: 'talk', shop: 'shop', buy: 'buy', wave: 'wave', dance: 'dance', photo: 'photo' }[m.type];
      if (ev === want) m.p++;
      return m.p >= m.goal ? 'done' : null;
    }
    if (!m.target) return null;
    const d = Math.hypot(st.x - m.target.x, st.z - m.target.z);
    m.dist = d;
    const ok = {
      goto: d < 4 && st.veh === 'foot', run: d < 4 && st.veh === 'foot', drive: d < 6 && st.veh === 'car', bike: d < 5 && st.veh === 'bike',
      heli: d < 9 && st.veh === 'heli' && st.alt < 1.5, plane: d < 22 && st.veh === 'plane' && st.alt > 10, race: d < 6 && st.veh !== 'foot',
    }[m.type];
    return ok ? 'done' : null;
  }
  return { TOTAL, TYPES, generate, advance, needsTarget };
});
