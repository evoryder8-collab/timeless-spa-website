// Home hero: still water at golden hour with a cairn of three basalt stones.
// The water is a GPU height-field simulation, so the pointer (and the stones) make real ripples,
// and it is drawn with a planar reflection that the ripples distort.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { sound } from './audio';
import { bridge } from './stone-bridge';
import { CAIRN, SKY, stoneGeometry, stoneMaterial } from './stone-shape';

gsap.registerPlugin(ScrollTrigger);

const SIM_SIZE = 16; // world units covered by the ripple simulation

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// one step of the wave equation: height in r, velocity in g
const stepFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uState;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(uState, vUv);
    float avg = (
      texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r +
      texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r +
      texture2D(uState, vUv - vec2(0.0, uTexel.y)).r +
      texture2D(uState, vUv + vec2(0.0, uTexel.y)).r) * 0.25;
    s.g += (avg - s.r) * 2.0;
    s.g *= 0.993;
    s.r += s.g;
    s.r *= 0.9995;
    // soak up waves near the edge so they never bounce back
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float keep = mix(0.86, 1.0, smoothstep(0.0, 0.1, edge));
    s.rg *= keep;
    gl_FragColor = s;
  }
`;

const dropFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uState;
  uniform vec3 uDrop; // uv, strength
  uniform float uRadius;
  uniform float uAspect;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(uState, vUv);
    vec2 d = (uDrop.xy - vUv) * vec2(1.0, uAspect);
    float k = max(0.0, 1.0 - length(d) / uRadius);
    k = 0.5 - cos(k * 3.14159265) * 0.5;
    s.r -= k * uDrop.z;
    gl_FragColor = s;
  }
`;

