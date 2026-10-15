// #11 Aftershock — a day of USGS earthquakes with the biggest one hidden.
// Find where it struck (clusters of small quakes = foreshocks/aftershocks), then guess its magnitude.

/** Score for a magnitude guess: 100 at exact, ~37 at 0.6 off. */
export function magScore(guess, answer) {
  return Math.round(100 * Math.exp(-Math.abs(guess - answer) / 0.6));
}

const MIN_TOP = 4.8, MIN_GAP = 0.2, MIN_N = 25;
const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Shape a USGS GeoJSON feed (one UTC day, M2.5+) into a puzzle, or null if the day
 * has no clear "biggest" quake (top < M4.8, < 0.2 above the runner-up, or < 25 quakes).
 */
export function toPuzzle(geo, date) {
  const qs = [];
  for (const f of geo?.features ?? []) {
    const p = f.properties ?? {}, c = f.geometry?.coordinates ?? [];
    if (p.type !== 'earthquake' || !Number.isFinite(p.mag) || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !Number.isFinite(p.time)) continue;
    if (new Date(p.time).toISOString().slice(0, 10) !== date) continue;
    qs.push({ mag: p.mag, lat: c[1], lng: c[0], place: p.place, id: String(f.id), t: p.time });
  }
  const seen = new Set();
  const uniq = qs.filter((q) => !seen.has(q.id) && seen.add(q.id));
  uniq.sort((a, b) => b.mag - a.mag || (a.id < b.id ? -1 : 1));
  if (uniq.length < MIN_N) return null;
  const [top, second] = uniq;
  if (top.mag < MIN_TOP || top.mag - second.mag < MIN_GAP) return null;
  return {
    date, n: uniq.length,
    top: { lat: r2(top.lat), lng: r2(top.lng), mag: top.mag, place: top.place || `${r2(top.lat)}°, ${r2(top.lng)}°`, id: top.id, time: new Date(top.t).toISOString().slice(11, 16) },
    others: uniq.slice(1).map((q) => [r2(q.lat), r2(q.lng), q.mag]),
  };
}

/** Count quakes within `km` of a point (used for the teaching detail). */
export function nearby(others, lat, lng, km, hav) {
  return others.filter((q) => hav(lat, lng, q[0], q[1]) <= km);
}

