const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const result = await query(
      'SELECT id, name, email, password, role, avatar_url, phone FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user.id);
    const { password: _, ...userSafe } = user;

    res.json({ token, user: userSafe });
  } catch (err) { next(err); }
});

// POST /api/auth/register (admin-only in prod, open for demo)
router.post('/register', [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(['admin','trainer','client'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role = 'client', phone } = req.body;

    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users(name,email,password,role,phone) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role,phone,created_at',
      [name, email, hashed, role, phone]
    );

    const user = result.rows[0];
    // Create client profile if role is client
    if (role === 'client') {
      await query('INSERT INTO clients(user_id) VALUES($1)', [user.id]);
    }

    const token = signToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url, u.phone, u.created_at,
        c.id AS client_id, c.trainer_id, c.goal, c.date_of_birth, c.gender
       FROM users u
       LEFT JOIN clients c ON c.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, [
  body('currentPassword').isLength({ min: 6 }),
  body('newPassword').isLength({ min: 6 })
], async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
