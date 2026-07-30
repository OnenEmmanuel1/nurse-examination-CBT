'use strict';

const express = require('express');
const db      = require('../../config/db');
const engine  = require('../../engine/nepEngine');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router  = express.Router();

// GET /api/analytics/admin — system-wide statistics
router.get('/admin', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [results] = await db.execute(
      `SELECT r.user_id, r.category_id, r.percentage, r.taken_at,
              u.name AS user_name, c.name AS category_name
       FROM results r
       JOIN users u ON u.id = r.user_id
       JOIN categories c ON c.id = r.category_id`
    );
    const stats = engine.computeSystemStats(results);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Analytics query failed.' });
  }
});

// GET /api/analytics/student/:userId
router.get('/student/:userId', isAuthenticated, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  // Students can only access their own analytics
  if (req.session.user.role === 'student' && req.session.user.id !== userId) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }
  try {
    const [results] = await db.execute(
      `SELECT r.id, r.score, r.total_questions, r.percentage, r.taken_at,
              c.id AS category_id, c.name AS category_name
       FROM results r
       JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ?
       ORDER BY r.taken_at ASC`,
      [userId]
    );
    const trendData      = engine.computeStudentTrend(results);
    const categoryStats  = engine.computeCategoryAnalytics(results);
    res.json({ success: true, data: { trendData, categoryStats } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Analytics query failed.' });
  }
});

module.exports = router;
