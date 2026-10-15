// #31 Rent Index — guess a county's HUD Fair Market Rent for a 2-bedroom, then three higher/lower duels.

export const N_DUELS = 4;
export const EST_MAX = 80;
export const DUEL_PTS = 5;

/** Pick `n` distinct rivals whose 2BR FMR differs from the target by 8%–60% (close enough to need thought, never a tie). */
export function pickRivals(counties, target, rng, n = N_DUELS, minGap = 0.08, maxGap = 0.6) {
  const gap = (c) => Math.abs(c.fmr[2] - target.fmr[2]) / target.fmr[2];
  let ok = counties.filter((c) => c !== target && gap(c) >= minGap && gap(c) <= maxGap);
  if (ok.length < n) ok = counties.filter((c) => c !== target && gap(c) >= minGap);
  return rng.sample(ok, n);
}

/** Rescale to a 100-point total: estimate 80 + 5 per duel. */
export function scaleStages(est, duels) {
  const e = { ...est, score: Math.round((est.score / (est.max || 100)) * EST_MAX), max: EST_MAX };
  const d = { ...duels, score: duels.score * DUEL_PTS, max: duels.max * DUEL_PTS };
  return [e, d];
}

const pct = (a, b) => Math.round((a / b - 1) * 100);

export default {
  meta: {
    num: 31,
    slug: 'rent-index',
    title: 'Rent Index',
    tagline: '猜一个美国县的两居室公平市场租金（HUD FMR），再比四组高低。',
    category: 'money',
    data: 'snapshot',
    howTo: [
      '给你一个美国县（或新英格兰的镇）的名称、州、人口和所属租金区。猜它两居室的月租金（HUD 公平市场租金，FY2026）。',
      '最多 3 次机会，每次猜完会告诉你该调高还是调低；多用一次扣 10% 的分。',
      '接着是四道比大小：这个县和另一个县，谁的两居室租金更高。',
      '计分满分 100：估值 80 分（约偏 20% 得 30 分）+ 比大小每题 5 分。',
    ],
    scoring: '估值 80 分（按百分比误差衰减，多猜一次扣 10%）+ 比大小每题答对 5 分，共 100 分。',
    sources: [{ name: 'HUD Fair Market Rents FY2026（县级）', url: 'https://www.huduser.gov/portal/datasets/fmr.html', note: 'FY26_FMRs_revised.xlsx，含 2023 年人口' }],
    dataNote: 'FMR 是 HUD 为住房补贴设定的约第 40 百分位的市场租金，不等于平均租金。数据只含人口 ≥ 4 万的县（新英格兰为镇；不含关岛等海外领地）。同一个租金区内的县共用同一个 FMR。HUD 官方 API 需要令牌且无 CORS，所以使用官网发布的 xlsx 快照。',
  },

  puzzle({ data, pick, rng }) {
    const c = pick(data.counties);
    const rivals = pickRivals(data.counties, c, rng).map((r) => data.counties.indexOf(r));
    return { i: data.counties.indexOf(c), rivals };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const c = D.counties[p.i];
    const $ = (v) => core.fmtMoney(v);
    ctx.log('county', c.name, c.st, c.fmr[2]);

    ctx.stage.append(ui.panel({ kicker: 'HUD FY2026 · 两居室月租', title: `${c.name}，${c.st}` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px' } },
        ui.stat({ label: '人口', value: core.fmtCompact(c.pop), sub: '2023' }),
        ui.stat({ label: `${c.st} 州中位县`, value: $(D.stateMed[c.st]), sub: '两居室' }),
        ui.stat({ label: '全美中位县', value: $(D.nat), sub: '两居室' })),
      ui.h('p', { class: 'small ink2', style: { marginTop: '10px' } }, `所属租金区：${c.area}`)));

    const r1 = await ctx.estimate({
      title: '这个地区两居室的月租是多少？',
      answer: c.fmr[2], min: 300, max: 5000, log: true, step: 5, initial: D.nat,
      format: $, attempts: 3, scoring: 'pct', scale: 0.2, tolerance: 0.03,
    });

    const rivals = p.rivals.map((i) => D.counties[i]);
    const r2 = await ctx.rounds({
      title: '比大小',
      rounds: rivals.map((o, k) => {
        const flip = (p.i + k) % 2;
        const opts = flip ? [o, c] : [c, o];
        return {
          prompt: '谁的两居室租金更高？',
          options: opts.map((x) => ({ label: `${x.name}, ${x.st}`, sub: `人口 ${core.fmtCompact(x.pop)}` })),
          correct: opts[0].fmr[2] > opts[1].fmr[2] ? 0 : 1,
          explain: `${c.name} ${$(c.fmr[2])} vs ${o.name} ${$(o.fmr[2])}`,
        };
      }),
    });

    const [e, d] = scaleStages(r1, r2);
    const res = ctx.combine([e, d]);
    const ans = c.fmr[2];
    const sm = D.stateMed[c.st];
    const sameArea = D.counties.filter((x) => x !== c && x.area === c.area).length;
    const why = [
      `${c.name}两居室 ${$(ans)}，${pct(ans, sm) >= 0 ? '高于' : '低于'}${c.st} 州中位县（${$(sm)}）${Math.abs(pct(ans, sm))}%，${pct(ans, D.nat) >= 0 ? '高于' : '低于'}全美中位县（${$(D.nat)}）${Math.abs(pct(ans, D.nat))}%。`,
      ans > sm * 1.2 ? '明显高于本州中位县：多半是大都会核心或旅游/高收入地区，人口大、靠近就业中心的县通常更贵。'
        : ans < sm * 0.85 ? '低于本州中位县：偏农村或经济较弱的地区，租金随离大城市的距离衰减。'
        : '接近本州中位水平：线索里的州中位县就是很好的锚点。',
      c.metro ? '属于都会区：同一都会区内的县共用一个 FMR，邻县的价格是很好的参照。' : '不在大都会区内：租金主要由本地收入与住房存量决定。',
      `每多一间卧室，租金约涨 ${pct(c.fmr[3], c.fmr[2])}%（两居 → 三居）。`,
    ].join(' ');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', `${$(ans)} / 月`],
        ['你的估值', r1.guess != null ? $(r1.guess) : (r1.summary || '')],
        ['全部户型', `开间 ${$(c.fmr[0])} · 一居 ${$(c.fmr[1])} · 两居 ${$(c.fmr[2])} · 三居 ${$(c.fmr[3])} · 四居 ${$(c.fmr[4])}`],
        ['租金区', `${c.area}${sameArea ? `（池中另有 ${sameArea} 个县/镇同价）` : ''}`],
        ['规律', why]]));
    return res;
  },
};
