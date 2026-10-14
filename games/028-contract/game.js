// #28 Contract — read a real federal contract description, guess the dollar amount on a log scale.
export const BUCKETS = 8;

/** Pick `n` awards from distinct magnitude buckets so every day spans small and huge contracts. */
export function pickSet(awards, rng, n = 3) {
  const byB = Array.from({ length: BUCKETS }, () => []);
  awards.forEach((a, i) => byB[a.b].push(i));
  const bs = rng.sample([...Array(BUCKETS).keys()].filter((b) => byB[b].length), n);
  return bs.sort((x, y) => x - y).map((b) => rng.pick(byB[b]));
}

/** Within what factor was the guess? (symmetric, >= 1) */
export const factorOff = (guess, answer) => Math.exp(Math.abs(Math.log(guess / answer)));

const title = (s) => s.toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

export default {
  meta: {
    num: 28,
    slug: 'contract',
    title: 'Contract',
    tagline: '一份真实的美国联邦采购合同描述，猜它值多少钱——按对数刻度计分。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天 3 份联邦合同，金额从几千美元到几十亿美元不等。',
      '读合同描述、采购机构、商品/服务类别和承包商，拖动滑块（对数刻度）或直接输入金额。',
      '差几倍比差多少美元重要：猜 2 倍以内得高分，差 10 倍以上基本拿不到分。',
      '线索：“MINIMUM GUARANTEE”、“BPA”、“IDIQ” 往往是小额保底或超大框架；“PURCHASE ORDER” 多半不大。',
    ],
    scoring: '每份合同 100 分：按猜测与真实金额之比的对数衰减（差 4 倍 ≈ 37 分），3 份取平均。',
    sources: [
      { name: 'USAspending.gov API — spending_by_award', url: 'https://api.usaspending.gov/', note: '2024 财年的合同类授予（award type A–D）' },
    ],
    dataNote: '金额为该合同授予的 Award Amount（累计授予额），按对数分桶抽样以保证量级分布均匀，不代表联邦合同的真实分布。',
  },

  puzzle({ data, rng }) {
    return { ids: pickSet(data.awards, rng, 3) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const results = [];
    const awards = p.ids.map((i) => ctx.data.awards[i]);
    ctx.log('contracts', awards.map((a) => a.id));
    for (const [i, a] of awards.entries()) {
      const box = ui.h('div', { class: 'ds-stack' });
      ctx.stage.append(ui.panel({ kicker: `合同 ${i + 1} / ${awards.length}`, title: a.ag },
        ui.quote(a.desc),
        ui.kv([
          ['承包商', a.rec],
          ['商品/服务', a.psc ? title(a.psc) : '—'],
          ['行业 (NAICS)', a.naics ? title(a.naics) : '—'],
          ['履约地', a.st || '—'],
          ['开始日期', a.date],
        ]), box));
      const r = await ctx.estimate({
        title: '这份合同值多少美元？',
        answer: a.amt, min: 1000, max: 5e9, log: true, initial: 1e5, step: 1,
        unit: '$', format: (v) => core.fmtMoney(v), scoring: 'log', scale: 0.6, container: box,
      });
      const f = factorOff(r.guess, a.amt);
      ctx.log('guess', { id: a.id, guess: r.guess, answer: a.amt, factor: f });
      r.detail = `${core.fmtMoney(a.amt)}（你猜 ${core.fmtMoney(r.guess)}，差 ${f.toFixed(1)} 倍）`;
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.table({
      columns: [{ key: 'ag', label: '机构' }, { key: 'rec', label: '承包商' }, { key: 'amt', label: '真实金额', num: true }, { key: 'guess', label: '你猜', num: true }, { key: 'x', label: '差距', num: true }],
      rows: awards.map((a, i) => ({ ag: a.ag, rec: a.rec, amt: core.fmtMoney(a.amt), guess: core.fmtMoney(results[i].guess), x: `${factorOff(results[i].guess, a.amt).toFixed(1)}×` })),
    });
    res.detail = ui.h('div', { class: 'ds-stack' }, res.detail,
      ui.h('div', { class: 'small muted' }, '规律：描述里的 “MINIMUM GUARANTEE / BPA / IDIQ” 是保底或框架合同，实际金额与描述的“规模感”常常脱节；大额合同几乎都来自国防部、能源部的设备、研发和长期服务。'));
    return res;
  },
};
