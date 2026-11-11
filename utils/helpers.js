const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function formatYear(y) {
  if (y === null || y === undefined) return '';
  return y < 0 ? `${-y} BCE` : y < 1000 ? `${y} CE` : String(y);
}

function parsePage(req) {
  const p = parseInt(req.query.page, 10);
  return Number.isFinite(p) && p > 0 ? Math.min(p, 10000) : 1;
}

function buildPager(req, total, limit, page) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const url = (n) => {
    const p = new URLSearchParams(req.query);
    p.set('page', n);
    return `${req.path}?${p.toString()}`;
  };
  return { page, pages, total, prev: page > 1 ? url(page - 1) : null, next: page < pages ? url(page + 1) : null };
}

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

module.exports = { wrap, formatYear, parsePage, buildPager, escapeLike };
