// Small interface behaviour: header state, booking panel, mobile menu, sound switch,
// massage filters, today's opening hours and the interface sounds.
import { gsap } from 'gsap';
import type Lenis from 'lenis';
import { sound } from './audio';

let globalBound = false;

/** Listeners on document/window that survive page changes: bind once */
export function bindGlobal() {
  if (globalBound) return;
  globalBound = true;

  // interface sounds: data-sfx="click" | "bowl" on anything clickable
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-sfx]');
    if (!el) return;
    if (el.dataset.sfx === 'bowl') sound.bowl(0.8);
    else sound.click();
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
      sound.click();
      gsap.from(menu.querySelectorAll('li, .mobile-menu__foot'), { y: 30, opacity: 0, filter: 'blur(6px)', duration: 0.9, stagger: 0.06, ease: 'power3.out', clearProps: 'all' });
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
        const show = items.filter((it) => f === 'all' || it.querySelector('[data-focus]')!.getAttribute('data-focus')!.split(' ').includes(f));
        items.forEach((it) => it.classList.toggle('is-hidden', !show.includes(it)));
        gsap.fromTo(show, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
        lenis?.resize();
      }),
    );
  }

  // ───── today's opening hours (Cologne time) ─────
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(new Date());
  const iso = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1;
  document.querySelectorAll<HTMLElement>('[data-hours] .hours__row').forEach((row) => {
    row.classList.toggle('is-today', (row.dataset.days || '').split(',').includes(String(iso)));
  });

  return () => cleanups.forEach((fn) => fn());
}
