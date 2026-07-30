'use strict';

const express = require('express');
const db      = require('../../config/db');
const engine  = require('../../engine/nepEngine');
const { isAuthenticated, isStudent } = require('../../middleware/auth');
const router  = express.Router();

const EXAM_DURATION = parseInt(process.env.EXAM_DURATION_SECONDS || '1800', 10);

// All student routes require authentication + student role
router.use(isAuthenticated, isStudent);

// ─── GET /student/dashboard ───────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [categories] = await db.execute(
      `SELECT c.id, c.name, c.description,
              COUNT(DISTINCT q.id) AS question_count
       FROM categories c
       LEFT JOIN questions q ON q.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    );

    const [recentResults] = await db.execute(
      `SELECT r.id, r.score, r.total_questions, r.percentage, r.taken_at,
              c.name AS category_name
       FROM results r
       JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ?
       ORDER BY r.taken_at DESC
       LIMIT 5`,
      [userId]
    );

    const [statsRow] = await db.execute(
      `SELECT COUNT(*) AS total_attempts,
              COALESCE(AVG(percentage), 0) AS avg_percentage,
              COALESCE(MAX(percentage), 0) AS best_score
       FROM results WHERE user_id = ?`,
      [userId]
    );

    res.render('student/dashboard', {
      title:         'Dashboard — NurseExamPrep',
      categories,
      recentResults,
      stats:         statsRow[0]
    });
  } catch (err) {
    console.error('[Student/Dashboard]', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load dashboard.' });
  }
});

// ─── POST /student/exam/start ─────────────────────────────────────
router.post('/exam/start', async (req, res) => {
  const categoryId = parseInt(req.body.category_id, 10);
  if (!categoryId) {
    req.setFlash('error', 'Please select a valid subject category.');
    return res.redirect('/student/dashboard');
  }

  try {
    // Verify category exists
    const [catRows] = await db.execute(
      'SELECT id, name FROM categories WHERE id = ? LIMIT 1',
      [categoryId]
    );
    if (catRows.length === 0) {
      req.setFlash('error', 'Category not found.');
      return res.redirect('/student/dashboard');
    }

    // Fetch all questions with options for this category
    const [questions] = await db.execute(
      `SELECT q.id, q.question_text FROM questions q
       WHERE q.category_id = ?
       ORDER BY q.id`,
      [categoryId]
    );

    if (questions.length === 0) {
      req.setFlash('error', 'No questions available for this category yet. Check back later.');
      return res.redirect('/student/dashboard');
    }

    // Fetch all options for these questions
    const questionIds = questions.map(q => q.id);
    const placeholders = questionIds.map(() => '?').join(',');
    const [options] = await db.execute(
      `SELECT id, question_id, option_text, is_correct
       FROM options WHERE question_id IN (${placeholders})`,
      questionIds
    );

    // Attach options to their questions
    const questionsWithOptions = questions.map(q => ({
      ...q,
      options: options.filter(o => o.question_id === q.id)
    }));

    // Apply Fisher-Yates: shuffle questions AND shuffle options within each question
    const shuffled = engine.shuffleExamContent(questionsWithOptions);

    // Store FULL data (with is_correct) in server-side session for grading
    req.session.examSession = {
      categoryId,
      categoryName:  catRows[0].name,
      questions:     shuffled,   // contains is_correct — server only
      startTime:     Date.now(),
      durationSecs:  EXAM_DURATION
    };

    res.redirect('/student/exam/session');
  } catch (err) {
    console.error('[Student/ExamStart]', err);
    req.setFlash('error', 'Failed to start exam. Please try again.');
    res.redirect('/student/dashboard');
  }
});

// ─── GET /student/exam/session ────────────────────────────────────
router.get('/exam/session', (req, res) => {
  const session = req.session.examSession;
  if (!session) {
    req.setFlash('error', 'No active exam session. Please start a new exam.');
    return res.redirect('/student/dashboard');
  }

  const remaining = engine.getRemainingTime(session.startTime, session.durationSecs);
  if (remaining <= 0) {
    // Session expired — auto submit with empty answers
    req.session.examSession = null;
    req.setFlash('error', 'Your exam session has expired.');
    return res.redirect('/student/dashboard');
  }

  // Strip is_correct before passing to view
  const clientQuestions = engine.sanitizeQuestionsForClient(session.questions);

  res.render('student/exam', {
    title:         `Exam: ${session.categoryName} — NurseExamPrep`,
    categoryName:  session.categoryName,
    questions:     clientQuestions,
    remainingTime: remaining,
    totalQuestions: session.questions.length
  });
});

// ─── POST /student/exam/submit ────────────────────────────────────
router.post('/exam/submit', async (req, res) => {
  const session = req.session.examSession;
  if (!session) {
    req.setFlash('error', 'No active exam session found.');
    return res.redirect('/student/dashboard');
  }

  // Enforce server-side timer validation (with 15s network latency grace period)
  const remaining = engine.getRemainingTime(session.startTime, session.durationSecs);
  if (remaining < -15) {
    req.session.examSession = null;
    req.setFlash('error', 'Your exam session time limit has expired. Submission rejected.');
    return res.redirect('/student/dashboard');
  }

  try {
    // Parse submitted answers (sent as JSON string from client form)
    let submittedAnswers = {};
    try {
      submittedAnswers = JSON.parse(req.body.answers || '{}');
    } catch (_) {
      submittedAnswers = {};
    }

    // Grade server-side using engine (never trust client-submitted scores)
    const { score, total, percentage, reviewData } = engine.gradeExam(
      session.questions,
      submittedAnswers
    );

    // Persist result to database
    const [insertResult] = await db.execute(
      `INSERT INTO results (user_id, category_id, score, total_questions, percentage)
       VALUES (?, ?, ?, ?, ?)`,
      [req.session.user.id, session.categoryId, score, total, percentage]
    );

    const resultId = insertResult.insertId;

    // Store review data in session for the result page (not in DB — transient)
    req.session.lastReview = {
      resultId,
      score,
      total,
      percentage,
      categoryName: session.categoryName,
      reviewData
    };

    // Clear exam session
    req.session.examSession = null;

    res.redirect(`/student/result/${resultId}`);
  } catch (err) {
    console.error('[Student/ExamSubmit]', err);
    req.setFlash('error', 'Failed to process submission. Please contact administrator.');
    res.redirect('/student/dashboard');
  }
});

// ─── GET /student/result/:id ──────────────────────────────────────
router.get('/result/:id', async (req, res) => {
  const resultId = parseInt(req.params.id, 10);

  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.score, r.total_questions, r.percentage, r.taken_at,
              c.name AS category_name
       FROM results r
       JOIN categories c ON c.id = r.category_id
       WHERE r.id = ? AND r.user_id = ?
       LIMIT 1`,
      [resultId, req.session.user.id]
    );

    if (rows.length === 0) {
      req.setFlash('error', 'Result not found.');
      return res.redirect('/student/history');
    }

    const result = rows[0];
    // Review data from session (only available immediately after submission)
    const review = req.session.lastReview && req.session.lastReview.resultId === resultId
      ? req.session.lastReview.reviewData
      : null;

    if (req.session.lastReview && req.session.lastReview.resultId === resultId) {
      req.session.lastReview = null;
    }

    res.render('student/result', {
      title:  `Result — NurseExamPrep`,
      result,
      review
    });
  } catch (err) {
    console.error('[Student/Result]', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load result.' });
  }
});

// ─── GET /student/history ─────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const [results] = await db.execute(
      `SELECT r.id, r.score, r.total_questions, r.percentage, r.taken_at,
              c.name AS category_name, c.id AS category_id
       FROM results r
       JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ?
       ORDER BY r.taken_at DESC`,
      [req.session.user.id]
    );

    const trendData = engine.computeStudentTrend(results);

    res.render('student/history', {
      title:     'Performance History — NurseExamPrep',
      results,
      trendData: JSON.stringify(trendData)
    });
  } catch (err) {
    console.error('[Student/History]', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load history.' });
  }
});

module.exports = router;
