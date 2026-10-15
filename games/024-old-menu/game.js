// #24 Old Menu — historic NYPL menu: a restaurant, a year, an anchor price; estimate three other dishes.
export const usd = (v) => (v < 1 ? `${Math.round(v * 100)}¢` : `$${v.toFixed(2)}`);
// slider range by era (so the slider itself never reveals the answer, yet stays usable)
export const rangeFor = (y) => (y < 1930 ? { min: 0.02, max: 10 } : y < 1960 ? { min: 0.05, max: 25 } : { min: 0.1, max: 60 });
// price in today's dollars, or null before 1913 (no CPI series)
export const modern = (price, y, cpi) => (cpi && cpi[y] ? price * cpi[y] : null);
const money = (v) => (v >= 100 ? `$${Math.round(v)}` : `$${v.toFixed(2)}`);

export default {
  meta: {
    num: 24,
    slug: 'old-menu',
    title: 'Old Menu',
    tagline: 'A century-old menu: given the restaurant, the year and one dish\'s price, guess what three other dishes cost.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'Read the restaurant, place and year; the menu first gives you the real price of one dish as a reference.',
      'Estimate the prices of three more dishes in turn (a log slider, where each step is a fixed multiple of the last; you can also type a number). Every menu is priced in US dollars.',
      'Meat, seafood and main courses usually cost much more than bread, sides and desserts: use the reference price and each dish\'s \u201cclass\u201d to scale. If a \u201ctoday\u2019s dollars\u201d conversion is shown, use it to get a feel for what a dollar bought back then.',
    ],
    scoring: 'Each dish is scored by how many times your guess differs from the real price (log scale): 1.25\u00d7 off is about 76 points, 2\u00d7 off about 42, 10\u00d7 off about 6. The three add up to a maximum of 300.',
    sources: [
      { name: 'NYPL \u201cWhat\u2019s on the Menu?\u201d dataset', url: 'https://menus.nypl.org/data', note: 'Snapshot of Mar 16, 2023: the Menu / MenuPage / MenuItem / Dish tables' },
      { name: 'US CPI-U monthly index (datasets/cpi-us, from BLS)', url: 'https://github.com/datasets/cpi-us', note: 'From 1913; used to convert to today\'s dollars' },
    ],
    dataNote: 'From about 17,000 menus, we keep those priced in US dollars (or from US locations), dated 1880\u20131990, with more than 9 priced food items, and take 4 dishes from each: 1 mid-range dish as the reference, and 3 more from cheapest to priciest. Drinks are dropped because bottle/glass pricing is inconsistent, leaving food only. Prices are as printed on the menu (US dollars) and have not been proofread by hand; today\'s dollars use the CPI, and before 1913 there is no CPI series, so no conversion is shown.',
  },

  puzzle({ data, pick }) {
    return { menu: pick(data.menus), cpi: data.cpi, cpiBase: data.cpiBase };
  },

  async play(ctx, { menu, cpi, cpiBase }) {
    const { ui } = ctx;
    const [anchor, ...targets] = menu.d;
    const norm = (t) => String(t || '').trim().toLowerCase();
    const f = cpi && cpi[menu.y];
    ctx.log('menu', menu.id, menu.who, menu.y);
    ctx.stage.append(
      ui.panel({ kicker: `${menu.y}`, title: menu.who },
        ui.kv([
          ...(menu.where && norm(menu.where) !== norm(menu.who) ? [['Place', menu.where]] : []),
          ['Occasion', menu.ev || 'Daily menu'],
          ['Year', `${menu.y} (${2026 - menu.y} years ago)`],
          ['Prices', f ? `$1 that year is about $${f.toFixed(2)} today` : 'No CPI data before 1913, so no conversion'],
          ['Reference', ui.h('span', {}, `${anchor[0]} = `, ui.h('b', { class: 'mono' }, usd(anchor[1])))],
        ])));

    const { min, max } = rangeFor(menu.y);
    const rs = [];
    for (let i = 0; i < targets.length; i++) {
      const [name, price] = targets[i];
      const r = await ctx.estimate({
        title: `Dish ${i + 1} of 3: ${name}`,
        prompt: `In ${menu.y}, ${anchor[0]} on the same menu sold for ${usd(anchor[1])}. What did this one cost?`,
        answer: price, min, max, log: true, step: 0.01, initial: anchor[1],
        format: usd, scoring: 'log', scale: 0.35,
      });
      ctx.log('estimate', name, price, r.guess);
      rs.push(r);
    }
    const res = ctx.combine(rs);
    const hi = targets.reduce((a, b) => (b[1] > a[1] ? b : a));
    const lo = targets.reduce((a, b) => (b[1] < a[1] ? b : a));
    const cols = [{ key: 'n', label: 'Dish' }, { key: 'p', label: 'Price', num: true }, { key: 'r', label: 'vs. ref.', num: true }, { key: 'k', label: 'Pricier than', num: true }];
    if (f) cols.push({ key: 'm', label: 'Today', num: true });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: cols,
        rows: menu.d.map(([n, p, pct], i) => ({
          n: i ? n : `${n} (reference)`, p: usd(p), r: i ? `×${(p / anchor[1]).toFixed(2)}` : '×1',
          k: `${pct}%`, m: f ? money(p * f) : '',
        })),
      }),
      ui.callout(`This menu has ${menu.n} priced food items. ${hi[0]} (${usd(hi[1])}) costs ${(hi[1] / lo[1]).toFixed(1)}\u00d7 as much as ${lo[0]} (${usd(lo[1])}). `
        + `The reference dish, ${anchor[0]}, is pricier than ${anchor[2]}% of the menu, so mains, meat and seafood ranked above it cost more, and sides, bread and desserts ranked below it cost less. `
        + (f ? `In today\'s dollars the reference dish is about ${money(anchor[1] * f)}; when estimating, think \u201cwhat would this dish cost today?\u201d and divide by ${f.toFixed(1)}.` : ''),
        'good'));
    return res;
  },
};
