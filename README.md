# NurseExamPrep

**Web-Based Examination Preparatory System with Randomized Automated Assessment for Nigerian Nursing Students**

A production-ready full-stack web application built with Node.js, Express, EJS, and MySQL.

---

## Features

- ✅ **Fisher-Yates Randomization** — question order AND option order shuffled independently every session
- ✅ **True CBT Interface** — countdown timer, question navigation panel, flag-for-review
- ✅ **Server-Side Grading** — correct answers never leave the server; grading is tamper-proof
- ✅ **Instant Results** — question-by-question review immediately after submission
- ✅ **Performance Analytics** — student history trends, admin leaderboard, category breakdowns
- ✅ **Role-Based Access** — Student portal + Admin panel with separate dashboards
- ✅ **Full Admin CRUD** — manage categories and question bank without touching code
- ✅ **3NF MySQL Schema** — referential integrity enforced via foreign keys

---

## Quick Start (Local)

### Prerequisites
- Node.js ≥ 18
- MySQL 8.0 running locally

### 1. Clone & Install
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

### 3. Create Database & Schema
```sql
-- In MySQL client:
CREATE DATABASE nursing_exam_preparation_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Then run the schema:
```bash
mysql -u root -p nursing_exam_preparation_system < schema.sql
```

### 4. Seed the Database
```bash
npm run seed
```

### 5. Start the Server
```bash
npm run dev     # development (nodemon)
# or
npm start       # production
```

Open **http://localhost:3000**

---

## Docker (recommended)

```bash
# Copy and configure .env
cp .env.example .env
# Set DB_PASSWORD, DB_NAME, SESSION_SECRET in .env

# Start everything (MySQL + app)
docker compose up -d

# Seed the database (first run only)
docker compose exec app node seed.js
```

---

## Default Test Credentials

| Role    | Email                       | Password      |
|---------|-----------------------------|---------------|
| Admin   | admin@nurseexamprep.ng      | Admin@1234    |
| Student | amaka@student.ng            | Student@1234  |
| Student | emeka@student.ng            | Student@1234  |
| Student | ngozi@student.ng            | Student@1234  |

---

## Project Structure

```
├── app.js                    # Express entry point
├── schema.sql                # MySQL schema (5 tables, 3NF, FK-enforced)
├── seed.js                   # Database seeder (run once)
├── Dockerfile
├── docker-compose.yml
│
├── engine/
│   └── nepEngine.js          # Fisher-Yates shuffle, grading, analytics
│
├── config/
│   └── db.js                 # MySQL2 promise pool
│
├── middleware/
│   ├── auth.js               # isAuthenticated, isStudent, isAdmin guards
│   └── flash.js              # Flash message middleware
│
├── routes/
│   ├── pages/
│   │   ├── index.js          # Landing page
│   │   ├── auth.js           # Login / Register / Logout
│   │   ├── student.js        # Student dashboard, exam flow, results
│   │   └── admin.js          # Admin CRUD + reports
│   └── api/
│       ├── exam.js           # /api/exam/* (JSON)
│       ├── questions.js      # /api/questions/* (JSON)
│       └── analytics.js      # /api/analytics/* (JSON)
│
├── views/
│   ├── partials/             # head, footer, sidebars
│   ├── landing.ejs
│   ├── login.ejs / register.ejs / error.ejs
│   ├── student/              # dashboard, exam, result, history
│   └── admin/                # dashboard, categories, questions, reports
│
└── public/
    ├── css/
    │   ├── nep-tokens.css    # Design tokens (no gradients)
    │   ├── nep-global.css    # Base styles, components
    │   ├── nep-landing.css
    │   ├── nep-auth.css
    │   ├── nep-dashboard.css
    │   ├── nep-exam.css      # CBT interface
    │   └── nep-admin.css
    └── js/
        ├── nep-exam.js       # Timer, navigation, auto-submit
        └── nep-admin.js      # Admin interactions
```

---

## Security Design

| Threat | Mitigation |
|--------|-----------|
| Score tampering | Grading runs in `nepEngine.gradeExam()` against server session — client score submission ignored |
| Correct answer exposure | `sanitizeQuestionsForClient()` strips `is_correct` before EJS render |
| Password storage | bcrypt with cost factor 10 |
| Session fixation | `req.session.regenerate()` on login |
| XSS | Helmet CSP headers + EJS auto-escaping |
| SQL injection | All queries use mysql2 parameterized placeholders only |

---

## Exam Flow

```
Student selects category
       ↓
POST /student/exam/start
 └─ Fetch questions from DB
 └─ Fisher-Yates shuffle (questions + options)
 └─ Store in req.session.examSession (server only — includes is_correct)
       ↓
GET /student/exam/session
 └─ sanitizeQuestionsForClient() → strips is_correct
 └─ Render exam.ejs (no correct answers in HTML)
       ↓
[Student answers + timer runs]
       ↓
POST /student/exam/submit
 └─ gradeExam(session.questions, submittedAnswers)
 └─ Save to results table
 └─ Redirect to /student/result/:id
```

---

## Database Schema

```
users (id, name, email, password_hash, role, created_at)
categories (id, name, description, created_at)
questions (id, category_id→, question_text, created_at)
options (id, question_id→, option_text, is_correct)
results (id, user_id→, category_id→, score, total_questions, percentage, taken_at)
```

---

## License

Academic project — Nigerian Nursing Examination Preparation System.
