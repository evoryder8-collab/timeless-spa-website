// Small interface behaviour: header state, booking panel, mobile menu, sound switch,
// massage filters, today's opening hours and the interface sounds.
import { gsap } from 'gsap';
import type Lenis from 'lenis';
import { sound } from './audio';
import { requestTilt, buzz, tilt } from './tilt';

let globalBound = false;

/** Listeners on document/window that survive page changes: bind once */
export function bindGlobal() {
  if (globalBound) return;
  globalBound = true;

  // interface sounds: data-sfx="click" | "bowl" on anything clickable
  document.addEventListener('click', (e) => {
    // returning visitors skip the intro, so their first tap is when a phone may start sharing its tilt
    requestTilt();
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-sfx]');
    if (!el) return;
    if (el.dataset.sfx === 'bowl') sound.bowl(0.8);
    else sound.click();
    buzz(6);
  });
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.btn, .site-nav a, .chip');
    if (!el || el.contains(e.relatedTarget as Node)) return;
    sound.hover();
    // the button's hover ripple starts where the pointer came in
    if (el.classList.contains('btn')) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--rx', `${e.clientX - r.left}px`);
      el.style.setProperty('--ry', `${e.clientY - r.top}px`);
    }
  });

  // sound chosen earlier this session, but the page was reloaded: resume on the first gesture
  if (sound.wanted && !sound.enabled) {
    const resume = () => {
      removeEventListener('pointerdown', resume, true);
      removeEventListener('keydown', resume, true);
      if (!document.documentElement.classList.contains('show-intro')) sound.enable();
    };
    addEventListener('pointerdown', resume, true);
    addEventListener('keydown', resume, true);
  }
}

