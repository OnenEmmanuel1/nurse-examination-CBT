'use strict';

const express = require('express');
const db      = require('../../config/db');
const engine  = require('../../engine/nepEngine');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router  = express.Router();

router.use(isAuthenticated, isAdmin);

// ─── GET /admin/dashboard ─────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [[{ totalStudents }]] = await db.execute(
      `SELECT COUNT(*) AS totalStudents FROM users WHERE role = 'student'`
    );
    const [[{ totalQuestions }]] = await db.execute(
      `SELECT COUNT(*) AS totalQuestions FROM questions`
    );
    const [[{ totalCategories }]] = await db.execute(
      `SELECT COUNT(*) AS totalCategories FROM categories`
    );
    const [[{ totalAttempts }]] = await db.execute(
      `SELECT COUNT(*) AS totalAttempts FROM results`
    );

    const [recentAttempts] = await db.execute(
      `SELECT r.id, r.score, r.total_questions, r.percentage, r.taken_at,
              u.name AS student_name, c.name AS category_name
       FROM results r
       JOIN users u ON u.id = r.user_id
       JOIN categories c ON c.id = r.category_id
       ORDER BY r.taken_at DESC LIMIT 10`
    );

    res.render('admin/dashboard', {
      title: 'Admin Dashboard — NurseExamPrep',
      stats: { totalStudents, totalQuestions, totalCategories, totalAttempts },
      recentAttempts
    });
  } catch (err) {
    console.error('[Admin/Dashboard]', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load admin dashboard.' });
  }
});

// ══════════════════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════════════════

