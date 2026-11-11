(() => {
  const scene = document.getElementById('journey');
  const panel = document.getElementById('party-panel');
  const toggle = document.getElementById('party-toggle');
  if (!scene || !panel || !toggle) return;
  const $ = (s) => document.getElementById(s);
  const CODE_RE = /^[A-Z0-9]{4,8}$/;
  const COLOR_RE = /^hsl\(\d{1,3} 85% 62%\)$/;
  const users = new Map(), cursors = new Map();
  let ws = null, me = null, code = '', lastSent = 0, leaving = false;

  const setMsg = (t) => { $('party-msg').textContent = t || ''; };
  const showPanel = (open) => { panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
  const live = (on) => { $('party-start').hidden = on; $('party-live').hidden = !on; };
  const updateCount = () => { $('party-count').textContent = users.size ? `${users.size} here` : ''; };

  function addLog(name, color, text, mine) {
    const li = document.createElement('li');
    const b = document.createElement('strong');
    b.textContent = name + ': ';
    if (COLOR_RE.test(color)) b.style.color = color;
    li.append(b, document.createTextNode(text));
    if (mine) li.className = 'mine';
    const log = $('party-log');
    log.append(li);
    while (log.children.length > 80) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function system(text) { const li = document.createElement('li'); li.className = 'sys'; li.textContent = text; $('party-log').append(li); $('party-log').scrollTop = $('party-log').scrollHeight; }

  function cursorFor(user) {
    let c = cursors.get(user.id);
    if (!c) {
      const el = document.createElement('div'); el.className = 'party-cursor'; el.setAttribute('aria-hidden', 'true');
      const dot = document.createElement('i'); const label = document.createElement('span'); label.textContent = user.name;
      el.append(dot, label);
      if (COLOR_RE.test(user.color)) el.style.setProperty('--c', user.color);
      scene.append(el); c = { el, seen: Date.now() }; cursors.set(user.id, c);
    }
    return c;
  }
  function dropCursor(id) { const c = cursors.get(id); if (c) { c.el.remove(); cursors.delete(id); } }

  function connect(room) {
    code = room; leaving = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    setMsg('Connecting…');
    ws = new WebSocket(`${proto}://${location.host}/ws/party?room=${encodeURIComponent(room)}`);
    ws.addEventListener('open', () => setMsg(''));
    ws.addEventListener('message', (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hello') {
        me = m.you; users.clear(); m.users.forEach((u) => users.set(u.id, u));
        $('party-code').textContent = room; live(true); updateCount();
        system(`You joined as ${me.name}.`);
      } else if (m.t === 'join') { users.set(m.user.id, m.user); updateCount(); system(`${m.user.name} joined.`); }
      else if (m.t === 'leave') { const u = users.get(m.id); users.delete(m.id); dropCursor(m.id); updateCount(); if (u) system(`${u.name} left.`); }
      else if (m.t === 'move') {
        const u = users.get(m.id); if (!u) return;
        const c = cursorFor(u); c.seen = Date.now();
        c.el.style.left = `${m.x * 100}%`; c.el.style.top = `${m.y * 100}%`; c.el.style.opacity = '1';
      } else if (m.t === 'chat') addLog(m.name, m.color, m.text, me && m.id === me.id);
      else if (m.t === 'error') setMsg(m.message);
    });
    ws.addEventListener('close', () => {
      cursors.forEach((_, id) => dropCursor(id)); users.clear(); updateCount();
      if (!leaving) { live(false); setMsg('Disconnected from the party. The server may not support Time Party yet (needs the ws package).'); }
    });
  }

  function newCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint8Array(5);
    crypto.getRandomValues(r);
    return [...r].map((n) => abc[n % abc.length]).join('');
  }
  function inviteUrl() { const u = new URL(location.href); u.searchParams.set('party', code); return u.href; }
  function start(room) {
    const u = new URL(location.href); u.searchParams.set('party', room); history.replaceState(null, '', u);
    connect(room);
  }

  toggle.addEventListener('click', () => showPanel(panel.hidden));
  $('party-close').addEventListener('click', () => { showPanel(false); toggle.focus(); });
  $('party-create').addEventListener('click', () => start(newCode()));
  $('party-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(inviteUrl()); setMsg('Invite link copied.'); } catch { setMsg(inviteUrl()); }
  });
  $('party-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('party-input'), text = input.value.trim();
    if (text && ws && ws.readyState === 1) { ws.send(JSON.stringify({ t: 'chat', text })); input.value = ''; }
  });
  scene.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (!ws || ws.readyState !== 1 || now - lastSent < 80) return;
    lastSent = now;
    ws.send(JSON.stringify({ t: 'move', x: +(e.clientX / innerWidth).toFixed(4), y: +(e.clientY / innerHeight).toFixed(4) }));
  });
  setInterval(() => { const t = Date.now(); cursors.forEach((c) => { if (t - c.seen > 6000) c.el.style.opacity = '0.25'; }); }, 2000);
  addEventListener('pagehide', () => { leaving = true; if (ws) ws.close(); });

  const fromUrl = (new URLSearchParams(location.search).get('party') || '').toUpperCase();
  if (CODE_RE.test(fromUrl)) { showPanel(true); connect(fromUrl); }
})();
