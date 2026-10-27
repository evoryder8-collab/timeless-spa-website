// Contact map: starts as a real Earth floating in space (NASA Blue Marble on MapLibre's globe), turns to Europe
// and dives down to the spa, where the satellite picture gives way to OpenFreeMap streets recoloured in sand,
// olive and clay with warm 3D buildings. Nothing loads until the visitor taps "show map".
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
// NASA Blue Marble: public-domain satellite imagery of the whole Earth, served by NASA GIBS (zoom 0–8)
const EARTH_TILES = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
// between these zoom levels the satellite globe hands over to the city map
const HANDOVER: [number, number] = [6.5, 9.5];
const fadeIn = (to = 1) => ['interpolate', ['linear'], ['zoom'], HANDOVER[0], 0, HANDOVER[1], to];

function restyle(style: StyleSpecification) {
  style.layers = style.layers.filter((l) => l.id !== 'building' && !l.id.startsWith('highway-shield') && !l.id.startsWith('road_shield'));
  for (const l of style.layers) {
    const p = ((l as { paint?: Record<string, unknown> }).paint ??= {});
    const id = l.id;
    // the street map only appears once the camera is close to the ground
    const opacity = { background: 'background-opacity', fill: 'fill-opacity', line: 'line-opacity', symbol: 'text-opacity' }[l.type as string];
    if (opacity) p[opacity] = fadeIn(typeof p[opacity] === 'number' ? (p[opacity] as number) : 1);
    if (l.type === 'symbol') p['icon-opacity'] = fadeIn();

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
  // the Earth from space, under everything else
  style.sources.earth = { type: 'raster', tiles: [EARTH_TILES], tileSize: 256, maxzoom: 8, attribution: 'Imagery © NASA Blue Marble (GIBS)' };
  style.layers.splice(1, 0, {
    id: 'earth',
    type: 'raster',
    source: 'earth',
    maxzoom: HANDOVER[1] + 0.5,
    paint: {
      'raster-opacity': ['interpolate', ['linear'], ['zoom'], HANDOVER[0], 1, HANDOVER[1], 0],
      'raster-contrast': 0.08,
      'raster-fade-duration': 250,
    },
  });
  style.projection = { type: 'globe' };
  // a thin blue atmosphere around the globe in space; a warm haze on the horizon once the camera tilts
  style.sky = {
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
    'sky-color': ['interpolate', ['linear'], ['zoom'], 8, 'rgba(233, 220, 203, 0)', 11, '#e9dccb'],
    'horizon-color': ['interpolate', ['linear'], ['zoom'], 8, 'rgba(226, 173, 136, 0)', 11, '#e2ad88'],
    'fog-color': C.bg,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.5,
  };

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
  let stopSpace = () => {};

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
      const small = innerWidth < 720;
      map = new ml.Map({
        container: canvas,
        style,
        center: [lngLat[0] - 70, 22],
        zoom: small ? 0.55 : 1.05,
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

      const space = makeSpace(block);
      map.on('move', () => space.update(map!.getZoom(), map!.getCenter().lng));

      map.once('load', () => {
        block.classList.add('is-live');
        // keep the credits folded into the (i) button so they don't cover the globe
        canvas.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        const target = { center: lngLat, zoom: small ? 16.2 : 16.8, pitch: 62, bearing: -28 };
        if (reduced) {
          map!.jumpTo(target);
          label.style.opacity = '1';
          return;
        }
        // 1 · the Earth turns until Europe faces us
        map!.easeTo({ center: [lngLat[0], lngLat[1] - 8], zoom: small ? 0.9 : 1.5, duration: 3200, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
        map!.once('moveend', () => {
          if (dead) return;
          // 2 · and then down through the atmosphere to Ehrenfeld
          sound.whoosh();
          map!.flyTo({ ...target, duration: 8000, curve: 1.3, essential: true });
          map!.once('moveend', () => {
            if (dead) return;
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
      });
      stopSpace = space.stop;
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
    stopSpace();
    map?.remove();
    map = null;
  };
}

/** Deep space behind the globe: a field of softly twinkling stars that drifts as the Earth turns
 *  and fades into the sand-coloured sky as the camera comes down. */
function makeSpace(block: HTMLElement) {
  const el = document.createElement('canvas');
  el.className = 'mapblock__space';
  el.setAttribute('aria-hidden', 'true');
  block.prepend(el);
  const ctx = el.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const stars = Array.from({ length: 420 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() ** 3 * 1.4 + 0.25,
    a: Math.random() * 0.7 + 0.3,
    tw: Math.random() * Math.PI * 2,
    warm: Math.random() < 0.18,
  }));
  let shift = 0;
  let alpha = 1;
  let raf = 0;
  const draw = (t: number) => {
    raf = requestAnimationFrame(draw);
    if (alpha <= 0.01) return;
    const w = (el.width = el.clientWidth * dpr);
    const h = (el.height = el.clientHeight * dpr);
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const x = (((s.x * w - shift * dpr) % w) + w) % w;
      const tw = 0.65 + 0.35 * Math.sin(t / 900 + s.tw);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = s.warm ? '#ffd9b8' : '#f4f1ff';
      ctx.beginPath();
      ctx.arc(x, s.y * h, s.r * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  raf = requestAnimationFrame(draw);
  return {
    update(zoom: number, lng: number) {
      shift = lng * 1.6;
      alpha = 1 - Math.min(1, Math.max(0, (zoom - 4) / 3));
      el.style.opacity = String(alpha);
    },
    stop() {
      cancelAnimationFrame(raf);
      el.remove();
    },
  };
}
