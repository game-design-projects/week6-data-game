// #101 Spotter — a plane-spotter's photo; name the airport, then the airline, type and season.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const QUARTERS = [
  { label: 'Dec–Feb', months: [12, 1, 2] },
  { label: 'Mar–May', months: [3, 4, 5] },
  { label: 'Jun–Aug', months: [6, 7, 8] },
  { label: 'Sep–Nov', months: [9, 10, 11] },
];
export const quarterOf = (date) => QUARTERS.findIndex((q) => q.months.includes(+date.slice(5, 7)));
/** First word of a type ("Boeing 737-800" -> "Boeing") groups manufacturers for plausible decoys. */
export const maker = (t) => t.split(' ')[0];

/** Airlines whose liveries look alike (Lufthansa / Lufthansa Cargo, Air Canada / Air Canada Rouge) share a brand key. */
export function opBrand(op) {
  const w = op.split(/\s+/);
  if (['Air', 'Eastern', 'Western', 'Hong', 'China'].includes(w[0])) return w.slice(0, 2).join(' ').toLowerCase();
  return w[0].toLowerCase();
}

/** Pick `n` decoys, preferring same-group values, never equal to the answer nor `clash`-ing with it. */
export function decoys(rng, pool, answer, n, group = () => 0, clash = () => false) {
  const uniq = [...new Set(pool)].filter((x) => x !== answer && !clash(x, answer));
  const near = rng.shuffle(uniq.filter((x) => group(x) === group(answer)));
  const far = rng.shuffle(uniq.filter((x) => group(x) !== group(answer)));
  return [...near, ...far].slice(0, n);
}

