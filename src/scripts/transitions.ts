import type { TransitionDirectionalAnimations } from 'astro';

// Page change: the old page lifts away and the new one is drawn up like a linen sheet.
const out = { name: 'ts-old-out', duration: '0.5s', easing: 'cubic-bezier(.4,0,.2,1)', fillMode: 'both' };
const inn = { name: 'ts-new-in', duration: '0.95s', delay: '0.12s', easing: 'cubic-bezier(.2,.7,.1,1)', fillMode: 'both' };

export const linen: TransitionDirectionalAnimations = {
  forwards: { old: out, new: inn },
  backwards: { old: out, new: inn },
};
