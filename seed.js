'use strict';

/**
 * seed.js — NurseExamPrep Database Seeder
 *
 * Run: node seed.js
 *
 * Seeds:
 *  - 1 Admin  : admin@nurseexamprep.ng / Admin@1234
 *  - 3 Students: amaka@student.ng / emeka@student.ng / ngozi@student.ng — all: Student@1234
 *  - 2 Categories: Adult Health Nursing, Maternal & Child Health Nursing
 *  - 7 questions per category (14 total), each with 4 options
 */

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function seed() {
  const db = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'nursing_exam_preparation_system',
    multipleStatements: false
  });

  console.log('✓ Connected to database');

  // ─── Clear existing data (reverse FK order) ───────────────────────
  await db.execute('DELETE FROM results');
  await db.execute('DELETE FROM options');
  await db.execute('DELETE FROM questions');
  await db.execute('DELETE FROM categories');
  await db.execute('DELETE FROM users');
  // Reset auto-increment
  await db.execute('ALTER TABLE users AUTO_INCREMENT = 1');
  await db.execute('ALTER TABLE categories AUTO_INCREMENT = 1');
  await db.execute('ALTER TABLE questions AUTO_INCREMENT = 1');
  await db.execute('ALTER TABLE options AUTO_INCREMENT = 1');
  await db.execute('ALTER TABLE results AUTO_INCREMENT = 1');
  console.log('✓ Cleared existing data');

  // ─── Hash passwords ───────────────────────────────────────────────
  const adminHash   = await bcrypt.hash('Admin@1234',   SALT_ROUNDS);
  const studentHash = await bcrypt.hash('Student@1234', SALT_ROUNDS);
  console.log('✓ Passwords hashed');

  // ─── Insert Users ─────────────────────────────────────────────────
  await db.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Administrator', 'admin@nurseexamprep.ng', adminHash, 'admin']);

  await db.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Amaka Okonkwo', 'amaka@student.ng', studentHash, 'student']);
  await db.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Emeka Nwosu', 'emeka@student.ng', studentHash, 'student']);
  await db.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Ngozi Adeyemi', 'ngozi@student.ng', studentHash, 'student']);
  console.log('✓ Users seeded (1 admin + 3 students)');

  // ─── Insert Categories ────────────────────────────────────────────
  const [cat1Result] = await db.execute(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    ['Adult Health Nursing',
     'Covers medical-surgical nursing, cardiac care, respiratory system, pharmacology, and general adult health topics for Nigerian nursing practice.']
  );
  const [cat2Result] = await db.execute(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    ['Maternal and Child Health Nursing',
     'Covers obstetrics, maternal care, neonatal nursing, pediatric health, immunization, and community child health aligned to NMCN standards.']
  );

  const cat1Id = cat1Result.insertId;
  const cat2Id = cat2Result.insertId;
  console.log('✓ Categories seeded (2 categories)');

  // ─── Question bank ────────────────────────────────────────────────
  const questions = {
    [cat1Id]: [
      {
        text: 'A patient presents with acute chest pain radiating to the left arm, diaphoresis, and shortness of breath. This presentation is most consistent with which condition?',
        options: [
          { text: 'Pleuritis',                              correct: false },
          { text: 'Myocardial Infarction',                  correct: true  },
          { text: 'Gastroesophageal Reflux Disease (GERD)', correct: false },
          { text: 'Costochondritis',                        correct: false }
        ]
      },
      {
        text: 'Which of the following is the PRIMARY assessment finding in a patient presenting with left-sided heart failure?',
        options: [
          { text: 'Peripheral pitting edema',               correct: false },
          { text: 'Ascites and hepatomegaly',               correct: false },
          { text: 'Pulmonary congestion and dyspnoea',      correct: true  },
          { text: 'Jugular vein distension',                correct: false }
        ]
      },
      {
        text: 'What is the normal adult respiratory rate range per minute?',
        options: [
          { text: '8–10 breaths per minute',   correct: false },
          { text: '12–20 breaths per minute',  correct: true  },
          { text: '22–28 breaths per minute',  correct: false },
          { text: '30–35 breaths per minute',  correct: false }
        ]
      },
      {
        text: 'A patient receiving intravenous heparin therapy should be monitored primarily using which laboratory value?',
        options: [
          { text: 'Prothrombin Time (PT)',                              correct: false },
          { text: 'Platelet count',                                     correct: false },
          { text: 'Activated Partial Thromboplastin Time (aPTT)',       correct: true  },
          { text: 'International Normalized Ratio (INR)',               correct: false }
        ]
      },
      {
        text: 'Which nursing intervention is MOST appropriate for a patient with a Grade II pressure ulcer?',
        options: [
          { text: 'Apply tight compression bandages to reduce movement',                       correct: false },
          { text: 'Reposition the patient every 2 hours and use pressure-relieving devices',   correct: true  },
          { text: 'Limit fluid intake to prevent wound seepage',                               correct: false },
          { text: 'Apply heat to the affected area to promote circulation',                    correct: false }
        ]
      },
      {
        text: 'The specific antidote used in the management of acetaminophen (paracetamol) overdose is:',
        options: [
          { text: 'Naloxone (Narcan)',           correct: false },
          { text: 'Flumazenil',                 correct: false },
          { text: 'N-acetylcysteine (Mucomyst)', correct: true  },
          { text: 'Atropine sulfate',            correct: false }
        ]
      },
      {
        text: 'Which position is MOST appropriate for a patient experiencing acute respiratory distress to maximally expand the lungs?',
        options: [
          { text: 'Supine with legs elevated',             correct: false },
          { text: 'Trendelenburg position',                correct: false },
          { text: "High Fowler's position (75–90 degrees)", correct: true  },
          { text: 'Left lateral decubitus position',       correct: false }
        ]
      }
    ],
    [cat2Id]: [
      {
        text: 'The normal duration of a full-term pregnancy calculated from the first day of the last menstrual period (LMP) is approximately:',
        options: [
          { text: '36 weeks (252 days)',  correct: false },
          { text: '38 weeks (266 days)',  correct: false },
          { text: '40 weeks (280 days)',  correct: true  },
          { text: '42 weeks (294 days)',  correct: false }
        ]
      },
      {
        text: 'Which combination of findings is a CARDINAL sign of preeclampsia according to clinical criteria?',
        options: [
          { text: 'Low blood pressure, generalised edema, and proteinuria',                          correct: false },
          { text: 'Hypertension (≥140/90 mmHg), significant proteinuria, and edema after 20 weeks', correct: true  },
          { text: 'Hypertension, haematuria, and glycosuria',                                        correct: false },
          { text: 'Normal blood pressure, proteinuria, and jaundice',                                correct: false }
        ]
      },
      {
        text: 'The APGAR score, used to assess the condition of a newborn, is routinely assessed at which time intervals after birth?',
        options: [
          { text: '1 minute and 5 minutes after birth',       correct: true  },
          { text: '5 minutes and 10 minutes after birth',     correct: false },
          { text: 'Immediately at birth and at 5 minutes',    correct: false },
          { text: '10 minutes and 20 minutes after birth',    correct: false }
        ]
      },
      {
        text: 'According to the Nigerian Expanded Programme on Immunization (EPI) schedule, which vaccines are administered to a newborn at birth?',
        options: [
          { text: 'DPT (Diphtheria, Pertussis, Tetanus)',      correct: false },
          { text: 'Oral Polio Vaccine (OPV0) and BCG',         correct: true  },
          { text: 'Measles vaccine and Vitamin A',             correct: false },
          { text: 'Hepatitis B and Tetanus Toxoid',            correct: false }
        ]
      },
      {
        text: 'According to WHO classification, a child with a weight-for-height Z-score (WHZ) of less than −3 SD is classified as:',
        options: [
          { text: 'Overweight',                         correct: false },
          { text: 'Moderate Acute Malnutrition (MAM)',  correct: false },
          { text: 'Severe Acute Malnutrition (SAM)',    correct: true  },
          { text: 'Underweight only',                   correct: false }
        ]
      },
      {
        text: 'The World Health Organization (WHO) recommends exclusive breastfeeding for a duration of:',
        options: [
          { text: '3 months',  correct: false },
          { text: '4 months',  correct: false },
          { text: '6 months',  correct: true  },
          { text: '12 months', correct: false }
        ]
      },
      {
        text: 'Eclampsia is differentiated from severe preeclampsia PRIMARILY by the occurrence of which clinical feature?',
        options: [
          { text: 'Severe hypertension (systolic ≥160 mmHg)',     correct: false },
          { text: 'Massive proteinuria (>5 g/24 hours)',          correct: false },
          { text: 'Grand mal (tonic-clonic) seizures or coma',    correct: true  },
          { text: 'Generalised pitting edema',                    correct: false }
        ]
      }
    ]
  };

  // ─── Insert questions + options ────────────────────────────────────
  let qCount = 0;
  for (const [catId, qs] of Object.entries(questions)) {
    for (const q of qs) {
      const [qResult] = await db.execute(
        'INSERT INTO questions (category_id, question_text) VALUES (?, ?)',
        [parseInt(catId, 10), q.text]
      );
      const qId = qResult.insertId;
      for (const opt of q.options) {
        await db.execute(
          'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
          [qId, opt.text, opt.correct ? 1 : 0]
        );
      }
      qCount++;
    }
  }
  console.log(`✓ Questions seeded (${qCount} questions with 4 options each)`);

  await db.end();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Seed complete! Default credentials:');
  console.log('  Admin:   admin@nurseexamprep.ng   →  Admin@1234');
  console.log('  Student: amaka@student.ng          →  Student@1234');
  console.log('  Student: emeka@student.ng          →  Student@1234');
  console.log('  Student: ngozi@student.ng          →  Student@1234');
  console.log('══════════════════════════════════════════════════════\n');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
