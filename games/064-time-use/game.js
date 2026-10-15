// #64 Time Use — guess how many minutes a day a group of Americans spends on an activity (BLS ATUS).
import { ACT, SLEEP } from './acts.js';

export { ACT };
const AGE = { '000': '15 岁及以上', 103: '15–24 岁', '031': '25–34 岁', '038': '35–44 岁', '042': '45–54 岁', '049': '55–64 岁', '065': '65 岁及以上' };
const SEX = ['男女合计', '男性', '女性'];
export const MIN_MEAN = 5; // activities averaging < 5 min/day are too small to estimate fairly
export const SCALE = 0.3; // log10 error scale: 2x off ~ 37 pts
export const ageLabel = (a) => AGE[a];
export const sexLabel = (s) => SEX[s];
export const fmtHM = (m) => (m < 60 ? `${m} 分钟` : m % 60 === 0 ? `${m / 60} 小时` : `${Math.floor(m / 60)} 小时 ${m % 60} 分`);
export const eligible = (g) => Object.keys(g.v).filter((k) => ACT[k] && g.v[k][0] >= MIN_MEAN);
export const whoLabel = (g) => `美国 · ${g.y} 年 · ${SEX[g.s]} · ${AGE[g.a]}`;
export const findGroup = (groups, p) => groups.find((x) => x.y === p.y && x.s === p.s && x.a === p.a);

/** Why the number is what it is: participation × time-per-doer, versus all US adults of the same year. */
export function explain(cell, base) {
  const [mean, rate, doer] = cell;
  let t;
  if (rate < 15) t = `只有 ${rate}% 的人当天做了这件事，做的人平均 ${fmtHM(doer)}，摊到所有人头上只剩 ${fmtHM(mean)}。`;
  else if (rate >= 85) t = `${rate}% 的人当天都做了，所以全体平均（${fmtHM(mean)}）和做的人平均（${fmtHM(doer)}）几乎一样。`;
  else t = `${rate}% 的人当天做了，做的人平均 ${fmtHM(doer)}；没做的人按 0 算，全体平均 ${fmtHM(mean)}。`;
  if (base && base !== cell) {
    const r = mean / base[0];
    if (r >= 1.25) t += ` 比同年全体 15 岁以上美国人（${fmtHM(base[0])}）多约 ${Math.round((r - 1) * 100)}%。`;
    else if (r <= 0.8) t += ` 比同年全体 15 岁以上美国人（${fmtHM(base[0])}）少约 ${Math.round((1 - r) * 100)}%。`;
  }
  return t;
}

export default {
  meta: {
    num: 64,
    slug: 'time-use',
    title: 'Time Use',
    tagline: '美国某个人群平均每天花多少分钟在某件事上？看着睡眠和参与率估三件。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '今天给你一个美国人群（年份、性别、年龄段），和三件日常小事。',
      '估计这个人群平均每天在每件事上花多少分钟。注意是“所有人、所有日子”的平均，当天没做这件事的人也算 0 分钟。',
      '线索：这个人群的平均睡眠，和“当天做过这件事的人占比”。占比低，平均值就会被大幅拉低。',
    ],
    scoring: '每题按“差了几倍”计分（对数刻度）：差 1.4 倍约 61 分，差 2 倍约 37 分，差 10 倍约 4 分；三题取平均。',
    sources: [
      { name: 'BLS American Time Use Survey（ATUS）', url: 'https://www.bls.gov/tus/', note: '美国劳工统计局的时间日记调查，2003–2025 年度数据' },
      { name: 'BLS ATUS 时间序列文件（tu.series / tu.data）', url: 'https://download.bls.gov/pub/time.series/tu/', note: '本游戏直接读取的原始文件' },
    ],
    dataNote: '快照数据：BLS 每年 6 月左右才发布上一年的结果，没有每日更新，所以不是实时数据。分钟数由官方“平均每天小时数”×60 四舍五入得到，参与率为官方“当天做过该活动的人口占比”。2020 年因疫情调查曾暂停数月。',
  },

  puzzle({ data, pick, rng }) {
    const g = pick(data.groups);
    return { y: g.y, s: g.s, a: g.a, acts: rng.sample(eligible(g), 3) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const g = findGroup(ctx.data.groups, p);
    const base = ctx.data.groups.find((x) => x.y === p.y && x.s === 0 && x.a === '000');
    ctx.log('group', p);
    const who = whoLabel(g);
    ctx.stage.append(ui.panel({ kicker: '今天的人群', title: who },
      ui.row(
        ui.stat({ label: '平均每天睡眠', value: fmtHM(g.v[SLEEP][0]), sub: '一天共 1440 分钟' }),
        ui.stat({ label: '要估的事', value: '3 件', sub: '分钟数，对数滑杆' })),
      p.y === 2020 ? ui.callout('2020 年疫情期间调查曾暂停数月，数据仍是官方公布值。') : null));
    const results = [];
    for (const ac of p.acts) {
      const [name, gloss] = ACT[ac];
      const [mean, rate] = g.v[ac];
      ctx.log('ask', ac, mean, rate);
      results.push(await ctx.estimate({
        title: `${name}：平均每天多少分钟？`,
        prompt: `${who}。“${name}”指${gloss}。这个人群里，当天做过的人占 ${rate}%。`,
        answer: mean, min: 1, max: 720, log: true, step: 1, initial: 30,
        format: (v) => fmtHM(Math.round(v)), scoring: 'log', scale: SCALE,
      }));
    }
    const out = ctx.combine(results);
    out.detail = ui.stack(
      ui.callout(`${who}。平均数把没做这件事的人也算作 0 分钟：占比低的事看起来很短，占比高的事才接近“做的人”的时长。`),
      ui.table({
        columns: [{ key: 'n', label: '活动' }, { key: 'm', label: '全体平均', num: true }, { key: 'r', label: '当天做过', num: true }, { key: 'd', label: '做的人平均', num: true }],
        rows: p.acts.map((ac) => ({ n: ACT[ac][0], m: fmtHM(g.v[ac][0]), r: `${g.v[ac][1]}%`, d: fmtHM(g.v[ac][2]) })),
      }),
      ...p.acts.map((ac) => ui.quote(`${ACT[ac][0]}：${explain(g.v[ac], base?.v[ac])}`)));
    return out;
  },
};
