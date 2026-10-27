// The voucher card leans towards the pointer (or follows the phone's tilt) and catches the light;
// at rest it sways a little.
import { gsap } from 'gsap';
import { tilt as phone } from './tilt';

export function startVouchers(): () => void {
  const cleanups: (() => void)[] = [];
  document.querySelectorAll<HTMLElement>('[data-voucher]').forEach((box) => {
    const card = box.querySelector<HTMLElement>('[data-voucher-card]')!;
    const tilt = { rx: 0, ry: 0, mx: 50, my: 30 };
    const apply = () => {
      card.style.setProperty('--rx', `${tilt.rx}deg`);
      card.style.setProperty('--ry', `${tilt.ry}deg`);
      card.style.setProperty('--mx', `${tilt.mx}%`);
      card.style.setProperty('--my', `${tilt.my}%`);
    };
    const sway = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut', duration: 3.2, onUpdate: apply } });
    sway.to(tilt, { rx: 5, ry: -9, mx: 30, my: 20 }).to(tilt, { rx: -4, ry: 8, mx: 70, my: 45 });

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = box.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      sway.pause();
      card.classList.add('is-live');
      gsap.to(tilt, { rx: (0.5 - y) * 18, ry: (x - 0.5) * 24, mx: x * 100, my: y * 100, duration: 0.4, ease: 'power2.out', onUpdate: apply, overwrite: true });
    };
    const leave = () => {
      card.classList.remove('is-live');
      gsap.to(tilt, { rx: 0, ry: 0, mx: 50, my: 30, duration: 1.2, ease: 'power3.out', onUpdate: apply, overwrite: true, onComplete: () => { sway.restart(); } });
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerleave', leave);

    // on phones the card follows the way the phone is tilted, once the phone shares it
    let raf = 0;
    const follow = () => {
      raf = requestAnimationFrame(follow);
      if (!phone.active) return;
      sway.pause();
      tilt.rx += (-phone.y * 16 - tilt.rx) * 0.15;
      tilt.ry += (phone.x * 22 - tilt.ry) * 0.15;
      tilt.mx += (50 + phone.x * 45 - tilt.mx) * 0.15;
      tilt.my += (35 + phone.y * 35 - tilt.my) * 0.15;
      apply();
    };
    raf = requestAnimationFrame(follow);

    cleanups.push(() => {
      cancelAnimationFrame(raf);
      sway.kill();
      gsap.killTweensOf(tilt);
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerleave', leave);
    });
  });
  return () => cleanups.forEach((fn) => fn());
}
