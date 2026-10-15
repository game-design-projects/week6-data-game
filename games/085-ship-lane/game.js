// #85 Ship Lane — a crop of the vessel-density heat map; name the strait or port.
import { distKm, bearing, arrow, axisWords } from './geo.js';

const MAX_GUESSES = 6;
const R_EARTH = 6378137;
const SEA = '#0c1f2e', LAND = '#3b4048';

/** 100·(max−n+1)/max when solved on guess n, else 0. */
export function scoreFor(n, won, max = MAX_GUESSES) {
  return won ? Math.round((100 * (max - n + 1)) / max) : 0;
}

/** Coarse 5-degree box for the last clue (so it narrows the field without naming the place). */
export function coordClue(p) {
  const la = Math.floor(p.lat / 5) * 5, lo = Math.floor(p.lng / 5) * 5;
  const ew = (v) => `${Math.abs(v)}°${v < 0 ? 'W' : 'E'}`;
  return `Rough location: ${la}°–${la + 5}°N, ${ew(lo)}–${ew(lo + 5)}`;
}

/** The result-card explanation, built from this place's own data. */
export function explain(place) {
  const lines = [place.note];
  if (place.axis && place.axis.elong >= 2) lines.push(`The yellow and red high-density band runs ${axisWords(place.axis.bearing)}.`);
  else lines.push('No single main lane stands out in the picture: traffic is spread out.');
  return lines;
}

export default {
  meta: {
    num: 85,
    slug: 'ship-lane',
    title: 'Ship Lane',
    tagline: 'A crop of European shipping-density heat map. Name the strait, sea or port.',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      'The picture is EMODnet\u2019s vessel-density map (2023 average): green means few ships, yellow and red many, gray is land, dark blue is sea with no ship signals. No labels: coastline shapes and lane directions are your clues.',
      'You start with the closest crop. Each miss unlocks a clue: a medium view, a wide view, the place type, then rough coordinates.',
      'Pick a place from the list. Each guess shows how many kilometers away the answer is and in which direction. Up to 6 guesses.',
      'The sooner the better: 100 points on guess 1, about 17 fewer for each extra guess, 0 if you miss.',
    ],
    scoring: '100 × (7 − guesses) / 6, or 0 if you miss.',
    sources: [
      { name: 'EMODnet Human Activities: Vessel density', url: 'https://emodnet.ec.europa.eu/en/human-activities', note: 'All vessel types, annual average (2023)' },
      { name: 'EMODnet WMS (vesseldensity_allavg)', url: 'https://ows.emodnet-humanactivities.eu/wms', note: 'GetMap crops, EPSG:3857' },
      { name: 'Natural Earth via world-atlas', url: 'https://github.com/topojson/world-atlas', note: 'Land base map' },
    ],
    dataNote: 'Density maps come from EMODnet (built from AIS signals, covering EU and neighboring waters only), using the 2023 average. They are pre-cropped at three zoom levels and saved as images, so this is not live data, and the list covers European waters only. Land is drawn from Natural Earth with no place names; coordinates are the approximate center of each place.',
  },

  puzzle({ data, pick }) {
    return { place: pick(data.places) };
  },

  async play(ctx, { place }) {
    const { ui } = ctx;
    const P = ctx.data.places;
    const byId = Object.fromEntries(P.map((p) => [p.id, p]));
    ctx.log('ship-lane answer', place.id, 'pool', P.length);

    let land = null, d3 = null;
    try { [land, d3] = await Promise.all([ui.geo('countries50'), ui.lib('d3')]); } catch (e) { ctx.log.warn('ship-lane land layer unavailable', String(e)); }

    // one crop = sea colour, Natural Earth land, then the transparent density PNG on top
    const crop = async (i) => {
      const W = 480, cv = ui.h('canvas', { width: W, height: W, role: 'img', 'aria-label': 'Vessel-density heat map, place names hidden',
        style: { width: '100%', height: 'auto', display: 'block', aspectRatio: '1' } });
      const g = cv.getContext('2d');
      g.fillStyle = SEA; g.fillRect(0, 0, W, W);
      if (land && d3) {
        const proj = d3.geoMercator().scale(W / ((2 * place.half[i]) / R_EARTH)).center([place.lng, place.lat]).translate([W / 2, W / 2]).precision(0.1);
        g.fillStyle = LAND; g.beginPath(); d3.geoPath(proj, g)(land); g.fill();
      }
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.onerror = () => { ctx.log.warn('ship-lane image failed', place.files[i]); res(); }; img.src = ctx.asset('img/' + place.files[i]); });
      g.imageSmoothingEnabled = false;
      if (img.naturalWidth) g.drawImage(img, 0, 0, W, W);
      return ui.stack(
        ui.h('div', { style: { borderRadius: '10px', overflow: 'hidden', width: '100%', maxWidth: '320px', margin: '0 auto' } }, cv),
        ui.h('div', { class: 'ds-muted', style: { textAlign: 'center', fontSize: '.85em' } }, `Frame about ${place.spanKm[i].toLocaleString('en-US')} km across · green to red = more ships`));
    };
    const views = await Promise.all([0, 1, 2].map(crop));

    const kind = place.kind === 'strait' ? 'Strait / sea passage' : 'Port / estuary';
    const r = await ctx.guess({
      title: 'Where is this?',
      options: P.map((p) => ({ id: p.id, label: p.en })),
      answer: place.id,
      maxGuesses: MAX_GUESSES,
      clues: [views[0], views[1], views[2], `Type: ${kind}`, coordClue(place)],
      cluesTitle: 'Density map',
      columns: ['Distance', 'Direction'],
      feedback: (g, a) => {
        const gp = byId[g.id], ap = byId[a.id];
        const d = distKm(gp, ap);
        return [{ text: `${Math.round(d).toLocaleString()} km`, num: true, state: d < 150 ? 'hit' : d < 600 ? 'near' : 'miss' },
          { text: d < 1 ? '✓' : arrow(bearing(gp, ap)), state: d < 1 ? 'hit' : undefined }];
      },
      near: (g, a) => distKm(byId[g.id], byId[a.id]) < 500,
      scoring: (n, won) => scoreFor(n, won),
    });
    r.detail = ui.kv([
      ['Answer', place.en],
      ['Type', kind],
      ['Why', ui.stack(...explain(place).map((t) => ui.h('div', {}, t)))],
    ]);
    return r;
  },
};
