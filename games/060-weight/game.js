// #60 Weight — read a board game's box blurb + mechanics, guess its BGG "complexity weight" (1–5).

const STOP = new Set(['the', 'and', 'of', 'for', 'game', 'games', 'board', 'card', 'with', 'from', 'second', 'third', 'edition', 'new', 'old', 'one', 'two', 'sea', 'war', 'art', 'hex', 'big', 'age', 'all', 'you', 'who', 'its', 'her', 'his', 'out', 'red', 'day', 'man']);
const fold = (s) => [...s.normalize('NFC')].map((c) => c.normalize('NFD')[0]).join('');
const isL = '[\\p{L}\\p{N}]';

/** Hide the game's own title (and its distinctive words) inside the blurb. Accent-insensitive. */
export function redactName(text, name) {
  let out = text.normalize('NFC');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = fold(name).split(/[^A-Za-z0-9'’]+/).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  // title with any punctuation/spacing between words
  const phrase = (t) => fold(t).split(/[^A-Za-z0-9]+/).filter(Boolean).map(esc).join('[^\\p{L}\\p{N}]{1,3}');
  const full = phrase(name);
  const main = phrase(name.split(/[:(–—]| - /)[0]); // title without subtitle
  const apply = (re) => {
    const folded = fold(out);
    if (folded.length !== out.length) return; // cannot align positions, skip
    let res = '', last = 0;
    for (const m of folded.matchAll(re)) { res += out.slice(last, m.index) + '▇▇▇'; last = m.index + m[0].length; }
    out = res + out.slice(last);
  };
  if (main && main !== full) apply(new RegExp(`(?<!${isL})${main}[\\p{L}\\p{N}]*`, 'giu'));
  if (full) apply(new RegExp(`(?<!${isL})${full}[\\p{L}\\p{N}]*`, "giu"));
  for (const w of words) {
    const ww = esc(w).replace(/['’]/g, "['’]?");
    apply(new RegExp(`(?<!${isL})${ww}[\\p{L}\\p{N}'’]*`, 'giu'));
  }
  return out.replace(/(▇▇▇[\s:,'’-]*){2,}/g, '▇▇▇ ').replace(/▇▇▇\s+(?=[,.;:!?)])/g, '▇▇▇');
}

export const ROUNDS = 3;
export const SCALE = 0.5;
export const roundScore = (guess, answer) => 100 * Math.exp(-Math.abs(guess - answer) / SCALE);

export const band = (w) => (w < 1.8 ? 'light (family / party)' : w < 2.6 ? 'medium-light' : w < 3.4 ? 'medium' : w < 4.1 ? 'medium-heavy' : 'heavy (hardcore strategy)');

export default {
  meta: {
    num: 60,
    slug: 'weight',
    title: 'Weight',
    tagline: 'Read a board game\'s blurb, mechanics and play time, then guess its BoardGameGeek complexity rating (1–5).',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      'Three board games a day, with the game\'s name blacked out (the blurb is the original BGG text). Read the blurb, mechanics, play time and recommended age.',
      'Drag the slider or type a number to guess the average "weight" players give it: 1 = easy to pick up, 5 = brain-burning.',
      'Clues: longer games with more mechanics (worker placement, economy, area control) tend to be heavier; card, word and reaction games tend to be light.',
      'Scored by error: every 0.5 off cuts that game\'s score to about a third; the three add up to a maximum of 300.',
    ],
    scoring: 'Each game scores 100 × e^(−error/0.5); the three add up to a maximum of 300. Off by 0.35 earns about 50, off by 0.5 about 37.',
    sources: [
      { name: 'BoardGameGeek (complexity weight)', url: 'https://boardgamegeek.com/', note: 'Average weight voted by many players, via api.geekdo.com/api/dynamicinfo' },
      { name: 'TidyTuesday 2022-01-25 · BGG blurbs, mechanics and player counts', url: 'https://github.com/rfordatascience/tidytuesday/tree/master/data/2022/2022-01-25' },
    ],
    dataNote: 'Covers 259 of BGG\'s roughly 260 most-rated games that have at least 150 complexity votes (a snapshot: weights from October 2026, blurbs and mechanics from a January 2022 BGG mirror). Blurbs are the original BGG text, with the game\'s name and its key words blacked out. No box art is shown, because the box prints the title and would give the answer away. BGG\'s official XML API needs a token and the JSON endpoint the website uses (api.geekdo.com) does not allow cross-origin requests (CORS), so the browser cannot read it live and the data is not live.',
  },

  puzzle({ data, pick, rng }) {
    const a = pick(data.games);
    const ok = (g, used) => used.every((u) => Math.abs(g.weight - u.weight) >= 0.6);
    const pool = rng.shuffle(data.games.filter((g) => g.id !== a.id));
    const chosen = [a];
    for (const g of pool) { if (chosen.length < ROUNDS && ok(g, chosen)) chosen.push(g); }
    return { ids: rng.shuffle(chosen.map((g) => g.id)) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const games = ctx.data.games;
    const results = [];
    const picked = p.ids.map((id) => games.find((g) => g.id === id));
    const mean = (a) => a.reduce((s, x) => s + x.weight, 0) / (a.length || 1);
    const globalAvg = mean(games);
    const mechAvg = (m) => { const l = games.filter((x) => x.mechs.includes(m)); return { m, n: l.length, avg: mean(l) }; };

    for (let i = 0; i < picked.length; i++) {
      const g = picked[i];
      const players = g.minp === g.maxp ? `${g.minp}` : `${g.minp}–${g.maxp}`;
      const box = ui.panel({ kicker: `Game ${i + 1} of ${picked.length}`, title: 'How complex is this game?' },
        ui.h('div', { class: 'ds-stack' },
          ui.quote(redactName(g.desc, g.name)),
          ui.h('div', { class: 'ds-grid', style: { '--min': '90px' } },
            ui.stat({ label: 'Published', value: String(g.year) }),
            ui.stat({ label: 'Players', value: players }),
            ui.stat({ label: 'Minutes', value: String(g.time) }),
            ui.stat({ label: 'Age', value: `${g.age}+` })),
          ui.h('div', { class: 'small muted' }, 'Categories'), ui.chips(g.cats),
          ui.h('div', { class: 'small muted' }, 'Mechanics'), ui.chips(g.mechs)));
      ctx.stage.append(box);
      ctx.log('round', i + 1, g.name, g.weight);

      const r = await ctx.estimate({
        answer: g.weight, min: 1, max: 5, step: 0.05, initial: 2.5,
        format: (v) => v.toFixed(2), scoring: 'abs', scale: SCALE,
        title: 'What is its complexity?',
      });
      const peers = games.filter((x) => x.id !== g.id && Math.abs(x.time - g.time) <= Math.max(15, g.time * 0.25));
      const sig = g.mechs.map(mechAvg).filter((x) => x.n >= 5).sort((x, y) => Math.abs(y.avg - globalAvg) - Math.abs(x.avg - globalAvg)).slice(0, 3);
      const sigText = sig.length ? sig.map((x) => `${x.m} (${x.n} games, average ${x.avg.toFixed(2)})`).join('; ') : 'No mechanic that skews especially heavy or light';
      const verdict = r.guess == null ? '' : Math.abs(r.guess - g.weight) <= 0.25 ? 'Spot on.' : r.guess > g.weight ? 'You overestimated.' : 'You underestimated.';
      r.detail = ui.panel({ plain: true }, ui.kv([
        ['Game', `${g.name} (${g.year})`],
        ['Weight', `${g.weight.toFixed(2)} / 5 · ${band(g.weight)} (${ctx.core.fmtNum(g.votes)} votes)`],
        ['Your guess', r.guess == null ? '—' : `${Number(r.guess).toFixed(2)} ${verdict}`],
        ['Time clue', `Popular games of about ${g.time} minutes (${peers.length} of them) average ${mean(peers).toFixed(2)}; this one is ${g.weight.toFixed(2)}. All ${games.length} games average ${globalAvg.toFixed(2)}.`],
        ['Mechanics clue', sigText],
        ['All mechanics', g.mechs.join(', ') || '—'],
        ['BGG rating', `${g.rating} (rank ${g.rank})`],
      ]));
      results.push(r);
      box.style.opacity = '.6';
    }
    return ctx.combine(results);
  },
};
