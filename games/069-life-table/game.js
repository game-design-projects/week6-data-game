// #69 Life Table — a 40-year-old in country X: what's the chance of reaching 80?
const zh = (iso2, fallback) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(iso2); } catch { return fallback; } };

/** Survival 40→80 as a percentage from lx values (pure; tested). */
export const survival = (l40, l80) => +((l80 / l40) * 100).toFixed(1);

export default {
  meta: {
    num: 69,
    slug: 'life-table',
    title: 'Life Table',
    tagline: '某国 40 岁的人，有多大概率活到 80 岁？用出生预期寿命推断，估出这个百分比。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '今天给你一个国家和性别，估计这个国家 40 岁的人能活到 80 岁的概率（0–100%）。',
      '线索：出生时预期寿命，以及几个已知国家的参照值。预期寿命低往往因为婴幼儿死亡多，不代表中年人也一样。',
      '有两次机会，第一次后会告诉你偏高还是偏低。',
    ],
    scoring: '第一次的误差每 12 个百分点约扣 63 分；用第二次修正，最多拿 90%。',
    sources: [
      { name: 'UN World Population Prospects 2024 — Abridged Life Table (Medium variant, 2023)', url: 'https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=Mortality' },
    ],
    dataNote: '概率 = 生命表中 80–84 岁组起点的存活人数 l80 ÷ 40–44 岁组起点的存活人数 l40，使用联合国 2023 年估计值。',
  },

  puzzle({ data, pick, rng }) {
    const c = pick(data.countries);
    return { cc: c.cc, sex: rng.chance(0.5) ? 'F' : 'M' };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const c = ctx.data.countries.find((x) => x.cc === p.cc);
    const r = c[p.sex];
    const sexZh = p.sex === 'F' ? '女性' : '男性';
    const name = zh(c.iso2, c.name);
    ctx.log('puzzle', c.cc, p.sex, r.p);

    const anchors = ['NGA', 'IND', 'USA', 'JPN'].map((k) => ctx.data.countries.find((x) => x.cc === k)).filter(Boolean);
    ctx.stage.append(ui.panel({ kicker: '今天的题目', title: `${name} · ${sexZh}` },
      ui.grid(130,
        ui.stat({ label: '出生时预期寿命（岁）', value: r.e0.toFixed(1), big: true }),
        ui.stat({ label: '数据年份', value: String(ctx.data.year) })),
      ui.h('div', { class: 'small muted', style: { marginTop: '10px' } }, '参照（同性别，40 岁→80 岁存活率 / 出生预期寿命）：'),
      ui.table({
        columns: [{ key: 'n', label: '国家' }, { key: 'p', label: '40→80', num: true }, { key: 'e', label: '出生预期寿命', num: true }],
        rows: anchors.map((a) => ({ n: zh(a.iso2, a.name), p: `${a[p.sex].p}%`, e: `${a[p.sex].e0.toFixed(1)} 岁` })),
      })));

    const res = await ctx.estimate({
      answer: r.p, min: 0, max: 100, step: 0.5, initial: 50,
      format: (v) => `${core.fmtNum(v, 1)}%`,
      attempts: 2, scoring: 'abs', scale: 12, tolerance: 1.5,
      title: `${name}的${sexZh}：40 岁活到 80 岁的概率`,
    });

    const gap = r.e40 + 40;
    res.detail = ui.kv([
      ['答案', `${r.p}%`],
      ['出生预期寿命', `${r.e0.toFixed(1)} 岁`],
      ['40 岁时的剩余预期寿命', `${r.e40.toFixed(1)} 岁（即平均活到约 ${gap.toFixed(0)} 岁）`],
      ['规律', r.e0 < 65
        ? '预期寿命偏低，主要被早年夭折拉低；活过 40 岁的人，剩余寿命比出生预期寿命少得没那么多。'
        : '40 岁时的剩余寿命越长，活到 80 岁的概率越高。把出生预期寿命换算成“40 岁后还能活多久”是关键。'],
      ['性别差', `同国${p.sex === 'F' ? '男性' : '女性'}为 ${c[p.sex === 'F' ? 'M' : 'F'].p}%`],
    ]);
    return res;
  },
};
