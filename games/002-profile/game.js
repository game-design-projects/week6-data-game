// #2 Profile — an elevation profile along a hidden 240 km line (random bearing); place the whole line.
// Data: Copernicus GLO-90 DEM via the Open-Meteo elevation API (snapshot, 61 samples per line).

const R = 6371.0088;
const RAD = Math.PI / 180;
const POS_SCALE = 600; // km: midpoint error at which the position score has fallen to 1/e
const POS_MAX = 70;
const DIR_MAX = 30;
const DIR_ZERO = 90; // degrees of bearing error at which the direction score hits 0
const fmt = (x) => x.toLocaleString('en-US');
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Point reached from `p` after `km` along the great circle with initial `bearing` (deg, 0 = north, clockwise). */
export function destPoint(p, bearing, km) {
  const d = km / R, b = bearing * RAD, la = p.lat * RAD, lo = p.lng * RAD;
  const lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lng2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
  // longitude stays continuous with p.lng (may leave ±180) so lines near the antimeridian draw short
  const dl = ((((lng2 - lo) / RAD) % 360) + 540) % 360 - 180;
  return { lat: lat2 / RAD, lng: p.lng + dl };
}

/** Start (left end of the profile) and end (right end) of the line centred on `mid`. */
export function lineEnds(mid, bearing, lenKm) {
  return { a: destPoint(mid, (bearing + 180) % 360, lenKm / 2), b: destPoint(mid, bearing, lenKm / 2) };
}

/** Smallest angle between two bearings, 0..180. */
export const angleDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

