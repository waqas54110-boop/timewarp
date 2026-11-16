// TimeWarp Save System (browser side). One save slot with two parts: "life" (Life Mode) and "world" (Live World).
// Signed-in players are saved on the server (/api/save, /api/load, CSRF header). Guests are saved in this browser (localStorage).
// Pure logic with injected storage/fetch so tests/save.test.js can run it without a browser.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TimeWarpSave = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'timewarp-save-v1';
  const MIN_GAP = 4000; // server saves are at most one every 4 s; the last change always goes out

  function create(env) {
    const { storage, fetchFn, csrf, auth } = env;
    const now = env.now || (() => Date.now());
    const timers = env.timers || { set: setTimeout, clear: clearTimeout };
    const listeners = [];
    const pending = {};           // parts waiting to be sent to the server
    let lastSent = 0, timer = null, inflight = Promise.resolve();

    const status = (s) => listeners.forEach((fn) => { try { fn(s); } catch (e) { /* a listener must never break saving */ } });
    function readLocal() {
      try { const v = JSON.parse(storage.getItem(KEY)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
    }
    function writeLocal(patch, mode) {
      try {
        const cur = readLocal() || {};
        Object.assign(cur, patch, { lastMode: mode, savedAt: new Date(now()).toISOString() });
        storage.setItem(KEY, JSON.stringify(cur));
        return true;
      } catch (e) { return false; } // storage blocked or full
    }
    const headers = () => ({ 'Content-Type': 'application/json', 'x-csrf-token': csrf || '' });

    function flush() {
      timer = null;
      const body = Object.assign({}, pending);
      Object.keys(pending).forEach((k) => delete pending[k]);
      if (!Object.keys(body).length) return inflight;
      lastSent = now();
      status('saving');
      inflight = fetchFn('/api/save', { method: 'POST', headers: headers(), credentials: 'same-origin', keepalive: true, body: JSON.stringify(body) })
        .then((r) => { status(r.ok ? 'saved' : 'error'); return r.ok; })
        .catch(() => { status('error'); return false; });
      return inflight;
    }
    function queue(part, data) {
      pending[part] = data;
      if (timer) return inflight;
      const wait = Math.max(0, lastSent + MIN_GAP - now());
      if (!wait) return flush();
      timer = timers.set(flush, wait);
      return inflight;
    }
    function save(part, data) {
      if (part !== 'life' && part !== 'world' && part !== 'meta') throw new Error('part must be life, world or meta');
      if (!auth) { const cur = readLocal(); const ok = writeLocal({ [part]: data }, part === 'meta' ? ((cur && cur.lastMode) || 'life') : part); status(ok ? 'saved-local' : 'error'); return Promise.resolve(ok); }
      return queue(part, data);
    }
    // sends anything that is still waiting (page closing, "Save now")
    function flushNow() { if (timer) { timers.clear(timer); } return flush(); }

    // load() -> the save ({lastMode, life, world, savedAt}) or null
    async function load() {
      if (!auth) {
        const l = readLocal();
        return l && (l.life || l.world || l.meta) ? { lastMode: l.lastMode || (l.life ? 'life' : 'world'), life: l.life || null, world: l.world || null, meta: l.meta || null, savedAt: l.savedAt || null } : null;
      }
      try {
        const r = await fetchFn('/api/load', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!r.ok) return null;
        const j = await r.json();
        return j.save || null;
      } catch (e) { return null; }
    }
    // clear('life') = New Life, clear() = everything
    async function clear(part) {
      if (!auth) {
        const l = readLocal();
        if (!l) return true;
        if (part) { delete l[part]; l.lastMode = l.world ? 'world' : 'life'; try { storage.setItem(KEY, JSON.stringify(l)); } catch (e) { return false; } }
        else { try { storage.removeItem(KEY); } catch (e) { return false; } }
        return true;
      }
      if (part) delete pending[part]; else Object.keys(pending).forEach((k) => delete pending[k]);
      try { const r = await fetchFn('/api/save' + (part ? '?part=' + part : ''), { method: 'DELETE', headers: headers(), credentials: 'same-origin' }); return r.ok; } catch (e) { return false; }
    }
    // the save of THIS browser (what a guest has), even when signed in
    const local = () => readLocal();
    // adopt(): a signed-in player moves the browser's guest save into the account (parts the account already has are kept). Returns the parts moved.
    async function adopt(serverSave) {
      const l = readLocal(); if (!l || !auth) return [];
      const moved = [];
      for (const part of ['life', 'world', 'meta']) {
        if (l[part] && !(serverSave && serverSave[part])) { await queue(part, l[part]); moved.push(part); }
      }
      if (moved.length) { await flushNow(); try { storage.removeItem(KEY); } catch (e) { /* blocked */ } }
      return moved;
    }
    // exportJson(save) -> text of a save file; parseJson(text) -> { life, world, meta } or null (the caller validates the parts)
    const exportJson = (sv) => JSON.stringify({ app: 'timewarp', version: 1, life: sv.life || null, world: sv.world || null, meta: sv.meta || null }, null, 1);
    function parseJson(text) {
      try { const j = JSON.parse(text); return j && j.app === 'timewarp' ? { life: j.life || null, world: j.world || null, meta: j.meta || null } : null; } catch (e) { return null; }
    }
    return { save, load, clear, flushNow, local, adopt, exportJson, parseJson, onStatus: (fn) => listeners.push(fn), auth: !!auth };
  }

  const api = { create, KEY, MIN_GAP };
  if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
    let storage;
    try { storage = window.localStorage; storage.getItem(KEY); } catch (e) { storage = { getItem() { return null; }, setItem() { throw new Error('blocked'); }, removeItem() {} }; }
    const inst = create({ storage, fetchFn: (u, o) => fetch(u, o), csrf: document.body.dataset.csrf, auth: document.body.dataset.auth === '1' });
    Object.assign(api, inst);
    addEventListener('pagehide', () => { inst.flushNow(); });
  }
  return api;
});
