// Cards that light up under the cursor. Keep in sync with the spotlight selector in styles/motion.css.
const SPOT = '.dashboard-card, .metric-card, .insights-chart-card, .plan-surface-card, .goal-card, .parity-card, .account-summary, .quick-action';

/** Feeds the cursor position to the hovered card as --mx/--my so CSS can draw the spotlight there. */
export function initSpotlight() {
  if (!window.matchMedia('(hover: hover)').matches) return;
  let frame = 0;
  document.addEventListener('pointermove', (e) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const card = e.target instanceof Element ? e.target.closest<HTMLElement>(SPOT) : null;
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - box.left}px`);
      card.style.setProperty('--my', `${e.clientY - box.top}px`);
    });
  }, { passive: true });
}

/** Adds .reveal to matching elements and .revealed once each scrolls into view (landing page sections). */
export function revealOnScroll(root: ParentNode, selector: string) {
  const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('revealed');
      seen.unobserve(entry.target);
    }
  }, { threshold: 0.12 });
  for (const el of targets) { el.classList.add('reveal'); seen.observe(el); }
  return () => { seen.disconnect(); for (const el of targets) el.classList.remove('reveal', 'revealed'); };
}
