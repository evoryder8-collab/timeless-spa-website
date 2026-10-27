// The travelling stone. One small WebGL stone that lives outside the page content
// (its layer survives page changes), rolls to a resting spot near what the visitor is reading,
// moves to the massage under the pointer and glows on the warm treatments.
// On the home page it starts and ends as the top stone of the cairn.
import * as THREE from 'three';
import { sound } from './audio';
import { bridge } from './stone-bridge';
import { buzz } from './tilt';
import { TRAVELLER, stoneGeometry, stoneMaterial } from './stone-shape';

const BOX = 280; // canvas size in CSS pixels; the stone is drawn inside it at any size up to ~240px

type Anchor = { el: Element; corner: 'top-left' | 'top-right'; warm: boolean; focus?: boolean };

let ready = false;
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let mesh: THREE.Mesh;
let mat: THREE.MeshPhysicalMaterial;
let wrap: HTMLElement;
let glowEl: HTMLElement;
let shadowEl: HTMLElement;
let hitEl: HTMLButtonElement;

const pos = { x: -200, y: -200, vx: 0, vy: 0 };
const anchorPrev = { x: 0, y: 0, ok: false };
let size = 0; // drawn width in px
let shown = 0; // 0 hidden … 1 visible
let glow = 0;
let wasDocked = true;
let hoverAnchor: Anchor | null = null;
let hoverTimer = 0;
let spots: Anchor[] = [];
let lastSpot: Element | null = null;
let wobble = 0;
const restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.62, 0.5, -0.08));
const q = new THREE.Quaternion().copy(restQ);
const axis = new THREE.Vector3();
const dq = new THREE.Quaternion();

const baseSize = () => (innerWidth < 760 ? 60 : 74);
const fineMq = matchMedia('(hover: hover) and (pointer: fine)');
const fine = () => fineMq.matches;

export function initStone(layer: HTMLElement) {
  if (ready) return;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return;
  }
  ready = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(BOX, BOX, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1.4, 1.4, 1.4, -1.4, 0.1, 20);
  camera.position.set(0, 0, 6);
  scene.add(new THREE.HemisphereLight(0xf3e3cf, 0x3a2a20, 1.2));
  const key = new THREE.DirectionalLight(0xffd6ae, 2.6);
  key.position.set(-2, 3, -1.5);
  const fill = new THREE.DirectionalLight(0xffe9d6, 1.3);
  fill.position.set(2, 2, 5);
  scene.add(key, fill);
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#e7cdb2');
  envScene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2a20, 3));
  scene.environment = pm.fromScene(envScene, 0.1).texture;
  scene.environmentIntensity = 0.5;

  mat = stoneMaterial();
  mesh = new THREE.Mesh(stoneGeometry(TRAVELLER, 18), mat);
  scene.add(mesh);

  wrap = document.createElement('div');
  wrap.className = 'tstone';
  wrap.innerHTML = '<div class="tstone__shadow"></div><div class="tstone__glow"></div>';
  wrap.appendChild(renderer.domElement);
  shadowEl = wrap.querySelector('.tstone__shadow')!;
  glowEl = wrap.querySelector('.tstone__glow')!;
  hitEl = document.createElement('button');
  hitEl.type = 'button';
  hitEl.tabIndex = -1;
  hitEl.setAttribute('aria-hidden', 'true');
  hitEl.className = 'tstone__hit';
  hitEl.addEventListener('click', () => {
    wobble = 1;
    sound.stone(0.9);
    buzz(14);
  });
  layer.append(wrap, hitEl);

  // when the page changes, forget the old page's spots; the stone stays where it is
  document.addEventListener('astro:before-swap', () => {
    spots = [];
    hoverAnchor = null;
    lastSpot = null;
    anchorPrev.ok = false;
  });

  let prev = performance.now();
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min((now - prev) / 1000, 1 / 30);
    prev = now;
    tick(dt);
  };
  requestAnimationFrame(loop);
}

