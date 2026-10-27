// First visit: breathe once with the circle, then choose to enter with or without sound.
import { gsap } from 'gsap';
import { sound } from './audio';

export function runIntro(): Promise<void> {
  const html = document.documentElement;
  const el = document.querySelector<HTMLElement>('[data-intro]');
  if (!el || !html.classList.contains('show-intro')) return Promise.resolve();

  const word = el.querySelector<HTMLElement>('[data-intro-word]')!;
  const circle = el.querySelector<HTMLElement>('[data-intro-circle]')!;
  const glow = el.querySelector<HTMLElement>('[data-intro-glow]')!;
  const inner = el.querySelector<HTMLElement>('.intro__inner')!;

  // the CSS breath is 8 s: in for 4, out for 4
  let inhale = true;
  const swap = window.setInterval(() => {
    inhale = !inhale;
    gsap.to(word, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        word.textContent = (inhale ? word.dataset.inhale : word.dataset.exhale) || '';
        gsap.to(word, { opacity: 1, duration: 0.8 });
      },
    });
  }, 4000);
  gsap.fromTo(glow, { scale: 0.4, opacity: 0 }, { scale: 0.7, opacity: 1, duration: 3, ease: 'sine.out' });
  gsap.from(inner.children, { y: 24, opacity: 0, filter: 'blur(8px)', duration: 1.4, stagger: 0.12, ease: 'power3.out', clearProps: 'filter' });
  el.querySelector<HTMLButtonElement>('[data-intro-enter="sound"]')?.focus({ preventScroll: true });

  return new Promise((resolve) => {
    const choose = async (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-intro-enter]');
      if (!btn) return;
      el.removeEventListener('click', choose);
      clearInterval(swap);
      if (btn.dataset.introEnter === 'sound') {
        await sound.enable();
        sound.bowl(1);
      } else {
        sound.disable();
      }
      try { sessionStorage.setItem('ts-intro', 'seen'); } catch {}

      // freeze the breathing circle where it is, then let it open over the whole screen
      const m = new DOMMatrix(getComputedStyle(circle).transform);
      circle.style.animation = 'none';
      gsap.set(circle, { scale: m.a || 0.62 });
      const tl = gsap.timeline({
        onComplete: () => {
          html.classList.remove('show-intro');
          el.remove();
          resolve();
        },
      });
      tl.to(inner.querySelectorAll('.logo, .intro__choices, .intro__hint, [data-intro-word]'), { opacity: 0, y: -16, filter: 'blur(6px)', duration: 0.6, stagger: 0.04, ease: 'power2.in' }, 0)
        .to(circle, { scale: 14, duration: 1.5, ease: 'power3.in' }, 0.15)
        .to(glow, { scale: 2, opacity: 0, duration: 1.4, ease: 'power2.in' }, 0.15)
        .call(() => { dispatchEvent(new Event('ts:intro-exit')); }, [], 1.2)
        .to(el, { opacity: 0, duration: 0.9, ease: 'power2.out' }, 1.25);
    };
    el.addEventListener('click', choose);
  });
}
