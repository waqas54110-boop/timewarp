function notFound(req, res) {
  if (req.originalUrl.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.status(404).render('errors/error', { title: 'Not found', status: 404, message: 'This moment in time does not exist.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message = status >= 500 ? 'Something went wrong in the time stream.' : err.message;
  if (req.originalUrl.startsWith('/api')) return res.status(status).json({ error: message });
  res.status(status).render('errors/error', { title: 'Error', status, message });
}

module.exports = { notFound, errorHandler };
