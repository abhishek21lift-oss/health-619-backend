require('dotenv').config();
const { pool } = require('./index');

const migrations = `

-- ── EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS (Admin / Trainer / Client)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('admin','trainer','client')),
  avatar_url  TEXT,
  phone       VARCHAR(20),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENTS (extended profile linked to a user)
CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  trainer_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  date_of_birth   DATE,
  gender          VARCHAR(10),
  goal            VARCHAR(100),
  health_notes    TEXT,
  emergency_contact VARCHAR(100),
  join_date       DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── HEALTH METRICS (Blood sugar, Heart rate, Blood pressure)
CREATE TABLE IF NOT EXISTS health_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ DEFAULT NOW(),
  blood_sugar     NUMERIC(6,2),    -- mg/dL
  heart_rate      INTEGER,          -- bpm
  bp_systolic     INTEGER,          -- mmHg
  bp_diastolic    INTEGER,          -- mmHg
  weight_kg       NUMERIC(5,2),
  height_cm       NUMERIC(5,2),
  bmi             NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN height_cm > 0 AND weight_kg > 0
    THEN ROUND((weight_kg / ((height_cm/100.0) * (height_cm/100.0)))::NUMERIC, 2)
    ELSE NULL END
  ) STORED,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── BODY MEASUREMENTS
CREATE TABLE IF NOT EXISTS body_measurements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ DEFAULT NOW(),
  chest_in        NUMERIC(5,2),
  waist_in        NUMERIC(5,2),
  hip_in          NUMERIC(5,2),
  bicep_in        NUMERIC(5,2),
  thigh_in        NUMERIC(5,2),
  body_fat_pct    NUMERIC(5,2),
  body_shape      VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ACTIVITIES (workout sessions)
CREATE TABLE IF NOT EXISTS activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  activity_date   DATE DEFAULT CURRENT_DATE,
  activity_type   VARCHAR(50) NOT NULL, -- aerobics, yoga, meditation, weight_training, cardio, hiit
  duration_mins   INTEGER,
  intensity       VARCHAR(20) CHECK (intensity IN ('low','moderate','high','very_high')),
  heart_rate_avg  INTEGER,
  calories_burned INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  trainer_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  title           VARCHAR(150) NOT NULL,
  appointment_date TIMESTAMPTZ NOT NULL,
  duration_mins   INTEGER DEFAULT 60,
  status          VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming','completed','cancelled','no_show')),
  location        VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_health_metrics_client ON health_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_recorded ON health_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_client ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_clients_trainer ON clients(trainer_id);

-- ── UPDATED_AT trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations...');
    await client.query(migrations);
    console.log('✅ Migrations complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(process.exit.bind(process, 1));
