'use strict';

/**
 * nepEngine.js — NurseExamPrep Business Logic Engine
 *
 * Contains ALL core business logic:
 *   1. Fisher-Yates Shuffle (randomization)
 *   2. Exam content shuffler (questions + options)
 *   3. Server-side grading engine
 *   4. Client-sanitisation (strips correct-answer flags)
 *   5. Performance analytics computations
 *
 * This module has NO database access and NO HTTP concerns.
 * It receives plain data, processes it, and returns results.
 * Route handlers are responsible for DB I/O and HTTP responses.
 */

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 — RANDOMIZATION ENGINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Fisher-Yates Shuffle Algorithm
 *
 * Iterates from the LAST element backward to index 1.
 * At each position i, a random index j is chosen from the remaining
 * unshuffled portion [0 … i] (inclusive). Elements at i and j are swapped.
 * This produces a uniformly distributed random permutation where every
 * possible ordering is equally probable (Knuth, 2011).
 *
 * @param  {Array} array  Input array (not mutated)
 * @returns {Array}       New shuffled array
 */
function fisherYatesShuffle(array) {
  const arr = array.slice(); // shallow copy — original is never mutated
  for (let i = arr.length - 1; i > 0; i--) {
    // Random index from the unshuffled portion [0, i]
    const j = Math.floor(Math.random() * (i + 1));
    // Swap elements at i and j
    const tmp = arr[i];
    arr[i]    = arr[j];
    arr[j]    = tmp;
  }
  return arr;
}

/**
 * Shuffles exam content:
 *   (a) Shuffles the order of questions using Fisher-Yates.
 *   (b) Independently shuffles the options within EACH question using Fisher-Yates.
 *
 * Both shuffles are independent, guaranteeing no two sessions share
 * an identical question-or-option sequence.
 *
 * @param  {Array} questions  Question objects, each with an `options` array
 * @returns {Array}           Fully shuffled question + options array
 */
