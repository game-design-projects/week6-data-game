// #32 Basket — spend exactly $20 at the grocery prices of a past year (a knapsack with history).
import { solveExact, scoreGap } from './solve.mjs';

const usd = (c) => `$${(c / 100).toFixed(2)}`;
export { scoreGap };

export default {
  meta: {
    num: 32,
    slug: 'basket',
    title: 'Basket',
    tagline: '给你一个年份和 $20，按那年的真实物价买菜，要求正好花完。带历史的背包问题。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '今天抽到一个年份，货架上有 8 样食品，标着那一年美国的全国平均价格。',
      '用 +/− 把商品放进篮子，每样最多 10 件，至少买 4 种不同的东西，总价不能超过 $20。',
      '目标是花得正好 $20.00。看价格的末位数字：它们决定了能不能凑成整数分。',
      '点「结账」交卷。',
    ],
    scoring: '正好 $20.00 得 100 分；每差 1 美分扣 6 分，差 17 美分以上得 0 分。',
    sources: [
      { name: 'BLS Average Price Data (series APU0000…)', url: 'https://download.bls.gov/pub/time.series/ap/', note: '美国全国城市平均价格，各年 12 个月均值，四舍五入到分' },
    ],
    dataNote: '价格是 BLS 全国平均价，每个商品每年取 12 个月的平均值。每道题在生成时已用动态规划验证，至少存在 40 种正好 $20.00 的合法购买方案。价格是历史数据，不随日期变化，所以没有做实时抓取（BLS 公共 API 虽可跨域，但免密钥版每天只有 25 次查询，且今天的题目不依赖最新月份）。',
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
    ctx.stage.append(ui.panel({ kicker: `${p.year} 年`, title: '那一年的物价' },
      ui.h('div', { class: 'ink2 small' }, `你有 $20.00，货架上是 ${p.year} 年的价格。下图把各商品价格设为 ${p.year} 年 = 100，看看它们后来涨了多少（不同商品涨幅不同，所以今天的 $20 早已不是当年的 $20）。`),
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
    const btn = ui.button('结账', { variant: 'accent', onClick: () => finish() });
    const qEls = [], rowEls = [], minus = [], plus = [];

    const refresh = () => {
      const s = spent(), left = budget - s;
      remainEl.textContent = `${usd(s)} / ${usd(budget)}　还剩 ${usd(left)}`;
      barEl.style.width = `${(100 * s) / budget}%`;
      items.forEach((it, i) => {
        qEls[i].textContent = qty[i];
        minus[i].disabled = qty[i] === 0;
        plus[i].disabled = qty[i] >= maxQty || it.cents > left;
        rowEls[i].style.opacity = plus[i].disabled && qty[i] === 0 ? 0.45 : 1;
      });
      const k = kinds();
      btn.disabled = k < minKinds;
      msgEl.textContent = left === 0 && k >= minKinds ? '正好 $20.00！可以结账了。' : k < minKinds ? `至少买 ${minKinds} 种不同的商品（现在 ${k} 种）。` : `还差 ${usd(left)} 才花完。`;
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
    ctx.stage.append(ui.panel({ kicker: '购物', title: '你的篮子' },
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
      const ex = items.map((it, i) => (solQty[i] ? `${solQty[i]}× ${it.name}` : null)).filter(Boolean).join('、');
      const arith = items.map((it, i) => (solQty[i] ? `${solQty[i]}×${it.cents}¢` : null)).filter(Boolean).join(' + ') + ' = 2000¢';
      const main = items.reduce((b, it, i) => (solQty[i] * it.cents > b.v ? { v: solQty[i] * it.cents, it } : b), { v: 0, it: null }).it;
      const tails = items.map((it) => `${it.name} …${it.cents % 10}`).join('，');
      const miss = gap === 0 ? '你已经凑齐了。' : `你还差 ${gap} 美分：试着把一件价格末位合适的商品换成另一件，让总价末位变成 0。`;
      const res = {
        score, max: 100, win: gap === 0,
        emoji: gap === 0 ? '🧺✅' : `🧺${gap}¢`,
        summary: gap === 0 ? `正好 $20.00（${p.year}）` : `${usd(s)}，差 ${usd(gap)}（${p.year}）`,
        detail: ui.kv([
          ['你买的', items.map((it, i) => (qty[i] ? `${qty[i]}× ${it.name}` : null)).filter(Boolean).join('、')],
          ['一种正好 $20.00 的买法', ex],
          ['算式', arith],
          ['怎么凑', `总价要等于 2000 美分，末位必须是 0。今天各商品价格的末位是：${tails}。示例解先让「${main.name}」（${main.cents}¢）撑起大头，再用末位互补的商品把「分」对齐到 0。${miss}`],
          ['有多少种解', `${p.n.toLocaleString('en-US')} 种合法买法（动态规划枚举）——越少越难。`],
          ['物价变迁', lastY ? `每样各买 1 件，${p.year} 年共 ${usd(total(p.year))}，${lastY} 年要 ${usd(total(lastY))}（${(total(lastY) / total(p.year)).toFixed(1)} 倍）。` : ''],
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
