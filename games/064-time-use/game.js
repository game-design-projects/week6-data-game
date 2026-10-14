// #64 Time Use — guess how many minutes a day a group of people spends on an activity.
export const ACT = {
  AC02: '吃饭', AC1A: '工作（含通勤）', AC21A: '上学/上课', AC31A: '做饭备餐', AC321: '打扫房间', AC331: '洗衣服',
  AC344: '遛狗', AC36: '购物和办事', AC38A: '照顾孩子', AC51A: '串门和聚会', AC52: '看展演和娱乐', AC611: '散步和徒步',
  AC6A: '运动和户外活动', AC7A: '用电脑', AC812: '读书', AC82: '看电视和视频', AC913: '上下班路上',
};
const AGE = { TOTAL: '15 岁以上所有人', 'Y15-20': '15–19 岁', 'Y20-24': '20–24 岁', 'Y25-44': '25–44 岁', 'Y45-64': '45–64 岁', 'Y65-74': '65–74 岁' };
const SEX = { T: '男女合计', M: '男性', F: '女性' };
const CC = { UK: 'GB', EL: 'GR' };
const zhCountry = (c) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(CC[c] ?? c); } catch { return c; } };
export const fmtHM = (m) => (m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时 ${m % 60} 分`);
/** Average minutes among those who did the activity (mean over everyone ÷ participation rate). */
export const perDoer = (mean, rate) => (rate > 0 ? Math.round((mean * 100) / rate) : mean);

export default {
  meta: {
    num: 64,
    slug: 'time-use',
    title: 'Time Use',
    tagline: '某个国家、某个人群，平均每天花多少分钟在某件事上？估一估。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '给你一个人群（国家、年份、性别、年龄段），以及三件日常小事。',
      '估计这个人群平均每天在每件事上花多少分钟。注意是“所有人”的平均，没做这件事的人也算 0 分钟。',
      '线索：睡眠时长和“当天做过这件事的人占比”。占比很低时，平均值会被大幅拉低。',
    ],
    scoring: '每题按“差了几倍”计分（对数刻度）：差 1.4 倍约 63 分，差 2 倍约 37 分；三题取平均。',
    sources: [
      { name: 'Eurostat HETUS：tus_00age（按性别、年龄的时间使用）', url: 'https://ec.europa.eu/eurostat/databrowser/view/tus_00age/', note: '欧洲统一的时间日记调查；原定的美国 BLS ATUS 屏蔽脚本下载，故改用 Eurostat' },
    ],
    dataNote: '数据来自 2000 年和 2010 年前后两轮欧洲时间使用调查（22 个国家，不是每个国家两轮都有），是平均到“所有人、所有日子”的分钟数。',
  },

  puzzle({ data, pick, rng }) {
    const g = pick(data.groups);
    const acts = rng.sample(Object.keys(g.v).filter((k) => k !== 'AC01' && ACT[k]), 3);
    return { c: g.c, y: g.y, s: g.s, a: g.a, acts };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const g = ctx.data.groups.find((x) => x.c === p.c && x.y === p.y && x.s === p.s && x.a === p.a);
    ctx.log('group', p, 'acts', p.acts);
    const who = `${zhCountry(p.c)} · ${p.y} 年 · ${SEX[p.s]} · ${AGE[p.a]}`;
    ctx.stage.append(ui.panel({ kicker: '今天的人群', title: who },
      ui.row(
        ui.stat({ label: '平均每天睡眠', value: fmtHM(g.v.AC01[0]), sub: '一天共 1440 分钟' }),
        ui.stat({ label: '要估的事', value: '3 件', sub: '分钟数，对数滑杆' }))));
    const results = [];
    for (const ac of p.acts) {
      const [mean, rate] = g.v[ac];
      const r = await ctx.estimate({
        title: `${ACT[ac]}：平均每天多少分钟？`,
        prompt: `${who}。这个人群里，当天做过“${ACT[ac]}”的人占 ${rate}%。`,
        answer: mean, min: 1, max: 720, log: true, step: 1, initial: 30,
        format: (v) => fmtHM(Math.round(v)), scoring: 'log', scale: 0.35,
      });
      results.push(r);
    }
    const out = ctx.combine(results);
    out.detail = ui.stack(
      ui.callout(`${who}。平均数把没做这件事的人也算作 0 分钟，所以参与率低的事看起来很短。`),
      ui.table({
        columns: [{ key: 'n', label: '活动' }, { key: 'm', label: '全体平均', num: true }, { key: 'r', label: '做过的人占比', num: true }, { key: 'd', label: '做的人平均', num: true }],
        rows: p.acts.map((ac) => ({ n: ACT[ac], m: fmtHM(g.v[ac][0]), r: `${g.v[ac][1]}%`, d: fmtHM(perDoer(...g.v[ac])) })),
      }));
    return out;
  },
};
