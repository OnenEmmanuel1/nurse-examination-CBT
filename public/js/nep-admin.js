/**
 * nep-admin.js — Admin Panel Client Interactions
 */
(function () {
  'use strict';

  // ── Confirm delete ────────────────────────────────────────────────
  document.querySelectorAll('[data-confirm]').forEach(btn => {
    btn.addEventListener('click', e => {
      const msg = btn.dataset.confirm || 'Are you sure you want to delete this item?';
      if (!confirm(msg)) e.preventDefault();
    });
  });

  // ── Option correct radio — highlight the selected row ─────────────
  document.querySelectorAll('.nep-correct-radio').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.nep-qform-opt').forEach(row => row.classList.remove('is-correct'));
      if (radio.checked) {
        const row = radio.closest('.nep-qform-opt');
        if (row) row.classList.add('is-correct');
      }
    });
  });

  // Initialise correct-row highlighting on page load
  document.querySelectorAll('.nep-correct-radio:checked').forEach(radio => {
    const row = radio.closest('.nep-qform-opt');
    if (row) row.classList.add('is-correct');
  });

  // ── Category filter (questions page) ─────────────────────────────
  const $catFilter = document.getElementById('nep-cat-filter');
  if ($catFilter) {
    $catFilter.addEventListener('change', () => {
      const val = $catFilter.value;
      const url = val ? `/admin/questions?category=${val}` : '/admin/questions';
      window.location.href = url;
    });
  }

  // ── Inline percentage bar colour ──────────────────────────────────
  document.querySelectorAll('.nep-pct-fill[data-pct]').forEach(bar => {
    const pct = parseFloat(bar.dataset.pct);
    bar.style.width = pct + '%';
    bar.classList.remove('high', 'medium', 'low');
    if (pct >= 70)      bar.classList.add('high');
    else if (pct >= 40) bar.classList.add('medium');
    else                bar.classList.add('low');
  });

  // ── Simple toast on flash messages ───────────────────────────────
  const $flash = document.querySelector('.nep-alert[data-auto-dismiss]');
  if ($flash) {
    setTimeout(() => {
      $flash.style.transition = 'opacity 0.4s';
      $flash.style.opacity    = '0';
      setTimeout(() => $flash.remove(), 400);
    }, 4000);
  }

  // ── Category delete protection (requires typing name) ─────────────
  // (Using basic confirm for this prototype)
  document.querySelectorAll('[data-delete-cat]').forEach(form => {
    form.addEventListener('submit', e => {
      const catName = form.dataset.deleteCat;
      if (!confirm(`Delete category "${catName}" and ALL its questions?\nThis cannot be undone.`)) {
        e.preventDefault();
      }
    });
  });

})();
