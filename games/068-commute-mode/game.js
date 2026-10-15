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
      '拖动或输入数字，猜该县上班族中乘公共交通、骑自行车、居家办公各占百分之几（对数刻度，小数值也能精细调）。',
      '三个滑块同屏，各自提交；计分按倍数误差，猜得越接近真实比例分越高，三项取平均。',
      '提示：三项加起来不会超过“剩余份额”；大城市和大学城骑车多，疫情后白领县居家办公比例高。',
    ],
    scoring: '每项按“差几倍”计分：正好 100，差 2 倍约 37 分，三项取平均。',
    sources: [
      { name: 'U.S. Census Bureau, ACS 5-year 2019–2023, Table B08301 (Means of Transportation to Work)', url: 'https://data.census.gov/table/ACSDT5Y2023.B08301' },
      { name: 'U.S. Census Bureau, ACS Table B01003 (Total Population)', url: 'https://data.census.gov/table/ACSDT5Y2023.B01003' },
    ],
    dataNote: '数据为 ACS 2019–2023 五年估计，含抽样误差；只收录通勤人数 ≥ 2.5 万、且公交/骑车/居家办公占比都 ≥ 0.2% 的县（共 400 个，保证答案不会被滑块下限 0.1% 截断）。已尝试 api.census.gov 实时接口：需要 API key（302 到 missing_key），且 ACS 五年估计本身不按天更新，故保留快照。居家办公比例包含疫情期间的大幅上升。',
  },

  puzzle({ data, pick }) {
    const c = pick(data.counties);
    return { i: data.counties.indexOf(c) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const c = ctx.data.counties[p.i];
    ctx.log('county', c.name, c.state, { transit: c.transit, bike: c.bike, wfh: c.wfh });
    const left = leftover(c);
    ctx.stage.append(ui.panel({ kicker: '今天的县', title: `${c.name}，${c.state}` },
      ui.grid(110,
        ui.stat({ label: '人口', value: c.pop ? core.fmtCompact(c.pop) : '—' }),
        ui.stat({ label: '上班族', value: core.fmtCompact(c.workers) }),
        ui.stat({ label: '独自开车', value: `${c.drive}%`, sub: '已知' }),
        ui.stat({ label: '步行', value: `${c.walk}%`, sub: '已知' })),
      ui.h('p', { class: 'small muted', style: { marginTop: '10px' } },
        `开车、拼车、步行和其他方式之外，剩下的约 ${left}% 要分给公交、骑车和居家办公——三项加起来不会超过它。`)));
    const box = ui.h('div', { class: 'ds-stack' });
    ctx.stage.append(box);
    const rs = await Promise.all(MODES.map((m) => ctx.estimate({
      title: `${m.icon} ${m.label}占多少？`,
      prompt: `${c.name} 的上班族里，${m.label}的比例是多少？`,
      container: box,
      answer: c[m.key], min: 0.1, max: 100, log: true, step: 0.1, initial: 5,
      format: (v) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`,
      scoring: 'log', scale: 0.35,
    })));
    const res = ctx.combine(rs);
    const med = (k) => { const a = ctx.data.counties.map((x) => x[k]).sort((x, y) => x - y); return a[a.length >> 1]; };
    res.detail = ui.stack(
      ui.callout(`${c.name}，${c.state}：公交 ${c.transit}%、骑车 ${c.bike}%、居家 ${c.wfh}%。你的得分：${rs.map((r, i) => `${MODES[i].label} ${r.summary}`).join(' / ')}`),
      ui.table({
        columns: [{ key: 'k', label: '通勤方式' }, { key: 'v', label: '占比', num: true }, { key: 'm', label: '样本县中位数', num: true }],
        rows: [['独自开车', c.drive, med('drive')], ['拼车', c.carpool, med('carpool')], ['公共交通', c.transit, med('transit')], ['骑自行车', c.bike, med('bike')], ['步行', c.walk, med('walk')], ['居家办公', c.wfh, med('wfh')], ['其他', c.other, med('other')]].map(([k, v, m]) => ({ k, v: `${v}%`, m: `${m}%` })),
      }),
      ui.h('div', { class: 'small muted' }, explain(c, med)));
    return res;
  },
};

/** share left for transit + bike + wfh after the four "known" categories */
export function leftover(c) { return +(100 - c.drive - c.carpool - c.walk - c.other).toFixed(1); }

/** puzzle-specific teaching text */
export function explain(c, med) {
  const left = leftover(c);
  const bits = [];
  bits.push(c.drive > 80 ? `独自开车高达 ${c.drive}%，公交和骑车几乎没有空间。` : c.drive < 60 ? `独自开车只有 ${c.drive}%，明显低于一般水平，说明有别的方式在分流。` : `独自开车 ${c.drive}%，处在常见区间。`);
  bits.push(c.transit >= 10 ? `公交占 ${c.transit}%，是典型的大城市核心县（样本中位数 ${med('transit')}%）。` : `公交只有 ${c.transit}%，低于一成，多数通勤靠汽车。`);
  bits.push(c.bike >= 2 ? `骑车占 ${c.bike}%，远高于样本中位数 ${med('bike')}%，常见于大学城或自行车友好城市。` : `骑车仅 ${c.bike}%，大多数县都在 1% 以内。`);
  bits.push(c.wfh >= 15 ? `居家办公 ${c.wfh}%，白领和科技从业者多的县疫情后明显偏高。` : `居家办公 ${c.wfh}%（样本中位数 ${med('wfh')}%）。`);
  bits.push(`三项合计 ${+(c.transit + c.bike + c.wfh).toFixed(1)}%，没有超过剩余的 ${left}%。`);
  return bits.join('');
}