const waterShader = {
  name: 'TimelessWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uHeight: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uSimCenter: { value: new THREE.Vector2() },
    uSimSize: { value: SIM_SIZE },
    uNormalStrength: { value: 34 },
    uDeep: { value: SKY.water.clone() },
    uNear: { value: SKY.waterNear.clone() },
    uSunColor: { value: SKY.sun.clone() },
    uSunDir: { value: new THREE.Vector3() },
    uFog: { value: SKY.horizon.clone() },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vRefl;
    varying vec3 vWorld;
    void main() {
      vRefl = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D uHeight;
    uniform vec2 uTexel;
    uniform vec2 uSimCenter;
    uniform float uSimSize;
    uniform float uNormalStrength;
    uniform vec3 uDeep;
    uniform vec3 uNear;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform vec3 uFog;
    uniform float uTime;
    varying vec4 vRefl;
    varying vec3 vWorld;
    #include <common>

    float hgt(vec2 uv) { return texture2D(uHeight, uv).r; }

    void main() {
      vec2 suv = (vWorld.xz - uSimCenter) / uSimSize + 0.5;
      float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
      float fadeIn = inside * smoothstep(0.0, 0.14, min(min(suv.x, 1.0 - suv.x), min(suv.y, 1.0 - suv.y)));
      vec2 cuv = clamp(suv, 0.0, 1.0);
      float dx = hgt(cuv + vec2(uTexel.x, 0.0)) - hgt(cuv - vec2(uTexel.x, 0.0));
      float dz = hgt(cuv + vec2(0.0, uTexel.y)) - hgt(cuv - vec2(0.0, uTexel.y));

      // the faintest breath on the surface, so it never looks frozen
      vec2 p = vWorld.xz;
      float micro = sin(p.x * 3.1 + uTime * 0.35) * sin(p.y * 2.3 - uTime * 0.27) * 0.004;
      vec3 n = normalize(vec3(-dx * uNormalStrength * fadeIn + micro, 1.0, -dz * uNormalStrength * fadeIn + micro * 0.7));

      vec3 viewDir = normalize(cameraPosition - vWorld);
      float cosT = max(dot(n, viewDir), 0.0);
      float fres = 0.06 + 0.94 * pow(1.0 - cosT, 4.0);

      vec4 rc = vRefl;
      rc.xy += n.xz * 0.55 * rc.w;
      vec3 refl = texture2DProj(tDiffuse, rc).rgb;

      float d = length(vWorld.xz - uSimCenter);
      vec3 body = mix(uNear, uDeep, smoothstep(1.0, 9.0, d));
      vec3 col = mix(body, refl, clamp(0.38 + fres, 0.0, 1.0));

      // sun glitter on the ripples
      vec3 h = normalize(uSunDir + viewDir);
      float spec = pow(max(dot(n, h), 0.0), 260.0);
      col += uSunColor * spec * 2.4;

      // melt into the haze at the horizon
      float dist = length(cameraPosition.xz - vWorld.xz);
      col = mix(col, uFog, smoothstep(9.0, 30.0, dist));

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

const skyShader = {
  uniforms: {
    uTop: { value: SKY.top.clone() },
    uMid: { value: SKY.mid.clone() },
    uHorizon: { value: SKY.horizon.clone() },
    uSun: { value: SKY.sun.clone() },
    uSunDir: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop, uMid, uHorizon, uSun, uSunDir;
    varying vec3 vDir;
    void main() {
      float y = vDir.y;
      vec3 c = mix(uHorizon, uMid, smoothstep(-0.02, 0.16, y));
      c = mix(c, uTop, smoothstep(0.16, 0.6, y));
      float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
      c += uSun * (pow(s, 6.0) * 0.32 + pow(s, 60.0) * 0.5 + pow(s, 900.0) * 1.5);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

/** A soft round sprite for the steam, drawn once into a canvas */
function steamTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,248,238,0.9)');
  grd.addColorStop(0.45, 'rgba(255,248,238,0.35)');
  grd.addColorStop(1, 'rgba(255,248,238,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function startHero(section: HTMLElement): () => void {
  const stage = section.querySelector<HTMLElement>('[data-hero-stage]')!;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = innerWidth < 760;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' });
  } catch {
    return () => {};
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const sunDir = new THREE.Vector3(-0.38, 0.1, -1).normalize();

  // ───── sky ─────
  const skyMat = new THREE.ShaderMaterial({ ...skyShader, uniforms: THREE.UniformsUtils.clone(skyShader.uniforms), side: THREE.BackSide, depthWrite: false });
  skyMat.uniforms.uSunDir.value.copy(sunDir);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  // environment for the stones' oily sheen, rendered from the same sky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
  const env = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  // ───── lights: low sun behind, warm fill from the viewer ─────
  scene.add(new THREE.HemisphereLight(0xf3e3cf, 0x3a2a20, 1.1));
  const sun = new THREE.DirectionalLight(0xffd6ae, 3.2);
  sun.position.copy(sunDir).multiplyScalar(20);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe9d6, 0.9);
  fill.position.set(2.5, 3, 6);
  scene.add(fill);

  // ───── ripple simulation ─────
  const res = small ? 160 : 256;
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  let simA = new THREE.WebGLRenderTarget(res, res, rtOpts);
  let simB = new THREE.WebGLRenderTarget(res, res, rtOpts);
  const texel = new THREE.Vector2(1 / res, 1 / res);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const stepMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: stepFrag, uniforms: { uState: { value: null }, uTexel: { value: texel } } });
  const dropMat = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: dropFrag, uniforms: { uState: { value: null }, uDrop: { value: new THREE.Vector3() }, uRadius: { value: 0.02 }, uAspect: { value: 1 } } });
  const clearColor = new THREE.Color(0, 0, 0);
  renderer.setRenderTarget(simA);
  renderer.setClearColor(clearColor, 0);
  renderer.clear();
  renderer.setRenderTarget(simB);
  renderer.clear();
  renderer.setRenderTarget(null);

  const pass = (mat: THREE.ShaderMaterial) => {
    mat.uniforms.uState.value = simA.texture;
    quad.material = mat;
    renderer.setRenderTarget(simB);
    renderer.render(quadScene, quadCam);
    [simA, simB] = [simB, simA];
  };
  const drops: { u: number; v: number; s: number; r: number }[] = [];
  const drop = (u: number, v: number, s: number, r = 0.018) => drops.push({ u, v, s, r });

  // ───── water ─────
  const water = new Reflector(new THREE.PlaneGeometry(60, 60), {
    textureWidth: Math.round(innerWidth * (small ? 0.5 : 0.6)),
    textureHeight: Math.round(innerHeight * (small ? 0.5 : 0.6)),
    clipBias: 0.002,
    shader: waterShader,
    multisample: 0,
  });
  water.rotation.x = -Math.PI / 2;
  const wMat = water.material as THREE.ShaderMaterial;
  wMat.uniforms.uTexel.value.copy(texel);
  wMat.uniforms.uSunDir.value.copy(sunDir);
  scene.add(water);

  // ───── the cairn ─────
  const cairn = new THREE.Group();
  scene.add(cairn);
  const stones = CAIRN.map((shape, i) => {
    const mesh = new THREE.Mesh(stoneGeometry(shape, small ? 14 : 20), stoneMaterial());
    mesh.scale.setScalar(shape.scale);
    cairn.add(mesh);
    return mesh;
  });
  // resting pose: each stone sits on the one below, slightly off-centre and tilted
  const rest = [
    { pos: new THREE.Vector3(0, 0.12, 0), rot: new THREE.Euler(0.02, 0.4, -0.03) },
    { pos: new THREE.Vector3(-0.08, 0.6, 0.03), rot: new THREE.Euler(-0.05, -0.5, 0.06) },
    { pos: new THREE.Vector3(0.04, 0.99, -0.02), rot: new THREE.Euler(0.04, 1.1, -0.04) },
  ];
  // a couple of small pebbles half under water
  [
    { x: 1.25, z: 0.55, s: 0.2, seed: 51 },
    { x: -1.4, z: -0.4, s: 0.26, seed: 63 },
    { x: 0.9, z: -1.3, s: 0.16, seed: 71 },
  ].forEach((p) => {
    const m = new THREE.Mesh(stoneGeometry({ flat: 0.5, long: 1.1, seed: p.seed }, 10), stoneMaterial());
    m.scale.setScalar(p.s);
    m.position.set(p.x, 0.0, p.z);
    m.rotation.y = p.seed;
    cairn.add(m);
  });

  // ───── steam ─────
  const STEAM = small ? 26 : 48;
  const steamGeo = new THREE.BufferGeometry();
  const seeds = new Float32Array(STEAM * 4);
  for (let i = 0; i < STEAM; i++) {
    seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  steamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STEAM * 3), 3));
  steamGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const steamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uTex: { value: steamTexture() }, uScale: { value: 1 }, uLift: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        float life = 7.0 + aSeed.x * 5.0;
        float t = fract(uTime / life + aSeed.y);
        float ang = aSeed.z * 6.2831;
        float rad = 0.35 + aSeed.w * 1.5;
        vec3 p = vec3(cos(ang) * rad, 0.05 + t * 2.4, sin(ang) * rad * 0.7);
        p.x += sin(uTime * 0.3 + aSeed.x * 9.0) * 0.25 * t;
        p.z += cos(uTime * 0.25 + aSeed.y * 7.0) * 0.2 * t;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (60.0 + 140.0 * t) / -mv.z;
        vAlpha = smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.55, 1.0, t)) * 0.16;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 c = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(c.rgb, c.a * vAlpha);
      }
    `,
  });
  const steam = new THREE.Points(steamGeo, steamMat);
  steam.frustumCulled = false;
  cairn.add(steam);

  // ───── layout: cairn to the right of the headline on wide screens, above it on narrow ones ─────
  // `shift` slides the picture sideways (a view offset), so the cairn sits beside the headline
  const view = { camY: 1.1, lookY: 0.62, camZ: 7.4, shift: 0 };
  let width = 1, height = 1;
  const resize = () => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const wide = camera.aspect > 1.05;
    view.shift = wide ? THREE.MathUtils.clamp((camera.aspect - 1) * 0.6, 0.16, 0.26) : 0;
    // on tall screens the camera looks down past the cairn so it sits in the top quarter, above the text
    view.camZ = wide ? THREE.MathUtils.clamp(7.4 + (1.6 - camera.aspect) * 3, 7.4, 8.6) : 12;
    view.camY = wide ? 1.1 : 1.6;
    view.lookY = wide ? 0.62 : -1.68;
    camera.fov = wide ? 34 : 40;
    if (view.shift) camera.setViewOffset(width, height, -width * view.shift, 0, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    steamMat.uniforms.uScale.value = height * renderer.getPixelRatio() * 0.012;
    dropMat.uniforms.uAspect.value = 1;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  // ───── scroll: the camera rises, the stones lift apart and turn ─────
  const state = { p: 0, intro: 1 };
  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => (state.p = self.progress),
  });

  // ───── pointer: ripples where you touch the water ─────
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  let last: { u: number; v: number } | null = null;
  let lastSound = 0;
  const toUv = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const u = hit.x / SIM_SIZE + 0.5;
    const v = hit.z / SIM_SIZE + 0.5;
    if (u < 0.02 || u > 0.98 || v < 0.02 || v > 0.98) return null;
    return { u, v };
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const p = toUv(e);
    if (!p) { last = null; return; }
    const dist = last ? Math.hypot(p.u - last.u, p.v - last.v) : 1;
    if (dist < 0.004) return;
    const s = Math.min(0.012 + dist * 0.6, 0.05);
    drop(p.u, p.v, s, 0.014);
    last = p;
    section.classList.add('touched');
    const now = performance.now();
    if (now - lastSound > 260 && dist > 0.01) {
      lastSound = now;
      sound.drip(Math.min(0.25 + dist * 8, 0.7));
    }
  };
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    const p = toUv(e);
    if (!p) return;
    drop(p.u, p.v, 0.11, 0.03);
    section.classList.add('touched');
    sound.drip(1);
  };
  section.addEventListener('pointermove', onMove);
  section.addEventListener('pointerdown', onDown);

  // the intro ends with one big drop in front of the stones
  const onIntro = () => {
    drop(0.5 - 0.6 / SIM_SIZE, 0.5 + 1.6 / SIM_SIZE, 0.16, 0.035);
    setTimeout(() => sound.drip(0.8), 80);
  };
  addEventListener('ts:intro-exit', onIntro);

  // ───── render loop (only while the hero is on screen) ─────
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '100px' });
  io.observe(section);

  let prevT = performance.now();
  let time = 0;
  let acc = 0;
  let ambientNext = 1.5;
  let raf = 0;
  const topWorld = new THREE.Vector3();
  const topEdge = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  let firstFrame = true;

  bridge.heroActive = true;

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - prevT) / 1000, 0.05);
    prevT = now;
    time += dt;
    if (!visible) return;

    const p = state.p;
    const e = p * p * (3 - 2 * p);

    // camera
    camera.position.set(e * 0.2, view.camY + e * 1.7, view.camZ - e * 1.2);
    look.set(0, view.lookY - e * 0.25, 0);
    camera.lookAt(look);

    // stones: gentle lift apart while scrolling, perfectly still at rest
    stones.forEach((m, i) => {
      const r = rest[i];
      const lift = [0, 0.42, 1.0][i] * e;
      m.position.copy(r.pos);
      m.position.y += lift;
      m.rotation.set(r.rot.x + e * [0, 0.25, -0.5][i], r.rot.y + e * [0.15, -0.6, 1.4][i], r.rot.z + e * [0, 0.12, 0.3][i]);
    });

    // the top stone leaves the cairn past halfway and becomes the travelling stone
    bridge.wantsHome = p < 0.42;
    const top = stones[2];
    top.visible = bridge.docked && bridge.wantsHome;
    top.getWorldPosition(topWorld);
    tmp.copy(topWorld).project(camera);
    const rect = stage.getBoundingClientRect();
    bridge.top.x = rect.left + (tmp.x * 0.5 + 0.5) * rect.width;
    bridge.top.y = rect.top + (-tmp.y * 0.5 + 0.5) * rect.height;
    const cx = tmp.x;
    topEdge.set(CAIRN[2].scale * CAIRN[2].long, 0, 0).applyQuaternion(camera.quaternion).add(topWorld).project(camera);
    bridge.top.size = Math.abs(topEdge.x - cx) * 0.5 * rect.width * 2;

    // a drop now and then where the bottom stone meets the water
    ambientNext -= dt;
    if (ambientNext <= 0) {
      const a = Math.random() * Math.PI * 2;
      drop(0.5 + (Math.cos(a) * 1.15) / SIM_SIZE, 0.5 - (Math.sin(a) * 0.8) / SIM_SIZE, 0.012 + Math.random() * 0.015, 0.012);
      ambientNext = 2 + Math.random() * 3;
    }

    // simulation: apply drops, then step at a fixed 120 Hz
    while (drops.length) {
      const d = drops.shift()!;
      dropMat.uniforms.uDrop.value.set(d.u, d.v, d.s);
      dropMat.uniforms.uRadius.value = d.r;
      pass(dropMat);
    }
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 120 && steps < 4) {
      pass(stepMat);
      acc -= 1 / 120;
      steps++;
    }
    renderer.setRenderTarget(null);

    wMat.uniforms.uHeight.value = simA.texture;
    wMat.uniforms.uTime.value = time;
    steamMat.uniforms.uTime.value = time;
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      section.classList.add('has-webgl');
    }
  };
  frame();

  return () => {
    cancelAnimationFrame(raf);
    bridge.heroActive = false;
    bridge.wantsHome = false;
    st.kill();
    ro.disconnect();
    io.disconnect();
    removeEventListener('ts:intro-exit', onIntro);
    section.removeEventListener('pointermove', onMove);
    section.removeEventListener('pointerdown', onDown);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    water.dispose();
    env.dispose();
    pmrem.dispose();
    simA.dispose();
    simB.dispose();
    stepMat.dispose();
    dropMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
