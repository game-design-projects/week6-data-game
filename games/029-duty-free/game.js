// #29 Duty Free — an absurdly specific line of the US tariff schedule; guess its duty rate.
const fmtRate = (r) => (r === 0 ? 'Free (0%)' : `${r}%`);

/** Per-item teaching text, specific to the line: chapter norm vs this line, column-2 and FTA hints. */
export function explain(it, data) {
  const ch = data.chapters[it.c];
  const name = data.names[it.c];
  const parts = [];
  if (ch) {
    const side = it.r === 0 ? 'duty-free' : it.r > ch.med ? `above the ${ch.med}% median` : it.r < ch.med ? `below the ${ch.med}% median` : 'exactly the median';
    parts.push(`Chapter ${it.c}, “${name}”, has ${ch.n} pure ad valorem lines: ${ch.free}% are duty-free, the median is ${ch.med}% and the highest is ${ch.max}%. This line is ${fmtRate(it.r)}, which is ${side}. `);
  }
  if (it.o != null) parts.push(`The Column 2 rate (for countries without normal trade relations) is ${fmtRate(it.o)}. `);
  if (it.f) parts.push('Imports from free-trade-agreement partners (such as Australia, Korea or Israel) can enter duty-free.');
  return parts.join('').trim();
}

export const SCALE = 3;
/** Score one guess (same curve as ctx.estimate 'abs' with scale SCALE). */
export const scoreGuess = (guess, answer) => Math.round(100 * Math.exp(-Math.abs(guess - answer) / SCALE));

export default {
  meta: {
    num: 29,
    slug: 'duty-free',
    title: 'Duty Free',
    tagline: 'An absurdly specific line from the US tariff schedule. Guess its import duty rate.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'Each day you get 3 product lines from the US Harmonized Tariff Schedule (HTS), described in laughably exact detail. The chapter and unit of quantity are given as clues.',
      'Use the slider or the input box to guess its general duty rate (%). Plenty of lines are actually duty-free (0%), and a few run past 30.',
      'You get one try per line. The answer is revealed right away, with the chapter\'s rate distribution and the Column 2 rate to explain the pattern.',
    ],
    scoring: 'Scored by absolute error: 0 points off scores 100, 3 points off about 37, 9 points off about 5. The three lines add up to 300.',
    sources: [{ name: 'USITC Harmonized Tariff Schedule (REST export)', url: 'https://hts.usitc.gov/reststop/exportList?from=0101&to=9999&format=JSON&styles=false', note: 'Lines whose Column 1 General rate is Free or a single percentage, deduplicated by 8-digit code' }],
    dataNote: 'Rates come from an HTS snapshot (date in data.json). Only lines whose rate is a single percentage or Free are included; lines with specific or compound duties are dropped, as are chapters 98 and 99 and catch-all “Other › Other” lines. The rates are the statutory general (MFN) rates and leave out the extra tariffs added in recent years under Section 301, 232 and similar authorities, so actual duties at the border may be higher. The schedule does not change daily, so there is no live API; each day\'s puzzle rotates through 90 fixed sets.',
  },

  puzzle({ data, pick }) {
    return { items: pick(data.puzzles).map((i) => data.items[i].h) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.items.map((x) => [x.h, x]));
    const results = [];
    const rows = [];
    for (let i = 0; i < p.items.length; i++) {
      const it = by.get(p.items[i]);
      ctx.log('item', it.h, it.r);
      const body = ui.h('div', { class: 'ds-stack' },
        ui.quote(it.d),
        ui.h('div', { class: 'small muted mono' }, `HTS ${it.h} · Chapter ${it.c}, ${ctx.data.names[it.c]}${it.u ? ` · unit: ${it.u}` : ''}`));
      const holder = ui.h('div');
      ctx.stage.append(holder);
      holder.append(ui.panel({ kicker: `Item ${i + 1} of ${p.items.length}`, title: 'What is the import duty on this item?' }, body));
      const r = await ctx.estimate({
        answer: it.r, min: 0, max: 40, step: 0.5, initial: 5, scoring: 'abs', scale: SCALE,
        attempts: 1, tolerance: 0.5, container: holder, title: 'Your guess', format: (v) => `${v}%`,
      });
      results.push(r);
      rows.push({ h: it.h, r: fmtRate(it.r), g: `${r.guess}%`, why: explain(it, ctx.data) });
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ...rows.map((row, i) => ui.h('div', { class: 'ds-stack' },
        ui.h('div', null, ui.h('b', null, `Item ${i + 1} · ${row.h}`), ` Actual ${row.r}, you guessed ${row.g}`),
        ui.h('div', { class: 'ink2 small' }, row.why))));
    return res;
  },
};
