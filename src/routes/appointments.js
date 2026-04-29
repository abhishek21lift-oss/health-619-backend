const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/appointments
router.get('/', async (req, res, next) => {
  try {
    let sql, params = [];
    const base = `SELECT a.*, u.name AS client_name, t.name AS trainer_name
      FROM appointments a
      JOIN clients c ON c.id = a.client_id
      JOIN users u ON u.id = c.user_id
      LEFT JOIN users t ON t.id = a.trainer_id`;

    if (req.user.role === 'admin') {
      sql = `${base} ORDER BY a.appointment_date ASC`;
    } else if (req.user.role === 'trainer') {
      sql = `${base} WHERE a.trainer_id = $1 ORDER BY a.appointment_date ASC`;
      params = [req.user.id];
    } else {
      sql = `${base} WHERE c.user_id = $1 ORDER BY a.appointment_date ASC`;
      params = [req.user.id];
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/appointments
router.post('/', async (req, res, next) => {
  try {
    const { client_id, trainer_id, title, appointment_date, duration_mins, location, notes } = req.body;
    const result = await query(
      `INSERT INTO appointments(client_id,trainer_id,title,appointment_date,duration_mins,location,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client_id, trainer_id, title, appointment_date, duration_mins || 60, location, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/appointments/:id/status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await query(
      'UPDATE appointments SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/appointments/:id
router.delete('/:id', requireRole('admin','trainer'), async (req, res, next) => {
  try {
    await query('DELETE FROM appointments WHERE id=$1', [req.params.id]);
    res.json({ message: 'Appointment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
