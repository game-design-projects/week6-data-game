// #67 Pyramid — read a population pyramid, name the country.
import { haversineKm, fmtKm, fmtCompact } from '../../engine/core.js';

const zh = (cc) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return cc; } };

/** ↑ if the answer is larger than the guess, ↓ if smaller, ✓ when within tol. */
export function dir(guess, answer, tol = 0) {
  if (Math.abs(answer - guess) <= tol) return '✓';
  return answer > guess ? '↑' : '↓';
}

/** Short description of the shape of a pyramid from its summary stats. */
export function shapeOf(c) {
  if (c.med < 20) return '底部极宽、顶部很尖的“真金字塔”：几乎一半人口是孩子，高出生率、人均寿命较短。';
  if (c.med < 30) return '底部仍然偏宽的年轻型结构：出生率较高，但已经开始放缓。';
  if (c.med < 40) return '接近柱形的成熟型结构：出生率下降，劳动年龄人口占大头。';
  return '“倒置”的老龄型结构：底部收窄、顶部变胖，少子老龄化明显。';
}

export default {
  meta: {
    num: 67,
    slug: 'pyramid',
    title: 'Pyramid',
    tagline: '一张人口金字塔，猜是哪个国家。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '图里是某个国家 2023 年按年龄和性别划分的人口金字塔（左男右女，横轴为占总人口的百分比）。',
      '从列表里选国家来猜，最多 6 次。每猜错一次多解锁一条线索。',
      '每次猜测会告诉你：答案的中位年龄比你猜的高还是低、人口更多还是更少、是否同一地区、首都相距多远。',
      '提示：底部宽 = 年轻、高生育；腰身细 = 人口外流或历史创伤；顶部胖 = 老龄化；男多女少的中段往往是外来劳工。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'World Bank Open Data（SP.POP.*.FE/MA，来自 UN World Population Prospects）', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' },
      { name: 'UN World Population Prospects', url: 'https://population.un.org/wpp/' },
    ],
    dataNote: '联合国 WPP 官网为大文件下载，这里使用世界银行 API 镜像的同一套 WPP 年龄/性别人口数据（2023 年，5 岁一组，80+ 合并）。仅收录人口超过 150 万的国家和地区。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.countries).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byId = new Map(ctx.data.countries.map((c) => [c.id, c]));
    const ans = byId.get(p.id);
    const ages = ctx.data.ages.map((a) => (a === '80UP' ? '80+' : `${+a.slice(0, 2)}–${+a.slice(2)}`));
    ctx.log('answer', ans.id);

    const bars = [];
    ages.forEach((a, i) => {
      bars.push({ age: a, sex: '男', v: -ans.m[i] }, { age: a, sex: '女', v: ans.f[i] });
    });
    const maxV = Math.ceil(Math.max(...ans.f, ...ans.m) * 1.1);
    const maleColor = '#5b8fd9';
    const pyramid = await ui.plot((Plot, c) => ({
      height: 340,
      marginLeft: 44,
      x: { label: '占总人口 %', domain: [-maxV, maxV], tickFormat: (d) => Math.abs(d) },
      y: { label: null, domain: ages, reverse: false },
      marks: [
        Plot.barX(bars, { x: 'v', y: 'age', fill: (d) => (d.sex === '男' ? maleColor : c.accent), title: (d) => `${d.age} 岁 ${d.sex} ${Math.abs(d.v)}%` }),
        Plot.ruleX([0], { stroke: c.ink }),
      ],
    }));

    const legend = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px' } },
      ui.h('span', ui.h('span', { style: { color: maleColor } }, '■'), ' 男（左）'),
      ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '■'), ' 女（右）'));

    const clues = [
      ui.h('div', pyramid, legend),
      `0–14 岁占 ${ans.u15}%，65 岁以上占 ${ans.o65}%，女性占 ${ans.fshare}%。`,
      `中位年龄约 ${ans.med} 岁。${shapeOf(ans)}`,
      `世界银行的收入分组：${ans.income}。`,
      `所在地区：${ans.region}。总人口约 ${fmtCompact(ans.pop)}。`,
      `英文国名以 “${ans.name[0]}” 开头。`,
    ];

    const options = ctx.data.countries.map((c) => ({ id: c.id, label: zh(c.cc), hint: c.name, aliases: [c.name, c.cc] }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪个国家？',
      placeholder: '输入国家名（中文或英文）…',
      clues,
      cluesTitle: '人口金字塔和线索',
      columns: ['中位年龄', '人口', '地区', '首都距离'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1500,
      feedback: (g) => {
        const gc = byId.get(g.id);
        const hit = gc.id === ans.id;
        const dm = dir(gc.med, ans.med, 1.5);
        const dp = dir(Math.log(gc.pop), Math.log(ans.pop), 0.25);
        const km = haversineKm(gc, ans);
        return [
          { text: `${gc.med} ${dm}`, num: true, state: hit || dm === '✓' ? 'hit' : undefined },
          { text: `${fmtCompact(gc.pop)} ${dp}`, num: true, state: hit || dp === '✓' ? 'hit' : undefined },
          { text: gc.region === ans.region ? '同区' : '不同', state: gc.region === ans.region ? 'hit' : undefined },
          { text: hit ? '0 km' : fmtKm(km), num: true, state: km < 1500 ? 'near' : undefined },
        ];
      },
    });
    ctx.log('result', res.score);

    const peers = ctx.data.countries.filter((c) => c.id !== ans.id).sort((a, b) => Math.abs(a.med - ans.med) - Math.abs(b.med - ans.med)).slice(0, 3);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${zh(ans.cc)}（${ans.name}），${ctx.data.year} 年。`),
      ui.kv([
        ['人口', fmtCompact(ans.pop)],
        ['中位年龄', `${ans.med} 岁`],
        ['0–14 / 65+', `${ans.u15}% / ${ans.o65}%`],
        ['地区 · 收入', `${ans.region} · ${ans.income}`],
        ['年龄结构相近的国家', peers.map((c) => zh(c.cc)).join('、')],
      ]),
      ui.h('div', { class: 'small ink2' }, shapeOf(ans)));
    return res;
  },
};
