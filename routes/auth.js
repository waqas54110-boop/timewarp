const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');
const auth = require('../controllers/authController');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: 'Too many attempts. Please try again later.' });

router.get('/register', auth.registerForm);
router.post('/register', limiter, validate('register'), auth.register);
router.get('/login', auth.loginForm);
router.post('/login', limiter, validate('login'), auth.login);
router.post('/logout', requireAuth, auth.logout);

module.exports = router;
