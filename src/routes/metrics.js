const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/metrics/:clientId
router.get('/:clientId', async (req, res, next) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const result = await query(
      `SELECT * FROM health_metrics WHERE client_id = $1
       ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [req.params.clientId, limit, offset]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/metrics/:clientId
router.post('/:clientId', async (req, res, next) => {
  try {
    const { blood_sugar, heart_rate, bp_systolic, bp_diastolic, weight_kg, height_cm, notes } = req.body;
    const result = await query(
      `INSERT INTO health_metrics(client_id,blood_sugar,heart_rate,bp_systolic,bp_diastolic,weight_kg,height_cm,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.clientId, blood_sugar, heart_rate, bp_systolic, bp_diastolic, weight_kg, height_cm, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// GET /api/metrics/:clientId/trends — weekly averages
router.get('/:clientId/trends', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT DATE_TRUNC('week', recorded_at) AS week,
         ROUND(AVG(blood_sugar),1) AS avg_blood_sugar,
         ROUND(AVG(heart_rate),0) AS avg_heart_rate,
         ROUND(AVG(bp_systolic),0) AS avg_bp_systolic,
         ROUND(AVG(bp_diastolic),0) AS avg_bp_diastolic,
         ROUND(AVG(weight_kg),1) AS avg_weight
       FROM health_metrics WHERE client_id = $1
         AND recorded_at > NOW() - INTERVAL '12 weeks'
       GROUP BY week ORDER BY week`,
      [req.params.clientId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
