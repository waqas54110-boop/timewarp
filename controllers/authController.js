const bcrypt = require('bcrypt');
const { wrap } = require('../utils/helpers');
const userModel = require('../models/userModel');

const COST = 12;
// Used to keep login timing similar when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

exports.registerForm = (req, res) => res.render('user/register', { title: 'Create account', errors: [], values: {} });
exports.loginForm = (req, res) => res.render('user/login', { title: 'Log in', errors: [], values: {} });

function startSession(req, user, cb) {
  const returnTo = req.session.returnTo;
  req.session.regenerate((err) => {
    if (err) return cb(err);
    req.session.user = { id: user.id, username: user.username, role: user.role };
    cb(null, returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard');
  });
}

exports.register = wrap(async (req, res, next) => {
  if (!req.valid) return res.status(400).render('user/register', { title: 'Create account', errors: req.validationErrors, values: { username: req.body.username, email: req.body.email } });
  const { username, email, password } = req.valid;
  if (await userModel.findByEmail(email)) {
    return res.status(400).render('user/register', { title: 'Create account', errors: ['An account with that email already exists.'], values: { username, email } });
  }
  const user = await userModel.create({ username, email, passwordHash: await bcrypt.hash(password, COST) });
  startSession(req, user, (err, dest) => (err ? next(err) : req.session.save(() => res.redirect(dest))));
});

exports.login = wrap(async (req, res, next) => {
  const fail = () => res.status(401).render('user/login', { title: 'Log in', errors: ['Invalid email or password.'], values: { email: req.body.email } });
  if (!req.valid) return fail();
  const user = await userModel.findByEmail(req.valid.email);
  const ok = await bcrypt.compare(req.valid.password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return fail();
  startSession(req, user, (err, dest) => (err ? next(err) : req.session.save(() => res.redirect(dest))));
});

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('tw.sid');
    res.redirect('/');
  });
};