/** Called on every page load: collect this page's resting spots and hover targets */
export function stoneOnPage(): () => void {
  if (!ready) return () => {};
  spots = [...document.querySelectorAll('[data-stone-spot]')].map((el) => ({
    el,
    corner: (el.getAttribute('data-stone-spot') as Anchor['corner']) || 'top-left',
    warm: false,
  }));
  const hoverables = [...document.querySelectorAll<HTMLElement>('[data-stone-hover]')];
  // phones have no hover: the massage in the middle of the screen is the one the stone goes to
  if (!fine()) {
    spots.push(...hoverables.map((el) => ({ el, corner: 'top-right' as const, warm: el.hasAttribute('data-warm'), focus: true })));
  }
  const enter = (e: Event) => {
    if (!fine()) return;
    clearTimeout(hoverTimer);
    const el = e.currentTarget as HTMLElement;
    const warm = el.hasAttribute('data-warm');
    if (warm && hoverAnchor?.el !== el) sound.warm();
    hoverAnchor = { el, corner: 'top-right', warm };
  };
  const leave = () => {
    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => (hoverAnchor = null), 450);
  };
  hoverables.forEach((el) => {
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
  });
  return () => {
    hoverables.forEach((el) => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    });
  };
}

/** Where the stone sits on an element: on its top edge, near the chosen corner */
function anchorPoint(a: Anchor, s: number) {
  const r = a.el.getBoundingClientRect();
  if (!r.width) return null;
  const inset = Math.min(s * 0.9, r.width * 0.25);
  return {
    x: a.corner === 'top-right' ? r.right - inset : r.left + inset,
    y: r.top - s * 0.18,
  };
}

