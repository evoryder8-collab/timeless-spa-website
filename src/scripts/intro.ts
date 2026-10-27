// First visit in a tab: choose sound, then language. The language suggestion follows the same rules as the
// Luma Wellness and Matthew Hua portals:
//   · a language in the address (/en/…) wins, then a choice saved earlier, then the browser's languages;
//   · the suggested option fills with warm light over a five-second countdown, then is chosen exactly as if tapped;
//   · touching any option, using the keyboard, or leaving the tab pauses it, and it can be paused or resumed.
// Switching language uses the client router, so the sound that was just switched on keeps playing.
import { gsap } from 'gsap';
import { navigate } from 'astro:transitions/client';
import { sound } from './audio';
import { requestTilt, buzz, tilt } from './tilt';

type Lang = 'de' | 'en';
type Texts = Record<Lang, Record<string, string>>;

const COUNTDOWN = 5000;
let running: Promise<void> | null = null;

export const introRunning = () => !!running;

const store = {
  get(area: 'local' | 'session', key: string) {
    try { return (area === 'local' ? localStorage : sessionStorage).getItem(key); } catch { return null; }
  },
  set(area: 'local' | 'session', key: string, value: string) {
    try { (area === 'local' ? localStorage : sessionStorage).setItem(key, value); } catch {}
  },
};

/** the language to suggest: address first, then a saved choice, then the browser */
function suggestLanguage(): Lang {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = location.pathname.slice(base.length);
  if (path.startsWith('/en/') || path === '/en') return 'en';
  const saved = store.get('local', 'ts-lang');
  if (saved === 'de' || saved === 'en') return saved;
  for (const l of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const primary = (l || '').toLowerCase().split(/[-_]/)[0];
    if (primary === 'de' || primary === 'en') return primary;
  }
  // neither German nor English in the browser: English is the shared language
  return 'en';
}

export function runIntro(): Promise<void> {
  if (running) return running;
  const html = document.documentElement;
  const el = document.querySelector<HTMLElement>('[data-intro]');
  if (!el || !html.classList.contains('show-intro')) return Promise.resolve();
  running = play(el).finally(() => (running = null));
  return running;
}

