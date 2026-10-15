// #67 Pyramid — read a population pyramid, name the country.
import { haversineKm, fmtKm, fmtCompact } from '../../engine/core.js';


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

const band = (c, i) => c.f[i] + c.m[i];

/** Sum of absolute differences between two pyramids (percentage points). */
export function shapeDist(a, b) {
  let d = 0;
  for (let i = 0; i < a.f.length; i++) d += Math.abs(band(a, i) - band(b, i));
  return d;
}

/** Puzzle-specific observations: which features of this pyramid identify it. */
export function patterns(c, ages) {
  const out = [];
  const base = band(c, 0), mid = band(c, 5);
  out.push(`0–4 岁占 ${base.toFixed(1)}%，25–29 岁占 ${mid.toFixed(1)}%：底部是腰部的 ${(base / mid).toFixed(2)} 倍${base / mid > 1.25 ? '（还在高速扩张）' : base / mid < 0.8 ? '（新生儿比青年少，生育率低于更替水平）' : '（出生数大致稳定）'}。`);
  const mw = c.m.slice(4, 11).reduce((a, b) => a + b, 0), fw = c.f.slice(4, 11).reduce((a, b) => a + b, 0);
  if (mw / fw > 1.12) out.push(`20–54 岁男女比约 ${(mw / fw).toFixed(2)}：男性明显偏多，通常是外来劳工大量流入。`);
  else if (mw / fw < 0.95) out.push(`20–54 岁男女比仅 ${(mw / fw).toFixed(2)}：女性偏多，常见于男性外出务工或早逝较多的国家。`);
  const old = c.f[16] + c.m[16];
  if (old >= 3.5) out.push(`80 岁以上占 ${old.toFixed(1)}%，顶端明显偏胖，长寿 + 少子的老龄化社会。`);
  else if (old <= 0.5) out.push(`80 岁以上不到 ${Math.max(old, 0.1).toFixed(1)}%，顶端几乎消失，说明预期寿命较短、人口很年轻。`);
  let peak = 0;
  for (let i = 1; i < 17; i++) if (band(c, i) > band(c, peak)) peak = i;
  if (peak >= 3) out.push(`最宽的一档是 ${ages[peak]} 岁（${band(c, peak).toFixed(1)}%），比最年轻的一档还宽：人口红利/“婴儿潮”世代正在这个年龄段。`);
  let worst = null;
  for (let i = 1; i < 14; i++) {
    const r = band(c, i) / ((band(c, i - 1) + band(c, i + 1)) / 2);
    if (r < 0.85 && (!worst || r < worst.r)) worst = { i, r };
  }
  if (worst) out.push(`${ages[worst.i]} 岁这一档明显凹下去（只有相邻两档均值的 ${Math.round(worst.r * 100)}%）：出生低谷或人口外流留下的“缺口”。`);
  const dep = ((c.u15 + c.o65) / (100 - c.u15 - c.o65)) * 100;
  out.push(`抚养比（15 岁以下 + 65 岁以上 对 15–64 岁）约 ${Math.round(dep)}%，其中少儿 ${c.u15}%、老人 ${c.o65}%。`);
  return out;
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
      '图里是某个国家 2024 年按年龄和性别划分的人口金字塔（左男右女，横轴为占总人口的百分比）。',
      '从列表里选国家来猜，最多 6 次。每猜错一次多解锁一条线索。',
      '每次猜测会告诉你：答案的中位年龄比你猜的高还是低、人口更多还是更少、是否同一地区、两国相距多远（点位为首都附近）。',
      '提示：底部宽 = 年轻、高生育；腰身细 = 人口外流或历史创伤；顶部胖 = 老龄化；男多女少的中段往往是外来劳工。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'World Bank Open Data（SP.POP.*.FE/MA，来自 UN World Population Prospects）', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' },
      { name: 'UN World Population Prospects', url: 'https://population.un.org/wpp/' },
    ],
    dataNote: '联合国 WPP 官网为大文件下载，这里使用世界银行 API 镜像的同一套 WPP 年龄/性别人口数据（2024 年估计，5 岁一组，80+ 合并），中位年龄由 5 岁分组线性插值得出（80+ 按 80–90 岁计）。收录人口超过 100 万的国家和地区（含中国香港、波多黎各），共 159 个。世界银行 API 无需密钥但未开放 CORS 保证，因此以快照形式提供。',
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

    const c0 = ui.colors();
    const bars = [];
    ages.forEach((a, i) => {
      bars.push({ age: a, sex: '男', v: -ans.m[i] }, { age: a, sex: '女', v: ans.f[i] });
    });
    const maxV = Math.ceil(Math.max(...ans.f, ...ans.m) * 1.1);
    const lum = (hex) => { const m = /^#?([0-9a-f]{6})/i.exec(String(hex).trim()); return m ? parseInt(m[1].slice(0, 2), 16) * 0.3 + parseInt(m[1].slice(2, 4), 16) * 0.6 + parseInt(m[1].slice(4), 16) * 0.1 : 0; };
    const maleColor = lum(c0.paper) < 128 ? '#6aa0e8' : '#2f6bb8';
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

    const options = ctx.data.countries.map((c) => ({ id: c.id, label: c.zh, hint: c.name, aliases: [c.name, c.cc, c.id] }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪个国家？',
      placeholder: '输入国家名（中文或英文）…',
      clues,
      cluesTitle: '人口金字塔和线索',
      columns: ['中位年龄', '人口', '地区', '相距'],
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

    const peers = ctx.data.countries.filter((c) => c.id !== ans.id).sort((a, b) => shapeDist(a, ans) - shapeDist(b, ans)).slice(0, 3);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.zh}（${ans.name}），${ctx.data.year} 年。`),
      ui.kv([
        ['人口', fmtCompact(ans.pop)],
        ['中位年龄', `${ans.med} 岁`],
        ['0–14 / 65+', `${ans.u15}% / ${ans.o65}%`],
        ['地区 · 收入', `${ans.region} · ${ans.income}`],
        ['形状最相近的国家', peers.map((c) => c.zh).join('、')],
      ]),
      ui.h('div', { class: 'small ink2' }, shapeOf(ans)),
      ui.h('div', { class: 'ds-stack small' }, ui.h('b', '这张金字塔的识别特征'), ...patterns(ans, ages).map((t) => ui.h('div', { class: 'ink2' }, '· ' + t))));
    return res;
  },
};
