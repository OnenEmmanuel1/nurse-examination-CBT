'use strict';

const express  = require('express');
const bcrypt   = require('bcrypt');
const db       = require('../../config/db');
const router   = express.Router();

const SALT_ROUNDS = 10;

// ─── GET /login ───────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.user) {
    return req.session.user.role === 'admin'
      ? res.redirect('/admin/dashboard')
      : res.redirect('/student/dashboard');
  }
  res.render('login', { title: 'Login — NurseExamPrep' });
});

// ─── POST /login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.setFlash('error', 'Email and password are required.');
    return res.redirect('/login');
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      req.setFlash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      req.setFlash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    // Regenerate session to prevent fixation
    req.session.regenerate(err => {
      if (err) {
        req.setFlash('error', 'Session error. Please try again.');
        return res.redirect('/login');
      }
      req.session.user = {
        id:   user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      req.session.save(() => {
        return user.role === 'admin'
          ? res.redirect('/admin/dashboard')
          : res.redirect('/student/dashboard');
      });
    });

  } catch (err) {
    console.error('[Auth/Login]', err);
    req.setFlash('error', 'A server error occurred. Please try again.');
    res.redirect('/login');
  }
});

// ─── GET /register ────────────────────────────────────────────────
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/student/dashboard');
  res.render('register', { title: 'Create Account — NurseExamPrep' });
});

// ─── POST /register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, confirm_password } = req.body;

  // Server-side validation
  if (!name || !email || !password || !confirm_password) {
    req.setFlash('error', 'All fields are required.');
    return res.redirect('/register');
  }
  if (password !== confirm_password) {
    req.setFlash('error', 'Passwords do not match.');
    return res.redirect('/register');
  }
  if (password.length < 8) {
    req.setFlash('error', 'Password must be at least 8 characters.');
    return res.redirect('/register');
  }

  try {
    // Check for existing email
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      req.setFlash('error', 'An account with this email already exists.');
      return res.redirect('/register');
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hash, 'student']
    );

    // Auto-login after registration
    req.session.regenerate(err => {
      if (err) return res.redirect('/login');
      req.session.user = {
        id:    result.insertId,
        name:  name.trim(),
        email: email.trim().toLowerCase(),
        role:  'student'
      };
      req.session.save(() => res.redirect('/student/dashboard'));
    });

  } catch (err) {
    console.error('[Auth/Register]', err);
    req.setFlash('error', 'Registration failed. Please try again.');
    res.redirect('/register');
  }
});

// ─── GET /logout ─────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;
