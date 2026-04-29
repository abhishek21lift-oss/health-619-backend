require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./index');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');

    // ── Clear existing data
    await client.query('TRUNCATE appointments, activities, body_measurements, health_metrics, clients, users RESTART IDENTITY CASCADE');

    // ── Admin
    const adminId = uuidv4();
    const trainerIds = [uuidv4(), uuidv4()];
    const clientUserIds = Array.from({ length: 6 }, () => uuidv4());
    const clientIds = Array.from({ length: 6 }, () => uuidv4());

    const hash = (pw) => bcrypt.hashSync(pw, 10);

    // ── Insert Admin
    await client.query(`INSERT INTO users(id,name,email,password,role,phone) VALUES($1,$2,$3,$4,$5,$6)`, [
      adminId, 'Abhishek Katiyar', 'admin@619fitness.com', hash('Admin@619'), 'admin', '+91-9999999999'
    ]);

    // ── Insert Trainers
    const trainers = [
      [trainerIds[0], 'Rajat Katiyar', 'rajat@619fitness.com', hash('Rajat@619'), 'trainer', '+91-8888888881'],
      [trainerIds[1], 'Riya Singh',    'riya@619fitness.com',  hash('Riya@619'),  'trainer', '+91-8888888882'],
    ];
    for (const t of trainers) {
      await client.query(`INSERT INTO users(id,name,email,password,role,phone) VALUES($1,$2,$3,$4,$5,$6)`, t);
    }

    // ── Insert Client Users
    const clientUsers = [
      [clientUserIds[0], 'Jayant Sharma',   'jayant@email.com',  hash('Client@1')],
      [clientUserIds[1], 'Rahul Rathore',   'rahul@email.com',   hash('Client@2')],
      [clientUserIds[2], 'Priya Verma',     'priya@email.com',   hash('Client@3')],
      [clientUserIds[3], 'Amit Tiwari',     'amit@email.com',    hash('Client@4')],
      [clientUserIds[4], 'Sneha Patel',     'sneha@email.com',   hash('Client@5')],
      [clientUserIds[5], 'Vikram Nair',     'vikram@email.com',  hash('Client@6')],
    ];
    for (const [id, name, email, password] of clientUsers) {
      await client.query(`INSERT INTO users(id,name,email,password,role) VALUES($1,$2,$3,$4,'client')`, [id, name, email, password]);
    }

    // ── Insert Client profiles
    const clientProfiles = [
      [clientIds[0], clientUserIds[0], trainerIds[0], '1992-05-14', 'male',   'Muscle Gain',    'No known conditions', '2024-01-10'],
      [clientIds[1], clientUserIds[1], trainerIds[0], '1988-11-20', 'male',   'Weight Loss',    'Mild hypertension',   '2024-02-01'],
      [clientIds[2], clientUserIds[2], trainerIds[1], '1995-03-08', 'female', 'Fitness',        'No known conditions', '2024-01-20'],
      [clientIds[3], clientUserIds[3], trainerIds[0], '1990-07-25', 'male',   'Strength',       'Knee injury history', '2024-03-05'],
      [clientIds[4], clientUserIds[4], trainerIds[1], '1997-01-15', 'female', 'Weight Loss',    'No known conditions', '2024-02-15'],
      [clientIds[5], clientUserIds[5], trainerIds[1], '1985-09-30', 'male',   'Endurance',      'Asthma (controlled)', '2024-01-05'],
    ];
    for (const [id, uid, tid, dob, gender, goal, notes, join_date] of clientProfiles) {
      await client.query(`INSERT INTO clients(id,user_id,trainer_id,date_of_birth,gender,goal,health_notes,join_date)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, uid, tid, dob, gender, goal, notes, join_date]);
    }

    // ── Insert Health Metrics (last 14 days per client)
    for (const cid of clientIds) {
      for (let d = 13; d >= 0; d--) {
        const dt = new Date(); dt.setDate(dt.getDate() - d);
        await client.query(`INSERT INTO health_metrics(client_id,recorded_at,blood_sugar,heart_rate,bp_systolic,bp_diastolic,weight_kg,height_cm)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [
          cid, dt,
          (75 + Math.random() * 30).toFixed(1),
          Math.floor(65 + Math.random() * 35),
          Math.floor(110 + Math.random() * 30),
          Math.floor(68 + Math.random() * 14),
          (65 + Math.random() * 30).toFixed(1),
          (160 + Math.random() * 20).toFixed(1)
        ]);
      }
    }

    // ── Insert Body Measurements
    const measurements = [
      [clientIds[0], 44.5, 34.0, 38.0, 15.0, 22.0, 14.5, 'Inverted Triangle'],
      [clientIds[1], 42.0, 38.0, 40.5, 13.5, 23.0, 22.0, 'Rectangle'],
      [clientIds[2], 36.0, 28.0, 38.0, 11.0, 21.0, 18.5, 'Hourglass'],
      [clientIds[3], 46.0, 36.0, 39.0, 16.0, 25.0, 16.0, 'Inverted Triangle'],
      [clientIds[4], 35.0, 30.0, 40.0, 11.5, 22.0, 24.0, 'Pear'],
      [clientIds[5], 43.0, 35.0, 38.5, 14.5, 24.0, 12.0, 'Rectangle'],
    ];
    for (const [cid, chest, waist, hip, bicep, thigh, bfat, shape] of measurements) {
      await client.query(`INSERT INTO body_measurements(client_id,chest_in,waist_in,hip_in,bicep_in,thigh_in,body_fat_pct,body_shape)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [cid, chest, waist, hip, bicep, thigh, bfat, shape]);
    }

    // ── Insert Activities (last 18 days)
    const activityTypes = ['aerobics','yoga','meditation','weight_training','cardio','hiit'];
    const intensities = ['low','moderate','high','very_high'];
    for (const cid of clientIds) {
      for (let d = 17; d >= 0; d--) {
        const dt = new Date(); dt.setDate(dt.getDate() - d);
        const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        const intensity = intensities[Math.floor(Math.random() * intensities.length)];
        await client.query(`INSERT INTO activities(client_id,activity_date,activity_type,duration_mins,intensity,calories_burned)
          VALUES($1,$2,$3,$4,$5,$6)`, [
          cid, dt, type,
          Math.floor(20 + Math.random() * 60),
          intensity,
          Math.floor(150 + Math.random() * 350)
        ]);
      }
    }

    // ── Insert Appointments
    const apptData = [
      [clientIds[0], trainerIds[0], 'Fitness Assessment', 2, 'upcoming', 'Annual review'],
      [clientIds[1], trainerIds[0], 'Diet Consultation',  1, 'upcoming', 'Review nutrition plan'],
      [clientIds[2], trainerIds[1], 'Progress Check',     3, 'upcoming', '8 week check-in'],
      [clientIds[3], trainerIds[0], 'Injury Follow-up',   1, 'upcoming', 'Knee rehab review'],
      [clientIds[4], trainerIds[1], 'Goal Setting',       5, 'upcoming', 'Q2 goals'],
      [clientIds[5], trainerIds[1], 'Cardio Test',        7, 'upcoming', 'VO2 max estimation'],
    ];
    for (const [cid, tid, title, daysAhead, status, notes] of apptData) {
      const dt = new Date(); dt.setDate(dt.getDate() + daysAhead);
      await client.query(`INSERT INTO appointments(client_id,trainer_id,title,appointment_date,status,notes)
        VALUES($1,$2,$3,$4,$5,$6)`, [cid, tid, title, dt, status, notes]);
    }

    console.log('✅ Seed complete!');
    console.log('');
    console.log('📋 Login credentials:');
    console.log('  Admin   → admin@619fitness.com  / Admin@619');
    console.log('  Trainer → rajat@619fitness.com  / Rajat@619');
    console.log('  Trainer → riya@619fitness.com   / Riya@619');
    console.log('  Client  → jayant@email.com      / Client@1');
    console.log('  Client  → rahul@email.com       / Client@2');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(process.exit.bind(process, 1));
