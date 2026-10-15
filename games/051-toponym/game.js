// #51 Toponym — a place name's literal meaning is the only clue; find the place on the map.

/** Round score weights: 3 places per day. Pure helper for tests. */
export function pickThree(places, pick, rng) {
  const first = pick(places);
  const rest = rng.sample(places.filter((p) => p.id !== first.id), 2);
  return [first, ...rest].map((p) => p.id);
}

export default {
  meta: {
    num: 51,
    slug: 'toponym',
    title: 'Toponym',
    tagline: 'You get the literal meaning of a place name, such as “Black Pool”. Find the place on the world map.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '3 place names a day. Each clue gives only its literal meaning, the language it comes from and its type (city, country, region). The map has no labels.',
      'Ask yourself which language it is, and where speakers of that language (or colonizers who spoke it) lived. Then drop a pin. You get 2 tries per name; the second comes with a compass hint.',
      'Language is the biggest clue: Spanish, Portuguese, French, Arabic, Sanskrit and Old Norse each left very different footprints.',
      'After the reveal you see the original spelling, in case you knew it all along.',
    ],
    scoring: 'Each name scores by distance: 0 km is 100 points, about 1,500 km off is about 37. The second try costs 10%. Three names add up to 300.',
    sources: [
      { name: 'Wikidata (coordinates and entries)', url: 'https://www.wikidata.org/', note: 'P625 coordinates via the wbgetentities API' },
      { name: 'Etymology sections of Wikipedia place articles', url: 'https://en.wikipedia.org/', note: 'Literal meanings are condensed from each article\'s etymology section' },
    ],
    dataNote: 'Literal meanings follow the commonly cited etymology in each article\'s Wikipedia etymology section; places with disputed etymologies were left out. Coordinates are Wikidata center points (for countries and regions, their center). The pool is 88 hand-picked names. The meanings and the language-fingerprint notes were written by hand, not parsed from Wiktionary, whose etymologies are free text that cannot be extracted reliably. Each meaning has been reworded to avoid hinting at the name directly.',
  },

  puzzle({ data, pick, rng }) {
    return { ids: pickThree(data.places, pick, rng) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byId = new Map(ctx.data.places.map((x) => [x.id, x]));
    // world band lat -58..80 is ~0.59x as tall as wide in Mercator; size the map to it so no empty strip shows
    const mapHeight = Math.max(260, Math.min(480, Math.round(((ctx.stage?.clientWidth || 390) - 40) * 0.6)));
    const results = [];
    const details = [];
    for (let i = 0; i < p.ids.length; i++) {
      const pl = byId.get(p.ids[i]);
      ctx.log(`round ${i + 1}`, pl.id, pl.name);
      const prompt = ui.h('div', { class: 'ds-stack' },
        ui.h('div', { style: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent)' } }, `“${pl.meaning}”`),
        ui.h('div', { class: 'ds-row', style: { gap: '8px' } }, ui.badge(pl.kind), ui.badge(`Language: ${pl.lang}`)),
        ui.h('div', { class: 'small muted' }, 'That is what this place name means, word for word. Where is it?'));
      const r = await ctx.pin({
        title: `Name ${i + 1} of ${p.ids.length}`,
        prompt,
        answer: { lat: pl.lat, lng: pl.lng, label: pl.name },
        view: { bounds: [[-58, -180], [80, 180]] },
        height: mapHeight,
        basemap: 'gray',
        scale: 1500,
        attempts: 2,
        hint: (km, bearing) => {
          const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
          return `About ${ctx.core.fmtKm(km)} off. The answer lies to the ${dirs[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]}.`;
        },
      });
      results.push(r);
      details.push(ui.h('div', { class: 'ds-stack' },
        ui.h('div', {}, ui.h('b', pl.name), ` \u00b7 ${pl.kind}`),
        ui.kv([['Original', pl.orig], ['Language', pl.lang], ['Literal meaning', pl.meaning], ['Your miss', ctx.core.fmtKm(r.km ?? 0)]]),
        ui.callout(`The clue is in the language. ${ctx.data.langNotes?.[pl.lang] ?? ''} So “${pl.meaning}” (${pl.lang}) points to ${pl.name}.`, 'good'),
        ui.h('a', { href: `https://en.wikipedia.org/wiki/${encodeURIComponent(pl.wiki.replace(/ /g, '_'))}`, target: '_blank', rel: 'noopener' }, 'Etymology on Wikipedia ↗')));
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' }, ...details);
    return res;
  },
};
