const { requireRole } = require('./auth');
module.exports = { editorOrAdmin: requireRole('editor', 'admin'), adminOnly: requireRole('admin') };
