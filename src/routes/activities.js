const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/activities/:clientId
router.get('/:clientId', async (req, res, next) => {
  try {
    const { days = 18 } = req.query;
    const result = await query(
      `SELECT * FROM activities WHERE client_id = $1
         AND activity_date > NOW() - ($2 || ' days')::INTERVAL
       ORDER BY activity_date ASC`,
      [req.params.clientId, days]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/activities/:clientId
router.post('/:clientId', async (req, res, next) => {
  try {
    const { activity_type, activity_date, duration_mins, intensity, heart_rate_avg, calories_burned, notes } = req.body;
    const result = await query(
      `INSERT INTO activities(client_id,activity_type,activity_date,duration_mins,intensity,heart_rate_avg,calories_burned,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.clientId, activity_type, activity_date || new Date(), duration_mins, intensity, heart_rate_avg, calories_burned, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
