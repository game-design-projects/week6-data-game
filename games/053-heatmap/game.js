// #53 Heatmap — a series' per-episode IMDb ratings as a season x episode heatmap; name the show.

const MAX_GUESSES = 6;
const STOP = new Set(['the', 'and', 'of', 'in', 'a', 'an', 'to', 'for', 'with', 'is', 'on', 'my']);
const BAR = '▇▇▇';
const OPACITY = [0.3, 0.45, 0.62, 0.8, 1];

/** Colour bucket for a rating (also used by tests). */
export function bucket(r) { return r >= 9 ? 4 : r >= 8.5 ? 3 : r >= 8 ? 2 : r >= 7 ? 1 : 0; }

/** Score for winning on guess n (1-based) of MAX_GUESSES; 0 when not won. */
export function scoreFor(n, won) { return won ? Math.round((100 * (MAX_GUESSES - n + 1)) / MAX_GUESSES) : 0; }

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Hide the show's name inside an episode title. Whole words only (plus a plural / possessive
 * tail), so no fragments like "▇▇▇lantis" are left behind. The full title phrase goes first.
 */
export function redactTitle(text, show) {
  const L = '\\p{L}\\p{N}';
  const wrap = (src) => new RegExp(`(?<![${L}])(?:${src})(?:['’]?s)?(?![${L}])`, 'giu');
  const phrase = show.title.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = [...new Set(phrase.split(' ').filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w)))];
  let out = text;
  if (phrase) out = out.replace(wrap(phrase.split(' ').map(esc).join('[^\\p{L}\\p{N}]+')), BAR);
  if (words.length) out = out.replace(wrap(words.map(esc).join('|')), BAR);
  return out;
}

/** A title worth showing as a clue (not an IMDb placeholder). */
export const isNamed = (t) => !!t && !/^episode\s*#?\d/i.test(t.trim());

/** Autocomplete label: add the premiere year when two shows share a title. */
export function labelsFor(shows) {
  const n = new Map();
  for (const s of shows) n.set(s.title, (n.get(s.title) || 0) + 1);
  return shows.map((s) => (n.get(s.title) > 1 ? `${s.title} (${s.start})` : s.title));
}

const avg = (xs) => xs.reduce((a, x) => a + x.r, 0) / xs.length;

