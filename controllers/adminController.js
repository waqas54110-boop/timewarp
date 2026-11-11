const { z } = require('zod');
const db = require('../config/database');
const { wrap } = require('../utils/helpers');

// Whitelisted resources: table and column names never come from user input.
const RESOURCES = {
  events: {
    table: 'events', label: 'Events', order: 'event_year, id',
    columns: ['id', 'title', 'event_year', 'category'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 255 },
      { name: 'event_year', label: 'Year (negative = BCE)', type: 'int', required: true, min: -5000, max: 3000 },
      { name: 'category', label: 'Category', type: 'text', max: 60 },
      { name: 'destination_id', label: 'Destination ID', type: 'int', min: 1 },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'image_url', label: 'Image URL (licensed / public domain)', type: 'text', max: 1000 },
      { name: 'source_url', label: 'Source URL', type: 'text', max: 1000 },
    ],
  },
  destinations: {
    table: 'destinations', label: 'Destinations', order: 'name',
    columns: ['id', 'name', 'country'],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 200 },
      { name: 'country', label: 'Country', type: 'text', max: 100 },
      { name: 'era_id', label: 'Era ID', type: 'int', min: 1 },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'image_url', label: 'Image URL', type: 'text', max: 1000 },
    ],
  },
  predictions: {
    table: 'predictions', label: 'Future scenarios', order: 'target_year, id',
    columns: ['id', 'title', 'target_year', 'category'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 255 },
      { name: 'target_year', label: 'Target year', type: 'int', required: true, min: 2027, max: 3000 },
      { name: 'category', label: 'Category', type: 'text', max: 100 },
      { name: 'confidence_level', label: 'Confidence (low / medium / high)', type: 'text', max: 30 },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'assumptions', label: 'Assumptions', type: 'textarea' },
      { name: 'author', label: 'Author', type: 'text', max: 100 },
    ],
  },
};

function getResource(req, res, next) {
  const r = Object.hasOwn(RESOURCES, req.params.resource) ? RESOURCES[req.params.resource] : null;
  if (!r) return next('route');
  req.resource = r;
  next();
}

function parseFields(resource, body) {
  const shape = {};
  for (const f of resource.fields) {
    let s;
    if (f.type === 'int') {
      s = z.coerce.number().int();
      if (f.min !== undefined) s = s.min(f.min);
      if (f.max !== undefined) s = s.max(f.max);
    } else {
      s = z.string().trim();
      if (f.max) s = s.max(f.max);
      if (f.required) s = s.min(1);
    }
    const empty = (v) => v === '' || v === undefined || v === null;
    shape[f.name] = f.required ? s : z.preprocess((v) => (empty(v) ? null : v), s.nullable());
  }
  return z.object(shape).safeParse(body || {});
}

async function audit(req, action, resource, recordId) {
  await db.query('INSERT INTO audit_log (user_id, action, resource, record_id) VALUES ($1,$2,$3,$4)', [req.session.user.id, action, resource, recordId]);
}

exports.getResource = getResource;

exports.index = wrap(async (req, res) => {
  const counts = {};
  for (const [k, r] of Object.entries(RESOURCES)) counts[k] = (await db.query(`SELECT COUNT(*)::int n FROM ${r.table}`)).rows[0].n;
  const log = (await db.query('SELECT a.*, u.username FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 10')).rows;
  res.render('admin/index', { title: 'Admin', resources: RESOURCES, counts, log });
});

exports.list = wrap(async (req, res) => {
  const r = req.resource;
  const rows = (await db.query(`SELECT ${r.columns.join(', ')} FROM ${r.table} ORDER BY ${r.order} LIMIT 500`)).rows;
  res.render('admin/list', { title: r.label, key: req.params.resource, r, rows });
});

exports.newForm = (req, res) => res.render('admin/form', { title: `New – ${req.resource.label}`, key: req.params.resource, r: req.resource, values: {}, errors: [], id: null });

exports.editForm = wrap(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const row = Number.isInteger(id) ? (await db.query(`SELECT * FROM ${req.resource.table} WHERE id = $1`, [id])).rows[0] : null;
  if (!row) return next();
  res.render('admin/form', { title: `Edit – ${req.resource.label}`, key: req.params.resource, r: req.resource, values: row, errors: [], id });
});

exports.save = wrap(async (req, res) => {
  const r = req.resource;
  const id = req.params.id ? parseInt(req.params.id, 10) : null;
  const parsed = parseFields(r, req.body);
  if (!parsed.success) {
    return res.status(400).render('admin/form', { title: r.label, key: req.params.resource, r, values: req.body, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`), id });
  }
  const names = r.fields.map((f) => f.name);
  const vals = names.map((n) => parsed.data[n]);
  let recordId = id;
  try {
    if (id) {
      const sets = names.map((n, i) => `${n} = $${i + 1}`).join(', ');
      await db.query(`UPDATE ${r.table} SET ${sets} WHERE id = $${names.length + 1}`, [...vals, id]);
    } else {
      const ph = names.map((_, i) => `$${i + 1}`).join(', ');
      recordId = (await db.query(`INSERT INTO ${r.table} (${names.join(', ')}) VALUES (${ph}) RETURNING id`, vals)).rows[0].id;
    }
  } catch (e) {
    if (e.code === '23503') {
      return res.status(400).render('admin/form', { title: r.label, key: req.params.resource, r, values: req.body, errors: ['A referenced ID (destination or era) does not exist.'], id });
    }
    throw e;
  }
  await audit(req, id ? 'update' : 'create', r.table, recordId);
  res.redirect(`/admin/${req.params.resource}`);
});

exports.remove = wrap(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return next();
  await db.query(`DELETE FROM ${req.resource.table} WHERE id = $1`, [id]);
  await audit(req, 'delete', req.resource.table, id);
  res.redirect(`/admin/${req.params.resource}`);
});
