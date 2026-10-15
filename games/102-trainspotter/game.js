// #102 Trainspotter — a railway photo from Wikimedia Commons: name the operator,
// name the train type, then pin where the photographer stood.

/** Pick `n` wrong options (distinct labels, never the answer) and shuffle with the answer.
 *  `skip(m)` drops lookalikes of the answer; `prefer(m)` fronts plausible decoys (e.g. same country). */
export function buildChoices(all, answer, key, n, rng, { skip = () => false, prefer = () => false } = {}) {
  const seen = new Set([answer[key]]);
  const wrong = [];
  const pool = rng.shuffle(all.slice().filter((m) => m !== answer && !skip(m)));
  pool.sort((a, b) => Number(prefer(b)) - Number(prefer(a)));
  for (const m of pool) {
    if (wrong.length >= n) break;
    if (!seen.has(m[key])) { seen.add(m[key]); wrong.push(m); }
  }
  return rng.shuffle([answer, ...wrong]).map((m) => m[key]);
}

/** Three equal parts: operator (0/1), train type (0/1) and the pin (0..100) → 0..300. */
export function totalScore(opOk, typeOk, pinScore) {
  return (opOk ? 100 : 0) + (typeOk ? 100 : 0) + Math.max(0, Math.min(100, pinScore));
}

/** Short verdict on the pin, specific to how far off the player was. */
export function pinVerdict(km) {
  if (km < 30) return 'Practically on the same platform. Superb.';
  if (km < 300) return 'Same country, same general area: right idea.';
  if (km < 1500) return 'Roughly the right region, but about a country off. Use the livery and overhead wires to find the country first, then follow the railway to a big station.';
  return 'On another continent or the far side of one. Identify the country first (livery, lettering, platforms), then narrow down to a big city.';
}

export default {
  meta: {
    num: 102,
    slug: 'trainspotter',
    title: 'Trainspotter',
    tagline: 'A railway photo: name the operator and the train type, then pin where it was taken.',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      'Study the photo: livery, nose shape, pantograph, platforms and signals are all clues.',
      'Pick the operator, then the train type (4 choices each, 100 points each). The type options include other models from the same country, so the country alone will not decide it.',
      'Finally, pin where the photographer stood on the map (zoom to level 6 or more to see OpenRailwayMap lines and follow the track to a station).',
      'The pin scores 100 × e^(−distance / 600 km): 100 points at 0 km, about 37 at 600 km off. 300 points max.',
    ],
    scoring: 'Operator 100 + type 100 + pin 100 × e^(−distance / 600 km), 300 max.',
    sources: [
      { name: 'Wikimedia Commons train-type categories (photos, coordinates, authors, licenses)', url: 'https://commons.wikimedia.org/wiki/Category:Trains_by_type' },
      { name: 'OpenRailwayMap / OpenStreetMap (railway line map overlay)', url: 'https://www.openrailwaymap.org/' },
    ],
    dataNote: 'Photos come from geotagged images in 17 Wikimedia Commons train-type categories, each checked by hand (interiors, close-ups and photos with a legible operator logo or station sign were excluded). The type-to-operator mapping is hand-curated. Coordinates are the photographer\'s position, not necessarily a station. The OpenRailwayMap tiles are served by a third party; there is no offline version of the OSM rail lines (the vector data for all of Eurasia will not fit in a browser), so its raster layer is overlaid directly. Commons now only serves 960 px thumbnails.',
  },

  puzzle({ data, pick, rng }) {
    const photo = pick(data.photos);
    const model = data.models.find((m) => m.id === photo.model);
    return {
      photo: photo.id,
      ops: buildChoices(data.models, model, 'op', 3, rng),
      names: buildChoices(data.models, model, 'name', 3, rng, {
        skip: (m) => m.family === model.family,
        prefer: (m) => m.country === model.country,
      }),
    };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const photo = ctx.data.photos.find((x) => x.id === p.photo);
    const model = ctx.data.models.find((m) => m.id === photo.model);
    ctx.log('photo', photo.id, model.name);

    // author and licence are shown after the answer (an author's home town can give the place away)
    const credit = ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Wikimedia Commons · author and license shown after you answer');
    const img = ui.h('img', { src: photo.img, alt: 'Railway photo', decoding: 'async', style: { width: '100%', borderRadius: 'var(--radius, 10px)', display: 'block' } });
    img.addEventListener('error', () => { ctx.log.warn('photo failed to load', photo.id); credit.textContent = 'The photo failed to load. Refresh to retry (Wikimedia Commons may be temporarily unavailable).'; });
    ctx.stage.append(ui.panel({ kicker: 'Today\'s photo', title: 'What train is this?' }, img, credit));

    const opRes = await ctx.rounds({
      title: 'Operator',
      rounds: [{ prompt: 'Which operator runs it?', options: p.ops.map((label) => ({ label })), correct: p.ops.indexOf(model.op), explain: `${model.op} (${model.country})` }],
    });
    const typeRes = await ctx.rounds({
      title: 'Train type',
      rounds: [{ prompt: 'Which type of train is it?', options: p.names.map((label) => ({ label })), correct: p.names.indexOf(model.name), explain: model.name }],
    });

    const pinRes = await ctx.pin({
      title: 'Where did the photographer stand?',
      prompt: 'Pin the shooting location on the map (a station or along the line). Zoom in to level 6 or more to see the railway lines.',
      answer: { lat: photo.lat, lng: photo.lng, label: 'Shot location' },
      view: { bounds: [[18, -82], [62, 143]] },
      scale: 600,
      setup: async ({ map, L }) => {
        try {
          L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', { minZoom: 6, maxZoom: 19, opacity: 0.85, attribution: '© OpenRailwayMap' }).addTo(map);
        } catch (e) { ctx.log.warn('openrailwaymap overlay failed', String(e)); }
      },
    });
    ctx.log('pin', Math.round(pinRes.km), 'km');
    credit.textContent = `Wikimedia Commons · ${photo.author} · ${photo.lic}`;

    const opOk = opRes.score >= 1;
    const typeOk = typeRes.score >= 1;
    const res = ctx.combine([
      { ...opRes, score: opOk ? 100 : 0, max: 100 },
      { ...typeRes, score: typeOk ? 100 : 0, max: 100 },
      pinRes,
    ]);
    res.score = totalScore(opOk, typeOk, pinRes.score);
    res.max = 300;
    res.summary = `Operator ${opOk ? '✓' : '✗'} · Type ${typeOk ? '✓' : '✗'} · ${ctx.core.fmtKm(pinRes.km)} off`;
    res.detail = ui.kv([
      ['Train type', `${model.name} (${model.op}, ${model.country})`],
      ['How to spot it', model.tell],
      ['Type options this time', p.names.join(' / ')],
      ['Location', ui.h('span', {}, ui.h('a', { href: photo.page, target: '_blank', rel: 'noopener' }, photo.title), ` · ${photo.lat.toFixed(3)}°, ${photo.lng.toFixed(3)}°`)],
      ['Your pin', `${ctx.core.fmtKm(pinRes.km)} off. ${pinVerdict(pinRes.km)}`],
      ['Author and license', `${photo.author} · ${photo.lic}`],
    ]);
    return res;
  },
};
