'use strict';

/**
 * Authentication middleware
 * Guards routes by role — redirects or returns 403 for API routes.
 */

/** Redirect unauthenticated users to login */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  req.session.flash = { type: 'error', message: 'Please log in to access that page.' };
  return res.redirect('/login');
}

/** Require student role */
function isStudent(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'student') return next();
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ success: false, message: 'Student access required.' });
  }
  req.session.flash = { type: 'error', message: 'Access restricted to students.' };
  return res.redirect('/login');
}

/** Require admin role */
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ success: false, message: 'Administrator access required.' });
  }
  req.session.flash = { type: 'error', message: 'Access restricted to administrators.' };
  return res.redirect('/login');
}

module.exports = { isAuthenticated, isStudent, isAdmin };