async function play(el: HTMLElement) {
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.setAttribute('data-open', '');
  el.dataset.step = 'sound';
  // the language options are links (for no-JS and crawlers); here the intro decides when they act
  el.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-intro-pick]')) e.preventDefault();
  }, true);
  const texts = JSON.parse(el.dataset.text || '{}') as Texts;
  const suggested = suggestLanguage();

  // everything on the intro speaks the suggested language from the very first frame
  const speak = (lang: Lang) => {
    el.querySelectorAll<HTMLElement>('[data-t]').forEach((n) => {
      const v = texts[lang]?.[n.dataset.t!];
      if (v) n.textContent = v;
    });
    el.setAttribute('lang', lang);
  };
  speak(suggested);

  const word = el.querySelector<HTMLElement>('[data-intro-word]')!;
  const circle = el.querySelector<HTMLElement>('[data-intro-circle]')!;
  const glow = el.querySelector<HTMLElement>('[data-intro-glow]')!;
  const inner = el.querySelector<HTMLElement>('.intro__inner')!;
  const stepSound = el.querySelector<HTMLElement>('[data-intro-step="sound"]')!;
  const stepLang = el.querySelector<HTMLElement>('[data-intro-step="lang"]')!;
  const sparks = startSparks(el.querySelector<HTMLCanvasElement>('[data-intro-sparks]')!, reduced);

  // the CSS breath lasts 8 s: in for 4, out for 4
  let inhale = true;
  let wordLang: Lang = suggested;
  const swap = window.setInterval(() => {
    inhale = !inhale;
    gsap.to(word, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        word.textContent = texts[wordLang][inhale ? 'inhale' : 'exhale'];
        gsap.to(word, { opacity: 1, duration: 0.8 });
      },
    });
  }, 4000);

  if (!reduced) {
    gsap.fromTo(glow, { scale: 0.4, opacity: 0 }, { scale: 0.75, opacity: 1, duration: 3, ease: 'sine.out' });
    gsap.from(inner.children, { y: 30, opacity: 0, filter: 'blur(10px)', duration: 1.6, stagger: 0.14, ease: 'power3.out', clearProps: 'filter,transform,opacity' });
  }
  el.querySelector<HTMLButtonElement>('[data-intro-sound="on"]')?.focus({ preventScroll: true });

  // ───── 1 · sound ─────
  const withSound = await new Promise<boolean>((resolve) => {
    const onClick = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-intro-sound]');
      if (!b) return;
      stepSound.removeEventListener('click', onClick);
      resolve(b.dataset.introSound === 'on');
    };
    stepSound.addEventListener('click', onClick);
  });
  requestTilt();
  buzz(12);
  if (withSound) {
    await sound.enable();
    sound.bowl(1);
  } else {
    sound.disable();
  }
  // a drop falls into the circle: it pulses, a ring spreads, and the sparks rush
  sparks.burst();
  if (!reduced) {
    gsap.fromTo(circle.parentElement, { scale: 1 }, { scale: 1.12, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' });
    await gsap.to(stepSound, { opacity: 0, y: -18, filter: 'blur(8px)', duration: 0.55, ease: 'power2.in' });
  }
  stepSound.hidden = true;
  el.dataset.step = 'lang';
  stepLang.hidden = false;
  if (!reduced) gsap.fromTo(stepLang.children, { opacity: 0, y: 24, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: 0.1, ease: 'power3.out', clearProps: 'filter,transform,opacity' });

  // ───── 2 · language, with a five-second suggestion ─────
  const chosen = await pickLanguage(el, suggested, texts, (l) => {
    wordLang = l;
  });
  clearInterval(swap);
  store.set('local', 'ts-lang', chosen);
  store.set('session', 'ts-intro', 'seen');
  sound.bowl(0.6);
  buzz(10);

  // a different language: switch page underneath the intro, which stays on screen
  if (chosen !== (document.documentElement.lang as Lang)) {
    const other = el.querySelector<HTMLAnchorElement>(`[data-intro-pick="${chosen}"]`)!.href;
    const swapped = new Promise<void>((r) => document.addEventListener('astro:page-load', () => r(), { once: true }));
    navigate(other);
    await swapped;
  }

  // ───── the reveal: the circle opens over the whole screen ─────
  const m = new DOMMatrix(getComputedStyle(circle).transform);
  circle.style.animation = 'none';
  gsap.set(circle, { scale: m.a || 0.64 });
  await new Promise<void>((resolve) => {
    if (reduced) {
      gsap.to(el, { opacity: 0, duration: 0.4, onComplete: resolve });
      return;
    }
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(inner.querySelectorAll('.logo, .intro__step:not([hidden]), [data-intro-word]'), { opacity: 0, y: -16, filter: 'blur(6px)', duration: 0.6, stagger: 0.04, ease: 'power2.in' }, 0)
      .to(circle, { scale: 16, duration: 1.5, ease: 'power3.in' }, 0.15)
      .to(glow, { scale: 2, opacity: 0, duration: 1.4, ease: 'power2.in' }, 0.15)
      .call(() => { dispatchEvent(new Event('ts:intro-exit')); }, [], 1.2)
      .to(el, { opacity: 0, duration: 0.9, ease: 'power2.out' }, 1.25);
  });
  sparks.stop();
  html.classList.remove('show-intro');
  el.remove();
}

function pickLanguage(el: HTMLElement, suggested: Lang, texts: Texts, onSuggest: (l: Lang) => void): Promise<Lang> {
  return new Promise((resolve) => {
    const picks = [...el.querySelectorAll<HTMLAnchorElement>('[data-intro-pick]')];
    const target = picks.find((p) => p.dataset.introPick === suggested)!;
    const bar = el.querySelector<HTMLElement>('[data-intro-countdown]')!;
    const secs = el.querySelector<HTMLElement>('[data-intro-seconds]')!;
    const label = el.querySelector<HTMLElement>('[data-intro-countdown-label]')!;
    const toggle = el.querySelector<HTMLButtonElement>('[data-intro-pause]')!;
    const t = texts[suggested];
    let remaining = COUNTDOWN;
    let paused = false;
    let previous = 0;
    let raf = 0;
    let done = false;

    target.classList.add('is-suggested');
    onSuggest(suggested);
    bar.hidden = false;
    bar.lang = suggested;
    target.focus({ preventScroll: true });

    const render = () => {
      secs.textContent = String(Math.max(1, Math.ceil(remaining / 1000)));
      const filled = 1 - remaining / COUNTDOWN;
      target.style.setProperty('--fill', filled.toFixed(4));
      target.style.setProperty('--edge', filled > 0.01 && filled < 0.995 ? '1' : '0');
      label.textContent = paused ? t.paused : t.countdown;
      toggle.textContent = paused ? t.resume : t.pause;
      toggle.setAttribute('aria-pressed', String(paused));
      el.classList.toggle('is-paused', paused);
    };
    const finish = (lang: Lang) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      el.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      bar.hidden = true;
      picks.forEach((p) => {
        p.classList.toggle('is-suggested', p.dataset.introPick === lang);
        p.style.setProperty('--fill', p.dataset.introPick === lang ? '1' : '0');
        p.style.setProperty('--edge', '0');
      });
      resolve(lang);
    };
    const tick = (now: number) => {
      if (done) return;
      if (!paused && !document.hidden && previous) remaining = Math.max(0, remaining - (now - previous));
      previous = now;
      render();
      if (remaining === 0) return finish(suggested);
      raf = requestAnimationFrame(tick);
    };
    // pause while someone is deciding: a touch on any option, or the keyboard
    const pause = () => {
      if (!paused) { paused = true; render(); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow')) pause();
    };
    const onVisibility = () => { previous = 0; };
    picks.forEach((p) => {
      p.addEventListener('pointerdown', pause);
      p.addEventListener('click', () => finish(p.dataset.introPick as Lang));
      p.addEventListener('pointerenter', () => sound.hover());
    });
    toggle.addEventListener('click', () => {
      paused = !paused;
      previous = 0;
      render();
    });
    el.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    render();
    raf = requestAnimationFrame(tick);
  });
}

/** Warm sparks drifting up through the intro, leaning with the pointer or the phone */
function startSparks(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const count = innerWidth < 760 ? 60 : 110;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const sg = sprite.getContext('2d')!;
  const grd = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,236,210,1)');
  grd.addColorStop(0.35, 'rgba(232,168,120,0.55)');
  grd.addColorStop(1, 'rgba(232,168,120,0)');
  sg.fillStyle = grd;
  sg.fillRect(0, 0, 32, 32);
  const parts = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.3 + Math.random() * 0.7,
    s: 3 + Math.random() * 9,
    tw: Math.random() * Math.PI * 2,
    drift: (Math.random() - 0.5) * 0.02,
  }));
  let speed = 1;
  let raf = 0;
  let px = 0;
  let py = 0;
  const onMove = (e: PointerEvent) => {
    px = e.clientX / innerWidth - 0.5;
    py = e.clientY / innerHeight - 0.5;
  };
  addEventListener('pointermove', onMove);
  let prev = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!ctx) return;
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    const w = (canvas.width = canvas.clientWidth * dpr);
    const h = (canvas.height = canvas.clientHeight * dpr);
    ctx.clearRect(0, 0, w, h);
    speed += (1 - speed) * Math.min(1, dt * 1.2);
    const lx = tilt.active ? tilt.x * 0.5 : px;
    const ly = tilt.active ? tilt.y * 0.5 : py;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (!reduced) {
        p.y -= dt * 0.025 * p.z * speed;
        p.x += dt * p.drift * speed;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      }
      const x = (p.x + lx * 0.06 * p.z) * w;
      const y = (p.y + ly * 0.04 * p.z) * h;
      const size = p.s * p.z * dpr;
      ctx.globalAlpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 700 + p.tw))) * p.z * 0.8;
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  };
  raf = requestAnimationFrame(frame);
  return {
    burst() { speed = reduced ? 1 : 9; },
    stop() {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
    },
  };
}
