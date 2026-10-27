// Starts everything on each page. With Astro's ClientRouter this module runs once; pages come and go
// through `astro:page-load` / `astro:before-swap`, while the sound and the travelling stone carry on.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { sound } from './audio';
import { startScroll, stopScroll } from './scroll';
import { initReveals } from './reveal';
import { bindGlobal, initPage } from './ui';
import { runIntro } from './intro';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
})();

let cleanups: (() => void)[] = [];
let pageId = 0;

/** run a page module that loads lazily; if the page has changed by the time it loads, undo it at once */
function lazy<T>(load: Promise<T>, start: (m: T) => () => void) {
  const id = pageId;
  load.then((m) => {
    const stop = start(m);
    if (id === pageId) cleanups.push(stop);
    else stop();
  }).catch(() => {});
}

bindGlobal();

const applyLook = () => {
  const d = document.documentElement;
  try {
    const look = sessionStorage.getItem('ts-look');
    d.classList.toggle('previewing-look', !!look);
    if (look === 'gold') d.dataset.look = 'gold';
    else delete d.dataset.look;
    document.querySelectorAll('[data-look-link]').forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('data-look-link') === (look || 'warm'))));
  } catch {}
};
applyLook();
document.addEventListener('astro:after-swap', () => {
  const d = document.documentElement;
  d.classList.add('js');
  if (reduced) d.classList.add('reduced');
  applyLook();
});
document.addEventListener('astro:before-preparation', () => sound.whoosh());
document.addEventListener('astro:before-swap', () => {
  pageId++;
  cleanups.forEach((fn) => fn());
  cleanups = [];
  ScrollTrigger.getAll().forEach((t) => t.kill());
  stopScroll();
});

document.addEventListener('astro:page-load', async () => {
  const lenis = startScroll(reduced);
  cleanups.push(initPage({ lenis }));

  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (hero && webgl && !reduced) lazy(import('./hero'), (m) => m.startHero(hero));
  if (webgl && !reduced) {
    const layer = document.querySelector<HTMLElement>('[data-stone-layer]');
    lazy(import('./stone'), (m) => {
      if (layer) m.initStone(layer);
      return m.stoneOnPage();
    });
  }
  if (document.querySelector('[data-voucher]') && !reduced) lazy(import('./voucher'), (m) => m.startVouchers());
  if (document.querySelector('[data-map]')) lazy(import('./map'), (m) => m.startMap());

  const id = pageId;
  if (document.documentElement.classList.contains('show-intro')) {
    lenis?.stop();
    await runIntro();
    lenis?.start();
  }
  if (id === pageId) initReveals(reduced);
});
