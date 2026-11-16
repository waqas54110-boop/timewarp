const wantsJson = (req) => req.originalUrl.startsWith('/api') || req.get('accept')?.includes('application/json');

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  if (wantsJson(req)) return res.status(401).json({ error: 'Authentication required' });
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    const u = req.session.user;
    if (!u) return requireAuth(req, res, next);
    if (!roles.includes(u.role)) {
      if (wantsJson(req)) return res.status(403).json({ error: 'Forbidden' });
      const err = new Error('You do not have permission to access this page.');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, wantsJson };
