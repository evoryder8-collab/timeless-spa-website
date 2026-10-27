// Contact map: MapLibre with OpenFreeMap tiles, recoloured in sand, olive and clay, with warm 3D buildings.
// Loads only after the visitor taps "show map", then flies in from above Cologne to the spa.
import type { StyleSpecification, Map as MlMap } from 'maplibre-gl';
import { sound } from './audio';

const C = {
  bg: '#ede4d8',
  land: '#e6dccd',
  park: '#d7d6bf',
  wood: '#cfcfb5',
  water: '#b8c1b3',
  waterLine: '#a9b3a4',
  road: '#f8f3ec',
  roadMajor: '#fbf7f1',
  casing: '#dccbb6',
  rail: '#cdbba5',
  label: '#4b3e34',
  labelSoft: '#7a6b5e',
  halo: '#f1e9de',
};
const DOM: [number, number] = [6.9583, 50.9413]; // Cologne Cathedral, where the flight begins

function restyle(style: StyleSpecification) {
  style.layers = style.layers.filter((l) => l.id !== 'building' && !l.id.startsWith('highway-shield') && !l.id.startsWith('road_shield'));
  for (const l of style.layers) {
    const p = ((l as { paint?: Record<string, unknown> }).paint ??= {});
    const id = l.id;
    if (l.type === 'background') p['background-color'] = C.bg;
    else if (l.type === 'fill') {
      if (id === 'park') p['fill-color'] = C.park;
      else if (id === 'landcover_wood') p['fill-color'] = C.wood;
      else if (id === 'water') p['fill-color'] = C.water;
      else if (id.startsWith('landuse') || id.startsWith('landcover')) p['fill-color'] = C.land;
      else if (id.startsWith('road') || id.startsWith('aeroway')) p['fill-color'] = C.road;
    } else if (l.type === 'line') {
      if (id === 'waterway') p['line-color'] = C.waterLine;
      else if (id.includes('casing') || id.startsWith('boundary')) p['line-color'] = C.casing;
      else if (id.startsWith('railway')) p['line-color'] = id.includes('dash') ? C.bg : C.rail;
      else if (id.includes('major') || id.includes('motorway')) p['line-color'] = C.roadMajor;
      else p['line-color'] = C.road;
    } else if (l.type === 'symbol') {
      p['text-color'] = id.startsWith('label_city') || id.startsWith('label_town') ? C.label : C.labelSoft;
      p['text-halo-color'] = C.halo;
      p['text-halo-width'] = 1.4;
    }
  }
  // warm 3D buildings under the labels: low ones sand, tall ones clay
  const labelIdx = style.layers.findIndex((l) => l.type === 'symbol');
  style.layers.splice(labelIdx, 0, {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0], 0, '#e4d3bf', 25, '#d9b99b', 80, '#c48f6c'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.6, ['coalesce', ['get', 'render_height'], 0]],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.92,
    },
  });
}

export function startMap(): () => void {
  const block = document.querySelector<HTMLElement>('[data-map]');
  if (!block) return () => {};
  const canvas = block.querySelector<HTMLElement>('[data-map-canvas]')!;
  const loadBtn = block.querySelector<HTMLButtonElement>('[data-map-load]');
  const lngLat: [number, number] = [Number(block.dataset.lng), Number(block.dataset.lat)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let map: MlMap | null = null;
  let dead = false;

  const load = async () => {
    if (!loadBtn || loadBtn.disabled) return;
    loadBtn.disabled = true;
    loadBtn.setAttribute('aria-busy', 'true');
    try {
      const [ml, workerUrl, style] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url').then((m) => m.default as string),
        fetch('https://tiles.openfreemap.org/styles/positron').then((r) => r.json() as Promise<StyleSpecification>),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      if (dead) return;
      ml.setWorkerUrl(workerUrl);
      restyle(style);
      map = new ml.Map({
        container: canvas,
        style,
        center: DOM,
        zoom: 11.2,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        cooperativeGestures: true,
        maxPitch: 70,
      });
      map.addControl(new ml.AttributionControl({ compact: true }), 'top-left');
      map.addControl(new ml.NavigationControl({ visualizePitch: true, showCompass: true }), 'top-right');

      const el = document.createElement('div');
      el.className = 'spa-marker';
      el.innerHTML = `<span class="spa-marker__ring"></span><span class="spa-marker__dot"></span><span class="spa-marker__label">${block.dataset.name}</span>`;
      const label = el.querySelector<HTMLElement>('.spa-marker__label')!;
      label.style.opacity = '0';
      new ml.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);

      map.once('load', () => {
        block.classList.add('is-live');
        const target = { center: lngLat, zoom: innerWidth < 720 ? 16.2 : 16.8, pitch: 62, bearing: -28 };
        if (reduced) {
          map!.jumpTo(target);
          label.style.opacity = '1';
          return;
        }
        sound.whoosh();
        map!.flyTo({ ...target, duration: 6500, curve: 1.6, essential: true });
        map!.once('moveend', () => {
          sound.bowl(0.8);
          label.animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 700, easing: 'cubic-bezier(.2,.7,.1,1)', fill: 'forwards' });
          // and then the slowest possible turn around the spa
          let bearing = target.bearing;
          let orbit = true;
          ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach((ev) => map!.on(ev as 'mousedown', () => (orbit = false)));
          const spin = () => {
            if (!map || dead || !orbit) return;
            bearing += 0.04;
            map.setBearing(bearing);
            requestAnimationFrame(spin);
          };
          requestAnimationFrame(spin);
        });
      });
    } catch {
      loadBtn.disabled = false;
      loadBtn.removeAttribute('aria-busy');
    }
  };
  loadBtn?.addEventListener('click', load);

  // directions chooser
  const sheet = block.querySelector<HTMLDialogElement>('[data-directions-sheet]');
  const openSheet = () => sheet?.showModal();
  const sheetClick = (e: MouseEvent) => {
    if (e.target === sheet || (e.target as HTMLElement).closest('[data-directions-close]')) sheet?.close();
    else if ((e.target as HTMLElement).closest('a')) setTimeout(() => sheet?.close(), 200);
  };
  const dirBtn = block.querySelector('[data-directions]');
  dirBtn?.addEventListener('click', openSheet);
  sheet?.addEventListener('click', sheetClick);

  return () => {
    dead = true;
    loadBtn?.removeEventListener('click', load);
    dirBtn?.removeEventListener('click', openSheet);
    sheet?.removeEventListener('click', sheetClick);
    map?.remove();
    map = null;
  };
}
