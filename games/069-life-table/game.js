// #69 Life Table — a 40-year-old in country X, year Y: what's the chance of reaching 80?
const zhName = (iso2, fallback) => {
  try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(iso2) || fallback; } catch { return fallback; }
};

/** Survival 40→80 as a percentage from lx values (pure; tested). */
export const survival = (l40, l80) => +((l80 / l40) * 100).toFixed(1);

/** Anchor countries shown as references (never the target itself). */
export const ANCHORS = ['JPN', 'USA', 'IND', 'NGA'];
export const anchorsFor = (cc) => {
  const list = ANCHORS.filter((k) => k !== cc);
  return list.length < ANCHORS.length ? [...list, 'BRA'] : list;
};

/** One row of the pool by (cc, sex, year). */
export const findRow = (data, cc, s, y) => data.rows.find((r) => r.cc === cc && r.s === s && r.y === y);

/** Per-puzzle explanation of which pattern in the numbers gives the answer away (pure; tested). */
export function explain(r) {
  const lifeAfter40 = r.e40 + 40;
  const parts = [];
  if (r.u5 >= 40) parts.push(`每千名新生儿有 ${r.u5} 人活不到 5 岁，把出生预期寿命（${r.e0} 岁）拉低了一截；但活到 40 岁的人平均还能活到约 ${lifeAfter40.toFixed(0)} 岁，比出生预期寿命高 ${(lifeAfter40 - r.e0).toFixed(0)} 岁。`);
  else if (r.u5 >= 12) parts.push(`5 岁前死亡率为 ${r.u5}‰，还会拉低一点出生预期寿命（${r.e0} 岁）；活到 40 岁的人平均能活到约 ${lifeAfter40.toFixed(0)} 岁，比它高 ${(lifeAfter40 - r.e0).toFixed(0)} 岁。`);
  else parts.push(`婴幼儿死亡已很少（5 岁前仅 ${r.u5}‰），出生预期寿命（${r.e0} 岁）和 40 岁时的平均寿命（约 ${lifeAfter40.toFixed(0)} 岁）只差 ${(lifeAfter40 - r.e0).toFixed(0)} 岁，关键看中老年死亡率。`);
  parts.push(lifeAfter40 >= 80
    ? `40 岁的人平均能活过 80 岁，所以多数人（${r.p}%）能跨过 80 岁这道线。`
    : `40 岁的人平均只能活到 ${lifeAfter40.toFixed(0)} 岁左右，比 80 岁少 ${(80 - lifeAfter40).toFixed(0)} 岁，所以只有 ${r.p}% 的人能活到 80。`);
  return parts.join('');
}

export default {
  meta: {
    num: 69,
    slug: 'life-table',
    title: 'Life Table',
    tagline: '某国某年的 40 岁男性或女性，有多大概率活到 80 岁？看预期寿命等线索估这个百分比。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '今天给你一个国家、一个年份（1970、1990、2010 或 2023）和性别，估计该年 40 岁的人能活到 80 岁的概率（0–100%）。',
      '线索：出生预期寿命、5 岁前死亡率，以及日本、美国、印度、尼日利亚同年同性别的参照值。出生预期寿命低往往是婴幼儿死亡多拉低的，不代表中年人同样短命。',
      '有两次机会，第一次提交后会告诉你偏高还是偏低。',
    ],
    scoring: '以最后一次的误差计分：差 0 个百分点满分，每差 12 个百分点分数降到约三分之一；第二次提交的得分打九折。',
    sources: [
      { name: 'UN World Population Prospects 2024 — Abridged Life Table (Medium variant)', url: 'https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=Mortality' },
    ],
    dataNote: '联合国人口司对各国各年的估计（1970、1990、2010、2023 年），不是实测的追踪队列。概率 = 生命表中活到恰好 80 岁的人数 l80 ÷ 活到恰好 40 岁的人数 l40（生命表的 lx 即恰好该岁数时的存活人数，不是近似）。已去掉非主权的小型属地。',
  },

  puzzle({ data, pick, rng }) {
    const r = pick(data.rows);
    return { cc: r.cc, s: r.s, y: r.y };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const { rows, countries } = ctx.data;
    const r = findRow(ctx.data, p.cc, p.s, p.y);
    const nm = (cc) => zhName(countries[cc].iso2, countries[cc].name);
    const name = nm(p.cc);
    const sexZh = p.s === 'F' ? '女性' : '男性';
    ctx.log('puzzle', p.cc, p.s, p.y, r.p);

    const anchors = anchorsFor(p.cc).map((k) => findRow(ctx.data, k, p.s, p.y)).filter(Boolean);
    ctx.stage.append(ui.panel({ kicker: '今天的题目', title: `${p.y} 年 · ${name} · ${sexZh}` },
      ui.grid(130,
        ui.stat({ label: '出生预期寿命（岁）', value: r.e0.toFixed(1), big: true }),
        ui.stat({ label: '5 岁前死亡率（‰）', value: r.u5.toFixed(1), big: true })),
      ui.h('div', { class: 'small muted', style: { margin: '10px 0 4px' } }, `参照（${p.y} 年同性别）：`),
      ui.table({
        columns: [{ key: 'n', label: '国家' }, { key: 'e', label: '预期寿命', num: true }, { key: 'u', label: '5 岁前‰', num: true }, { key: 'p', label: '40→80', num: true }],
        rows: anchors.map((a) => ({ n: nm(a.cc), e: `${a.e0.toFixed(1)}`, u: `${a.u5.toFixed(0)}`, p: `${a.p}%` })),
      })));

    const res = await ctx.estimate({
      answer: r.p, min: 0, max: 100, step: 0.5, initial: 50,
      format: (v) => `${core.fmtNum(v, 1)}%`,
      attempts: 2, scoring: 'abs', scale: 12, tolerance: 1.5,
      title: `${p.y} 年${name}${sexZh}：40 岁活到 80 岁的概率`,
    });

    // reveal chart: every country, same year and sex — life expectancy vs. 40→80 survival
    const peers = rows.filter((x) => x.y === p.y && x.s === p.s);
    const chart = await ui.plot((Plot, c) => ({
      marks: [
        Plot.dot(peers.filter((x) => x.cc !== p.cc), { x: 'e0', y: 'p', r: 3, fill: c.muted, fillOpacity: 0.5 }),
        Plot.dot([r], { x: 'e0', y: 'p', r: 6, fill: c.accent, stroke: c.ink }),
        Plot.text([r], { x: 'e0', y: 'p', text: () => name, dy: -12, fill: c.ink }),
      ],
      x: { label: '出生预期寿命（岁）', domain: [30, 90] },
      y: { label: '40→80 存活率（%）', domain: [0, 90] },
    }), { height: 240 });

    res.detail = ui.stack(
      ui.kv([
        ['答案', `${r.p}%`],
        ['出生预期寿命', `${r.e0.toFixed(1)} 岁`],
        ['40 岁时的剩余预期寿命', `${r.e40.toFixed(1)} 岁（平均活到约 ${(r.e40 + 40).toFixed(0)} 岁）`],
        ['新生儿活到 40 岁', `${r.s40}%`],
        ['规律', explain(r)],
        ['性别差', `同国同年${p.s === 'F' ? '男性' : '女性'}为 ${findRow(ctx.data, p.cc, p.s === 'F' ? 'M' : 'F', p.y).p}%`],
      ]),
      ui.h('div', { class: 'small muted' }, `${p.y} 年同性别的所有国家：预期寿命越高，40→80 存活率越高，但并非等比例。`),
      chart);
    return res;
  },
};
