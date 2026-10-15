// #7 Parallel — which of five cities lie farther north than today's city?
export function northOf(ref, cands) {
  return cands.map((c, i) => (c.lat > ref.lat ? i : -1)).filter((i) => i >= 0);
}
export const latLabel = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;
const gap = (a, b) => Math.abs(a.lat - b.lat);

// The closest call of a round: the candidate whose latitude is nearest to the reference.
export function closestCall(ref, cands) {
  return cands.reduce((best, c) => (gap(c, ref) < gap(best, ref) ? c : best));
}
// Teaching sentence for one round, specific to its data.
export function lesson(ref, cands) {
  const c = closestCall(ref, cands);
  const dir = c.lat > ref.lat ? 'farther north' : 'farther south';
  const d = gap(c, ref).toFixed(1);
  const far = Math.abs(c.lng - ref.lng) > 40;
  return `Closest call: ${c.name} (${c.country}, ${latLabel(c.lat)}) is ${dir} than ${ref.name} (${latLabel(ref.lat)}), by just ${d}°${far ? ' - and they sit half a world apart, so climate and gut feeling are no help; only the latitude itself is' : ''}.`;
}

export default {
  meta: {
    num: 7,
    slug: 'parallel',
    title: 'Parallel',
    tagline: 'Five cities, one reference. Tap every one that lies farther north. Yes, Rome is north of New York.',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      'Three rounds, each harder than the last. Every round gives you one reference city and five candidates, all from different countries.',
      'Select every candidate whose latitude is higher (farther north) than the reference city, anywhere from 1 to 4 of them, then submit. In the Southern Hemisphere, "farther north" still wins: 12°S is farther north than 34°S.',
      'Do not trust the weather: cold does not mean north. Warm ocean currents keep Europe far milder than North America at the same latitude, and Rome (41.9°N) is actually north of New York (40.7°N).',
      'After you submit, you see every city\'s exact latitude and the closest call of the round.',
    ],
    scoring: 'Each round is scored by overlap with the right answer (Jaccard: correct picks divided by everything you picked or should have picked), so three rounds are worth 3 points. Selecting everything or tapping at random earns only scraps; misses and extra picks both cost you.',
    sources: [
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: 'City coordinates and population (cities over 1.5 million people)' },
      { name: 'Wikidata', url: 'https://www.wikidata.org/', note: 'Used to pick well-known cities (matched by GeoNames ID)' },
    ],
    dataNote: 'Snapshot data: GeoNames city coordinates barely change and there is no daily feed, so nothing is loaded live. Only well-known cities over 1.5 million people are included. Latitude is taken at the city center. Each day\'s three rounds come from a fixed pool; the closest candidate is at least 3°, 1.2° and 0.4° from the reference city, respectively.',
  },

  puzzle({ data, pick }) {
    return pick(data.puzzles);
  },

  async play(ctx, p) {
    ctx.log('rounds', p.rounds.length);
    const rounds = p.rounds.map(({ ref, cands }) => {
      const correct = northOf(ref, cands);
      const rows = cands.slice().sort((a, b) => b.lat - a.lat)
        .map((c) => `${c.name} ${latLabel(c.lat)}${c.lat > ref.lat ? ' ↑' : ' ↓'}`).join(' · ');
      return {
        prompt: `Which are farther north than ${ref.name} (${ref.country})?`,
        options: cands.map((c) => ({ label: c.name, sub: c.country })),
        correct,
        explain: `${ref.name} ${latLabel(ref.lat)}. ${rows}`,
      };
    });
    const res = await ctx.rounds({ rounds, multi: true, title: 'Which cities lie north of the reference?' });
    res.detail = ctx.ui.stack(
      ...p.rounds.map(({ ref, cands }, i) => ctx.ui.callout(`Round ${i + 1}: ${lesson(ref, cands)}`, 'good')),
      ctx.ui.quote('Rule of thumb: go by latitude, not climate. Warm currents like the North Atlantic Drift make European winters milder than North America at the same latitude, so a colder city is not necessarily the more northern one.'),
    );
    return res;
  },
};