const dist = (a, b) => {
  const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Score a placed line: 70 pts for the midpoint (exp. decay), 30 pts for the bearing (linear, 0 at 90° off). */
export function scoreLine(km, errDeg) {
  const pos = POS_MAX * Math.exp(-Math.max(0, km) / POS_SCALE);
  const dir = DIR_MAX * Math.max(0, 1 - errDeg / DIR_ZERO);
  return { pos: Math.round(pos), dir: Math.round(dir), total: Math.round(pos + dir) };
}

/** Summarise a profile: min/max/relief and the position (0..1) of the highest point. */
export function summarize(elev) {
  const max = Math.max(...elev), min = Math.min(...elev);
  return { max, min, relief: max - min, peakAt: elev.indexOf(max) / (elev.length - 1) };
}

export const compassName = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Puzzle-specific teaching sentences derived from the elevation numbers. */
export function explain(elev, bearing, lenKm) {
  const s = summarize(elev);
  const n = elev.length;
  const seaAt = (i) => elev[i] <= 5;
  const out = [];
  const seaFrac = elev.filter((e) => e <= 5).length / n;
  const head = elev.slice(0, 5), tail = elev.slice(-5);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  if (seaFrac > 0.15 && seaFrac < 0.95) {
    const side = seaAt(0) || avg(head) < avg(tail) ? 'start (left end)' : 'end (right end)';
    out.push(`${Math.round(seaFrac * 100)}% of the samples on the line are at sea level (5 m or less), and the coast is toward the ${side}. Work out which way the shoreline runs first.`);
  } else if (seaFrac >= 0.95) out.push('Almost the whole way is at sea level: this line runs mostly over water.');
  const trend = avg(tail) - avg(head);
  if (Math.abs(trend) > 800) out.push(`From start to end the line ${trend > 0 ? 'climbs' : 'drops'} a net ${fmt(Math.round(Math.abs(trend)))} m: the land rises toward the ${compassName(trend > 0 ? bearing : (bearing + 180) % 360)}.`);
  if (s.min > 1500) out.push(`Even the lowest point is ${fmt(s.min)} m: the whole line is on a plateau or in high mountains.`);
  else if (s.relief > 2500) out.push(`Relief of ${fmt(s.relief)} m: it crosses a young mountain belt or a deep canyon.`);
  else if (s.relief < 500) out.push(`Relief of only ${s.relief} m: plains, a basin or an old plateau, so the clue is mostly absolute elevation.`);
  const pk = Math.round(s.peakAt * lenKm);
  out.push(`The highest point, ${fmt(s.max)} m, is about ${pk} km from the start. That peak or ridge is your anchor for placing the line.`);
  return out;
}

export default {
  meta: {
    num: 2,
    slug: 'profile',
    title: 'Profile',
    tagline: 'Slice the Earth along a hidden straight line. Read the elevation profile, then guess where the line is and which way it points.',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      'The chart is the elevation profile along a 240 km straight line of unknown direction: the left end is the start, the right end is the finish.',
      'Read its shape: hugging 0 m means the coast, a flat run is a plateau or plain, steep swings are mountain belts, and a deep V is a canyon or rift.',
      'The map is already limited to the continent the line is on, and the basemap is shaded relief with no place names. Click the map to drop the line\'s midpoint, then turn the arrow with the slider or compass buttons (the arrow points to the finish).',
      'Scoring: up to 70 points for the midpoint (falls to about a third for every 600 km off), up to 30 for direction (0 at 90° or more off).',
    ],
    scoring: '70 × e^(−midpoint error/600 km) + 30 × max(0, 1 − bearing error/90°).',
    sources: [
      { name: 'Copernicus DEM GLO-90', url: 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model', note: 'Global digital elevation model at 90 m resolution' },
      { name: 'Open-Meteo Elevation API', url: 'https://open-meteo.com/en/docs/elevation-api', note: 'Built on the Copernicus DEM; one sample every 4 km along the line' },
      { name: 'Esri World Shaded Relief', url: 'https://www.arcgis.com/home/item.html?id=1b243539f4514b6ba35e7d995890db1d', note: 'Map basemap (no place names while guessing)' },
    ],
    dataNote: 'About 77 hand-picked lines (high mountains, plateaus, canyons, plains and islands across six continents), with bearings from 0 to 345° chosen by a fixed rule. We read the Copernicus DEM through Open-Meteo offline and stored the result in data.json, rather than downloading DEM tiles. Lines with too little relief, and so almost no clues, were dropped.',
  },

  puzzle({ data, pick }) {
    return { ...pick(data.puzzles), lenKm: data.lenKm };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const { h } = ui;
    const reg = ctx.data.regions[p.region];
    const n = p.elev.length;
    const pts = p.elev.map((e, i) => ({ km: (i * p.lenKm) / (n - 1), e }));
    const s = summarize(p.elev);
    ctx.log('profile', p.id, { bearing: p.bearing, ...s });

    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      marginLeft: 48,
      x: { label: 'Distance (km)' },
      y: { label: null, grid: true, tickFormat: (v) => core.fmtNum(v) },
      marks: [
        Plot.areaY(pts, { x: 'km', y: 'e', fill: c.accent, fillOpacity: 0.25 }),
        Plot.lineY(pts, { x: 'km', y: 'e', stroke: c.accent, strokeWidth: 2 }),
        Plot.ruleY([0], { stroke: c.muted }),
        Plot.tip(pts, Plot.pointerX({ x: 'km', y: 'e', title: (d) => `${Math.round(d.km)} km · ${core.fmtNum(d.e)} m` })),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: `In ${reg.name} · elevation (m)`, title: 'Elevation profile, start on the left' },
      chart,
      h('div', { class: 'ds-grid', style: { '--min': '90px', marginTop: '12px' } },
        ui.stat({ label: 'Highest (m)', value: core.fmtNum(s.max) }),
        ui.stat({ label: 'Lowest (m)', value: core.fmtNum(s.min) }),
        ui.stat({ label: 'Relief (m)', value: core.fmtNum(s.relief) }))));

    // ── placement: midpoint pin + bearing arrow ──
    const m = await ui.createMap({ bounds: reg.bounds, basemap: 'hillshade' });
    m.el.classList.add('crosshair');
    const { L, map } = m;
    let mid = null, bearing = 90, marker = null, arrow = null, seg = null;
    const bearingTxt = h('b', { class: 'mono' });
    const slider = h('input', { type: 'range', class: 'ds-range', min: 0, max: 359, step: 1, value: bearing, 'aria-label': 'Bearing (degrees)' });
    const chipBtns = COMPASS.map((name, i) => h('button', { class: 'ds-chip', type: 'button', onClick: () => setBearing(i * 45) }, name));
    const status = h('div', { class: 'ink2 small' }, 'Click the map to drop the midpoint (the pin is draggable), then turn the arrow toward the finish');
    const submit = ui.button('Lock in this line', { variant: 'accent', disabled: true });

    const c0 = ui.colors();
    const ACC = c0.accent;
    const arrowIcon = (deg) => L.divIcon({
      className: '',
      iconSize: [84, 84],
      iconAnchor: [42, 42],
      html: `<svg width="84" height="84" viewBox="-42 -42 84 84" style="transform:rotate(${deg}deg);overflow:visible;pointer-events:none"><line x1="0" y1="0" x2="0" y2="-34" stroke="#fff" stroke-width="7" stroke-linecap="round"/><line x1="0" y1="14" x2="0" y2="-34" stroke="${ACC}" stroke-width="3.5" stroke-linecap="round"/><polygon points="0,-42 -9,-26 9,-26" fill="${ACC}" stroke="#fff" stroke-width="2"/><circle cx="0" cy="14" r="4" fill="#fff" stroke="${ACC}" stroke-width="2"/></svg>`,
    });
    const draw = () => {
      bearingTxt.textContent = `${compassName(bearing)} · ${String(bearing).padStart(3, '0')}°`;
      slider.value = bearing;
      slider.style.setProperty('--fill', `${(bearing / 359) * 100}%`);
      chipBtns.forEach((b, i) => b.classList.toggle('on', Math.round(bearing / 45) % 8 === i && bearing % 45 === 0));
      if (!mid) return;
      const e = lineEnds(mid, bearing, p.lenKm);
      const ll = [[e.a.lat, e.a.lng], [e.b.lat, e.b.lng]];
      if (seg) seg.setLatLngs(ll); else seg = L.polyline(ll, { color: c0.accent, weight: 3 }).addTo(map);
      if (arrow) arrow.setIcon(arrowIcon(bearing)).setLatLng([mid.lat, mid.lng]);
      else arrow = L.marker([mid.lat, mid.lng], { icon: arrowIcon(bearing), interactive: false, keyboard: false, zIndexOffset: -500 }).addTo(map);
    };
    function setBearing(b) { bearing = ((Math.round(b) % 360) + 360) % 360; draw(); }
    const setMid = (ll) => {
      const w = ll.wrap ? ll.wrap() : ll;
      mid = { lat: w.lat, lng: w.lng };
      if (marker) marker.setLatLng([mid.lat, mid.lng]);
      else {
        marker = m.pin([mid.lat, mid.lng], 'accent');
        marker.dragging?.enable?.();
        marker.on('drag', () => { const q = marker.getLatLng().wrap(); mid = { lat: q.lat, lng: q.lng }; draw(); });
      }
      submit.disabled = false;
      draw();
    };
    map.on('click', (e) => setMid(e.latlng));
    slider.addEventListener('input', () => setBearing(Number(slider.value)));

    const card = ui.panel({ kicker: 'Place the line', title: 'Where is it, and which way does it point?' },
      h('p', { class: 'ink2' }, `The arrow points from the line\'s midpoint to the finish (the right end of the profile). The line is ${p.lenKm} km long, only a few pixels on the map, so the arrow is drawn enlarged.`),
      m.el,
      h('div', { style: { marginTop: '12px' } },
        h('div', { class: 'ds-row between' }, h('span', { class: 'ink2 small' }, 'Bearing (start → finish)'), bearingTxt),
        slider,
        h('div', { class: 'ds-chips', style: { marginTop: '4px' } }, chipBtns)),
      h('div', { class: 'ds-row between', style: { marginTop: '12px' } }, status, submit));
    ctx.stage.append(card);
    requestAnimationFrame(() => map.invalidateSize());
    draw();

    const guess = await new Promise((resolve) => {
      submit.addEventListener('click', () => { if (mid) resolve({ mid, bearing }); });
      if (ctx.autoplay) {
        (async () => {
          await ctx.sleep(30);
          setMid({ lat: Math.max(-80, Math.min(80, p.lat + 3)), lng: p.lng + 3 });
          setBearing(p.bearing + 20);
          resolve({ mid, bearing });
        })();
      }
    });

    // ── score + reveal ──
    const km = dist(guess.mid, p);
    const err = angleDiff(guess.bearing, p.bearing);
    const sc = scoreLine(km, err);
    ctx.log('score', { km: Math.round(km), err, ...sc });
    submit.remove();
    marker?.dragging?.disable?.();
    m.el.classList.remove('crosshair');
    slider.disabled = true;
    chipBtns.forEach((b) => { b.disabled = true; });
    const c = ui.colors();
    const truth = lineEnds(p, p.bearing, p.lenKm);
    m.pin([p.lat, p.lng], 'answer', p.place);
    L.polyline([[guess.mid.lat, guess.mid.lng], [p.lat, p.lng]], { color: c.ink, weight: 2, dashArray: '6 6' }).addTo(map);
    L.polyline([[truth.a.lat, truth.a.lng], [truth.b.lat, truth.b.lng]], { color: '#e11', weight: 5 }).addTo(map);
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', iconSize: [84, 84], iconAnchor: [42, 42], html: `<svg width="84" height="84" viewBox="-42 -42 84 84" style="transform:rotate(${p.bearing}deg);overflow:visible;pointer-events:none"><polygon points="0,-42 -9,-26 9,-26" fill="#e11" stroke="#fff" stroke-width="2"/></svg>` }), interactive: false }).addTo(map);
    m.setLabels(true);
    map.fitBounds(L.latLngBounds([[guess.mid.lat, guess.mid.lng], [p.lat, p.lng]]).pad(0.5), { maxZoom: 8 });
    status.replaceChildren('Midpoint off by ', h('b', { class: 'mono' }, core.fmtKm(km)), ' · bearing off by ', h('b', { class: 'mono' }, `${err}°`), h('span', { class: 'mono', style: { marginLeft: '10px' } }, `${sc.total}/100`));

    return {
      score: sc.total,
      max: 100,
      win: sc.total >= 50,
      emoji: core.emojiBar(sc.total / 100),
      summary: `${core.fmtKm(km)} · ${err}°`,
      detail: ui.kv([
        ['Answer', `${p.place} (${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°), running from ${compassName((p.bearing + 180) % 360)} to ${compassName(p.bearing)} (${p.bearing}°)`],
        ['Your score', `Midpoint ${sc.pos}/${POS_MAX} (off by ${core.fmtKm(km)}) + bearing ${sc.dir}/${DIR_MAX} (off by ${err}°)`],
        ...explain(p.elev, p.bearing, p.lenKm).map((t, i) => [i === 0 ? 'Clues' : ' ', t]),
      ]),
    };
  },
};
