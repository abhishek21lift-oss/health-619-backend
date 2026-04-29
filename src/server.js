require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const metricsRoutes = require('./routes/metrics');
const appointmentRoutes = require('./routes/appointments');
const activityRoutes = require('./routes/activities');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// ── Security headers
app.use(helmet());

// ── CORS
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));

// ── Body parser
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' }
});

// ── Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: '619 Health Dashboard API' });
});

// ── Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 619 Health API running on port ${PORT}`);
});

module.exports = app;