router.get('/categories', async (req, res) => {
  try {
    const [categories] = await db.execute(
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(DISTINCT q.id) AS question_count
       FROM categories c
       LEFT JOIN questions q ON q.category_id = c.id
       GROUP BY c.id ORDER BY c.name`
    );
    res.render('admin/categories', { title: 'Categories — NurseExamPrep', categories });
  } catch (err) {
    console.error('[Admin/Categories]', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load categories.' });
  }
});

router.post('/categories', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    req.setFlash('error', 'Category name is required.');
    return res.redirect('/admin/categories');
  }
  try {
    await db.execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), (description || '').trim()]
    );
    req.setFlash('success', `Category "${name.trim()}" created successfully.`);
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('[Admin/CreateCategory]', err);
    req.setFlash('error', 'Failed to create category.');
    res.redirect('/admin/categories');
  }
});

router.get('/categories/:id/edit', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM categories WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) { req.setFlash('error', 'Category not found.'); return res.redirect('/admin/categories'); }
    res.render('admin/category-edit', { title: 'Edit Category — NurseExamPrep', category: rows[0] });
  } catch (err) {
    res.redirect('/admin/categories');
  }
});

router.post('/categories/:id/update', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    req.setFlash('error', 'Category name is required.');
    return res.redirect(`/admin/categories/${req.params.id}/edit`);
  }
  try {
    await db.execute(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name.trim(), (description || '').trim(), req.params.id]
    );
    req.setFlash('success', 'Category updated.');
    res.redirect('/admin/categories');
  } catch (err) {
    req.setFlash('error', 'Update failed.');
    res.redirect('/admin/categories');
  }
});

router.post('/categories/:id/delete', async (req, res) => {
  try {
    await db.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    req.setFlash('success', 'Category deleted (all related questions removed).');
    res.redirect('/admin/categories');
  } catch (err) {
    req.setFlash('error', 'Delete failed.');
    res.redirect('/admin/categories');
  }
});

// ══════════════════════════════════════════════════════════════════
// QUESTIONS
// ══════════════════════════════════════════════════════════════════

router.get('/questions', async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT id, name FROM categories ORDER BY name');
    const catFilter    = req.query.category ? parseInt(req.query.category, 10) : null;

    if (!catFilter && categories.length > 0) {
      return res.redirect(`/admin/questions?category=${categories[0].id}`);
    }

    let category = null;
    let questionsWithOptions = [];
    let stats = {
      totalQuestions: 0,
      totalAttempts: 0,
      completionRate: 0,
      completedUsers: 0,
      totalUsers: 0,
      avgScore: 0,
      avgTime: 0
    };

    if (catFilter) {
      const [catRows] = await db.execute('SELECT * FROM categories WHERE id = ? LIMIT 1', [catFilter]);
      if (catRows.length > 0) {
        category = catRows[0];

        // Fetch questions
        const [questions] = await db.execute(
          `SELECT q.id, q.question_text, q.created_at, c.name AS category_name
           FROM questions q
           JOIN categories c ON c.id = q.category_id
           WHERE q.category_id = ?
           ORDER BY q.created_at DESC`,
          [catFilter]
        );

        // Fetch options if we have questions
        if (questions.length > 0) {
          const questionIds = questions.map(q => q.id);
          const placeholders = questionIds.map(() => '?').join(',');
          const [options] = await db.execute(
            `SELECT id, question_id, option_text, is_correct FROM options WHERE question_id IN (${placeholders})`,
            questionIds
          );
          
          questionsWithOptions = questions.map(q => ({
            ...q,
            options: options.filter(o => o.question_id === q.id)
          }));
        }

        // Stats
        const [[{ totalAttempts }]] = await db.execute(
          `SELECT COUNT(*) AS total_attempts FROM results WHERE category_id = ?`,
          [catFilter]
        );
        const [[{ distinctStudents }]] = await db.execute(
          `SELECT COUNT(DISTINCT user_id) AS distinct_students FROM results WHERE category_id = ?`,
          [catFilter]
        );
        const [[{ totalStudents }]] = await db.execute(
          `SELECT COUNT(*) AS total_students FROM users WHERE role = 'student'`
        );
        const [[{ avgScore }]] = await db.execute(
          `SELECT COALESCE(AVG(percentage), 0) AS avg_score FROM results WHERE category_id = ?`,
          [catFilter]
        );

        stats.totalQuestions = questions.length;
        stats.totalAttempts = totalAttempts;
        stats.completedUsers = distinctStudents;
        stats.totalUsers = totalStudents || 1; // avoid div by 0
        stats.completionRate = Math.round((distinctStudents / stats.totalUsers) * 100);
        stats.avgScore = parseFloat(avgScore).toFixed(1);
        // Estimate average response duration based on question count: 0.75 mins per question
        stats.avgTime = (questions.length * 0.76).toFixed(2);
      }
    }

    res.render('admin/questions', {
      title: 'Question Bank — NurseExamPrep',
      questions: questionsWithOptions,
      categories,
      selectedCategory: catFilter,
      categoryDetails: category,
      stats
    });
  } catch (err) {
    console.error('[Admin/Questions]', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load questions.' });
  }
});

// ─── GET /admin/questions/upload ───────────────────────────────────
router.get('/questions/upload', async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT id, name FROM categories ORDER BY name');
    const selectedCat  = req.query.category ? parseInt(req.query.category, 10) : null;
    res.render('admin/questions-upload', {
      title: 'Upload Questions — NurseExamPrep',
      categories,
      selectedCategory: selectedCat
    });
  } catch (err) {
    console.error('[Admin/UploadGet]', err);
    res.redirect('/admin/questions');
  }
});

// CSV parser helper function
function parseCSV(text) {
  const results = [];
  const lines = text.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const row = [];
    let insideQuote = false;
    let currentField = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    
    if (row.length < 6) continue;
    
    const question_text = row[0];
    const option_texts = [row[1], row[2], row[3], row[4]];
    const correctVal = row[5].toUpperCase();
    
    let correctIdx = 0;
    if (correctVal === 'A' || correctVal === '1') correctIdx = 0;
    else if (correctVal === 'B' || correctVal === '2') correctIdx = 1;
    else if (correctVal === 'C' || correctVal === '3') correctIdx = 2;
    else if (correctVal === 'D' || correctVal === '4') correctIdx = 3;
    
    results.push({
      question_text,
      options: option_texts.map((t, idx) => ({
        option_text: t,
        is_correct: idx === correctIdx
      }))
    });
  }
  return results;
}

// ─── POST /admin/questions/upload ──────────────────────────────────
router.post('/questions/upload', async (req, res) => {
  const { category_id, content, format } = req.body;
  const catId = parseInt(category_id, 10);
  
  if (!catId || !content || !content.trim()) {
    req.setFlash('error', 'Category and content are required.');
    return res.redirect('/admin/questions/upload');
  }
  
  try {
    let parsedQuestions = [];
    if (format === 'json') {
      parsedQuestions = JSON.parse(content);
    } else {
      parsedQuestions = parseCSV(content);
    }
    
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      req.setFlash('error', 'Invalid formatting or no questions parsed.');
      return res.redirect(`/admin/questions/upload?category=${catId}`);
    }
    
    let importedCount = 0;
    for (const q of parsedQuestions) {
      if (!q.question_text || !q.question_text.trim() || !Array.isArray(q.options) || q.options.length < 2) {
        continue;
      }
      
      // Insert question
      const [qResult] = await db.execute(
        'INSERT INTO questions (category_id, question_text) VALUES (?, ?)',
        [catId, q.question_text.trim()]
      );
      const questionId = qResult.insertId;
      
      // Insert options
      for (const opt of q.options) {
        if (!opt.option_text || !opt.option_text.trim()) continue;
        await db.execute(
          'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
          [questionId, opt.option_text.trim(), opt.is_correct ? 1 : 0]
        );
      }
      importedCount++;
    }
    
    req.setFlash('success', `Successfully uploaded ${importedCount} questions.`);
    res.redirect(`/admin/questions?category=${catId}`);
  } catch (err) {
    console.error('[Admin/UploadPost]', err);
    req.setFlash('error', 'Failed to parse or save uploaded questions: ' + err.message);
    res.redirect(`/admin/questions/upload?category=${catId}`);
  }
});

router.get('/questions/new', async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT id, name FROM categories ORDER BY name');
    res.render('admin/question-form', {
      title:      'Add Question — NurseExamPrep',
      categories,
      question:   null,
      options:    [{ option_text: '', is_correct: 0 }, { option_text: '', is_correct: 0 },
                   { option_text: '', is_correct: 0 }, { option_text: '', is_correct: 0 }],
      formAction: '/admin/questions/create'
    });
  } catch (err) {
    res.redirect('/admin/questions');
  }
});

router.post('/questions/create', async (req, res) => {
  const { category_id, question_text, option_text, is_correct } = req.body;

  if (!category_id || !question_text || !question_text.trim()) {
    req.setFlash('error', 'Category and question text are required.');
    return res.redirect('/admin/questions/new');
  }

  const texts     = Array.isArray(option_text) ? option_text : [option_text];
  const corrects  = Array.isArray(is_correct)  ? is_correct  : [is_correct];
  const validOpts = texts.filter(t => t && t.trim());

  if (validOpts.length < 2) {
    req.setFlash('error', 'At least 2 options are required.');
    return res.redirect('/admin/questions/new');
  }
  if (!corrects.some(c => c === 'true' || c === '1' || c === true)) {
    req.setFlash('error', 'Please mark one option as correct.');
    return res.redirect('/admin/questions/new');
  }

  try {
    const [qResult] = await db.execute(
      'INSERT INTO questions (category_id, question_text) VALUES (?, ?)',
      [parseInt(category_id, 10), question_text.trim()]
    );
    const questionId = qResult.insertId;
    const correctIdx = corrects.findIndex(c => c === 'true' || c === '1' || c === true);

    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || !texts[i].trim()) continue;
      await db.execute(
        'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
        [questionId, texts[i].trim(), i === correctIdx ? 1 : 0]
      );
    }

    req.setFlash('success', 'Question added successfully.');
    res.redirect('/admin/questions');
  } catch (err) {
    console.error('[Admin/CreateQuestion]', err);
    req.setFlash('error', 'Failed to create question.');
    res.redirect('/admin/questions/new');
  }
});

router.get('/questions/:id/edit', async (req, res) => {
  try {
    const [qRows] = await db.execute('SELECT * FROM questions WHERE id = ? LIMIT 1', [req.params.id]);
    if (!qRows.length) { req.setFlash('error', 'Question not found.'); return res.redirect('/admin/questions'); }
    const [options] = await db.execute('SELECT * FROM options WHERE question_id = ? ORDER BY id', [req.params.id]);
    const [categories] = await db.execute('SELECT id, name FROM categories ORDER BY name');

    // Pad to 4 options
    while (options.length < 4) options.push({ id: null, option_text: '', is_correct: 0 });

    res.render('admin/question-form', {
      title:      'Edit Question — NurseExamPrep',
      categories,
      question:   qRows[0],
      options:    options.slice(0, 4),
      formAction: `/admin/questions/${req.params.id}/update`
    });
  } catch (err) {
    res.redirect('/admin/questions');
  }
});

router.post('/questions/:id/update', async (req, res) => {
  const { category_id, question_text, option_id, option_text, is_correct } = req.body;
  const qId = parseInt(req.params.id, 10);

  if (!question_text || !question_text.trim()) {
    req.setFlash('error', 'Question text is required.');
    return res.redirect(`/admin/questions/${qId}/edit`);
  }

  const texts     = Array.isArray(option_text) ? option_text : [option_text];
  const ids       = Array.isArray(option_id)   ? option_id   : [option_id];
  const corrects  = Array.isArray(is_correct)  ? is_correct  : [is_correct];
  const correctIdx = corrects.findIndex(c => c === 'true' || c === '1');

  if (correctIdx < 0) {
    req.setFlash('error', 'Please mark one option as correct.');
    return res.redirect(`/admin/questions/${qId}/edit`);
  }

  try {
    await db.execute(
      'UPDATE questions SET category_id = ?, question_text = ? WHERE id = ?',
      [parseInt(category_id, 10), question_text.trim(), qId]
    );

    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || !texts[i].trim()) continue;
      const isCorrectVal = i === correctIdx ? 1 : 0;
      if (ids[i] && ids[i] !== '') {
        await db.execute(
          'UPDATE options SET option_text = ?, is_correct = ? WHERE id = ? AND question_id = ?',
          [texts[i].trim(), isCorrectVal, parseInt(ids[i], 10), qId]
        );
      } else {
        await db.execute(
          'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
          [qId, texts[i].trim(), isCorrectVal]
        );
      }
    }

    req.setFlash('success', 'Question updated successfully.');
    res.redirect('/admin/questions');
  } catch (err) {
    console.error('[Admin/UpdateQuestion]', err);
    req.setFlash('error', 'Update failed.');
    res.redirect(`/admin/questions/${qId}/edit`);
  }
});

router.post('/questions/:id/delete', async (req, res) => {
  try {
    await db.execute('DELETE FROM questions WHERE id = ?', [req.params.id]);
    req.setFlash('success', 'Question deleted.');
    res.redirect('/admin/questions');
  } catch (err) {
    req.setFlash('error', 'Delete failed.');
    res.redirect('/admin/questions');
  }
});

// ══════════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════════

router.get('/reports', async (req, res) => {
  try {
    const [results] = await db.execute(
      `SELECT r.id, r.user_id, r.category_id, r.score, r.total_questions,
              r.percentage, r.taken_at,
              u.name AS user_name, c.name AS category_name
       FROM results r
       JOIN users u ON u.id = r.user_id
       JOIN categories c ON c.id = r.category_id
       ORDER BY r.taken_at DESC`
    );

    const stats = engine.computeSystemStats(results);

    res.render('admin/reports', {
      title:        'Performance Reports — NurseExamPrep',
      results,
      stats,
      chartData:    JSON.stringify(stats.categoryBreakdown)
    });
  } catch (err) {
    console.error('[Admin/Reports]', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load reports.' });
  }
});

// ─── Students management ──────────────────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const [students] = await db.execute(
      `SELECT u.id, u.name, u.email, u.created_at,
              COUNT(r.id) AS total_attempts,
              COALESCE(AVG(r.percentage), 0) AS avg_percentage
       FROM users u
       LEFT JOIN results r ON r.user_id = u.id
       WHERE u.role = 'student'
       GROUP BY u.id ORDER BY u.name`
    );
    res.render('admin/students', { title: 'Students — NurseExamPrep', students });
  } catch (err) {
    res.status(500).render('error', { title: 'Error', message: 'Failed to load students.' });
  }
});

module.exports = router;
