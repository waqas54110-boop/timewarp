const { z } = require('zod');

const blank = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optInt = z.preprocess(blank, z.coerce.number().int().optional());
const optStr = (max) => z.preprocess(blank, z.string().trim().max(max).optional());

const YEAR_MIN = -5000;
const YEAR_MAX = 3000;
const year = z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX);

const schemas = {
  register: z.object({
    username: z.string().trim().min(3).max(50),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(128),
  }),
  login: z.object({
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(1).max(128),
  }),
  journey: z.object({
    selectedYear: year,
    travelType: z.enum(['past', 'present', 'future']),
    destinationId: optInt,
  }),
  events: z.object({
    from: z.preprocess(blank, year.optional()),
    to: z.preprocess(blank, year.optional()),
    destinationId: optInt,
    country: optStr(100),
    category: optStr(60),
    q: optStr(100),
    page: z.preprocess(blank, z.coerce.number().int().min(1).max(10000).default(1)),
  }),
  quizSubmit: z.object({
    answers: z.array(z.object({ id: z.coerce.number().int(), answer: z.string().max(255) })).min(1).max(50),
  }),
};

// validate(schema, 'query' | 'body') -> req.valid, or respond with 400
function validate(name, source = 'body') {
  return (req, res, next) => {
    const result = schemas[name].safeParse(req[source] || {});
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`);
      if (req.originalUrl.startsWith('/api')) return res.status(400).json({ error: 'Validation failed', issues });
      req.validationErrors = issues;
      req.valid = null;
      return next();
    }
    req.valid = result.data;
    next();
  };
}

module.exports = { validate, schemas, optInt, optStr, YEAR_MIN, YEAR_MAX };
