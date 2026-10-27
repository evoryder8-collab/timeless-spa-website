// Phone motion: how the visitor tilts the phone, as a smooth pair in -1…1, plus a tiny haptic tap.
// iOS only shares motion after the visitor allows it, and only from a tap, so `requestTilt()` is
// called from taps (entering the site, touching the water). Other phones share it straight away.
export const tilt = { x: 0, y: 0, active: false };

let listening = false;
let asked = false;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function listen() {
  if (listening) return;
  listening = true;
  let base: { b: number; g: number } | null = null;
  addEventListener('deviceorientation', (e) => {
    if (e.beta == null || e.gamma == null) return;
    // "neutral" is however the phone is being held; it slowly follows the hand
    base ??= { b: e.beta, g: e.gamma };
    base.b += (e.beta - base.b) * 0.004;
    base.g += (e.gamma - base.g) * 0.004;
    tilt.x += (clamp((e.gamma - base.g) / 22, -1, 1) - tilt.x) * 0.25;
    tilt.y += (clamp((e.beta - base.b) / 22, -1, 1) - tilt.y) * 0.25;
    tilt.active = true;
  });
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Start listening; on iOS this must run inside a tap */
export function requestTilt() {
  if (listening || asked || !('DeviceOrientationEvent' in window)) return;
  if (!matchMedia('(pointer: coarse)').matches) return;
  const api = DeviceOrientationEvent as unknown as PermissionApi;
  if (typeof api.requestPermission === 'function') {
    asked = true;
    api.requestPermission().then((r) => r === 'granted' && listen()).catch(() => {});
  } else {
    listen();
  }
}

/** a very short vibration, where phones support it */
export function buzz(ms = 8) {
  // browsers only allow it after the visitor has tapped the page
  if (!navigator.userActivation?.hasBeenActive) return;
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
