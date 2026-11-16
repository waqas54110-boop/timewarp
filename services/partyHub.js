// "Time Party": real-time rooms (WebSocket) where visitors of the same scene see each other's cursors and chat.
// Rooms live in memory only: nothing is stored, nothing survives a restart.
const crypto = require('crypto');

const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const MAX_ROOM = 12, MAX_MSGS_PER_SEC = 30, CHAT_GAP_MS = 700, MAX_CHAT = 200;
const rooms = new Map(); // code -> Set<client>

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const publicUser = (c) => ({ id: c.id, name: c.name, color: c.color });
function broadcast(room, obj, except) {
  const set = rooms.get(room);
  if (set) set.forEach((c) => { if (c !== except) send(c.ws, obj); });
}
const cleanText = (s) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT);

function join(ws, roomRaw, user, now = Date.now) {
  const room = String(roomRaw || '').toUpperCase();
  if (!ROOM_RE.test(room)) { send(ws, { t: 'error', message: 'Invalid party code.' }); ws.close(1008, 'bad room'); return null; }
  const set = rooms.get(room) || new Set();
  if (set.size >= MAX_ROOM) { send(ws, { t: 'error', message: 'This party is full.' }); ws.close(1008, 'full'); return null; }

  const id = crypto.randomBytes(4).toString('hex');
  const client = {
    ws, id, room, tokens: [], lastChat: 0,
    name: user && user.username ? String(user.username).slice(0, 30) : `Guest-${id.slice(0, 4)}`,
    color: `hsl(${(parseInt(id, 16) % 360)} 85% 62%)`,
  };
  set.add(client); rooms.set(room, set);

  send(ws, { t: 'hello', you: publicUser(client), users: [...set].map(publicUser) });
  broadcast(room, { t: 'join', user: publicUser(client) }, client);

  ws.on('message', (data) => {
    const t = now();
    client.tokens = client.tokens.filter((x) => t - x < 1000);
    if (client.tokens.length >= MAX_MSGS_PER_SEC) return; // flood: drop silently
    client.tokens.push(t);
    let m;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'move') {
      const x = Number(m.x), y = Number(m.y);
      if (Number.isFinite(x) && Number.isFinite(y)) broadcast(room, { t: 'move', id, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }, client);
    } else if (m.t === 'chat') {
      const text = cleanText(m.text == null ? '' : m.text);
      if (!text || t - client.lastChat < CHAT_GAP_MS) return;
      client.lastChat = t;
      broadcast(room, { t: 'chat', id, name: client.name, color: client.color, text, at: t });
    }
  });
  const leave = () => {
    const s = rooms.get(room);
    if (!s || !s.delete(client)) return;
    if (!s.size) rooms.delete(room); else broadcast(room, { t: 'leave', id });
  };
  ws.on('close', leave);
  ws.on('error', leave);
  return client;
}

// Same-origin only (browsers send Origin on WebSocket handshakes).
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

function attach(server, sessionMiddleware) {
  const { WebSocketServer } = require('ws'); // loaded lazily so the rest of the app runs without it
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  server.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return socket.destroy(); }
    if (url.pathname !== '/ws/party') return socket.destroy();
    if (!originOk(req)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy(); }
    const accept = () => wss.handleUpgrade(req, socket, head, (ws) => {
      ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
      join(ws, url.searchParams.get('room'), req.session && req.session.user);
    });
    sessionMiddleware(req, {}, accept); // guests are fine: session just carries the username when signed in
  });
  const timer = setInterval(() => wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }), 30000);
  timer.unref();
  return wss;
}

module.exports = { attach, join, originOk, rooms, ROOM_RE, MAX_ROOM };
