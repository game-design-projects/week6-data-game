// #32 Basket — spend exactly $20 at the grocery prices of a past year (a knapsack with history).
import { solveExact, scoreGap } from './solve.mjs';

const usd = (c) => `$${(c / 100).toFixed(2)}`;
export { scoreGap };

export default {
  meta: {
    num: 32,
    slug: 'basket',
    title: 'Basket',
    tagline: 'A year and $20. Shop at that year\'s real grocery prices and spend exactly all of it. A knapsack puzzle with history.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'Today you get a year, and a shelf of 8 foods tagged with that year\'s national average US prices.',
      'Use +/− to put items in your basket: up to 10 of each, at least 4 different kinds, and a total no higher than $20.',
      'The goal is to spend exactly $20.00. Watch the last digit of each price: it decides whether the cents can add up.',
      'Tap "Check out" to hand in your basket.',
    ],
    scoring: 'Exactly $20.00 earns 100 points; every cent short costs 6, and 17 cents or more short earns 0.',
    sources: [
      { name: 'BLS Average Price Data (series APU0000…)', url: 'https://download.bls.gov/pub/time.series/ap/', note: 'US city average prices, 12-month mean for each year, rounded to the cent' },
    ],
    dataNote: 'Prices are BLS national averages, taking the 12-month mean for each item and year. Each puzzle was verified with dynamic programming when generated: at least 40 legal baskets add up to exactly $20.00. Prices are historical and do not change with the date, so nothing is fetched live (the BLS public API allows cross-origin calls, but the keyless tier allows only 25 queries a day, and today\'s puzzle does not depend on the latest month).',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { year: p.year, items: p.items, sol: p.sol, n: p.n };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const { budget, maxQty, minKinds } = data;
    const items = p.items.map((id) => ({ id, ...data.items[id], cents: data.items[id].p[p.year] }));
    const qty = items.map(() => 0);
    const spent = () => items.reduce((s, it, i) => s + it.cents * qty[i], 0);
    const kinds = () => qty.filter((q) => q > 0).length;
    ctx.log('basket start', p.year, items.map((i) => `${i.id}:${i.cents}`).join(' '));

    // clue: how each item's price moved, indexed to the puzzle year
    const hist = [];
    items.forEach((it) => { for (const [y, c] of Object.entries(it.p)) hist.push({ y: +y, item: it.name, idx: (100 * c) / it.cents }); });
    ctx.stage.append(ui.panel({ kicker: `${p.year}`, title: 'Prices that year' },
      ui.h('div', { class: 'ink2 small' }, `You have $20.00, and the shelf shows ${p.year} prices. The chart sets each item\'s price to ${p.year} = 100 and shows how much it rose later (items rose by different amounts, so today\'s $20 is long past being that year\'s $20).`),
      ui.h('div', { class: 'ds-row small', style: { gap: '4px 12px', flexWrap: 'wrap', margin: '8px 0 2px' } },
        ...items.map((it, i) => ui.h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } },
          ui.h('i', { style: { width: '14px', height: '3px', borderRadius: '2px', background: ui.colors().series[i % ui.colors().series.length] } }), it.name))),
      await ui.plot((Plot, c) => ({
        height: 220, marginLeft: 40,
        x: { label: null, tickFormat: 'd' }, y: { label: null, type: 'log' },
        color: { domain: items.map((i) => i.name), range: c.series },
        marks: [Plot.ruleY([100], { stroke: c.rule }), Plot.ruleX([p.year], { stroke: c.accent }),
          Plot.line(hist, { x: 'y', y: 'idx', stroke: 'item', strokeWidth: 1.6 })],
      }))));

    const remainEl = ui.h('span', { class: 'mono' });
    const barEl = ui.h('div', { style: { height: '8px', borderRadius: '4px', background: 'var(--accent)', width: '0%', transition: 'width .15s' } });
    const msgEl = ui.h('div', { class: 'small muted' });
    const btn = ui.button('Check out', { variant: 'accent', onClick: () => finish() });
    const qEls = [], rowEls = [], minus = [], plus = [];

    const refresh = () => {
      const s = spent(), left = budget - s;
      remainEl.textContent = `${usd(s)} / ${usd(budget)} · ${usd(left)} left`;
      barEl.style.width = `${(100 * s) / budget}%`;
      items.forEach((it, i) => {
        qEls[i].textContent = qty[i];
        minus[i].disabled = qty[i] === 0;
        plus[i].disabled = qty[i] >= maxQty || it.cents > left;
        rowEls[i].style.opacity = plus[i].disabled && qty[i] === 0 ? 0.45 : 1;
      });
      const k = kinds();
      btn.disabled = k < minKinds;
      msgEl.textContent = left === 0 && k >= minKinds ? 'Exactly $20.00! Ready to check out.' : k < minKinds ? `Buy at least ${minKinds} different items (you have ${k}).` : `${usd(left)} still to spend.`;
    };
    const step = (i, d) => { qty[i] += d; ctx.log('basket', items[i].id, qty[i]); refresh(); };

    const list = items.map((it, i) => {
      qEls[i] = ui.h('span', { class: 'mono', style: { minWidth: '1.6em', textAlign: 'center' } }, '0');
      minus[i] = ui.button('−', { small: true, variant: 'ghost', onClick: () => step(i, -1) });
      plus[i] = ui.button('+', { small: true, onClick: () => step(i, 1) });
      rowEls[i] = ui.h('div', { class: 'ds-row', style: { justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--rule)' } },
        ui.h('div', { style: { flex: 1, minWidth: 0 } }, ui.h('div', `${it.emoji} ${it.name}`), ui.h('div', { class: 'small muted mono' }, `${usd(it.cents)} / ${it.unit}`)),
        ui.h('div', { class: 'ds-row', style: { alignItems: 'center', gap: '6px' } }, minus[i], qEls[i], plus[i]));
      return rowEls[i];
    });

    let finish;
    const resultP = new Promise((resolve) => { finish = () => resolve(grade()); });
    ctx.stage.append(ui.panel({ kicker: 'Shopping', title: 'Your basket' },
      ui.h('div', { style: { position: 'sticky', top: 0, background: 'var(--card)', zIndex: 2, paddingBottom: '6px' } },
        remainEl, ui.h('div', { style: { background: 'var(--rule)', borderRadius: '4px', margin: '6px 0' } }, barEl), msgEl),
      ...list, ui.h('div', { style: { marginTop: '10px' } }, btn)));
    refresh();

    function grade() {
      const s = spent(), gap = budget - s, score = scoreGap(gap);
      ctx.log('basket graded', { spent: s, gap, score });
      const solQty = p.sol;
      const total = (y) => items.reduce((t, it) => t + (it.p[y] || 0), 0);
      const lastY = [2025, 2024, 2023].find((y) => items.every((it) => it.p[y]));
      const ex = items.map((it, i) => (solQty[i] ? `${solQty[i]}× ${it.name}` : null)).filter(Boolean).join(', ');
      const arith = items.map((it, i) => (solQty[i] ? `${solQty[i]}×${it.cents}¢` : null)).filter(Boolean).join(' + ') + ' = 2000¢';
      const main = items.reduce((b, it, i) => (solQty[i] * it.cents > b.v ? { v: solQty[i] * it.cents, it } : b), { v: 0, it: null }).it;
      const tails = items.map((it) => `${it.name} …${it.cents % 10}`).join(', ');
      const miss = gap === 0 ? 'You hit it exactly.' : `You were ${gap} ${gap === 1 ? 'cent' : 'cents'} short: try swapping one item for another whose last digit is right, so the total ends in 0.`;
      const res = {
        score, max: 100, win: gap === 0,
        emoji: gap === 0 ? '🧺✅' : `🧺${gap}¢`,
        summary: gap === 0 ? `Exactly $20.00 (${p.year})` : `${usd(s)}, ${usd(gap)} short (${p.year})`,
        detail: ui.kv([
          ['You bought', items.map((it, i) => (qty[i] ? `${qty[i]}× ${it.name}` : null)).filter(Boolean).join(', ')],
          ['An exact basket', ex],
          ['Sum', arith],
          ['Trick', `The total must equal 2000 cents, so it has to end in 0. Today\'s last price digits are: ${tails}. The example solution lets ${main.name} (${main.cents}¢) carry the bulk, then uses items with complementary last digits to bring the cents to 0. ${miss}`],
          ['Solutions', `${p.n.toLocaleString('en-US')} legal baskets (counted by dynamic programming); fewer means harder.`],
          ['Inflation', lastY ? `Buying one of each cost ${usd(total(p.year))} in ${p.year} and ${usd(total(lastY))} in ${lastY} (${(total(lastY) / total(p.year)).toFixed(1)}x).` : ''],
        ]),
      };
      return res;
    }
    if (ctx.autoplay) {
      p.sol.forEach((q, i) => { qty[i] = q; });
      refresh();
      await ctx.sleep(200);
      finish();
    }
    return resultP;
  },
};
