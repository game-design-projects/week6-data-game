export const MODES = [
  { key: 'transit', label: '公共交通', icon: '🚇' },
  { key: 'bike', label: '骑自行车', icon: '🚲' },
  { key: 'wfh', label: '居家办公', icon: '🏠' },
];

export default {
  meta: {
    num: 68,
    slug: 'commute-mode',
    title: 'Commute Mode',
    tagline: '给你一个美国县，猜猜上班族里多少人坐公交、骑车、在家办公。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '今天给出一个美国县的人口、通勤人数和“独自开车”的比例。',
      '依次拖动滑块，猜该县上班族中乘公共交通、骑自行车、居家办公各占百分之几（对数刻度，小数值也能精细调）。',
      '计分按倍数误差：猜得越接近真实比例分越高，三项取平均。',
      '提示：开车占大头时，其余方式加起来不会超过剩下的比例；大城市和大学城骑车多，疫情后白领县居家办公比例高。',
    ],
    scoring: '每项按“差几倍”计分：正好 100，差 2 倍约 37 分，三项取平均。',
    sources: [
      { name: 'U.S. Census Bureau, ACS 5-year 2019–2023, Table B08301 (Means of Transportation to Work)', url: 'https://data.census.gov/table/ACSDT5Y2023.B08301' },
      { name: 'U.S. Census Bureau, ACS Table B01003 (Total Population)', url: 'https://data.census.gov/table/ACSDT5Y2023.B01003' },
    ],
    dataNote: '数据为 ACS 2019–2023 五年估计，含抽样误差；只收录通勤人数 ≥ 4 万且骑车占比 ≥ 0.2% 的县。居家办公比例包含疫情期间的大幅上升。',
  },

  puzzle({ data, pick }) {
    const c = pick(data.counties);
    return { i: data.counties.indexOf(c) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const c = ctx.data.counties[p.i];
    ctx.log('county', c.name, c.state, { transit: c.transit, bike: c.bike, wfh: c.wfh });
    ctx.stage.append(ui.panel({ kicker: '今天的县', title: `${c.name}，${c.state}` },
      ui.grid(110,
        ui.stat({ label: '人口', value: c.pop ? core.fmtCompact(c.pop) : '—' }),
        ui.stat({ label: '上班族', value: core.fmtCompact(c.workers) }),
        ui.stat({ label: '独自开车', value: `${c.drive}%`, sub: '已知' }),
        ui.stat({ label: '步行', value: `${c.walk}%`, sub: '已知' }))));
    const rs = [];
    for (const m of MODES) {
      rs.push(await ctx.estimate({
        title: `${m.icon} ${m.label}占多少？`,
        prompt: `${c.name} 的上班族里，${m.label}的比例是多少？`,
        answer: Math.max(c[m.key], 0.1), min: 0.1, max: 100, log: true, step: 0.1, initial: 5,
        format: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`,
        scoring: 'log', scale: 0.35,
      }));
    }
    const res = ctx.combine(rs);
    res.detail = ui.stack(
      ui.callout(`${c.name}，${c.state}：公交 ${c.transit}%、骑车 ${c.bike}%、居家 ${c.wfh}%。你的猜测：${rs.map((r) => r.summary).join(' / ')}`),
      ui.table({
        columns: [{ key: 'k', label: '通勤方式' }, { key: 'v', label: '占比', num: true }],
        rows: [['独自开车', c.drive], ['拼车', c.carpool], ['公共交通', c.transit], ['骑自行车', c.bike], ['步行', c.walk], ['居家办公', c.wfh], ['其他', c.other]].map(([k, v]) => ({ k, v: `${v}%` })),
      }),
      ui.h('div', { class: 'small muted' }, c.drive > 80 ? '开车占了八成以上：这类县公交和骑车通常都在 1% 以下。' : c.transit > 10 ? '公交占比超过一成：典型的大城市核心县，开车比例相应被压低。' : '开车比例不到极端高位，其余份额被步行、居家办公等分走。'));
    return res;
  },
};