export default {
  meta: {
    num: 101,
    slug: 'spotter',
    title: 'Spotter',
    tagline: 'A real plane-spotter photo: name the airport first, then the airline, the aircraft type and the season.',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      'Look at a real photo taken by a plane spotter at an airport and guess which airport it was from the list. You get up to 6 guesses, and each miss unlocks a clue (continent, country, hemisphere, first letter of the IATA code).',
      'Each guess shows how far it is from the answer, in which direction, and whether it is in the same country.',
      'After the airport, answer three multiple-choice questions: which airline? Which aircraft type? Which months was the photo taken in?',
      'Tips: paint scheme and tail are an airline\'s fingerprint; engine count, fuselage length and winglets identify the type; vegetation, snow, sun angle and ground vehicles in the background hint at place and season.',
    ],
    scoring: '200 points in all: 100 for the airport (full marks on the first guess, about 17 fewer for each extra guess, 0 if not found in 6) and 100 for the three questions (about 33 each).',
    sources: [
      { name: 'Wikimedia Commons (photos and categories)', url: 'https://commons.wikimedia.org/wiki/Category:Aircraft_by_airport', note: 'The category name “type of airline at airport” is the answer; shooting dates come from the photo EXIF or description' },
      { name: 'Wikimedia Commons API', url: 'https://commons.wikimedia.org/w/api.php' },
    ],
    dataNote: 'Photos come from Commons categories named “type of airline at airport”, which supply the answers. Volunteers maintain them and occasionally mislabel, so at build time each photo was cross-checked against its file name and description, dropping obvious mislabels (a title naming a different airline or manufacturer), portrait shots and photos with no shooting month. Aircraft types are merged into families (A320neo into A320), and look-alike sub-brands (such as Lufthansa and Lufthansa Cargo) are never offered together as options. The original idea of a blurred registration plus OpenSky flight history was not built: OpenSky\'s historical flight API now needs an account, and a browser cannot reliably blur registrations, so the game asks four questions instead: airport, airline, type and month. The registration may be visible in the photo; that is part of a real photo. The original photo page link stays hidden until you finish, so the file name cannot leak the answer.',
  },

  puzzle({ data, rng, pick }) {
    const photo = pick(data.photos);
    const ap = data.airports.find((a) => a.iata === photo.iata);
    const sameCont = data.photos.filter((p) => data.airports.find((a) => a.iata === p.iata).cont === ap.cont);
    const ops = decoys(rng, [...sameCont, ...data.photos].map((p) => p.op), photo.op, 3, () => 0, (a, b) => opBrand(a) === opBrand(b));
    const types = decoys(rng, data.photos.map((p) => p.type), photo.type, 3, maker);
    const opts = (ans, ds) => { const all = rng.shuffle([ans, ...ds]); return { opts: all, correct: all.indexOf(ans) }; };
    return { photo, op: opts(photo.op, ops), type: opts(photo.type, types) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const ph = p.photo;
    const byIata = new Map(ctx.data.airports.map((a) => [a.iata, a]));
    const ans = byIata.get(ph.iata);
    ctx.log('photo', ph.iata, ph.op, ph.type, ph.date);

    ctx.stage.append(ui.panel({ kicker: 'Today\'s photo', title: 'Where was this plane photographed?' },
      ui.h('div', { style: { background: 'var(--paper-2, rgba(128,128,128,.12))', borderRadius: '8px', overflow: 'hidden' } },
        ui.h('img', { src: ph.thumb, alt: 'An aircraft photo (source shown after you answer)', referrerpolicy: 'no-referrer', style: { width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' } })),
      ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'The photographer and the original link appear once you finish.')));

    const clues = [
      'Study the photo: paint scheme, ground vehicles, background terrain and vegetation.',
      `Continent: ${ans.cont}`,
      `Country / region: ${ans.country}`,
      `Hemisphere: ${ans.lat >= 0 ? 'Northern' : 'Southern'} (seasons depend on it)`,
      `The airport's IATA code starts with “${ans.iata[0]}”.`,
    ];
    const ap = await ctx.guess({
      options: ctx.data.airports.map((a) => ({ id: a.iata, label: a.name, hint: a.iata, aliases: [a.en, a.iata, a.country] })),
      answer: ans.iata,
      maxGuesses: 6,
      title: 'Which airport?',
      placeholder: 'Type an airport, city or IATA code…',
      clues,
      cluesTitle: 'Clues',
      columns: ['Distance', 'Direction', 'Country'],
      near: (g, a) => haversineKm(byIata.get(g.id), byIata.get(a.id)) < 1500,
      feedback: (g) => {
        const ga = byIata.get(g.id);
        if (ga.iata === ans.iata) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: '✓', state: 'hit' }];
        const km = haversineKm(ga, ans);
        return [
          { text: fmtKm(km), num: true, state: km < 1500 ? 'near' : undefined },
          { text: arrow(bearingDeg(ga, ans)) },
          ga.country === ans.country ? { text: 'Same', state: 'near' } : { text: 'Other', state: undefined },
        ];
      },
    });
    ctx.log('airport stage', ap.score);

    const q = quarterOf(ph.date);
    const rd = await ctx.rounds({
      rounds: [
        { prompt: 'Which airline is this?', options: p.op.opts.map((label) => ({ label })), correct: p.op.correct, explain: `Answer: ${ph.op}` },
        { prompt: 'Which aircraft type is this?', options: p.type.opts.map((label) => ({ label })), correct: p.type.correct, explain: `Answer: ${ph.type}` },
        { prompt: 'Which months was the photo taken in?', options: QUARTERS.map((x) => ({ label: x.label })), correct: q, explain: `Taken on ${ph.date}` },
      ],
    });

    const res = ctx.combine([ap, { ...rd, score: (rd.score / rd.max) * 100, max: 100 }]);
    res.summary = `${ans.iata} · ${rd.score}/${rd.max}`;
    const mon = +ph.date.slice(5, 7);
    const north = ans.lat >= 0;
    const NORTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const season = (north ? NORTH[mon - 1] : NORTH[(mon + 5) % 12]);
    res.detail = ui.kv([
      ['Airport', `${ans.name} (${ans.iata}, ${ans.en}, ${ans.country})`],
      ['Airline', ph.op],
      ['Aircraft', ph.type],
      ['Date taken', `${ph.date} (${north ? 'northern' : 'southern'} hemisphere ${season})`],
      ['Source', ui.h('a', { href: ph.page, target: '_blank', rel: 'noopener' }, `${ph.by} · ${ph.lic} · Wikimedia Commons`)],
      ['Clues in this photo', `The livery is ${ph.op}: its main operating region narrows ${ans.name} down to ${ans.cont}, and ${ph.type} is a common type for that airline. ${MONTHS[mon - 1]} in the ${north ? 'northern' : 'southern'} hemisphere is ${season}, so the vegetation, snow and sun angle in the picture should fit that season.`],
      ['Telling types apart', 'Count the engines (2 or 4), check the fuselage length and whether there are winglets. Boeings tend to have a pointed tail cone and scalloped engine cowls; Airbuses tend to have a rounded nose and big cabin doors.'],
    ]);
    return res;
  },
};
