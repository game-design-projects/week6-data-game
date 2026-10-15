// #27 H-1B — guess the base salary on a real LCA (H-1B) filing from job, employer and city.
export const CITY_ZH = {
  'SAN FRANCISCO': '旧金山', 'NEW YORK': '纽约', SEATTLE: '西雅图', AUSTIN: '奥斯汀', CHICAGO: '芝加哥', BOSTON: '波士顿',
  ATLANTA: '亚特兰大', DALLAS: '达拉斯', HOUSTON: '休斯敦', 'SAN JOSE': '圣何塞', 'LOS ANGELES': '洛杉矶', DENVER: '丹佛',
};
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());

const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
const pctDiff = (a, b) => Math.round((a / b - 1) * 100);
const signed = (p) => (p >= 0 ? '+' : '−') + Math.abs(p) + '%';

/** Where a salary sits inside a cell's quartiles — for teaching text. */
export function where(sal, c) {
  if (sal < c.p25) return '低于该城市同职位的四分之一位';
  if (sal > c.p75) return '高于该城市同职位的四分之三位';
  return '落在该城市同职位的中间 50% 区间内';
}

/** Puzzle-specific explanation of which clue pointed to the answer. Pure. */
export function explain(x, cell, refs) {
  const parts = [];
  if (refs.length) {
    const avg = refs.reduce((s, r) => s + r.med, 0) / refs.length;
    const d = pctDiff(cell.med, avg);
    parts.push(Math.abs(d) < 5
      ? `这个城市的同职位中位数 ${money(cell.med)} 与参考表的平均水平 ${money(avg)} 相差无几，城市本身不提供加价线索。`
      : `这个城市的同职位中位数 ${money(cell.med)}，比参考表里 ${refs.length} 个城市的平均 ${money(avg)} ${d > 0 ? '高' : '低'} ${Math.abs(d)}%，这是城市溢价。`);
  }
  const vs = pctDiff(x.sal, cell.med);
  parts.push(Math.abs(vs) < 10
    ? '这份申请与城市中位数相差不到 10%。'
    : `这份申请比城市中位数${vs > 0 ? '高' : '低'} ${Math.abs(vs)}%，${vs > 0 ? '更像大公司或高职级岗位' : '更像小型咨询公司或初级岗位'}。`);
  if (x.empMed) {
    const e = pctDiff(x.sal, x.empMed);
    parts.push(`${titleCase(x.emp)} 在样本中另有 ${x.empN} 份申请，中位数 ${money(x.empMed)}，这份${Math.abs(e) < 10 ? '与之接近，雇主档次是可靠线索' : (e > 0 ? '明显高于' : '明显低于') + '它（' + signed(e) + '），职位或城市拉开了差距'}。`);
  } else {
    parts.push('这个雇主在样本里没有足够的其他申请，只能靠职位和城市判断。');
  }
  return parts.join('');
}

const fmtDate = (iso) => `${iso.slice(0, 4)} 年 ${+iso.slice(5, 7)} 月 ${+iso.slice(8)} 日`;

export default {
  meta: {
    num: 27,
    slug: 'h-1b',
    title: 'H-1B',
    tagline: '一份真实的 H-1B 劳工条件申请（LCA）：给你职位、雇主和城市，猜它申报的年薪。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '每天一份美国劳工部公开的 LCA 申请：职位、雇主、工作城市、提交日期，以及该雇主在样本里的其他申请。',
      '参考栏给出同一职位在另外几个城市的申报工资中位数：先判断这个城市比它们贵还是便宜，再看雇主档次。',
      '拖动滑块（对数刻度）或直接输入你认为的申报年薪，提交后揭晓。',
      '按相对误差计分：误差 0% 得 100 分，差约 30% 剩约 37 分。',
    ],
    scoring: '100 × e^(−|猜测−实际| / (0.3 × 实际))，近似按百分比误差。',
    sources: [
      { name: 'US DOL OFLC LCA Disclosure Data', url: 'https://www.dol.gov/agencies/eta/foreign-labor/performance' },
      { name: 'h1bdata.info（LCA 公开数据镜像，2024 年提交的申请）', url: 'https://h1bdata.info/' },
    ],
    dataNote: '数据来自 h1bdata.info 对 DOL LCA 披露数据（2024 年提交的申请）的检索；DOL 官网对脚本返回 403，无法直接下载。覆盖 15 类职位 × 12 个城市，所有中位数和“雇主其他申请”都只基于抓取到的样本，不是 DOL 全量数据。仅含申报的基础年薪，不含奖金和股票。因此本游戏是单一估值题，而不是分别猜雇主和城市。',
  },

  puzzle({ data, pick, rng }) {
    const x = pick(data.puzzles);
    const others = Object.entries(data.cells[x.q] || {}).filter(([c]) => c !== x.city).map(([city, c]) => ({ city, med: c.med, n: c.n }));
    const refs = rng.sample(others, Math.min(5, others.length)).sort((a, b) => b.med - a.med);
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
          ['提交日期', fmtDate(x.date)],
          ['雇主的其他申请', x.empMed ? `样本中另有 ${x.empN} 份，中位数 ${core.fmtMoney(x.empMed)}（含其他职位和城市）` : (x.empN ? `样本中另有 ${x.empN} 份（不足以给出中位数）` : '样本中没有其他申请')],
          ['同城同职位样本量', `${cell.n} 份`],
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
      answer: x.sal, min: 40000, max: 400000, log: true, step: 1000, initial: 120000,
      format: (v) => core.fmtMoney(v), scoring: 'pct', scale: 0.3,
    });
    res.detail = ui.kv([
      ['实际申报', core.fmtMoney(x.sal)],
      ['同城同职位', `中位数 ${core.fmtMoney(cell.med)}（${core.fmtMoney(cell.p25)} – ${core.fmtMoney(cell.p75)}），这份${where(x.sal, cell)}`],
      ['规律', explain(x, cell, p.refs)],
      ['案件编号', x.id],
    ]);
    return res;
  },
};
