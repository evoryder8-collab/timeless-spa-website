// The Earth in the map box before the real map loads: NASA's Blue Marble on a three.js sphere with a soft
// atmosphere and a glowing pin on Cologne. It is drawn entirely from files on this site, so nothing
// third-party loads until the visitor asks for the map. It turns until Cologne faces the viewer, can be
// dragged, and hands over to MapLibre (at a matching size) when the flight starts.
import * as THREE from 'three';
import earthUrl from '../assets/earth/blue-marble-2048.jpg?url';

const toVec = (lat: number, lng: number, r = 1) => {
  const phi = ((lng + 180) * Math.PI) / 180;
  const theta = ((90 - lat) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(theta) * Math.cos(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phi));
};

export interface Teaser {
  /** MapLibre zoom at which its globe appears the same size as this one */
  mapZoom(): number;
  /** fade out once the real map is on screen */
  handOff(): void;
  stop(): void;
}

export function startGlobe(block: HTMLElement, lngLat: [number, number], onTap: () => void): Teaser | null {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  const canvas = renderer.domElement;
  canvas.className = 'mapblock__globe';
  canvas.setAttribute('aria-hidden', 'true');
  block.querySelector('[data-map-poster]')!.prepend(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  // tilt (towards Cologne's latitude) on the outside, spin on the inside
  const tiltGroup = new THREE.Group();
  const spin = new THREE.Group();
  tiltGroup.add(spin);
  scene.add(tiltGroup);

  const tex = new THREE.TextureLoader().load(earthUrl, () => (dirty = true));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.MeshPhongMaterial({ map: tex, specular: new THREE.Color(0x223344), shininess: 12 }),
  );
  spin.add(earth);

  // a thin blue atmosphere, brightest at the rim
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vN;
        void main() {
          float i = pow(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(0.42, 0.62, 1.0, 1.0) * i * 1.6;
        }
      `,
    }),
  );
  scene.add(atmo);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.2);
  sun.position.set(-3, 1.5, 4);
  scene.add(sun);

  // the pin on Cologne: a warm dot and a ring that keeps spreading
  const pinPos = toVec(lngLat[1], lngLat[0], 1.002);
  const pin = new THREE.Group();
  pin.position.copy(pinPos);
  pin.lookAt(pinPos.clone().multiplyScalar(2));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.018, 32), new THREE.MeshBasicMaterial({ color: 0xe8a070 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.03, 48), new THREE.MeshBasicMaterial({ color: 0xffc89a, transparent: true }));
  pin.add(dot, ring);
  spin.add(pin);

  // the rotation that brings Cologne to the front
  const faceY = Math.atan2(-pinPos.x, pinPos.z);
  const zAfter = -pinPos.x * Math.sin(faceY) + pinPos.z * Math.cos(faceY);
  const faceX = Math.atan2(pinPos.y, zAfter) * 0.85;
  const rot = { y: faceY - 2.4, x: 0.2, vy: 0 };

  let w = 1, h = 1;
  const resize = () => {
    w = block.clientWidth;
    h = block.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // the globe takes about three quarters of the shorter side
    const want = 0.38 * Math.min(w, h);
    const dist = 1 / Math.tan(((camera.fov / 2) * Math.PI) / 180) * (h / 2) / want;
    camera.position.z = dist;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  let dirty = true;
  const ro = new ResizeObserver(resize);
  ro.observe(block);
  resize();

  // drag to turn it (sideways only, so the page still scrolls on phones)
  let drag: { x: number; y: number; t: number } | null = null;
  let moved = 0;
  const down = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    moved = 0;
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    moved += Math.abs(dx) + Math.abs(e.clientY - drag.y);
    rot.vy = (dx / w) * 4;
    rot.y += (dx / w) * 3;
    drag.x = e.clientX;
    drag.y = e.clientY;
    following = false;
  };
  const up = () => {
    if (drag && moved < 8) onTap();
    drag = null;
  };
  canvas.addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';

  // turn towards Cologne once the box is on screen
  let following = false;
  let visible = false;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !following && rot.y < faceY - 0.5) following = true;
  });
  io.observe(block);

  let raf = 0;
  let prev = performance.now();
  let fading = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (!visible && !dirty) return;
    if (following) {
      rot.y += (faceY - rot.y) * Math.min(1, dt * 1.1);
      rot.x += (faceX - rot.x) * Math.min(1, dt * 1.1);
      if (Math.abs(faceY - rot.y) < 0.002) following = false;
    } else if (!drag && !reduced) {
      rot.vy *= Math.pow(0.05, dt);
      rot.y += rot.vy * dt + dt * 0.05;
    }
    spin.rotation.y = rot.y;
    tiltGroup.rotation.x = rot.x;
    const pulse = (now / 1600) % 1;
    ring.scale.setScalar(1 + pulse * 2.6);
    (ring.material as THREE.MeshBasicMaterial).opacity = 1 - pulse;
    renderer.render(scene, camera);
    dirty = false;
  };
  raf = requestAnimationFrame(frame);
  if (reduced) {
    rot.y = faceY;
    rot.x = faceX;
  }

  return {
    mapZoom() {
      // MapLibre's globe radius in CSS px is 512 · 2^z / 2π
      const r = 0.38 * Math.min(w, h);
      return Math.log2((r * 2 * Math.PI) / 512);
    },
    handOff() {
      if (fading) return;
      fading = true;
      canvas.style.transition = 'opacity 0.9s ease';
      canvas.style.opacity = '0';
      setTimeout(() => this.stop(), 1000);
    },
    stop() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      tex.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
