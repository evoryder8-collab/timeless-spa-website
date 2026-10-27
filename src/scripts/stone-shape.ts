// Procedural basalt massage stones, shared by the hero cairn and the travelling stone.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ───── small seeded 3D value noise (enough for gentle stone shapes) ─────
function hash(x: number, y: number, z: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * (3 - 2 * t);
function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  ) * 2 - 1;
}

export interface StoneShape {
  /** half-height relative to width; massage stones are flat */
  flat: number;
  /** stretch along x */
  long: number;
  seed: number;
}

/** A smooth, slightly irregular flattened pebble with a radius of about 1 */
export function stoneGeometry({ flat, long, seed }: StoneShape, detail = 18) {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const r = 1
      + 0.075 * noise3(v.x * 1.4 + 3, v.y * 1.4, v.z * 1.4, seed)
      + 0.022 * noise3(v.x * 3.6, v.y * 3.6 + 7, v.z * 3.6, seed + 1)
      + 0.005 * noise3(v.x * 9, v.y * 9, v.z * 9 + 2, seed + 2);
    // flatter on the bottom than the top, like a stone worn by water
    const y = v.y * flat * (v.y < 0 ? 0.86 : 1);
    p.setXYZ(i, v.x * r * long, y * r, v.z * r);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Oiled basalt: dark, softly glossy, with fine lighter flecks. `emissive` is used for the warm glow. */
export function stoneMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0x2e2824,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.32,
    sheen: 0.35,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xc98a68),
    emissive: new THREE.Color(0xc4552c),
    emissiveIntensity: 0,
  });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStonePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStonePos = position;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vStonePos;
        float sh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float sn(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(sh(i), sh(i + vec3(1,0,0)), f.x), mix(sh(i + vec3(0,1,0)), sh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(sh(i + vec3(0,0,1)), sh(i + vec3(1,0,1)), f.x), mix(sh(i + vec3(0,1,1)), sh(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float cloud = sn(vStonePos * 3.0) * 0.6 + sn(vStonePos * 11.0) * 0.4;
        float fleck = smoothstep(0.8, 0.9, sn(vStonePos * 46.0));
        diffuseColor.rgb *= 0.8 + 0.36 * cloud;
        diffuseColor.rgb += vec3(0.07, 0.06, 0.05) * fleck;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        // the glow gathers in the stone's body and leaves the edges darker
        `#include <emissivemap_fragment>
        totalEmissiveRadiance *= 0.55 + 0.45 * sn(vStonePos * 2.5 + 4.0);`,
      );
  };
  return m;
}

/** The three stones of the cairn, bottom to top. The top one is the stone that travels. */
export const CAIRN: (StoneShape & { scale: number })[] = [
  { flat: 0.42, long: 1.12, seed: 11, scale: 1.0 },
  { flat: 0.46, long: 1.08, seed: 23, scale: 0.7 },
  { flat: 0.52, long: 1.06, seed: 37, scale: 0.46 },
];
export const TRAVELLER = CAIRN[2];

/** Warm sand sky with the low sun behind the stones */
export const SKY = {
  top: new THREE.Color('#e9dccb'),
  mid: new THREE.Color('#ecd6be'),
  horizon: new THREE.Color('#e2ad88'),
  sun: new THREE.Color('#fff0dc'),
  water: new THREE.Color('#5b4636'),
  waterNear: new THREE.Color('#3a2d24'),
};
