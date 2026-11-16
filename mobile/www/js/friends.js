// Friendship with the people of the Live World: you pick what to say, they remember. Kept in this browser only (localStorage).
// Levels: Ajnabi (stranger) < Jaan-pehchaan < Dost < Qareebi dost < Jigri yaar. Pure rules are tested in tests/friends.test.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpFriends = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'timewarp-friends-v1';
  const LEVELS = [[0, 'Ajnabi'], [15, 'Jaan-pehchaan'], [40, 'Dost'], [70, 'Qareebi dost'], [90, 'Jigri yaar']];
  const OPTIONS = [
    { id: 'salam', label: 'Salam karo', gain: 3, minLevel: 0 },
    { id: 'praise', label: 'Taareef karo', gain: 4, minLevel: 0 },
    { id: 'joke', label: 'Mazaq sunao', gain: 5, risk: 0.35, minLevel: 0 },
    { id: 'ask', label: 'Madad maango', gain: 3, minLevel: 1 },
    { id: 'gift', label: 'Chhota tohfa do (Rs 50)', gain: 8, cost: 50, minLevel: 0 },
    { id: 'secret', label: 'Dil ki baat karo', gain: 6, minLevel: 2 },
  ];
  const levelOf = (pts) => { let l = 0; LEVELS.forEach(([min], i) => { if (pts >= min) l = i; }); return l; };
  const levelName = (pts) => LEVELS[levelOf(pts)][1];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const REPLIES = {
    salam: ['Wa alaikum assalam! Kaise hain?', 'Salam! Aap ko dekh kar acha laga.', 'Salam salam! Aaj mausam acha hai na?'],
    praise: ['Shukriya, aap bohat meharbaan hain!', 'Arre, aap ki baat dil ko lagi.', 'Aap ke munh mein ghee shakkar!'],
    jokeGood: ['Haha! Ye to maza aa gaya.', 'Hahaha, ye main aaj sab ko sunaunga!'],
    jokeBad: ['Hmm... mazaq thora purana tha.', 'Samajh nahi aaya, par koshish achi thi.'],
    giftOk: ['Arre iski kya zaroorat thi! Bohat shukriya.', 'Aap ka tohfa mujhe hamesha yaad rahega.'],
    giftNo: ['Aap ke paas paise nahi hain, koi baat nahi, dosti kaafi hai.'],
    askLow: ['Abhi to hum theek se jaante bhi nahi, thora aur mil lein.'],
    askOk: ['Zaroor! Dost ki madad karna meri khushi hai.', 'Bataiye, kya masla hai? Main hazir hoon.'],
    secret: ['Aap par bharosa hai, isi liye bata raha hoon...', 'Ye baat sirf aap se kehta hoon.'],
    secretLow: ['Abhi itni dosti nahi hui.'],
  };
  const pickLine = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
  const dayKey = (d) => (d || new Date()).toISOString().slice(0, 10);

  // state = { [npcKey]: { pts, day, used: {optionId: count today} } }
  function get(state, key) { const e = state[key] || (state[key] = { pts: 0, day: '', used: {} }); return e; }
  // available(state, key) -> the options the player may pick now (locked ones are listed with a reason)
  function available(state, key, wallet) {
    const e = get(state, key), lv = levelOf(e.pts);
    return OPTIONS.map((o) => ({ id: o.id, label: o.label, locked: lv < o.minLevel || (o.cost && wallet < o.cost), why: lv < o.minLevel ? 'Pehle ' + LEVELS[o.minLevel][1] + ' banein' : o.cost && wallet < o.cost ? 'Paisa kam hai' : '' }));
  }
  // talk(state, key, optionId, rand, {wallet, day}) -> { reply, delta, cost, level, levelUp, pts }. The same choice again on the same day counts only 1 point.
  function talk(state, key, optionId, rand, ctx) {
    const o = OPTIONS.find((x) => x.id === optionId); if (!o) throw new Error('Unknown option');
    const c = ctx || {}, e = get(state, key), today = dayKey(c.day), lvBefore = levelOf(e.pts);
    if (e.day !== today) { e.day = today; e.used = {}; }
    if (lvBefore < o.minLevel) return { reply: pickLine(o.id === 'ask' ? REPLIES.askLow : REPLIES.secretLow, rand), delta: 0, cost: 0, level: lvBefore, levelUp: false, pts: e.pts };
    if (o.cost && (c.wallet || 0) < o.cost) return { reply: pickLine(REPLIES.giftNo, rand), delta: 0, cost: 0, level: lvBefore, levelUp: false, pts: e.pts };
    let delta = o.gain, reply;
    if (o.id === 'joke') { if (rand() < o.risk) { delta = -2; reply = pickLine(REPLIES.jokeBad, rand); } else reply = pickLine(REPLIES.jokeGood, rand); }
    else if (o.id === 'gift') reply = pickLine(REPLIES.giftOk, rand);
    else if (o.id === 'ask') reply = pickLine(REPLIES.askOk, rand);
    else reply = pickLine(REPLIES[o.id], rand);
    const n = e.used[o.id] || 0; e.used[o.id] = n + 1;
    if (n > 0 && delta > 0) delta = 1;
    e.pts = clamp(e.pts + delta, 0, 100);
    const lv = levelOf(e.pts);
    return { reply, delta, cost: o.cost || 0, level: lv, levelUp: lv > lvBefore, pts: e.pts };
  }
  function load(storage) { try { const v = JSON.parse(storage.getItem(KEY)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function save(storage, state) { try { const keys = Object.keys(state); if (keys.length > 300) keys.sort((a, b) => state[a].pts - state[b].pts).slice(0, keys.length - 300).forEach((k) => delete state[k]); storage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }

  // mount(container, {key, name, getWallet, spend, say}) draws the choice buttons (browser only)
  function mount(container, o) {
    const state = load(window.localStorage);
    const head = document.createElement('p'); head.className = 'friend-head small';
    const row = document.createElement('div'); row.className = 'friend-row';
    container.replaceChildren(head, row);
    const render = () => {
      const e = get(state, o.key); head.textContent = '🤝 ' + o.name + ': ' + levelName(e.pts) + ' (' + e.pts + ' / 100)';
      row.replaceChildren(...available(state, o.key, o.getWallet()).map((a) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = a.label; if (a.locked) { b.disabled = true; b.title = a.why; }
        b.addEventListener('click', () => {
          const r = talk(state, o.key, a.id, Math.random, { wallet: o.getWallet() });
          if (r.cost) o.spend(r.cost);
          o.say(r.reply + (r.delta ? '  (' + (r.delta > 0 ? '+' : '') + r.delta + ' dosti)' : '') + (r.levelUp ? '  🎉 Ab aap ' + levelName(r.pts) + ' hain!' : ''));
          save(window.localStorage, state); render();
        });
        return b;
      }));
    };
    render();
  }
  return { KEY, LEVELS, OPTIONS, levelOf, levelName, available, talk, load, save, mount };
});
