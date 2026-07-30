'use strict';

const express = require('express');
const router  = express.Router();

// GET / — Landing page
router.get('/', (req, res) => {
  if (req.session.user) {
    return req.session.user.role === 'admin'
      ? res.redirect('/admin/dashboard')
      : res.redirect('/student/dashboard');
  }
  res.render('landing', { title: 'NurseExamPrep — Nigerian Nursing Examination Preparation System' });
});

module.exports = router;
