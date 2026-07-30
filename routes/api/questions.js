'use strict';

const express = require('express');
const db      = require('../../config/db');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router  = express.Router();

// All question API routes require admin
router.use(isAuthenticated, isAdmin);

// GET /api/questions?category_id=X
router.get('/', async (req, res) => {
  try {
    const catId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    const query = catId
      ? `SELECT q.id, q.question_text, q.category_id, q.created_at,
                c.name AS category_name
         FROM questions q JOIN categories c ON c.id = q.category_id
         WHERE q.category_id = ? ORDER BY q.id`
      : `SELECT q.id, q.question_text, q.category_id, q.created_at,
                c.name AS category_name
         FROM questions q JOIN categories c ON c.id = q.category_id
         ORDER BY q.id`;

    const [questions] = catId
      ? await db.execute(query, [catId])
      : await db.execute(query);

    res.json({ success: true, data: questions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch questions.' });
  }
});

// GET /api/questions/:id (with options)
router.get('/:id', async (req, res) => {
  try {
    const [qRows] = await db.execute(
      'SELECT * FROM questions WHERE id = ? LIMIT 1', [req.params.id]
    );
    if (!qRows.length) return res.status(404).json({ success: false, message: 'Not found.' });
    const [options] = await db.execute(
      'SELECT * FROM options WHERE question_id = ? ORDER BY id', [req.params.id]
    );
    res.json({ success: true, data: { ...qRows[0], options } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch question.' });
  }
});

// DELETE /api/questions/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM questions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Question deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed.' });
  }
});

module.exports = router;
