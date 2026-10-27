// Smooth scrolling with Lenis, driven by GSAP's ticker so ScrollTrigger stays in step.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;
let tick: ((t: number) => void) | null = null;

export function startScroll(reduced: boolean) {
  if (reduced) return null;
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: -96 } });
  lenis.on('scroll', ScrollTrigger.update);
  const l = lenis;
  tick = (t) => l.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function stopScroll() {
  if (tick) gsap.ticker.remove(tick);
  tick = null;
  lenis?.destroy();
  lenis = null;
}

export const getLenis = () => lenis;
