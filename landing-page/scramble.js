(function () {
  'use strict';

  const STYLE_ID = 'vl-scramble-styles';
  const SCRAMBLE_DONE = 'data-scramble-done';
  const FADE_DONE = 'data-fade-init';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '[data-scramble-target]{display:inline-block;min-height:1em;}',
      '[data-card-fade]{opacity:0;transform:translateY(14px);transition:opacity .55s ease,transform .55s ease;will-change:opacity,transform;}',
      '[data-card-fade].is-visible{opacity:1;transform:translateY(0);}'
    ].join('');
    document.head.appendChild(style);
  }

  function scrambleText(node) {
    if (!node || node.getAttribute(SCRAMBLE_DONE) === 'true') return;

    const original = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!original || original.length < 3) return;

    node.setAttribute(SCRAMBLE_DONE, 'true');
    node.setAttribute('data-scramble-target', 'true');

    let frame = 0;
    let settled = 0;
    const revealStep = Math.max(0.45, original.length / 38);

    function draw() {
      settled += revealStep;
      const shown = Math.min(original.length, Math.floor(settled));

      const next = original
        .split('')
        .map(function (char, index) {
          if (/\s/.test(char)) return ' ';
          if (index < shown) return original[index];
          return LETTERS[(frame + index * 7) % LETTERS.length];
        })
        .join('');

      node.textContent = next;
      frame += 1;

      if (shown < original.length) {
        window.requestAnimationFrame(draw);
      } else {
        node.textContent = original;
      }
    }

    draw();
  }

  function initScramble() {
    const targets = document.querySelectorAll('h1, h2, h3, .section-title, [data-scramble]');
    targets.forEach(scrambleText);
  }

  function markFadeTarget(node) {
    if (!(node instanceof Element)) return;
    if (node.getAttribute(FADE_DONE) === 'true') return;
    node.setAttribute(FADE_DONE, 'true');
    node.setAttribute('data-card-fade', 'true');
  }

  function initCardFade() {
    const selector = [
      '[class$="card"]',
      '[class*=" card"]',
      '[class*="-card"]',
      '.vault-card',
      '.step-card',
      '.release-card'
    ].join(',');

    const initial = document.querySelectorAll(selector);
    initial.forEach(markFadeTarget);

    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 })
      : null;

    function revealOrObserve(node) {
      if (!(node instanceof Element)) return;
      if (io) {
        io.observe(node);
      } else {
        node.classList.add('is-visible');
      }
    }

    document.querySelectorAll('[data-card-fade]').forEach(revealOrObserve);

    if ('MutationObserver' in window) {
      const mo = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (added) {
            if (!(added instanceof Element)) return;
            if (added.matches(selector)) {
              markFadeTarget(added);
              revealOrObserve(added);
            }
            added.querySelectorAll(selector).forEach(function (desc) {
              markFadeTarget(desc);
              revealOrObserve(desc);
            });
          });
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  function start() {
    injectStyles();
    initScramble();
    initCardFade();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());
