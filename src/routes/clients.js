const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/clients — admin/trainer sees all; client sees only self
router.get('/', async (req, res, next) => {
  try {
    let sql, params = [];
    if (req.user.role === 'admin') {
      sql = `SELECT u.id AS user_id, u.name, u.email, u.phone, u.created_at,
               c.id, c.trainer_id, c.date_of_birth, c.gender, c.goal, c.health_notes, c.join_date,
               t.name AS trainer_name,
               hm.blood_sugar, hm.heart_rate, hm.bp_systolic, hm.bp_diastolic, hm.weight_kg, hm.height_cm, hm.bmi
             FROM clients c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN users t ON t.id = c.trainer_id
             LEFT JOIN LATERAL (
               SELECT * FROM health_metrics WHERE client_id = c.id ORDER BY recorded_at DESC LIMIT 1
             ) hm ON true
             ORDER BY u.name`;
    } else if (req.user.role === 'trainer') {
      sql = `SELECT u.id AS user_id, u.name, u.email, u.phone, u.created_at,
               c.id, c.trainer_id, c.date_of_birth, c.gender, c.goal, c.health_notes, c.join_date,
               hm.blood_sugar, hm.heart_rate, hm.bp_systolic, hm.bp_diastolic, hm.weight_kg, hm.height_cm, hm.bmi
             FROM clients c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN LATERAL (
               SELECT * FROM health_metrics WHERE client_id = c.id ORDER BY recorded_at DESC LIMIT 1
             ) hm ON true
             WHERE c.trainer_id = $1
             ORDER BY u.name`;
      params = [req.user.id];
    } else {
      sql = `SELECT u.id AS user_id, u.name, u.email, u.phone,
               c.id, c.trainer_id, c.date_of_birth, c.gender, c.goal, c.health_notes, c.join_date
             FROM clients c JOIN users u ON u.id = c.user_id
             WHERE u.id = $1`;
      params = [req.user.id];
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/clients/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id AS user_id, u.name, u.email, u.phone, u.avatar_url,
         c.id, c.trainer_id, c.date_of_birth, c.gender, c.goal, c.health_notes, c.join_date,
         t.name AS trainer_name
       FROM clients c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users t ON t.id = c.trainer_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { goal, health_notes, date_of_birth, gender, emergency_contact } = req.body;
    const result = await query(
      `UPDATE clients SET goal=$1, health_notes=$2, date_of_birth=$3, gender=$4, emergency_contact=$5
       WHERE id=$6 RETURNING *`,
      [goal, health_notes, date_of_birth, gender, emergency_contact, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// GET /api/clients/:id/summary — full dashboard summary for a client
router.get('/:id/summary', async (req, res, next) => {
  try {
    const cid = req.params.id;

    // Latest metrics
    const metrics = await query(
      `SELECT * FROM health_metrics WHERE client_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [cid]);

    // Latest measurements
    const measurements = await query(
      `SELECT * FROM body_measurements WHERE client_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [cid]);

    // Metrics history (last 14 days)
    const metricsHistory = await query(
      `SELECT recorded_at::date AS date, ROUND(AVG(blood_sugar),1) AS blood_sugar,
         ROUND(AVG(heart_rate),0) AS heart_rate,
         ROUND(AVG(bp_systolic),0) AS bp_systolic,
         ROUND(AVG(bp_diastolic),0) AS bp_diastolic
       FROM health_metrics WHERE client_id = $1
         AND recorded_at > NOW() - INTERVAL '14 days'
       GROUP BY date ORDER BY date`, [cid]);

    // Activity last 18 days by type
    const activities = await query(
      `SELECT activity_date AS date, activity_type, SUM(duration_mins) AS total_mins
       FROM activities WHERE client_id = $1
         AND activity_date > NOW() - INTERVAL '18 days'
       GROUP BY date, activity_type ORDER BY date`, [cid]);

    // Next appointment
    const appt = await query(
      `SELECT a.*, u.name AS trainer_name FROM appointments a
       LEFT JOIN users u ON u.id = a.trainer_id
       WHERE a.client_id = $1 AND a.status = 'upcoming' AND a.appointment_date > NOW()
       ORDER BY a.appointment_date LIMIT 1`, [cid]);

    res.json({
      latestMetrics: metrics.rows[0] || null,
      latestMeasurements: measurements.rows[0] || null,
      metricsHistory: metricsHistory.rows,
      activities: activities.rows,
      nextAppointment: appt.rows[0] || null
    });
  } catch (err) { next(err); }
});

module.exports = router;