/** The visible spot closest to the middle of the screen; on phones a card in the middle wins */
function pickSpot(s: number) {
  const header = 90;
  let best: Anchor | null = null;
  let bestD = Infinity;
  for (const a of spots) {
    const r = a.el.getBoundingClientRect();
    if (!r.width || r.top < header + s * 0.4 || r.top > innerHeight - s) continue;
    // cards in a sideways carousel only count while mostly on screen
    const cx = (r.left + r.right) / 2;
    if (cx < innerWidth * 0.2 || cx > innerWidth * 0.8) continue;
    let d = Math.abs(r.top - innerHeight * 0.45) + Math.abs(cx - innerWidth / 2) * 0.5;
    if (a.focus) d -= 60;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** On phones the stone can always sit on the floating booking bar */
function bookBar() {
  const bar = document.querySelector('.book-bar');
  if (!bar || document.documentElement.classList.contains('book-bar-hidden')) return null;
  const r = bar.getBoundingClientRect();
  return r.width && r.top < innerHeight ? bar : null;
}

function tick(dt: number) {
  const s0 = baseSize();
  let target: { x: number; y: number } | null = null;
  let targetSize = s0;
  let warm = false;
  let home = false;

  if (bridge.heroActive && bridge.wantsHome) {
    // go back into the cairn
    target = { x: bridge.top.x, y: bridge.top.y };
    targetSize = bridge.top.size;
    home = true;
  } else if (hoverAnchor) {
    target = anchorPoint(hoverAnchor, s0);
    warm = hoverAnchor.warm;
  } else {
    const spot = pickSpot(s0);
    const bar = spot ? null : !fine() && bookBar();
    if (spot) {
      target = anchorPoint(spot, s0);
      warm = spot.warm;
      if (spot.el !== lastSpot) {
        anchorPrev.ok = false;
        if (spot.warm) sound.warm();
      }
      lastSpot = spot.el;
    } else if (bar) {
      target = anchorPoint({ el: bar, corner: 'top-left', warm: false }, s0 * 0.85);
      targetSize = s0 * 0.85;
      if (bar !== lastSpot) anchorPrev.ok = false;
      lastSpot = bar;
    } else if (fine()) {
      // nothing to sit on: rest in the lower left corner
      target = { x: 46, y: innerHeight - 40 };
      targetSize = s0 * 0.78;
      lastSpot = null;
    } else {
      lastSpot = null;
    }
  }

  // leaving the cairn: appear exactly where the top stone was
  // (on a first visit to another page there is no cairn, so it rises from below instead)
  if (bridge.docked && !(bridge.heroActive && bridge.wantsHome)) {
    bridge.docked = false;
    if (wasDocked && bridge.top.size > 0) {
      pos.x = bridge.top.x;
      pos.y = bridge.top.y;
      size = bridge.top.size;
      pos.vx = 0;
      pos.vy = -260;
      shown = 1;
    } else {
      shown = 0;
    }
    wasDocked = false;
  }
  // appearing from nothing: start just below the spot and rise into it
  if (target && shown < 0.05 && !bridge.docked) {
    pos.x = target.x;
    pos.y = target.y + 70;
    pos.vx = 0;
    pos.vy = 0;
    size = targetSize;
  }

  // spring towards the target
  if (target) {
    const k = home ? 70 : 120;
    const c = 2 * Math.sqrt(k) * (home ? 1 : 0.82);
    pos.vx += (k * (target.x - pos.x) - c * pos.vx) * dt;
    pos.vy += (k * (target.y - pos.y) - c * pos.vy) * dt;
    pos.x += pos.vx * dt;
    pos.y += pos.vy * dt;
  }
  size += (targetSize - size) * Math.min(1, dt * 6);
  const wantShown = target ? 1 : 0;
  shown += (wantShown - shown) * Math.min(1, dt * 5);

  // docking: close enough to the cairn's top stone, hand it back
  if (home && !bridge.docked && Math.hypot(target!.x - pos.x, target!.y - pos.y) < 3 && Math.hypot(pos.vx, pos.vy) < 30) {
    bridge.docked = true;
    wasDocked = true;
    sound.stone(0.6);
  }

  // rolling: rotate by the distance travelled relative to whatever the stone is sitting on
  let relX = pos.vx * dt;
  let relY = pos.vy * dt;
  if (target && !home) {
    if (anchorPrev.ok) {
      relX -= target.x - anchorPrev.x;
      relY -= target.y - anchorPrev.y;
    }
    anchorPrev.x = target.x;
    anchorPrev.y = target.y;
    anchorPrev.ok = true;
  }
  const dist = Math.hypot(relX, relY);
  if (dist > 0.05) {
    axis.set(relY, relX, 0).normalize();
    dq.setFromAxisAngle(axis, (dist / Math.max(size, 20)) * 1.4);
    q.premultiply(dq);
  } else {
    q.slerp(restQ, Math.min(1, dt * 1.6));
  }
  if (wobble > 0.001) {
    wobble *= Math.pow(0.02, dt);
    dq.setFromAxisAngle(axis.set(0, 0, 1), Math.sin(performance.now() / 55) * wobble * 0.08);
    q.multiply(dq);
  }
  mesh.quaternion.copy(q);

  // warmth
  glow += ((warm ? 1 : 0) - glow) * Math.min(1, dt * (warm ? 2.2 : 1.4));
  mat.emissiveIntensity = glow * 1.15;

  // draw
  const visible = !bridge.docked && shown > 0.01;
  wrap.style.opacity = visible ? String(Math.min(1, shown * 1.2)) : '0';
  hitEl.style.display = visible && shown > 0.6 ? 'block' : 'none';
  if (!visible) return;
  // the orthographic view is 100px per unit; the stone is 2 × long units wide at scale 1
  mesh.scale.setScalar(size / (200 * TRAVELLER.long));
  wrap.style.transform = `translate3d(${pos.x - BOX / 2}px, ${pos.y - BOX / 2}px, 0)`;
  glowEl.style.opacity = String(glow * 0.9);
  glowEl.style.transform = `scale(${size / 120})`;
  shadowEl.style.transform = `translateY(${size * 0.3}px) scale(${size / 120}, ${size / 300})`;
  shadowEl.style.opacity = String(home ? 0 : 0.35);
  hitEl.style.transform = `translate3d(${pos.x - size / 2}px, ${pos.y - size * 0.35}px, 0)`;
  hitEl.style.width = `${size}px`;
  hitEl.style.height = `${size * 0.7}px`;
  renderer.render(scene, camera);
}
