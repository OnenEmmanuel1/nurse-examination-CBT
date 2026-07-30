'use strict';

/**
 * Flash message middleware
 * Stores a single flash message in the session and exposes it to every view.
 */

function flashMiddleware(req, res, next) {
  // Transfer flash from session into res.locals (consumed once)
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;

  // Helper for route handlers: req.flash(type, message)
  req.setFlash = (type, message) => {
    req.session.flash = { type, message };
  };

  next();
}

module.exports = flashMiddleware;
