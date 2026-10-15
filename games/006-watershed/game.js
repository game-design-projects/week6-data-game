// #6 Watershed — the outline of a river's whole drainage basin; name the river.
import { haversineKm, bearingDeg, arrow, fmtKm, fmtNum } from '../../engine/core.js';

const REGION = {
  Africa: 'Africa',
  Asia: 'Asia',
  Europe: 'Europe',
  'North America, Central America and the Caribbean': 'North America',
  'South America': 'South America',
  'South-West Pacific': 'Oceania',
};
export const regionName = (r) => REGION[r] || r;
export const fmtLat = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;
export const fmtLng = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'E' : 'W'}`;

/** Area clue band, e.g. 1.2M km² -> "800k – 1.6M km²", coarse on purpose. */
export function areaBand(km2) {
  const steps = [100e3, 200e3, 400e3, 800e3, 1.6e6, 3.2e6, 7e6];
  const lo = [0, ...steps].filter((s) => s <= km2).pop();
  const hi = steps.find((s) => s > km2);
  const f = (v) => (v >= 1e6 ? `${v / 1e6}M` : `${v / 1e3}k`);
  if (!hi) return `over ${f(lo)} km²`;
  return lo === 0 ? `under ${f(hi)} km²` : `${f(lo)} – ${f(hi)} km²`;
}

/** 6 guesses: 100 for the first, then 83, 67, 50, 33, 17; 0 if never found. */
export const scoreFor = (n, won) => (won ? Math.round((100 * (7 - n)) / 6) : 0);

/** Area feedback relative to the answer, from the guessed basin's point of view. */
export function areaCell(guessArea, ansArea) {
  const ratio = ansArea / guessArea;
  if (ratio >= 0.87 && ratio <= 1.15) return { text: 'Similar', num: true, state: 'near' };
  return ratio > 1
    ? { text: `\u2191 ${ratio.toFixed(1)}\u00d7`, num: true }
    : { text: `\u2193 ${(1 / ratio).toFixed(1)}\u00d7`, num: true };
}

/** Geometry for Plot: all outer rings as one MultiPolygon. */
export const toMulti = (r) => ({ type: 'MultiPolygon', coordinates: r.rings.map((ring) => [ring]) });

export default {
  meta: {
    num: 6,
    slug: 'watershed',
    title: 'Watershed',
    tagline: 'A river\'s whole drainage basin, reduced to an unlabeled outline. Name the river.',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      'The map shows the complete drainage basin of one river: all the land whose rain ends up in it. North is up and the projection is equal-area, so shapes are not distorted.',
      'Pick a river from the list. You have 6 guesses, and every miss unlocks a clue: area range, continent, latitude and longitude range, letter count, exact area.',
      'Each guess tells you how far its basin is from the answer, in which direction the answer lies, and whether the answer basin is bigger (\u2191) or smaller (\u2193) than the one you guessed.',
      'Reading tips: a thin branching shape is usually one long main stem; a big round blob is often a closed basin; notches and bulges follow mountain ranges on the divide.',
    ],
    scoring: '100 points for a first-try hit, then 83, 67, 50, 33 and 17; 0 if you miss all six.',
    sources: [
      { name: 'WMO Basins and Sub-basins, 3rd ed. (GRDC, 2020)', url: 'https://services1.arcgis.com/RTK5Unh1Z71JKIiR/arcgis/rest/services/WMO_Basins_and_Sub_Basins_3rd_ed_GRDC_2020/FeatureServer', note: 'WMO basin boundaries published by the Global Runoff Data Centre (German Federal Institute of Hydrology)' },
      { name: 'HydroSHEDS', url: 'https://www.hydrosheds.org/', note: 'The original plan. Its download site (data.hydrosheds.org) answers scripts with a Cloudflare 403, and HydroBASINS carries no river names, so the officially named WMO/GRDC basins are used instead' },
    ],
    dataNote: 'The data are WMO/GRDC basin and sub-basin polygons, simplified server-side (about 0.02° precision, small interior lake holes removed). The sub-basins of one river are merged into a single basin (the Mississippi = Mississippi + Missouri + Ohio + …). Only the 86 named basins of roughly 60,000 km² or more are included. Closed basins (Lake Chad, Lake Eyre) are listed under their lake, and Murray-Darling, Euphrates-Tigris and similar follow WMO groupings. The “where it ends” and “shape clue” texts were written by hand from standard geography references.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.rivers).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const rivers = ctx.data.rivers;
    const ans = rivers.find((r) => r.id === p.id);
    const byId = new Map(rivers.map((r) => [r.id, r]));
    ctx.log('answer', ans.name, ans.area, ans.subs);

    const geom = toMulti(ans);
    const cx = (ans.bbox[0] + ans.bbox[2]) / 2;
    const cy = (ans.bbox[1] + ans.bbox[3]) / 2;
    const outline = await ui.plot((Plot, c) => ({
      height: 320,
      axis: false,
      projection: { type: 'azimuthal-equal-area', rotate: [-cx, -cy], domain: geom, inset: 8 },
      marks: [
        Plot.geo(geom, { fill: c.accent, fillOpacity: 0.85, stroke: c.accent, strokeWidth: 0.6, strokeLinejoin: 'round' }),
      ],
    }), { axis: false });
    ctx.stage.append(ui.panel({ kicker: 'Equal-area projection · north up · no scale', title: 'This river\'s basin' }, outline));

    const fmtRange = (a, b, pos, neg) => {
      const f = (v) => `${Math.abs(Math.round(v))}°${v >= 0 ? pos : neg}`;
      return `${f(a)} ~ ${f(b)}`;
    };
    const letters = ans.name.replace(/[^A-Za-zÀ-ÿ]/g, '');
    const clues = [
      `The basin covers ${areaBand(ans.area)}.`,
      `It lies in ${regionName(ans.region)} (WMO region).`,
      ui.h('div', `The basin spans latitude ${fmtRange(ans.bbox[1], ans.bbox[3], 'N', 'S')} and longitude ${fmtRange(ans.bbox[0], ans.bbox[2], 'E', 'W')}.`),
      `The name has ${letters.length} letters and starts with “${ans.name[0]}”.`,
      `More precisely: about ${fmtNum(Math.round(ans.area / 1000) * 1000)} km².` + (ans.subs > 1 ? ` It is stitched together from ${ans.subs} WMO sub-basins.` : ''),
    ];

    const options = rivers.map((r) => ({
      id: r.id,
      label: r.name,
      aliases: [r.name, ...(r.aliases || [])],
    }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      scoring: scoreFor,
      title: 'Which river is this?',
      placeholder: 'Type a river, e.g. Danube…',
      clues,
      cluesTitle: 'Clues',
      columns: ['Distance', 'Direction', 'Ans. area'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1500,
      feedback: (g) => {
        const gr = byId.get(g.id);
        if (gr.id === ans.id) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: 'Match', state: 'hit' }];
        const km = haversineKm(gr, ans);
        return [
          { text: fmtKm(km), num: true, state: km < 1500 ? 'near' : undefined },
          { text: arrow(bearingDeg(gr, ans)) },
          areaCell(gr.area, ans.area),
        ];
      },
    });

    // Reveal: where on the globe this basin sits, so the shape can be tied to a place.
    let locator = null;
    try {
      const land = await ui.geo('land');
      locator = await ui.plot((Plot, c) => ({
        height: 240,
        axis: false,
        projection: { type: 'orthographic', rotate: [-ans.lng, -ans.lat] },
        marks: [
          Plot.sphere({ fill: c.paper2, stroke: c.rule }),
          Plot.geo(land, { fill: c.rule, fillOpacity: 0.7, stroke: c.muted, strokeWidth: 0.3 }),
          Plot.geo(geom, { fill: c.accent, stroke: c.accent, strokeWidth: 0.8 }),
        ],
      }), { axis: false });
    } catch (e) {
      ctx.log.warn('locator map failed', e);
    }
    const kv = ui.kv([
      ['Answer', ans.name],
      ['Basin area', `${fmtNum(ans.area)} km²`],
      ['Location', `${regionName(ans.region)} · center near ${fmtLat(ans.lat)}, ${fmtLng(ans.lng)}`],
      ['Where it ends', ans.mouth],
      ['Shape clue', ans.note],
    ]);
    res.detail = locator ? ui.stack(locator, kv) : kv;
    return res;
  },
};
