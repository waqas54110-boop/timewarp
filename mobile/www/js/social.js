// Street life simulation (no Three.js): citizens walk, chat, sometimes scuffle; police walk the beat,
// run to scuffles and break them up; shopkeepers stand at their shops and sell to customers;
// in the future, some people fly. The 3D page only draws what this says (agent.anim / bubble / x / z / alt).
(function (root) {
  const Crowd = typeof module !== 'undefined' && module.exports ? require('./crowd.js') : root.TimeWarpCrowd;
  const RUN = 2.4; // police run this many times their walking speed
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  // opts: rand, N, P, citizens, police, flyers, shops [{x, z, yaw, name}], fightRate (per meeting), chatRate
  function createSim(opts) {
    const { rand, N, P } = opts;
    const graph = Crowd.makeGrid(N, P);
    const fightRate = opts.fightRate == null ? 0.05 : opts.fightRate, chatRate = opts.chatRate == null ? 0.3 : opts.chatRate;
    const agents = [], alerts = [], log = [];
    let time = 0, scan = 0, nextId = 1;

    const say = (type, text) => { log.push({ t: time, type, text }); if (log.length > 60) log.shift(); };
    const add = (a) => { a.id = nextId++; agents.push(a); return a; };
    const randNode = () => (rand() * graph.length) | 0;
    function base(role, cur) {
      return { role, x: graph[cur].x, z: graph[cur].z, yaw: rand() * 6.28, speed: (role === 'police' ? 1.3 : 1.1) + rand() * 0.8, mode: 'walk', t: 0, cur, prev: -1,
        target: Crowd.pickNext(rand, graph, cur, -1), path: null, goal: null, partner: null, anim: 'walk', bubble: '', cool: rand() * 6, alt: 0, flyer: false, shop: null, alert: null };
    }

    for (let i = 0; i < (opts.citizens || 0); i++) {
      // the first few start near the middle so the player sees people straight away
      const near = graph.map((n, idx) => idx).filter((idx) => Math.hypot(graph[idx].x, graph[idx].z) < 30);
      add(base('citizen', i < 10 && near.length ? near[(rand() * near.length) | 0] : randNode()));
    }
    for (let i = 0; i < (opts.police || 0); i++) add(base('police', randNode()));
    for (let i = 0; i < (opts.flyers || 0); i++) { const a = base('citizen', randNode()); a.flyer = true; a.alt = 5 + rand() * 8; a.speed = 3 + rand() * 2; a.anim = 'fly'; add(a); }
    const shops = (opts.shops || []).map((s) => {
      const keeper = add({ role: 'keeper', x: s.x, z: s.z, yaw: s.yaw, speed: 0, mode: 'stand', t: rand() * 5, cur: -1, prev: -1, target: -1, path: null, goal: null, partner: null, anim: 'idle', bubble: '', cool: 0, alt: 0, flyer: false, shop: null, alert: null });
      const shop = { ...s, keeper, node: Crowd.nearestNode(graph, s.x, s.z) };
      keeper.shop = shop; return shop;
    });

    // ---- movement helpers ----
    function moveToward(a, tx, tz, speed, dt) {
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz), step = speed * dt;
      if (d > 1e-6) a.yaw += angleDiff(Math.atan2(dx, dz), a.yaw) * Math.min(1, dt * 8);
      if (d <= step) { a.x = tx; a.z = tz; return true; }
      a.x += (dx / d) * step; a.z += (dz / d) * step; return false;
    }
    const face = (a, o, dt) => { a.yaw += angleDiff(Math.atan2(o.x - a.x, o.z - a.z), a.yaw) * Math.min(1, dt * 8); };
    function resumeWalk(a, fromNode) {
      a.mode = 'walk'; a.anim = a.flyer ? 'fly' : 'walk'; a.bubble = ''; a.partner = null; a.path = null; a.goal = null; a.alert = null;
      if (fromNode != null) { a.cur = fromNode; a.prev = -1; a.target = Crowd.pickNext(rand, graph, fromNode, -1); }
    }
    const busy = (a) => a.mode !== 'walk' && a.mode !== 'pause';

    function walk(a, dt) {
      const t = graph[a.target];
      if (moveToward(a, t.x, t.z, a.speed, dt)) {
        a.prev = a.cur; a.cur = a.target; a.target = Crowd.pickNext(rand, graph, a.cur, a.prev);
        if (a.flyer) return;
        if (a.role === 'citizen') {
          const free = shops.filter((s) => !s.keeper.partner);
          if (free.length && rand() < 0.1) { startShopTrip(a, free[(rand() * free.length) | 0]); return; }
        }
        if (rand() < 0.12) { a.mode = 'pause'; a.t = 2 + rand() * 4; a.anim = 'idle'; }
      }
    }
    function followPath(a, dt, speed, onArrive) {
      if (a.path && a.path.length) {
        const n = graph[a.path[0]];
        if (moveToward(a, n.x, n.z, speed, dt)) a.path.shift();
        return;
      }
      if (moveToward(a, a.goal.x, a.goal.z, speed, dt)) onArrive();
    }

    // ---- shopping ----
    function startShopTrip(a, shop) {
      a.mode = 'shop'; a.shop = shop; a.anim = 'walk'; shop.keeper.partner = a; // reserve the keeper
      a.path = Crowd.shortestPath(graph, a.target, shop.node); a.goal = { x: shop.x, z: shop.z };
    }
    function shopStep(a, dt) {
      followPath(a, dt, a.speed, () => { a.mode = 'trade'; a.t = 4 + rand() * 3; a.anim = 'trade'; a.bubble = 'Rs'; a.shop.keeper.anim = 'trade'; });
    }
    function tradeStep(a, dt) {
      face(a, a.shop.keeper, dt); face(a.shop.keeper, a, dt);
      a.t -= dt;
      if (a.t <= 0) {
        say('sale', `A shopkeeper just made a sale at ${a.shop.name || 'a shop'}.`);
        a.shop.keeper.partner = null; a.shop.keeper.anim = 'idle'; const node = a.shop.node; a.shop = null; resumeWalk(a, node); a.cool = 10;
      }
    }

    // ---- the visitor: an object the sim reads (world.js keeps x/z up to date) ----
    const player = { x: 0, z: 0, detainedUntil: 0, warned: 0 };
    const chatLines = opts.chatLines && opts.chatLines.length ? opts.chatLines : ['Hello!', 'Nice day, is it not?'];
    // Anyone who was pulled out of their routine goes back to it: walkers keep walking, shopkeepers return to their shop.
    function settle(a) {
      if (a.role === 'keeper') { a.x = a.shop.x; a.z = a.shop.z; a.yaw = a.shop.yaw; a.mode = 'stand'; a.anim = 'idle'; a.bubble = ''; a.partner = null; a.alert = null; a.t = 3; return; }
      resumeWalk(a);
    }

    // ---- meetings: chat or scuffle ----
    function startChat(a, b) {
      [a, b].forEach((x, i) => { x.mode = 'chat'; x.anim = 'talk'; x.partner = i ? a : b; x.t = 8 + rand() * 6; x.cool = 12 + rand() * 10; x.clock = 0; x.seg = -1; });
      b.t = a.t;
    }
    function chatStep(a, dt) {
      if (!a.partner) return settle(a);
      face(a, a.partner, dt); a.t -= dt; a.clock += dt;
      const seg = Math.floor(a.clock / 3.2);                       // they take turns, one short sentence each
      if (seg !== a.seg) { a.seg = seg; a.line = chatLines[(rand() * chatLines.length) | 0]; }
      const myTurn = (seg % 2 === 0) === (a.id < a.partner.id);
      a.bubble = myTurn ? a.line : '';
      if (a.t <= 0) { const p = a.partner; settle(a); if (p && p.mode === 'chat') settle(p); }
    }
    // The nearest officers (up to 2) run to the scene; the scuffle lasts until the first can get there.
    function dispatchPolice(alert, mid) {
      const nodeNear = Crowd.nearestNode(graph, mid.x, mid.z);
      agents.filter((p) => p.role === 'police' && (p.mode === 'walk' || p.mode === 'pause'))
        .sort((p, q) => Math.hypot(p.x - mid.x, p.z - mid.z) - Math.hypot(q.x - mid.x, q.z - mid.z)).slice(0, 2)
        .forEach((p) => { p.mode = 'respond'; p.anim = 'run'; p.alert = alert; p.path = Crowd.shortestPath(graph, p.target, nodeNear); p.goal = { x: mid.x, z: mid.z }; p.bubble = ''; });
      const etas = agents.filter((p) => p.mode === 'respond' && p.alert === alert).map((p) => {
        let len = 0, px = p.x, pz = p.z;
        for (const n of p.path.concat([null])) { const q = n === null ? p.goal : graph[n]; len += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
        return len / (p.speed * RUN);
      });
      if (etas.length) { const t = Math.min(60, Math.max(14, Math.min(...etas) + 4)); alert.fighters.forEach((x) => { x.t = t; }); }
    }
    function startFight(a, b) {
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const alert = { id: nextId++, x: mid.x, z: mid.z, fighters: [a, b], resolved: false, started: time };
      [a, b].forEach((x, i) => { x.mode = 'fight'; x.anim = 'fight'; x.bubble = '!'; x.partner = i ? a : b; x.t = 14 + rand() * 6; x.alert = alert; x.cool = 30; });
      alerts.push(alert);
      say('fight', 'A heated argument turns into a scuffle. Police have been called.');
      dispatchPolice(alert, mid);
    }
    // The visitor picks a fight with someone (cartoon scuffle). Police come for both of them.
    function engagePlayer(a) {
      if (a.flyer || a.role === 'police' || !['walk', 'pause', 'chat', 'stand'].includes(a.mode)) return false;
      if (a.role === 'keeper' && a.partner) return false;
      if (a.mode === 'chat' && a.partner) { const o = a.partner; settle(o); o.cool = 8; }
      const mid = { x: (a.x + player.x) / 2, z: (a.z + player.z) / 2 };
      const alert = { id: nextId++, x: mid.x, z: mid.z, fighters: [a], withPlayer: true, resolved: false, started: time };
      a.mode = 'fight'; a.anim = 'fight'; a.bubble = '!'; a.partner = player; a.t = 14; a.alert = alert; a.cool = 30;
      alerts.push(alert);
      say('fight', 'You started a scuffle! Police have been called.');
      dispatchPolice(alert, mid);
      return true;
    }
    // Talking to someone: they stop, face the visitor and wait until released.
    function hold(a) {
      if (a.flyer || !['walk', 'pause', 'stand', 'chat'].includes(a.mode)) return false;
      if (a.role === 'keeper' && a.partner) return false;
      if (a.mode === 'chat' && a.partner) { const o = a.partner; settle(o); o.cool = 8; }
      a.mode = 'listen'; a.anim = 'idle'; a.bubble = ''; a.partner = null; a.t = 120; return true;
    }
    function release(a) { if (a.mode === 'listen') { settle(a); a.cool = 8; } }
    function listenStep(a, dt) { face(a, player, dt); a.t -= dt; if (a.t <= 0) settle(a); }

    function fightStep(a, dt) {
      if (a.partner) face(a, a.partner, dt);
      a.t -= dt;
      const al = a.alert, far = a.partner === player && Math.hypot(a.x - player.x, a.z - player.z) > 8; // the visitor walked away
      if ((a.t <= 0 || far) && al && !al.resolved) { // nobody came: they calm down on their own
        al.resolved = true;
        al.fighters.forEach((f) => { if (f.mode === 'fight') { settle(f); f.cool = 20; } });
        say('calm', 'The scuffle ended without police.');
      }
    }
    function respondStep(p, dt) {
      if (p.alert.resolved) return resumeWalk(p, Crowd.nearestNode(graph, p.x, p.z));
      if (p.alert.withPlayer) p.goal = { x: player.x, z: player.z };            // officers head for the visitor
      followPath(p, dt, p.speed * RUN, () => {
        const al = p.alert; p.mode = 'cuff'; p.anim = 'idle'; p.t = 7; p.bubble = 'STOP!';
        if (!al.arrived) {
          al.arrived = true;
          say('police', 'Police arrived and broke up the fight.');
          al.fighters.forEach((f) => { f.mode = 'detained'; f.anim = 'handsup'; f.bubble = ''; f.t = 7; });
          if (al.withPlayer) { player.detainedUntil = time + 7; player.warned++; }
        }
      });
    }
    function cuffStep(p, dt) {
      const al = p.alert, f = al && al.fighters[0];
      if (f) face(p, f, dt);
      p.t -= dt; if (p.t < 5) p.bubble = '';
      if (p.t <= 0) {
        if (al && !al.resolved) { al.resolved = true; say('detain', al.withPlayer ? 'Police warned you and the other person and sent you on your way.' : 'The two people were warned and sent on their way.'); al.fighters.forEach((x) => { if (x.mode === 'detained') { settle(x); x.cool = 30; } }); }
        resumeWalk(p, Crowd.nearestNode(graph, p.x, p.z));
      }
    }
    function detainedStep(a, dt) { if (a.alert && a.alert.arrived) { const p = agents.find((q) => q.mode === 'cuff' && q.alert === a.alert); if (p) face(a, p, dt); } a.t -= dt; if (a.t <= -3) settle(a); }

    function meetings() {
      const people = agents.filter((a) => a.role === 'citizen' && !a.flyer && !busy(a) && a.cool <= 0);
      const fights = alerts.filter((x) => !x.resolved).length;
      for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
        const a = people[i], b = people[j];
        if (busy(a) || busy(b) || a.cool > 0 || b.cool > 0 || Math.hypot(a.x - b.x, a.z - b.z) > 3.2) continue;
        const r = rand();
        if (r < chatRate) startChat(a, b);
        else if (r < chatRate + fightRate && fights < 2 && !agents.some((p) => p.role === 'police' && p.mode !== 'respond' && Math.hypot(p.x - a.x, p.z - a.z) < 10)) startFight(a, b);
        else { a.cool = b.cool = 5; }
      }
    }

    function step(dt) {
      time += dt; scan -= dt;
      if (scan <= 0) { scan = 0.5; meetings(); }
      for (const a of agents) {
        a.cool -= dt;
        switch (a.mode) {
          case 'walk': walk(a, dt); break;
          case 'pause': a.t -= dt; if (a.t <= 0) { a.mode = 'walk'; a.anim = 'walk'; } break;
          case 'chat': chatStep(a, dt); break;
          case 'fight': fightStep(a, dt); break;
          case 'detained': detainedStep(a, dt); break;
          case 'shop': shopStep(a, dt); break;
          case 'trade': tradeStep(a, dt); break;
          case 'respond': respondStep(a, dt); break;
          case 'cuff': cuffStep(a, dt); break;
          case 'listen': listenStep(a, dt); break;
          case 'stand': a.t -= dt; if (a.t <= 0 && a.anim === 'idle') { a.anim = 'wave'; a.t = 2; } else if (a.t <= 0 && a.anim === 'wave') { a.anim = 'idle'; a.t = 4 + rand() * 6; } break;
        }
      }
      if (alerts.length > 20) alerts.splice(0, alerts.length - 20);
    }
    return { agents, graph, shops, alerts, log, step, player, engagePlayer, hold, release, get time() { return time; } };
  }

  const api = { createSim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TimeWarpSocial = api;
})(typeof window !== 'undefined' ? window : globalThis);
