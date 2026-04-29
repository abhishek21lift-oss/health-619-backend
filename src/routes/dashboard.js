const router = require('express').Router();
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dashboard/stats — admin/trainer overview
router.get('/stats', requireRole('admin','trainer'), async (req, res, next) => {
  try {
    const trainerFilter = req.user.role === 'trainer' ? 'AND c.trainer_id = $1' : '';
    const params = req.user.role === 'trainer' ? [req.user.id] : [];

    const totalClients = await query(
      `SELECT COUNT(*) FROM clients c WHERE 1=1 ${trainerFilter}`, params);

    const activeToday = await query(
      `SELECT COUNT(DISTINCT a.client_id) FROM activities a
       JOIN clients c ON c.id = a.client_id
       WHERE a.activity_date = CURRENT_DATE ${trainerFilter}`, params);

    const upcomingAppts = await query(
      `SELECT COUNT(*) FROM appointments a
       JOIN clients c ON c.id = a.client_id
       WHERE a.status = 'upcoming' AND a.appointment_date > NOW() ${trainerFilter}`, params);

    const avgBMI = await query(
      `SELECT ROUND(AVG(hm.bmi),1) AS avg_bmi
       FROM health_metrics hm
       JOIN clients c ON c.id = hm.client_id
       WHERE hm.recorded_at > NOW() - INTERVAL '7 days' ${trainerFilter}`, params);

    // Clients list with latest metrics
    const clients = await query(
      `SELECT u.name, u.email, c.id AS client_id, c.goal,
         hm.blood_sugar, hm.heart_rate, hm.bp_systolic, hm.bp_diastolic, hm.bmi, hm.weight_kg,
         hm.recorded_at AS last_check,
         t.name AS trainer_name
       FROM clients c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users t ON t.id = c.trainer_id
       LEFT JOIN LATERAL (
         SELECT * FROM health_metrics WHERE client_id = c.id ORDER BY recorded_at DESC LIMIT 1
       ) hm ON true
       ${req.user.role === 'trainer' ? 'WHERE c.trainer_id = $1' : ''}
       ORDER BY u.name`,
      params
    );

    // Recent appointments
    const recentAppts = await query(
      `SELECT a.title, a.appointment_date, a.status, u.name AS client_name, t.name AS trainer_name
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users t ON t.id = a.trainer_id
       WHERE a.appointment_date > NOW() ${trainerFilter}
       ORDER BY a.appointment_date ASC LIMIT 10`,
      params
    );

    res.json({
      stats: {
        totalClients: parseInt(totalClients.rows[0].count),
        activeToday: parseInt(activeToday.rows[0].count),
        upcomingAppointments: parseInt(upcomingAppts.rows[0].count),
        avgBMI: parseFloat(avgBMI.rows[0].avg_bmi) || 0
      },
      clients: clients.rows,
      upcomingAppointments: recentAppts.rows
    });
  } catch (err) { next(err); }
});

module.exports = router;
