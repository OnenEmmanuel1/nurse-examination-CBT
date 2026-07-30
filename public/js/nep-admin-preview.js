/**
 * nep-admin-preview.js — Interactive Client Logic for Redesigned Admin Question Bank
 * Handles category filtering redirection, element transitions, and interactive phone previews.
 */

(function () {
  'use strict';

  function init() {
    // 1. Category Filter Redirection
    const catFilter = document.getElementById('nep-cat-filter');
    if (catFilter) {
      catFilter.addEventListener('change', function () {
        const catId = this.value;
        if (catId) {
          window.location.href = '/admin/questions?category=' + catId;
        } else {
          window.location.href = '/admin/questions';
        }
      });
    }

    // 2. Auto-Dismiss Alert Messages
    document.querySelectorAll('.nep-alert[data-auto-dismiss]').forEach(el => {
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.4s ease';
        setTimeout(() => el.remove(), 400);
      }, 4000);
    });

    // 3. Confirm Delete Prompts
    document.querySelectorAll('[data-confirm]').forEach(el => {
      el.addEventListener('click', function (e) {
        const msg = this.getAttribute('data-confirm') || 'Are you sure you want to perform this action?';
        if (!confirm(msg)) {
          e.preventDefault();
        }
      });
    });

    // 4. Interactive Live Preview Link (Left Cards <-> Right Smartphone Preview)
    const questionCards = document.querySelectorAll('.nep-question-card');
    const chatBody = document.getElementById('nep-phone-chat');

    function highlightAndScroll(qid) {
      // Highlight card on the left
      questionCards.forEach(card => {
        if (card.dataset.qid === qid) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });

      // Highlight bubble and scroll in mockup
      const chatGroup = document.getElementById('chat-qgroup-' + qid);
      if (chatGroup && chatBody) {
        // Remove highlight from all bubbles
        document.querySelectorAll('.nep-chat-q-group').forEach(group => {
          group.classList.remove('highlight-pulse');
        });

        // Add highlight to current
        chatGroup.classList.add('highlight-pulse');

        // Scroll smoothly inside phone mockup
        const containerTop = chatBody.getBoundingClientRect().top;
        const elemTop = chatGroup.getBoundingClientRect().top;
        const scrollTarget = chatBody.scrollTop + (elemTop - containerTop) - 20;

        chatBody.scrollTo({
          top: scrollTarget,
          behavior: 'smooth'
        });
      }
    }

    // Bind event listeners to left-side question cards
    questionCards.forEach((card, idx) => {
      // Highlight/Scroll on hover or click
      card.addEventListener('mouseenter', function () {
        highlightAndScroll(this.dataset.qid);
      });
      card.addEventListener('click', function () {
        highlightAndScroll(this.dataset.qid);
      });

      // Initial highlight for the first card
      if (idx === 0) {
        // Highlight first card after brief delay to allow mockup rendering
        setTimeout(() => highlightAndScroll(card.dataset.qid), 300);
      }
    });
  }

  // Bootstrap when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