export function initPage({ lenis }: { lenis: Lenis | null }) {
  const html = document.documentElement;
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(type, fn, opts);
    cleanups.push(() => el.removeEventListener(type, fn, opts));
  };
  const isHome = document.body.dataset.page === 'home';

  // ───── header: solid once scrolled, tucked away while reading down, back on scroll up ─────
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    html.classList.toggle('scrolled', y > 30);
    html.classList.toggle('book-bar-hidden', isHome && y < innerHeight * 0.6);
    if (y < 500) html.classList.remove('header-hidden');
    const delta = y - lastY;
    if (Math.abs(delta) < 6) return;
    const menuOpen = !document.querySelector('[data-mobile-menu]')?.hasAttribute('hidden');
    if (delta > 0 && y > 500 && !menuOpen) html.classList.add('header-hidden');
    else if (delta < 0) html.classList.remove('header-hidden');
    lastY = y;
  };
  onScroll();
  on(window, 'scroll', onScroll, { passive: true });

  // ───── booking panel ─────
  const dialog = document.querySelector<HTMLDialogElement>('[data-booking]');
  if (dialog) {
    const open = () => {
      if (dialog.open) return;
      closeMenu();
      dialog.showModal();
      lenis?.stop();
    };
    document.querySelectorAll('[data-book]').forEach((b) => on(b, 'click', open));
    on(dialog, 'close', () => lenis?.start());
    on(dialog, 'click', (e: MouseEvent) => {
      if (e.target === dialog || (e.target as HTMLElement).closest('[data-booking-close]')) dialog.close();
    });
  }

  // ───── mobile menu ─────
  const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    toggle?.setAttribute('aria-expanded', 'false');
    lenis?.start();
    html.style.overflow = '';
  }
  if (menu && toggle) {
    on(toggle, 'click', () => {
      if (!menu.hidden) return closeMenu();
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      lenis?.stop();
      html.style.overflow = 'hidden';
      sound.drip(0.7);
      // the menu spreads out from its button like a ripple
      const b = toggle.getBoundingClientRect();
      const at = `${b.left + b.width / 2}px ${b.top + b.height / 2}px`;
      gsap.fromTo(menu, { clipPath: `circle(0px at ${at})` }, { clipPath: `circle(${Math.hypot(innerWidth, innerHeight)}px at ${at})`, duration: 0.9, ease: 'power3.inOut', clearProps: 'clipPath' });
      gsap.from(menu.querySelectorAll('li, .mobile-menu__foot'), { y: 40, opacity: 0, filter: 'blur(8px)', duration: 1, delay: 0.25, stagger: 0.07, ease: 'power3.out', clearProps: 'all' });
    });
    on(document, 'keydown', (e: KeyboardEvent) => e.key === 'Escape' && closeMenu());
    menu.querySelectorAll('a').forEach((a) => on(a, 'click', closeMenu));
  }
  cleanups.push(() => {
    html.style.overflow = '';
    html.classList.remove('header-hidden');
  });

  // ───── sound switch ─────
  const soundBtn = document.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  if (soundBtn) {
    const reflect = (playing: boolean) => {
      soundBtn.setAttribute('aria-pressed', String(playing));
      soundBtn.setAttribute('aria-label', (playing ? soundBtn.dataset.labelOn : soundBtn.dataset.labelOff) || '');
    };
    reflect(sound.enabled);
    cleanups.push(sound.onChange(reflect) as () => void);
    on(soundBtn, 'click', async () => {
      await sound.toggle();
      if (sound.enabled) sound.bowl(0.7);
    });
  }

  // ───── massage filters ─────
  const filters = document.querySelector('[data-filters]');
  if (filters) {
    const items = [...document.querySelectorAll<HTMLElement>('[data-menu-list] .menu__item')];
    filters.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) =>
      on(btn, 'click', () => {
        const f = btn.dataset.filter!;
        filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        sound.click();
        const show = items.filter((it) => f === 'all' || it.querySelector('[data-world]')!.getAttribute('data-world') === f);
        items.forEach((it) => it.classList.toggle('is-hidden', !show.includes(it)));
        gsap.fromTo(show, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
        lenis?.resize();
      }),
    );
  }

  // ───── swipe carousels (phones): the card in the middle comes forward ─────
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((track) => {
    const items = [...track.children] as HTMLElement[];
    let current: HTMLElement | null = null;
    const update = () => {
      const t = track.getBoundingClientRect();
      const mid = t.left + t.width / 2;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const it of items) {
        const r = it.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        it.style.setProperty('--focus', String(Math.max(0, 1 - d / t.width)));
        if (d < bestD) { bestD = d; best = it; }
      }
      if (best && best !== current) {
        if (current) { sound.hover(); buzz(4); }
        current = best;
      }
    };
    update();
    on(track, 'scroll', update, { passive: true });
    on(window, 'resize', update);
  });

  // ───── cards lean towards the pointer, or with the phone's tilt ─────
  const cards = [...document.querySelectorAll<HTMLElement>('[data-tilt]')];
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cards.forEach((el) => {
      on(el, 'pointermove', (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('is-tilting');
        el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-4px)`;
        el.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
        el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
      });
      on(el, 'pointerleave', () => {
        el.classList.remove('is-tilting');
        el.style.transform = '';
      });
    });
  } else if (cards.length) {
    // phones: the cards on screen follow the way the phone is held
    const onScreen = new Set<HTMLElement>();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? onScreen.add(e.target as HTMLElement) : onScreen.delete(e.target as HTMLElement))));
    cards.forEach((c) => io.observe(c));
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!tilt.active) return;
      onScreen.forEach((el) => {
        el.style.transform = `perspective(900px) rotateX(${(-tilt.y * 6).toFixed(2)}deg) rotateY(${(tilt.x * 8).toFixed(2)}deg)`;
        el.style.setProperty('--gx', `${50 + tilt.x * 45}%`);
        el.style.setProperty('--gy', `${30 + tilt.y * 40}%`);
        el.classList.add('is-tilting');
      });
    };
    raf = requestAnimationFrame(loop);
    cleanups.push(() => { cancelAnimationFrame(raf); io.disconnect(); });
  }

  // ───── today's opening hours (Cologne time) ─────
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(new Date());
  const iso = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1;
  document.querySelectorAll<HTMLElement>('[data-hours] .hours__row').forEach((row) => {
    row.classList.toggle('is-today', (row.dataset.days || '').split(',').includes(String(iso)));
  });

  return () => cleanups.forEach((fn) => fn());
}
