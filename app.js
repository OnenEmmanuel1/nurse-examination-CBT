'use strict';

const express       = require('express');
const session       = require('express-session');
const helmet        = require('helmet');
const path          = require('path');
const fs            = require('fs');
require('dotenv').config();

const flashMiddleware = require('./middleware/flash');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
      styleSrc:   ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"]
    }
  }
}));

// ─── Body Parsers ─────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Session ──────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'nep_fallback_secret_change_in_production',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000  // 8 hours
  }
}));

// ─── Flash Messages ───────────────────────────────────────────────
app.use(flashMiddleware);

// ─── Global View Locals ───────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user    = req.session.user || null;
  res.locals.appName = 'NurseExamPrep';
  next();
});

// ─── View Engine ──────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Ensure required directories exist ───────────────────────────
['logs'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ══════════════════════════════════════════════════════════════════
// PAGE ROUTES
// ══════════════════════════════════════════════════════════════════
app.use('/',          require('./routes/pages/index'));
app.use('/',          require('./routes/pages/auth'));
app.use('/student',   require('./routes/pages/student'));
app.use('/admin',     require('./routes/pages/admin'));

// ══════════════════════════════════════════════════════════════════
// API ROUTES (JSON)
// ══════════════════════════════════════════════════════════════════
app.use('/api/exam',       require('./routes/api/exam'));
app.use('/api/questions',  require('./routes/api/questions'));
app.use('/api/analytics',  require('./routes/api/analytics'));

// ─── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  res.status(404).render('error', {
    title:   '404 — Page Not Found',
    message: 'The page you are looking for does not exist.',
    code:    404
  });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err.stack);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
  res.status(500).render('error', {
    title:   '500 — Server Error',
    message: 'An unexpected error occurred. Please try again.',
    code:    500
  });
});

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║  NurseExamPrep running on http://localhost:${PORT}  ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);
});

module.exports = app;