function shuffleExamContent(questions) {
  // (a) Shuffle question order
  const shuffledQuestions = fisherYatesShuffle(questions);

  // (b) Independently shuffle options within each question
  return shuffledQuestions.map(question => ({
    ...question,
    options: fisherYatesShuffle(question.options)
  }));
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — GRADING ENGINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Grade a submitted exam entirely on the server.
 *
 * Receives the full session question data (which includes is_correct flags
 * stored server-side) and the map of answers submitted by the student.
 * Correct answers are NEVER sent to the client at any point.
 *
 * @param  {Array}  sessionQuestions  Full question array from server session
 * @param  {Object} submittedAnswers  { [questionId]: optionId } from POST body
 * @returns {Object} { score, total, percentage, reviewData }
 */
function gradeExam(sessionQuestions, submittedAnswers) {
  let score = 0;
  const total = sessionQuestions.length;
  const reviewData = [];

  for (const question of sessionQuestions) {
    const submittedOptId = submittedAnswers[question.id] != null
      ? parseInt(submittedAnswers[question.id], 10)
      : null;

    // Locate the correct option using server-held data
    const correctOption = question.options.find(
      opt => opt.is_correct === 1 || opt.is_correct === true
    );

    // Locate what the student actually selected
    const selectedOption = submittedOptId != null
      ? question.options.find(opt => opt.id === submittedOptId)
      : null;

    const isCorrect = !!(
      selectedOption &&
      (selectedOption.is_correct === 1 || selectedOption.is_correct === true)
    );

    if (isCorrect) score++;

    reviewData.push({
      question_id:          question.id,
      question_text:        question.question_text,
      selected_option_id:   submittedOptId,
      selected_option_text: selectedOption ? selectedOption.option_text : null,
      correct_option_id:    correctOption  ? correctOption.id          : null,
      correct_option_text:  correctOption  ? correctOption.option_text : null,
      is_correct:           isCorrect
    });
  }

  const percentage = total > 0
    ? parseFloat(((score / total) * 100).toFixed(2))
    : 0;

  return { score, total, percentage, reviewData };
}

/**
 * Strips is_correct from every option before the data is passed to any view.
 * This is the ONLY version of question data that reaches the client.
 *
 * @param  {Array} questions  Full server-side question array
 * @returns {Array}           Client-safe questions (no is_correct field)
 */
function sanitizeQuestionsForClient(questions) {
  return questions.map(q => ({
    id:            q.id,
    question_text: q.question_text,
    options: q.options.map(opt => ({
      id:          opt.id,
      option_text: opt.option_text
      // is_correct deliberately omitted — never reaches the browser
    }))
  }));
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 3 — PERFORMANCE ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Aggregates result records by category.
 *
 * @param  {Array} results  Result records with category_id + category_name + percentage
 * @returns {Array}         Category analytics objects
 */
function computeCategoryAnalytics(results) {
  const map = {};
  for (const r of results) {
    const key = r.category_id;
    if (!map[key]) {
      map[key] = { category_id: key, category_name: r.category_name, attempts: [] };
    }
    map[key].attempts.push(parseFloat(r.percentage));
  }

  return Object.values(map).map(cat => {
    const { attempts } = cat;
    const count   = attempts.length;
    const sum     = attempts.reduce((a, b) => a + b, 0);
    const average = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    const highest = count > 0 ? parseFloat(Math.max(...attempts).toFixed(2)) : 0;
    const lowest  = count > 0 ? parseFloat(Math.min(...attempts).toFixed(2)) : 0;

    return {
      category_id:        cat.category_id,
      category_name:      cat.category_name,
      attempt_count:      count,
      average_percentage: average,
      highest_score:      highest,
      lowest_score:       lowest
    };
  });
}

/**
 * Returns a student's result history sorted chronologically for trend display.
 *
 * @param  {Array} results  Result records for a single student
 * @returns {Array}         Time-sorted results with ISO date strings
 */
function computeStudentTrend(results) {
  return results
    .slice()
    .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at))
    .map(r => ({
      ...r,
      percentage:     parseFloat(r.percentage),
      taken_at_iso:   new Date(r.taken_at).toISOString(),
      taken_at_label: new Date(r.taken_at).toLocaleDateString('en-NG', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    }));
}

/**
 * Computes system-wide aggregate statistics for the admin reporting view.
 *
 * @param  {Array} results  All result records with user_id, category fields
 * @returns {Object}        { totalAttempts, uniqueStudents, systemAverage, categoryBreakdown }
 */
function computeSystemStats(results) {
  const totalAttempts  = results.length;
  const uniqueStudents = new Set(results.map(r => r.user_id)).size;
  const systemAverage  = totalAttempts > 0
    ? parseFloat(
        (results.reduce((s, r) => s + parseFloat(r.percentage), 0) / totalAttempts).toFixed(2)
      )
    : 0;
  const categoryBreakdown = computeCategoryAnalytics(results);

  // Per-student leaderboard (top 10)
  const studentMap = {};
  for (const r of results) {
    if (!studentMap[r.user_id]) {
      studentMap[r.user_id] = { user_id: r.user_id, name: r.user_name, attempts: [], total_pct: 0 };
    }
    studentMap[r.user_id].attempts.push(parseFloat(r.percentage));
    studentMap[r.user_id].total_pct += parseFloat(r.percentage);
  }
  const leaderboard = Object.values(studentMap)
    .map(s => ({
      user_id:    s.user_id,
      name:       s.name,
      attempts:   s.attempts.length,
      average:    parseFloat((s.total_pct / s.attempts.length).toFixed(2))
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 10);

  return { totalAttempts, uniqueStudents, systemAverage, categoryBreakdown, leaderboard };
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 4 — TIMING HELPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Returns remaining seconds for an active exam session.
 *
 * @param  {number} startTime       Unix timestamp (ms) when exam began
 * @param  {number} durationSeconds Total allowed seconds
 * @returns {number}                Remaining seconds (minimum 0)
 */
function getRemainingTime(startTime, durationSeconds) {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  fisherYatesShuffle,
  shuffleExamContent,
  gradeExam,
  sanitizeQuestionsForClient,
  computeCategoryAnalytics,
  computeStudentTrend,
  computeSystemStats,
  getRemainingTime
};
