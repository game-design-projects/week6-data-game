// #78 Pwned — which password has leaked more often? Counts from Have I Been Pwned (k-anonymity range API).
export const ROUNDS = 8;

/** Min count ratio per round: easy first, close pairs last. */
export const TARGETS = [8, 6, 5, 4, 3, 2.2, 1.6, 1.3];
const ratio = (a, b) => Math.max(a.n, b.n) / Math.min(a.n, b.n);

/** Pick `n` disjoint pairs; round i has a count ratio in [TARGETS[i], ~2x that]. */
export function makePairs(items, rng, n = ROUNDS) {
  const pool = rng.shuffle(items.slice());
  const used = new Set();
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const lo = TARGETS[Math.min(i, TARGETS.length - 1)];
    const hi = i === n - 1 ? 2.2 : lo * 2.2;
    let found = null;
    for (const a of pool) {
      if (used.has(a.p)) continue;
      const b = pool.find((x) => x.p !== a.p && !used.has(x.p) && ratio(a, x) >= lo && ratio(a, x) <= hi);
      if (b) { found = [a, b]; break; }
    }
    if (!found) continue;
    used.add(found[0].p); used.add(found[1].p);
    pairs.push(rng.chance(0.5) ? found : [found[1], found[0]]);
  }
  return pairs;
}

const kind = (p) => (/^\d+$/.test(p) ? 'digits' : /\d/.test(p) ? 'mixed' : 'letters');

export default {
  meta: {
    num: 78,
    slug: 'pwned',
    title: 'Pwned',
    tagline: 'Two common passwords. Which one shows up more often in data breaches?',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      'Each round shows two real, commonly used passwords.',
      'Tap the one you think appears more often in historical breach data. There are 8 rounds, and the pairs get closer as you go (from 8x or more apart down to just 1.3x).',
      'After each round you see the real breach counts for both; at the end you see how much of today\'s 8 pairs "shorter / more common" explains.',
    ],
    scoring: '1 point for every round you get right, 8 points at most.',
    sources: [
      { name: 'Have I Been Pwned: Pwned Passwords range API', url: 'https://haveibeenpwned.com/API/v3#PwnedPasswords', note: 'Only the first 5 characters of the SHA-1 are sent (k-anonymity); it returns the counts for every hash under that prefix' },
      { name: 'SecLists 10k-most-common.txt', url: 'https://github.com/danielmiessler/SecLists/tree/master/Passwords/Common-Credentials', note: 'Candidate password list' },
    ],
    dataNote: 'Counts are a snapshot fetched from HIBP on Oct 14, 2026. Candidates are a sample (447) of the 10,000 most common passwords in SecLists, with vulgar words filtered out. HIBP allows browser access, but there is no date-pinned version and new breaches keep changing the counts, which would give different players different "right answers", so nothing is fetched live.',
  },

  puzzle({ data, rng }) {
    return { pairs: makePairs(data.items, rng).map((pr) => pr.map((x) => ({ p: x.p, n: x.n, r: x.r }))) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('pwned pairs', p.pairs.length);
    ctx.stage.append(ui.panel({ kicker: 'Background', title: 'How often has each password leaked?' },
      ui.h('p', { class: 'small muted' }, 'Data from Have I Been Pwned: billions of real passwords exposed in data breaches. The bigger the number, the more likely attackers are to try it in credential-stuffing attacks.')));
    const rounds = p.pairs.map(([a, b], i) => ({
      prompt: `Round ${i + 1}: which has leaked more?`,
      options: [a, b].map((x) => ({ label: x.p })),
      correct: a.n >= b.n ? 0 : 1,
      explain: `${a.p}: ${core.fmtNum(a.n)} times; ${b.p}: ${core.fmtNum(b.n)} times (${(Math.max(a.n, b.n) / Math.min(a.n, b.n)).toFixed(1)}x apart)`,
    }));
    const r = await ctx.rounds({ rounds, minWidth: 140 });
    const winners = p.pairs.map(([a, b]) => (a.n >= b.n ? [a, b] : [b, a]));
    const cnt = (f) => winners.filter(([w, l]) => f(w, l)).length;
    const shorter = cnt((w, l) => w.p.length < l.p.length), longer = cnt((w, l) => w.p.length > l.p.length);
    const higher = cnt((w, l) => w.r < l.r);
    const all = p.pairs.flat().sort((x, y) => y.n - x.n);
    const top = all[0], bot = all[all.length - 1];
    r.detail = ui.stack(
      ui.table({ columns: [
        { key: 'p', label: 'Password' },
        { key: 'n', label: 'Leaks', num: true, fmt: (v) => core.fmtNum(v) },
        { key: 'r', label: 'List rank', num: true, fmt: (v) => `#${core.fmtNum(v)}` },
        { key: 'p', label: 'Type', fmt: (v) => `${v.length} ${kind(v)}` },
      ], rows: all }),
      ui.callout(`Today\'s pattern: across the 8 pairs, the more-leaked password ranked higher on the SecLists common list ${higher} times, was shorter ${shorter} times and longer ${longer} times. The top one, ${top.p}, appears ${core.fmtNum(top.n)} times and the lowest, ${bot.p}, only ${core.fmtNum(bot.n)}, ${core.fmtNum(Math.round(top.n / bot.n))}x apart. Leak counts roughly follow a Zipf distribution: the shorter and more obvious the word (digit sequences, keyboard walks), the higher the count; names, places and rare words are far lower.`, 'good'),
    );
    return r;
  },
};
