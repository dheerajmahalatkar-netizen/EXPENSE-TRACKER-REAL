/**
 * interactive-3d.js
 * SpendWise Premium 3D Interaction & Motion Engine.
 *
 * Implements:
 * 1. Perspective 3D card tilt tracking with dynamic light reflection sheen.
 * 2. Number count-up animations for financial metrics.
 * 3. Accessibility checks respecting prefers-reduced-motion.
 */

let isReducedMotion = false;

export function init3DEffects() {
  if (typeof window === 'undefined') return;

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  isReducedMotion = mediaQuery.matches;
  mediaQuery.addEventListener('change', (e) => {
    isReducedMotion = e.matches;
  });

  setupCardTiltListeners();

  // Re-bind when views change
  const observer = new MutationObserver(() => {
    setupCardTiltListeners();
    animateTabularNumbers();
  });

  const main = document.getElementById('main-content');
  if (main) {
    observer.observe(main, { childList: true, subtree: true });
  }

  animateTabularNumbers();
}

/**
 * Binds mousemove/mouseleave listeners to 3D financial cards.
 */
function setupCardTiltListeners() {
  if (isReducedMotion) return;

  const selector = '.card, .kpi-card, .bank-plastic-card, .goal-card, .action-center-hero, .reserve-tile, .confidence-card, .feature-card, .growth-card, .step-card, .final-cta-card, .live-guardian-widget, .guardian-preview-box';
  const cards = document.querySelectorAll(selector);

  cards.forEach((card) => {
    if (card.dataset.hasTiltListener) return;
    card.dataset.hasTiltListener = 'true';

    // Add 3D container styling if not present
    card.classList.add('perspective-3d-card');

    let bounds;
    let isHovered = false;

    const onMouseEnter = () => {
      bounds = card.getBoundingClientRect();
      isHovered = true;
      card.style.transition = 'transform 100ms ease-out, box-shadow 250ms ease';
    };

    const onMouseMove = (e) => {
      if (!isHovered || !bounds) return;
      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;

      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;

      // Max tilt angle
      const maxTilt = card.classList.contains('bank-plastic-card') ? 14 : 7;
      const rotX = -((mouseY - centerY) / centerY) * maxTilt;
      const rotY = ((mouseX - centerX) / centerX) * maxTilt;

      // Dynamic light reflection sheen
      const sheenX = Math.round((mouseX / bounds.width) * 100);
      const sheenY = Math.round((mouseY / bounds.height) * 100);

      card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(8px)`;
      card.style.setProperty('--sheen-x', `${sheenX}%`);
      card.style.setProperty('--sheen-y', `${sheenY}%`);
    };

    const onMouseLeave = () => {
      isHovered = false;
      card.style.transition = 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 450ms ease';
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
    };

    card.addEventListener('mouseenter', onMouseEnter);
    card.addEventListener('mousemove', onMouseMove);
    card.addEventListener('mouseleave', onMouseLeave);
  });
}

/**
 * Animate numbers counting up on metric elements.
 */
export function animateTabularNumbers() {
  if (isReducedMotion) return;

  const metricElements = document.querySelectorAll('.kpi-value:not(.has-counted), .gauge-val:not(.has-counted)');
  metricElements.forEach((el) => {
    const rawText = el.textContent.trim();
    // Match numeric portion
    const match = rawText.match(/([^\d.-]*)([\d,]+(\.\d+)?)(.*)/);
    if (!match) return;

    el.classList.add('has-counted');
    const prefix = match[1] || '';
    const numericStr = match[2].replace(/,/g, '');
    const suffix = match[4] || '';
    const targetVal = parseFloat(numericStr);
    if (isNaN(targetVal) || targetVal === 0) return;

    const hasDecimal = match[2].includes('.');
    const decimalPlaces = hasDecimal ? (match[2].split('.')[1] || '').length : 0;
    const duration = 600; // ms
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = targetVal * eased;

      const formattedNum = currentVal.toLocaleString('en-IN', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

      el.textContent = `${prefix}${formattedNum}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        el.textContent = rawText; // restore original final formatted string
      }
    };

    requestAnimationFrame(updateCounter);
  });
}