export default {
  meta: {
    num: 11,
    slug: 'aftershock',
    title: 'Aftershock',
    tagline: 'Every earthquake in the world that day is on the map except the biggest one. Find where it struck, then guess how big it was.',
    category: 'geo',
    data: 'live',
    wide: true,
    howTo: [
      'Each dot on the map is one M2.5+ earthquake somewhere in the world yesterday (UTC); the bigger the circle, the bigger the quake. The day\u2019s biggest quake has been hidden.',
      'Big quakes are usually surrounded by smaller ones (foreshocks and aftershocks). Look for an unusually dense cluster that is missing its \u201cstar\u201d, and drop your pin there.',
      'Then guess its magnitude: check the biggest of the small quakes around it and how many there are. A mainshock is always bigger than its aftershocks, usually by about 1 magnitude.',
    ],
    scoring: 'Location: 100 \u00d7 e^(\u2212distance / 1,200 km). Magnitude: 100 \u00d7 e^(\u2212error / 0.6). The total is the average of the two.',
    sources: [
      { name: 'USGS Earthquake Catalog (FDSN event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: 'M2.5+, grouped by UTC calendar day; only days whose biggest quake is at least M4.8 and at least 0.2 above the runner-up are used' },
    ],
    dataNote: 'Puzzles come from the whole of yesterday (UTC) in the USGS catalog, which is final from the next day on, so every player sees the same day; a rolling \u201cpast 24 hours\u201d would not be fair. If yesterday has no clear biggest quake (below M4.8, or less than 0.2 above the second) or the request fails, a day is drawn from the snapshot of April to October 2026.',
  },

  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -1); // yesterday UTC: the catalog is final for everyone
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${day}&endtime=${ctx.date}&minmagnitude=2.5&orderby=time-asc&limit=20000`;
    const geo = await ctx.fetchJSON(url, { timeout: 12000 });
    const live = toPuzzle(geo, day);
    ctx.log('live', day, live ? `${live.n} quakes, hidden M${live.top.mag}` : 'no clear biggest quake, using snapshot');
    return live ? { ...ctx.data, live } : null;
  },

  puzzle({ data, pick }) {
    return data.live ?? pick(data.puzzles);
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('puzzle', p.date, 'quakes', p.others.length, 'hidden', p.top.id);
    ctx.stage.append(ui.panel({ kicker: `UTC ${p.date}`, title: 'The hidden biggest quake' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px' } },
        ui.stat({ label: 'Quakes that day', value: String(p.others.length + 1), sub: 'M2.5 and up' }),
        ui.stat({ label: 'Biggest visible', value: `M${p.others[0][2].toFixed(1)}`, sub: 'the hidden one is bigger' }))));

    let revealed = false;
    const pinRes = await ctx.pin({
      title: '1 \u00b7 Where is it?',
      answer: { lat: p.top.lat, lng: p.top.lng, label: `M${p.top.mag} · ${p.top.place}` },
      view: { bounds: [[-55, -175], [72, 175]] },
      scale: 1200,
      height: (ctx.stage.clientWidth || 390) < 700 ? Math.round((ctx.stage.clientWidth || 390) * 0.8) : undefined,
      reveal: async () => {
        revealed = true;
      },
      setup: async ({ L, map }) => {
        // fit the whole world at any width (fractional zoom so 390 px phones see everything)
        map.setMinZoom(0);
        map.options.zoomSnap = 0;
        map.options.zoomDelta = 0.5;
        const fit = () => { if (revealed) return; map.invalidateSize(); map.fitBounds([[-58, -170], [75, 170]], { padding: [4, 4], animate: false }); };
        fit(); setTimeout(fit, 120);
        for (const [lat, lng, m] of p.others) {
          L.circleMarker([lat, lng], { radius: Math.max(2, (m - 1.5) * 2.2), weight: 1, color: '#555', fillColor: '#e0a030', fillOpacity: 0.45, interactive: false }).addTo(map);
        }
      },
    });

    const g = pinRes.guess;
    const nearG = nearby(p.others, g.lat, g.lng, 300, core.haversineKm);
    const maxG = nearG.reduce((a, q) => Math.max(a, q[2]), 0);
    const magRes = await ctx.estimate({
      title: '2 \u00b7 How big is it?',
      prompt: nearG.length
        ? `Within 300 km of your pin there ${nearG.length === 1 ? 'is 1 visible smaller quake' : `are ${nearG.length} visible smaller quakes`}, the biggest M${maxG.toFixed(1)}. A mainshock is usually about 1 magnitude above its largest aftershock (B\u00e5th\u2019s law).`
        : 'No visible quakes within 300 km of your pin. An isolated big quake leaves no aftershock clue, so go by where the plate boundaries are.',
      answer: p.top.mag, min: 4, max: 9.5, step: 0.1, initial: 6,
      format: (v) => `M${Number(v).toFixed(1)}`,
      scoring: (gg, a) => magScore(gg, a) / 100,
    });

    const near = nearby(p.others, p.top.lat, p.top.lng, 300, core.haversineKm);
    const maxNear = near.reduce((a, q) => Math.max(a, q[2]), 0);
    const res = ctx.combine([pinRes, magRes]);
    res.detail = ui.kv([
      ['Answer', `M${p.top.mag} \u00b7 ${p.top.place} (UTC ${p.date} ${p.top.time})`],
      ['Your result', `Location off by ${core.fmtKm(pinRes.km)}; you guessed M${Number(magRes.guess).toFixed(1)} (${Math.abs(magRes.guess - p.top.mag).toFixed(1)} off)`],
      ['The clue', near.length
        ? `Within 300 km of ${p.top.place} there ${near.length === 1 ? 'was 1 smaller quake' : `were ${near.length} smaller quakes`}, the biggest M${maxNear.toFixed(1)}, ${(p.top.mag - maxNear).toFixed(1)} below the mainshock. The dense cluster missing its \u201cstar\u201d was its aftershocks and foreshocks.`
        : `There was not a single visible smaller quake within 300 km of ${p.top.place}: an isolated big quake. You could only go by where it sits on a plate boundary (subduction zone, mid-ocean ridge) and guess the magnitude from global statistics.`],
      ['The pattern', 'The number of aftershocks grows exponentially with magnitude, and the largest aftershock is typically about 1.2 below the mainshock (B\u00e5th\u2019s law). So an unusually dense cluster of small quakes usually points to the hidden mainshock, and the biggest dot in the cluster plus a bit more than 1 is its magnitude.'],
    ]);
    return res;
  },
};
