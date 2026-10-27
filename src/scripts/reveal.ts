// Scroll reveals. Text rises out of a soft blur like steam; photos open like a ripple spreading on water.
//   data-reveal="rise"     the element floats up into place
//   data-reveal="words"    each word rises in turn (headings)
//   data-reveal="stagger"  its [data-reveal-item] children rise one after another
//   data-reveal="ripple"   a photo opens from a circle, with a ring spreading outwards
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { sound } from './audio';

gsap.registerPlugin(ScrollTrigger);

function splitWords(el: HTMLElement) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent || '').split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) frag.append(document.createTextNode(part));
          else {
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.append(w);
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  };
  walk(el);
}

function play(el: HTMLElement) {
  const kind = el.dataset.reveal;
  el.classList.add('is-in');
  if (kind === 'words') {
    gsap.from(el.querySelectorAll('.w'), { yPercent: 55, opacity: 0, filter: 'blur(10px)', duration: 1.5, stagger: 0.065, ease: 'power3.out', clearProps: 'filter' });
  } else if (kind === 'stagger') {
    gsap.from(el.querySelectorAll('[data-reveal-item]'), { y: 50, opacity: 0, filter: 'blur(6px)', duration: 1.3, stagger: 0.12, ease: 'power3.out', clearProps: 'filter,transform' });
  } else if (kind === 'ripple') {
    const img = el.querySelector('img');
    const ring = document.createElement('span');
    ring.className = 'ripple-ring';
    el.append(ring);
    const tl = gsap.timeline({ onComplete: () => { ring.remove(); el.style.clipPath = ''; } });
    tl.fromTo(el, { clipPath: 'circle(0% at 50% 55%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 1.9, ease: 'power3.inOut' }, 0);
    if (img) tl.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 2.4, ease: 'power3.out', clearProps: 'transform' }, 0);
    tl.fromTo(ring, { scale: 0, opacity: 1 }, { scale: 3.4, opacity: 0, duration: 1.8, ease: 'power2.out' }, 0.15);
    sound.drip(0.35);
  } else {
    gsap.from(el, { y: 34, opacity: 0, filter: 'blur(6px)', duration: 1.3, ease: 'power3.out', clearProps: 'filter,transform' });
  }
}

export function initReveals(reduced: boolean) {
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (reduced) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  for (const el of els) {
    if (el.dataset.reveal === 'words') splitWords(el);
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => play(el) });
  }
}
