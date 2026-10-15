// engine/libs.js — lazily loaded third-party libraries (pinned CDN versions),
// plus the themed chart and map helpers built on them.
import { h, colors } from './dom.js';

const URLS = {
  d3: 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm',
  plot: 'https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm',
  topojson: 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm',
  leafletJs: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js',
  leafletCss: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  // Natural Earth via world-atlas: countries + land, 110m and 50m
  world110: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',
  world50: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json',
  usStates: 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json',
  usCounties: 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json',
};

const cache = new Map();
const once = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
};

/** Load a library: 'd3' | 'plot' | 'topojson' | 'leaflet'. */
export function lib(name) {
  if (name === 'leaflet') {
    return once('leaflet', async () => {
      if (!document.querySelector('link[data-leaflet]')) {
        document.head.append(h('link', { rel: 'stylesheet', href: URLS.leafletCss, 'data-leaflet': '' }));
      }
      const L = await import(URLS.leafletJs);
      return L.default ?? L;
    });
  }
  if (!URLS[name]) throw new Error(`lib: unknown library "${name}"`);
  return once(name, () => import(URLS[name]));
}

/**
 * GeoJSON shapes from world-atlas / us-atlas (TopoJSON → GeoJSON).
 * geo('countries') | geo('countries50') | geo('land') | geo('states') | geo('counties')
 * Country features carry `id` (ISO 3166-1 numeric, string) and `properties.name`.
 */
export function geo(which = 'countries') {
  return once(`geo:${which}`, async () => {
    const topojson = await lib('topojson');
    const src = { countries: 'world110', land: 'world110', countries50: 'world50', states: 'usStates', counties: 'usCounties' }[which];
    if (!src) throw new Error(`geo: unknown shape set "${which}"`);
    const topo = await (await fetch(URLS[src])).json();
    const obj = which === 'land' ? topo.objects.land : topo.objects[which === 'countries50' ? 'countries' : which];
    return topojson.feature(topo, obj);
  });
}

/**
 * Themed Observable Plot chart. Returns a wrapper element (await it).
 *   await plot((Plot) => ({ marks: [Plot.lineY(data, {x: 't', y: 'v', stroke: c.accent})] }))
 * Options passed through to Plot.plot; theme defaults fill in width/height/style.
 * `axis: false` hides both axes (for "unlabeled" puzzles).
 */
export async function plot(spec, { height = 280, width, axis = true } = {}) {
  const Plot = await lib('plot');
  const c = colors();
  const opts = typeof spec === 'function' ? spec(Plot, c) : spec;
  const host = h('div', { class: 'ds-plot' });
  const w = width ?? Math.max(280, Math.min(document.querySelector('.ds-stage')?.clientWidth || 720, 1080) - 40);
  const merged = {
    width: w,
    height,
    marginLeft: axis === false ? 10 : undefined,
    marginBottom: axis === false ? 10 : undefined,
    ...opts,
    style: { background: 'transparent', color: c.ink, fontFamily: c.mono, fontSize: '11px', overflow: 'visible', ...(opts.style || {}) },
  };
  if (axis === false) {
    merged.x = { axis: null, ...(opts.x || {}) };
    merged.y = { axis: null, ...(opts.y || {}) };
  }
  host.append(Plot.plot(merged));
  return host;
}

const isDarkTheme = () => document.documentElement.dataset.theme === 'dark' ||
  (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
/**
 * Keyless basemap tile URLs (Esri). basemap: 'gray' (default, label-free canvas),
 * 'imagery' (satellite), 'topo' (terrain/shaded relief, has labels).
 * Returns { base, labels } — `labels` is a transparent overlay (or null).
 */
export function tileUrl({ basemap = 'gray', dark = isDarkTheme() } = {}) {
  if (basemap === 'imagery') return { base: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, labels: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` };
  if (basemap === 'topo') return { base: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`, labels: null };
  const tone = dark ? 'Dark' : 'Light';
  // Esri's gray canvas bakes country/sea names into its base tiles at z3–8, so small
  // zooms use the label-free shaded-relief layer instead (see createMap).
  if (basemap === 'gray' || basemap === 'hillshade') return { relief: `${ESRI}/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}`, base: `${ESRI}/Canvas/World_${tone}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, labels: `${ESRI}/Canvas/World_${tone}_Gray_Reference/MapServer/tile/{z}/{y}/{x}` };
  throw new Error(`tileUrl: unknown basemap "${basemap}"`);
}

const ATTR = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

/**
 * Leaflet map inside a design-system frame.
 *   const { el, map, L, setLabels, pin } = await createMap({ center: [40.7, -74], zoom: 11 })
 * Defaults to a label-free world view. Place names appear only after setLabels(true)
 * (the pin preset does this on reveal). Append `el` to the page right away so
 * Leaflet can measure it (a ResizeObserver handles later size changes).
 */
export async function createMap({ center = [20, 0], zoom = 2, bounds, labels = false, basemap = 'gray', minZoom = 1, maxZoom = 18, height, className, worldCopyJump = true } = {}) {
  const L = await lib('leaflet');
  const el = h('div', { class: ['ds-map', `bm-${basemap}`, className], style: height ? { height: typeof height === 'number' ? `${height}px` : height } : null });
  const map = L.map(el, { center, zoom, minZoom, maxZoom, worldCopyJump, zoomControl: true, attributionControl: true });
  const urls = tileUrl({ basemap });
  if (urls.relief) {
    // label-free relief up to `split`, then the gray street canvas (no place names at city zooms)
    const split = basemap === 'hillshade' ? 12 : 8;
    L.tileLayer(urls.relief, { attribution: ATTR, maxNativeZoom: 13, maxZoom: split, className: `ds-relief ${basemap}` }).addTo(map);
    L.tileLayer(urls.base, { maxNativeZoom: 16, minZoom: split + 1, maxZoom, className: 'ds-streets' }).addTo(map);
  } else {
    L.tileLayer(urls.base, { attribution: ATTR, maxNativeZoom: 18, maxZoom }).addTo(map);
  }
  let labelLayer = null;
  const setLabels = (on) => {
    if (on && !labelLayer && urls.labels) labelLayer = L.tileLayer(urls.labels, { maxNativeZoom: 16, maxZoom, pane: 'overlayPane' }).addTo(map);
    if (!on && labelLayer) { map.removeLayer(labelLayer); labelLayer = null; }
  };
  setLabels(labels);
  // Leaflet measures the element once; a map created before it is attached (or while
  // hidden) has size 0, so re-measure on every resize and fit `bounds` on the first real size.
  let fitted = !bounds;
  const ro = new ResizeObserver(() => {
    if (!el.clientWidth || !el.clientHeight) return;
    map.invalidateSize();
    if (!fitted) { fitted = true; map.fitBounds(bounds, { padding: [12, 12] }); }
  });
  ro.observe(el);
  /** Teardrop pin marker. kind: '' | 'answer' | 'accent' */
  const pin = (latlng, kind = '', tooltip) => {
    const m = L.marker(latlng, { icon: L.divIcon({ className: '', html: `<div class="ds-pin ${kind}"></div>`, iconSize: [22, 22], iconAnchor: [11, 27] }) }).addTo(map);
    if (tooltip) m.bindTooltip(tooltip, { permanent: true, direction: 'top', offset: [0, -26] });
    return m;
  };
  return { el, map, L, setLabels, pin };
}
