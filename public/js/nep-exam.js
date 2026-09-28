/**
 * nep-exam.js — CBT Examination Interface Client Logic
 *
 * Responsibilities:
 *  - Countdown timer with auto-submit on expiry
 *  - Question navigation (prev/next/grid jump)
 *  - Answer state tracking (answered/unanswered/flagged)
 *  - Navigation grid rendering & colour states
 *  - Submit confirmation modal
 *  - Serialise answers to hidden form field before POST
 *
 * SECURITY NOTE: Correct answers are NEVER present in this file
 * or in the page DOM. Grading happens entirely server-side.
 */

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────
  const NEP = {
    currentIdx:    0,
    answers:       {},   // { questionId: optionId }
    flagged:       {},   // { questionId: true/false }
    questions:     [],   // array of { id, index } from DOM
    totalQuestions: 0,
    remainingTime: 0,
    timerInterval: null
  };

  // ── DOM references ────────────────────────────────────────────────
  const $timerEl      = document.getElementById('nep-timer-display');
  const $submitBtns   = document.querySelectorAll('[data-submit-exam]');
  const $modalOverlay = document.getElementById('nep-modal-overlay');
  const $modalConfirm = document.getElementById('nep-modal-confirm');
  const $modalCancel  = document.getElementById('nep-modal-cancel');
  const $modalAnswered= document.getElementById('nep-modal-answered');
  const $modalTotal   = document.getElementById('nep-modal-total');
  const $examForm     = document.getElementById('nep-exam-form');
  const $answersField = document.getElementById('nep-answers-field');
  const $qgrid        = document.getElementById('nep-qgrid');
  const $answeredCount= document.getElementById('nep-answered-count');
  const $flaggedCount = document.getElementById('nep-flagged-count');
  const $prevBtn      = document.getElementById('nep-prev-btn');
  const $nextBtn      = document.getElementById('nep-next-btn');

  // ── Initialise ───────────────────────────────────────────────────
  function init() {
    // Collect question IDs from data attributes on question panels
    const panels = document.querySelectorAll('div[data-question-id]');
    NEP.totalQuestions = panels.length;
    panels.forEach((panel, i) => {
      NEP.questions.push({ id: parseInt(panel.dataset.questionId, 10), index: i });
    });

    // Read remaining time from data attribute on timer element
    NEP.remainingTime = parseInt($timerEl ? $timerEl.dataset.remaining : '0', 10);

    // Attach option radio listeners
    document.querySelectorAll('.nep-exam-option').forEach(radio => {
      radio.addEventListener('change', onOptionChange);
    });

    // Attach flag listeners
    document.querySelectorAll('.nep-flag-checkbox').forEach(cb => {
      cb.addEventListener('change', onFlagChange);
    });

    // Navigation buttons
    if ($prevBtn) $prevBtn.addEventListener('click', () => navigate(-1));
    if ($nextBtn) $nextBtn.addEventListener('click', () => navigate(1));

    // Submit button → open modal
    $submitBtns.forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        openModal();
      });
    });
    if ($modalCancel) $modalCancel.addEventListener('click', closeModal);
    if ($modalConfirm) $modalConfirm.addEventListener('click', submitExam);

    // Close modal on overlay click
    if ($modalOverlay) $modalOverlay.addEventListener('click', e => {
      if (e.target === $modalOverlay) closeModal();
    });

    // Start timer
    startTimer();

    // Render initial state
    showQuestion(0);
    renderGrid();
    updateSummary();
  }

  // ── Question display ──────────────────────────────────────────────
  function showQuestion(idx) {
    if (idx < 0 || idx >= NEP.totalQuestions) return;

    // Hide all panels
    document.querySelectorAll('div[data-question-id]').forEach(p => {
      p.style.display = 'none';
    });

    // Show current
    const panel = document.querySelector(`div[data-question-id="${NEP.questions[idx].id}"]`);
    if (panel) panel.style.display = 'block';

    NEP.currentIdx = idx;

    // Restore selected option
    const qid = NEP.questions[idx].id;
    const savedOptId = NEP.answers[qid];
    if (savedOptId) {
      const radio = document.querySelector(`input[name="q_${qid}"][value="${savedOptId}"]`);
      if (radio) radio.checked = true;
    }

    // Restore flag
    const flagCb = document.getElementById(`flag-${qid}`);
    if (flagCb) {
      flagCb.checked = !!NEP.flagged[qid];
      updateFlagUI(qid, !!NEP.flagged[qid]);
    }

    // Update nav buttons
    if ($prevBtn) $prevBtn.disabled = idx === 0;
    if ($nextBtn) $nextBtn.textContent = idx === NEP.totalQuestions - 1 ? 'Finish →' : 'Next →';

    renderGrid();
  }

  // ── Navigation ───────────────────────────────────────────────────
  function navigate(delta) {
    const newIdx = NEP.currentIdx + delta;
    if (newIdx < 0) return;
    if (newIdx >= NEP.totalQuestions) {
      openModal();
      return;
    }
    showQuestion(newIdx);
  }

  // ── Option selection ──────────────────────────────────────────────
  function onOptionChange(e) {
    const radio = e.target;
    const qid   = parseInt(radio.dataset.questionId, 10);
    const optId = parseInt(radio.value, 10);
    NEP.answers[qid] = optId;
    renderGrid();
    updateSummary();
  }

  // ── Flag ─────────────────────────────────────────────────────────
  function onFlagChange(e) {
    const cb  = e.target;
    const qid = parseInt(cb.dataset.questionId, 10);
    NEP.flagged[qid] = cb.checked;
    updateFlagUI(qid, cb.checked);
    renderGrid();
    updateSummary();
  }

  function updateFlagUI(qid, isFlagged) {
    const wrap = document.querySelector(`.nep-flag-wrap[data-qid="${qid}"]`);
    if (!wrap) return;
    if (isFlagged) wrap.classList.add('flagged');
    else           wrap.classList.remove('flagged');
    const icon = wrap.querySelector('.nep-flag-icon');
    if (icon) icon.textContent = isFlagged ? '🚩' : '⚑';
  }

  // ── Navigation Grid ───────────────────────────────────────────────
  function renderGrid() {
    if (!$qgrid) return;
    $qgrid.innerHTML = '';
    NEP.questions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'nep-qgrid-btn';
      btn.textContent = idx + 1;
      btn.title     = `Question ${idx + 1}`;

      const classes = [];
      if (idx === NEP.currentIdx)   classes.push('current');
      if (NEP.flagged[q.id])        classes.push('flagged');
      else if (NEP.answers[q.id])   classes.push('answered');

      classes.forEach(c => btn.classList.add(c));

      btn.addEventListener('click', () => showQuestion(idx));
      $qgrid.appendChild(btn);
    });
  }

  // ── Summary counters ──────────────────────────────────────────────
  function updateSummary() {
    const answered = Object.keys(NEP.answers).length;
    const flagged  = Object.values(NEP.flagged).filter(Boolean).length;
    if ($answeredCount) $answeredCount.textContent = answered;
    if ($flaggedCount)  $flaggedCount.textContent  = flagged;
  }

  // ── Timer ─────────────────────────────────────────────────────────
  function startTimer() {
    if (!$timerEl) return;
    renderTimer();
    NEP.timerInterval = setInterval(() => {
      NEP.remainingTime = Math.max(0, NEP.remainingTime - 1);
      renderTimer();
      if (NEP.remainingTime <= 0) {
        clearInterval(NEP.timerInterval);
        autoSubmit();
      }
    }, 1000);
  }

  function renderTimer() {
    if (!$timerEl) return;
    const h   = Math.floor(NEP.remainingTime / 3600);
    const m   = Math.floor((NEP.remainingTime % 3600) / 60);
    const s   = NEP.remainingTime % 60;
    const hh  = String(h).padStart(2, '0');
    const mm  = String(m).padStart(2, '0');
    const ss  = String(s).padStart(2, '0');
    $timerEl.textContent = h > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;

    // Update visual state
    $timerEl.classList.remove('warning', 'critical');
    if (NEP.remainingTime <= 60)  $timerEl.classList.add('critical');
    else if (NEP.remainingTime <= 300) $timerEl.classList.add('warning');
  }

  // ── Submit modal ──────────────────────────────────────────────────
  function openModal() {
    if (!$modalOverlay) return;
    const answered = Object.keys(NEP.answers).length;
    if ($modalAnswered) $modalAnswered.textContent = answered;
    if ($modalTotal)    $modalTotal.textContent    = NEP.totalQuestions;
    $modalOverlay.classList.add('open');
  }

  function closeModal() {
    if ($modalOverlay) $modalOverlay.classList.remove('open');
  }

  function submitExam() {
    clearInterval(NEP.timerInterval);
    // Serialise answers to hidden field
    if ($answersField) $answersField.value = JSON.stringify(NEP.answers);
    if ($modalConfirm) $modalConfirm.disabled = true;
    if ($examForm)     submitForm();
  }

  function autoSubmit() {
    if ($answersField) $answersField.value = JSON.stringify(NEP.answers);
    if ($examForm)     submitForm();
  }

  function submitForm() {
    if (typeof $examForm.requestSubmit === 'function') {
      $examForm.requestSubmit();
    } else {
      HTMLFormElement.prototype.submit.call($examForm);
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
