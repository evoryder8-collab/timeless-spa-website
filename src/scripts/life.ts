// Small, continuous life in every section, so no frame is ever still:
//   · photos sit slightly deeper than their frames and drift as you scroll
//   · section headings float a little slower than the page
//   · gold dust rises through the dark sections (only while they are on screen)
//   · a breathing orb of warm light behind each sub-page headline follows the pointer or the phone
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { tilt } from './tilt';

gsap.registerPlugin(ScrollTrigger);

export function startLife(): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const cleanups: (() => void)[] = [];

  // photos: a little larger than their frame, drifting against the scroll
  document.querySelectorAll<HTMLImageElement>('.photo img, .sig__photo img, .mcard__photo img').forEach((img) => {
    gsap.set(img, { scale: 1.14 });
    const t = gsap.fromTo(img, { yPercent: -5 }, {
      yPercent: 5,
      ease: 'none',
      scrollTrigger: { trigger: img.parentElement!, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    });
    cleanups.push(() => t.scrollTrigger?.kill());
  });

  // headings: a touch of depth
  document.querySelectorAll<HTMLElement>('.section-head, .philosophy__claim').forEach((el) => {
    const t = gsap.fromTo(el, { y: 26 }, {
      y: -26,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
    });
    cleanups.push(() => t.scrollTrigger?.kill());
  });

  document.querySelectorAll<HTMLElement>('[data-dust]').forEach((section) => cleanups.push(dust(section)));
  document.querySelectorAll<HTMLElement>('.page-hero').forEach((hero) => cleanups.push(orb(hero)));

  return () => cleanups.forEach((fn) => fn());
}

/** Gold dust drifting up through a dark section */
function dust(section: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dust';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const g = sprite.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,240,214,1)');
  grd.addColorStop(0.3, 'rgba(214,191,146,0.6)');
  grd.addColorStop(1, 'rgba(214,191,146,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const parts = Array.from({ length: innerWidth < 760 ? 34 : 64 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.25 + Math.random() * 0.75,
    s: 3 + Math.random() * 8,
    tw: Math.random() * Math.PI * 2,
    sway: Math.random() * Math.PI * 2,
  }));
  let visible = false;
  let raf = 0;
  let prev = 0;
  let px = 0;
  const onMove = (e: PointerEvent) => (px = e.clientX / innerWidth - 0.5);
  addEventListener('pointermove', onMove, { passive: true });
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!ctx) return;
    const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0;
    prev = now;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const lean = tilt.active ? tilt.x * 0.5 : px;
    for (const p of parts) {
      p.y -= dt * 0.018 * p.z;
      if (p.y < -0.04) { p.y = 1.04; p.x = Math.random(); }
      const x = (p.x + Math.sin(now / 3000 + p.sway) * 0.01 + lean * 0.04 * p.z) * w;
      const y = p.y * h;
      const size = p.s * p.z * dpr;
      ctx.globalAlpha = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now / 800 + p.tw))) * p.z * 0.7;
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  };
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !visible) {
      visible = true;
      prev = 0;
      raf = requestAnimationFrame(frame);
    } else if (!e.isIntersecting && visible) {
      visible = false;
      cancelAnimationFrame(raf);
    }
  });
  io.observe(section);
  return () => {
    io.disconnect();
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', onMove);
    canvas.remove();
  };
}

/** A breathing orb of warm light behind a sub-page headline, drawn towards the pointer or the phone's tilt */
function orb(hero: HTMLElement) {
  const el = document.createElement('span');
  el.className = 'page-hero__orb';
  el.setAttribute('aria-hidden', 'true');
  hero.prepend(el);
  const set = (x: number, y: number) => {
    el.style.setProperty('--ox', `${30 + x * 22}%`);
    el.style.setProperty('--oy', `${46 + y * 18}%`);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
  };
  addEventListener('pointermove', onMove, { passive: true });
  let raf = 0;
  const follow = () => {
    raf = requestAnimationFrame(follow);
    if (tilt.active) set(tilt.x * 0.8, tilt.y * 0.8);
  };
  raf = requestAnimationFrame(follow);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', onMove);
    el.remove();
  };
}
