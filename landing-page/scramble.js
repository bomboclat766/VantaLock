(() => {
  'use strict';

  if (window.__vantalockScrambleInitialized) return;
  window.__vantalockScrambleInitialized = true;

  const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-=';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function injectStyles() {
    if (document.getElementById('vl-scramble-styles')) return;

    const style = document.createElement('style');
    style.id = 'vl-scramble-styles';
    style.textContent = `
      [data-scramble-fade] {
        opacity: 0;
        transform: translateY(18px);
        filter: blur(2px);
        transition: opacity 0.75s ease, transform 0.75s ease, filter 0.75s ease;
        transition-delay: var(--fade-delay, 0ms);
      }

      [data-scramble-fade].is-visible {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
      }

      .scramble-target {
        will-change: contents;
      }

      @media (prefers-reduced-motion: reduce) {
        [data-scramble-fade] {
          opacity: 1;
          transform: none;
          filter: none;
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  class TextScrambler {
    constructor(el) {
      this.el = el;
      this.frameRequest = null;
      this.frame = 0;
      this.queue = [];
      this.resolve = null;
      this.originalText = el.textContent;
    }

    setText(newText) {
      if (reduceMotion) {
        this.el.textContent = newText;
        return Promise.resolve();
      }

      const oldText = this.el.textContent || '';
      const length = Math.max(oldText.length, newText.length);
      this.queue = [];

      for (let i = 0; i < length; i += 1) {
        const from = oldText[i] || '';
        const to = newText[i] || '';

        if (to === ' ') {
          this.queue.push({ from, to, start: 0, end: 0, char: ' ' });
          continue;
        }

        const start = Math.floor(Math.random() * 18);
        const end = start + Math.floor(Math.random() * 22) + 8;
        this.queue.push({ from, to, start, end, char: '' });
      }

      cancelAnimationFrame(this.frameRequest);
      this.frame = 0;

      return new Promise((resolve) => {
        this.resolve = resolve;
        this.update();
      });
    }

    update() {
      let output = '';
      let complete = 0;

      for (let i = 0; i < this.queue.length; i += 1) {
        const item = this.queue[i];

        if (this.frame >= item.end) {
          complete += 1;
          output += item.to;
        } else if (this.frame >= item.start) {
          if (!item.char || Math.random() < 0.28) {
            item.char = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }
          output += item.char;
        } else {
          output += item.from;
        }
      }

      this.el.textContent = output;

      if (complete === this.queue.length) {
        this.el.textContent = this.originalText;
        this.resolve();
        return;
      }

      this.frame += 1;
      this.frameRequest = requestAnimationFrame(() => this.update());
    }
  }

  function observeAndScramble(elements) {
    const unique = new Set();
    const targets = elements.filter((el) => {
      if (unique.has(el)) return false;
      unique.add(el);
      return (el.textContent || '').trim().length > 0;
    });

    if (targets.length === 0) return;

    targets.forEach((el) => el.classList.add('scramble-target'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((el) => {
        const scrambler = new TextScrambler(el);
        scrambler.setText(el.textContent);
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        observer.unobserve(el);
        const scrambler = new TextScrambler(el);
        scrambler.setText(el.textContent);
      });
    }, { threshold: 0.35, rootMargin: '0px 0px -10% 0px' });

    targets.forEach((el) => observer.observe(el));
  }

  function observeFadeCards(elements) {
    const unique = new Set();
    const cards = elements.filter((el) => {
      if (unique.has(el)) return false;
      unique.add(el);
      return true;
    });

    if (cards.length === 0) return;

    cards.forEach((el, index) => {
      el.setAttribute('data-scramble-fade', '');
      el.style.setProperty('--fade-delay', `${Math.min(index % 8, 6) * 45}ms`);
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      cards.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });

    cards.forEach((el) => observer.observe(el));
  }

  function init() {
    injectStyles();

    const scrambleTargets = [
      ...document.querySelectorAll('h1, h2, h3'),
      ...document.querySelectorAll('.section-title, .page-subtitle, .vault-card-title, .step-title, .faq-q')
    ];

    const cardTargets = [
      ...document.querySelectorAll('.vault-card, .step-card, .content-box, .faq-item, .release-card, .report-card, .card, .panel')
    ];

    observeAndScramble(scrambleTargets);
    observeFadeCards(cardTargets);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
