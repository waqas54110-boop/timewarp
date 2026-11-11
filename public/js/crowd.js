// Pure layout + pedestrian-graph helpers for the Live World (no Three.js, so they can be unit tested).
// Layout: N x N blocks, pitch P. Roads run between blocks and around them; sidewalks hug each block.
(function (root) {
  const SIDEWALK = 7.75; // distance from a block centre to the sidewalk centre line

  const blockCenters = (N, P) => Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * P);
  const roadCenters = (N, P) => Array.from({ length: N + 1 }, (_, k) => (k - N / 2) * P);

  // Pedestrian graph: the 4 sidewalk corners of every block. Edges follow the sidewalk of one block,
  // plus crossings of the road to the neighbouring block.
  function makeGrid(N, P) {
    const cs = blockCenters(N, P), nodes = [], idx = new Map();
    const key = (i, j, sx, sz) => `${i},${j},${sx},${sz}`;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      idx.set(key(i, j, sx, sz), nodes.length);
      nodes.push({ x: cs[i] + sx * SIDEWALK, z: cs[j] + sz * SIDEWALK, nb: [] });
    }
    const link = (a, b) => { if (!nodes[a].nb.includes(b)) { nodes[a].nb.push(b); nodes[b].nb.push(a); } };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const a = idx.get(key(i, j, sx, sz));
        link(a, idx.get(key(i, j, -sx, sz)));
        link(a, idx.get(key(i, j, sx, -sz)));
      }
      for (const s of [-1, 1]) {
        if (i + 1 < N) link(idx.get(key(i, j, 1, s)), idx.get(key(i + 1, j, -1, s)));
        if (j + 1 < N) link(idx.get(key(i, j, s, 1)), idx.get(key(i, j + 1, s, -1)));
      }
    }
    return nodes;
  }

  // Next corner to walk to: anything but the corner we just came from (unless it is a dead end).
  function pickNext(rand, nodes, cur, prev) {
    const nb = nodes[cur].nb, opts = nb.filter((n) => n !== prev), list = opts.length ? opts : nb;
    return list[Math.floor(rand() * list.length) % list.length];
  }

  // Closest corner to a point, and the shortest corner-to-corner route (breadth-first search).
  function nearestNode(nodes, x, z) {
    let best = 0, bd = Infinity;
    nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function shortestPath(nodes, from, to) {
    if (from === to) return [from];
    const prev = new Map([[from, -1]]), q = [from];
    for (let h = 0; h < q.length; h++) {
      const cur = q[h];
      for (const n of nodes[cur].nb) {
        if (prev.has(n)) continue;
        prev.set(n, cur);
        if (n === to) { const path = [to]; let c = cur; while (c !== -1) { path.push(c); c = prev.get(c); } return path.reverse(); }
        q.push(n);
      }
    }
    return [from];
  }

  // Wrap a coordinate into [-ext/2, ext/2).
  const wrap = (v, ext) => ((((v + ext / 2) % ext) + ext) % ext) - ext / 2;

  const api = { SIDEWALK, blockCenters, roadCenters, makeGrid, pickNext, nearestNode, shortestPath, wrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TimeWarpCrowd = api;
})(typeof window !== 'undefined' ? window : globalThis);