export default {
  meta: {
    num: 53,
    slug: 'heatmap',
    title: 'Heatmap',
    tagline: '一部剧每一集的 IMDb 评分，排成「季 × 集」热力图。看高低起伏，猜剧名。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '热力图每一行是一季，每一格是一集，颜色越深评分越高；淡灰的空格是评分人数太少、没有收录的集。',
      '从列表里选剧名来猜，最多 6 次。每猜错一次解锁一条新线索：季数与集数、类型和年代、最高分与最低分的集名（剧名已遮住）、剧名首字……',
      '看形状：一路变淡说明口碑下滑，末季突然变深多半是大结局，每季最后一格都很深说明爱在季终集放大招。',
      '第 1 次猜中 100 分，之后每多猜一次少约 17 分，6 次都没猜中 0 分。',
    ],
    scoring: '第 n 次猜中得 100·(7−n)/6 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'IMDb Non-Commercial Datasets', url: 'https://developer.imdb.com/non-commercial-datasets/', note: 'title.basics / title.episode / title.ratings' },
    ],
    dataNote: '数据来自 IMDb 公开数据集的快照（该数据集是几百 MB 的整库文件，且没有 CORS，浏览器无法实时读取，其余可用的 IMDb 接口如 OMDb 需要密钥），收录评分人数超过 10 万、至少 2 季、至少 20 集有评分的 200 部热门剧，每部剧就是一道题。评分会随时间微调；每集评分不足 50 人的集不收录。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.shows).id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const shows = ctx.data.shows;
    const labels = labelsFor(shows);
    const ans = shows.find((s) => s.id === p.id);
    ctx.log('answer', ans.title, ans.eps.length);

    const cells = ans.eps.map(([s, e, r, t]) => ({ s, e, r, t, k: bucket(r) }));
    const seasonList = [...new Set(cells.map((x) => x.s))].sort((a, b) => a - b);
    const maxEp = Math.max(...cells.map((x) => x.e));
    const have = new Set(cells.map((x) => `${x.s}-${x.e}`));
    const gaps = [];
    for (const s of seasonList) {
      const top = Math.max(...cells.filter((x) => x.s === s).map((x) => x.e));
      for (let e = 1; e <= top; e++) if (!have.has(`${s}-${e}`)) gaps.push({ s, e });
    }
    const epDomain = Array.from({ length: maxEp }, (_, i) => i + 1);
    const showNums = maxEp <= 14;
    const heat = await ui.plot((Plot, c) => ({
      height: Math.min(560, 44 + seasonList.length * (maxEp > 30 ? 16 : 26)),
      marginLeft: 40,
      padding: 0.1,
      x: { label: null, domain: epDomain, ticks: epDomain.filter((e) => e === 1 || e % 5 === 0), tickSize: 0 },
      y: { label: null, domain: seasonList, tickFormat: (s) => `S${s}`, tickSize: 0 },
      opacity: { type: 'identity' },
      marks: [
        Plot.cell(gaps, { x: 'e', y: 's', fill: c.muted, fillOpacity: 0.12, rx: 2 }),
        Plot.cell(cells, { x: 'e', y: 's', fill: c.accent, fillOpacity: (x) => OPACITY[x.k], rx: 2, title: (x) => `S${x.s}E${x.e} · ${x.r}` }),
        ...(showNums ? [Plot.text(cells, { x: 'e', y: 's', text: (x) => x.r.toFixed(1), fontSize: 8, fill: c.ink, fillOpacity: 0.85 })] : []),
      ],
    }));
    const legendLabels = ['< 7', '7–8', '8–8.5', '8.5–9', '≥ 9'];
    const legend = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '10px', marginTop: '6px', flexWrap: 'wrap' } },
      ...legendLabels.map((l, i) => ui.h('span', ui.h('span', { style: { color: 'var(--accent)', opacity: String(OPACITY[i]) } }, '■'), ' ' + l)));

    const named = cells.filter((x) => isNamed(x.t));
    const pool = named.length ? named : cells;
    const best = pool.reduce((a, b) => (b.r > a.r ? b : a));
    const worst = pool.reduce((a, b) => (b.r < a.r ? b : a));
    const first = cells.filter((x) => x.s === seasonList[0]), last = cells.filter((x) => x.s === seasonList[seasonList.length - 1]);
    const decade = Math.floor(ans.start / 10) * 10;
    const perSeason = Math.round(cells.length / seasonList.length);
    const clues = [
      ui.h('div', heat, legend),
      `${seasonList.length} 季，共 ${cells.length} 集有评分（平均每季约 ${perSeason} 集）。第一季均分 ${avg(first).toFixed(1)}，最后一季均分 ${avg(last).toFixed(1)}。`,
      `类型：${ans.genres.join(' / ')}。首播于 ${decade} 年代。${ans.end ? '已完结。' : '数据里没有标记完结。'}`,
      `评分最高的一集 ${best.r}（S${best.s}E${best.e}）：“${redactTitle(best.t, ans)}”`,
      `评分最低的一集 ${worst.r}（S${worst.s}E${worst.e}）：“${redactTitle(worst.t, ans)}”`,
      `剧名以 “${ans.title[0]}” 开头，共 ${ans.title.length} 个字符。`,
    ];

    const byId = new Map(shows.map((s, i) => [s.id, s]));
    const res = await ctx.guess({
      options: shows.map((s, i) => ({ id: s.id, label: labels[i], hint: String(s.start), aliases: /^the /i.test(s.title) ? [s.title.slice(4)] : [] })),
      answer: ans.id,
      maxGuesses: MAX_GUESSES,
      title: '这是哪部剧？',
      placeholder: '输入剧名…',
      clues,
      cluesTitle: '热力图和线索',
      columns: ['首播', '总分'],
      near: (g, a) => Math.abs(byId.get(g.id).start - byId.get(a.id).start) <= 2,
      scoring: scoreFor,
      feedback: (g, a) => {
        const gs = byId.get(g.id), as = byId.get(a.id);
        const yr = gs.start === as.start ? 'hit' : Math.abs(gs.start - as.start) <= 3 ? 'near' : undefined;
        const rt = Math.abs(gs.rating - as.rating) < 0.2 ? 'hit' : Math.abs(gs.rating - as.rating) < 0.5 ? 'near' : undefined;
        return [
          { text: `${gs.start} ${gs.start < as.start ? '↑' : gs.start > as.start ? '↓' : ''}`, state: yr, num: true },
          { text: `${gs.rating} ${gs.rating < as.rating ? '↑' : gs.rating > as.rating ? '↓' : ''}`, state: rt, num: true },
        ];
      },
    });
    ctx.log('result', res.score);

    // which pattern gave it away: per-season averages, the finale, the dip
    const seasonAvg = seasonList.map((s) => [s, avg(cells.filter((x) => x.s === s))]);
    const peak = seasonAvg.reduce((a, b) => (b[1] > a[1] ? b : a));
    const dip = seasonAvg.reduce((a, b) => (b[1] < a[1] ? b : a));
    const trend = avg(last) - avg(first);
    const lastEp = last.reduce((a, b) => (b.e > a.e ? b : a));
    const finale = lastEp.r - avg(last);
    const shape = trend < -0.3 ? `口碑下滑：首季 ${avg(first).toFixed(1)} → 末季 ${avg(last).toFixed(1)}，热力图越往下越淡`
      : trend > 0.3 ? `越拍越好：首季 ${avg(first).toFixed(1)} → 末季 ${avg(last).toFixed(1)}，热力图越往下越深`
        : `全程稳定：首季 ${avg(first).toFixed(1)} → 末季 ${avg(last).toFixed(1)}，颜色深浅几乎不变`;
    const finaleTxt = finale >= 0.4 ? `大结局 S${lastEp.s}E${lastEp.e} 评分 ${lastEp.r}，比末季均分高 ${finale.toFixed(1)}，热力图右下角那格特别深`
      : `大结局 S${lastEp.s}E${lastEp.e} 评分 ${lastEp.r}，和末季均分差不多`;
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', `${ans.title}（${ans.start}${ans.end ? '–' + ans.end : '–'}）· ${ans.genres.join(' / ')}`],
        ['IMDb 总评分', `${ans.rating} · ${core.fmtCompact(ans.votes)} 人评分`],
        ['最高一集', `S${best.s}E${best.e} “${best.t}” ${best.r}`],
        ['最低一集', `S${worst.s}E${worst.e} “${worst.t}” ${worst.r}`],
        ['走势', shape],
        ['最强 / 最弱季', `S${peak[0]} 均分 ${peak[1].toFixed(1)} / S${dip[0]} 均分 ${dip[1].toFixed(1)}`],
        ['结局', finaleTxt],
      ]));
    return res;
  },
};
