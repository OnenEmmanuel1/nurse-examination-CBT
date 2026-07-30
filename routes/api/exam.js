'use strict';

const express = require('express');
const db      = require('../../config/db');
const engine  = require('../../engine/nepEngine');
const { isAuthenticated, isStudent } = require('../../middleware/auth');
const router  = express.Router();

const EXAM_DURATION = parseInt(process.env.EXAM_DURATION_SECONDS || '1800', 10);

/**
 * GET /api/exam/categories
 * Returns all categories with question counts for student exam selection.
 */
router.get('/categories', isAuthenticated, isStudent, async (req, res) => {
  try {
    const [categories] = await db.execute(
      `SELECT c.id, c.name, c.description, COUNT(q.id) AS question_count
       FROM categories c LEFT JOIN questions q ON q.category_id = c.id
       GROUP BY c.id HAVING question_count > 0 ORDER BY c.name`
    );
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load categories.' });
  }
});

/**
 * POST /api/exam/submit — JSON API version of exam submission
 * Accepts: { answers: { questionId: optionId } }
 * Returns: { score, total, percentage, resultId }
 *
 * SECURITY: Grades entirely from server session. Client-submitted scores ignored.
 */
router.post('/submit', isAuthenticated, isStudent, async (req, res) => {
  const session = req.session.examSession;
  if (!session) {
    return res.status(400).json({ success: false, message: 'No active exam session.' });
  }

  const submittedAnswers = req.body.answers || {};

  const { score, total, percentage, reviewData } = engine.gradeExam(
    session.questions,
    submittedAnswers
  );

  try {
    const [result] = await db.execute(
      `INSERT INTO results (user_id, category_id, score, total_questions, percentage)
       VALUES (?, ?, ?, ?, ?)`,
      [req.session.user.id, session.categoryId, score, total, percentage]
    );

    req.session.lastReview = {
      resultId: result.insertId,
      score, total, percentage,
      categoryName: session.categoryName,
      reviewData
    };
    req.session.examSession = null;

    res.json({ success: true, data: { score, total, percentage, resultId: result.insertId } });
  } catch (err) {
    console.error('[API/Exam/Submit]', err);
    res.status(500).json({ success: false, message: 'Failed to save result.' });
  }
});

module.exports = router;
