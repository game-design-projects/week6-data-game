// #27 H-1B — guess the base salary on a real LCA (H-1B) filing from job, employer and city.
export const CITY_ZH = {
  'SAN FRANCISCO': '旧金山', 'NEW YORK': '纽约', SEATTLE: '西雅图', AUSTIN: '奥斯汀', CHICAGO: '芝加哥', BOSTON: '波士顿',
  ATLANTA: '亚特兰大', DALLAS: '达拉斯', HOUSTON: '休斯敦', 'SAN JOSE': '圣何塞', 'LOS ANGELES': '洛杉矶', DENVER: '丹佛',
};
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());

/** Percentile (0-100) of a salary inside a cell's quartiles — rough, for teaching text. */
export function where(sal, c) {
  if (sal < c.p25) return '低于该城市同职位的四分之一位';
  if (sal > c.p75) return '高于该城市同职位的四分之三位';
  return '落在该城市同职位的中间 50% 区间内';
}

export default {
  meta: {
    num: 27,
    slug: 'h-1b',
    title: 'H-1B',
    tagline: '一份真实的 H-1B 劳工条件申请（LCA）：给你职位、雇主和城市，猜它申报的年薪。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天一份美国劳工部公开的 LCA 申请：职位、雇主、工作城市、提交日期。',
      '参考栏给出同一类职位在其他城市的申报工资中位数——城市差价和雇主档次是关键线索。',
      '拖动滑块（对数刻度）或直接输入你认为的申报年薪，提交后揭晓。',
      '按相对误差计分：误差 0% 得 100 分，差约 30% 剩约 37 分。',
    ],
    scoring: '100 × e^(−|猜测−实际| / (0.3 × 实际))，近似按百分比误差。',
    sources: [
      { name: 'US DOL OFLC LCA Disclosure Data', url: 'https://www.dol.gov/agencies/eta/foreign-labor/performance' },
      { name: 'h1bdata.info（LCA 公开数据镜像，FY2024 申请）', url: 'https://h1bdata.info/' },
    ],
    dataNote: '数据来自 h1bdata.info 对 DOL LCA 披露数据的检索（DOL 官网拒绝脚本下载）。仅含申报的基础年薪，不含奖金和股票；中位数基于抓取到的同职位同城市申请。',
  },

  puzzle({ data, pick, rng }) {
    const x = pick(data.puzzles);
    const others = Object.entries(data.cells[x.q] || {}).filter(([c]) => c !== x.city).map(([city, c]) => ({ city, med: c.med, n: c.n }));
    const refs = rng.sample(others, Math.min(4, others.length)).sort((a, b) => b.med - a.med);
    return { x, refs };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const { x } = p;
    const cell = ctx.data.cells[x.q][x.city];
    ctx.log('puzzle', x.id, x.emp, x.city, x.sal);
    ctx.stage.append(
      ui.panel({ kicker: 'LCA 申请', title: titleCase(x.title) },
        ui.kv([
          ['雇主', titleCase(x.emp)],
          ['工作城市', `${CITY_ZH[x.city] || x.city}（${titleCase(x.city)}）`],
          ['提交日期', x.date],
          ['同城同类职位申请数', `${cell.n} 份（抓取样本）`],
        ])),
      ui.panel({ kicker: '参考', title: `“${titleCase(x.q)}”在其他城市的申报工资中位数` },
        ui.table({
          columns: [{ key: 'city', label: '城市' }, { key: 'med', label: '中位数', num: true }],
          rows: p.refs.map((r) => ({ city: CITY_ZH[r.city] || r.city, med: core.fmtMoney(r.med) })),
        })),
    );
    const res = await ctx.estimate({
      title: '这份申请的年薪是多少？',
      prompt: '基础年薪（美元，不含奖金和股票）。',
      answer: x.sal, min: 30000, max: 500000, log: true, step: 1000, initial: 120000,
      format: (v) => core.fmtMoney(v), scoring: 'pct', scale: 0.3,
    });
    res.detail = ui.kv([
      ['实际申报', core.fmtMoney(x.sal)],
      ['同城同职位', `中位数 ${core.fmtMoney(cell.med)}（${core.fmtMoney(cell.p25)} – ${core.fmtMoney(cell.p75)}），这份${where(x.sal, cell)}`],
      ['规律', x.sal > cell.med ? '雇主档次与职级（Senior / Staff / Lead）往往把工资推到城市中位数之上。' : '小型咨询公司和低职级岗位常常低于城市中位数；城市物价差异也体现在其中。'],
      ['案件编号', x.id],
    ]);
    return res;
  },
};
