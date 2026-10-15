// #54 Chart Run — a song's weekly Billboard Hot 100 trajectory: guess the year, then the song.
export function yearOf(start) { return +start.slice(0, 4); }

/** Score for the year guess (0–100): exact 100, 5 years off ≈ 37, 15 years off ≈ 5. */
export function yearScore(guess, answer) { return Math.round(100 * Math.exp(-Math.abs(guess - answer) / 5)); }

/** Song guess: 1st try 100, then −1/6 per extra try (matches the engine default for 6 tries). */
export function songScore(n, won, max = 6) { return won ? Math.round((100 * (max - n + 1)) / max) : 0; }

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const era = (y) => (y < 1991 ? 0 : y < 2013 ? 1 : 2);
const ERA_TEXT = [
  '1991 年以前，榜单靠电台播放和唱片店的汇报，歌曲升降快、停留短。',
  '1991 年起榜单改用实际销量和电台播放数据（SoundScan / BDS），1998 年后无需发行实体单曲也能上榜，登顶歌曲停留更久。',
  '2013 年起流媒体和视频播放量计入榜单，热门歌曲的在榜时间被明显拉长。',
];
const ERA_NAME = ['1991 年前', '1991–2012 年', '2013 年起'];

/** Describe the run in numbers. run = weekly ranks (null = week off the chart). */
export function runFacts(run) {
  const ranks = run.filter((x) => x != null);
  const peak = Math.min(...ranks);
  const peakIdx = run.indexOf(peak);
  const first = run[run.findIndex((x) => x != null)];
  const last = ranks.at(-1);
  return {
    first, last, peak, peakIdx, weeks: ranks.length, span: run.length,
    atPeak: ranks.filter((x) => x === peak).length,
    top10: ranks.filter((x) => x <= 10).length,
    gaps: run.length - ranks.length,
    tail: run.length - 1 - peakIdx,
  };
}

/** Learnability text: which shape in this particular run gives the era away. */
export function patternText(pz, ans, data) {
  const f = runFacts(pz.run);
  const y = yearOf(pz.start);
  const e = era(y);
  const peers = data.puzzles.filter((q) => era(yearOf(q.start)) === e).map((q) => q.run.filter((x) => x != null).length);
  const med = Math.round(median(peers));
  const parts = [];
  parts.push(f.first <= 20 ? `首周就从第 ${f.first} 名入榜` : `首周从第 ${f.first} 名起步`);
  parts.push(f.peakIdx <= 3 ? `只用 ${f.peakIdx} 周就冲到最高第 ${f.peak}（爆发型）` : f.peakIdx >= 10 ? `用了 ${f.peakIdx} 周才爬到最高第 ${f.peak}（慢热型）` : `${f.peakIdx} 周爬到最高第 ${f.peak}`);
  parts.push(f.atPeak > 1 ? `在峰值停留 ${f.atPeak} 周` : '峰值只有 1 周');
  parts.push(f.tail <= 8 ? `之后 ${f.tail} 周快速退出` : `之后又拖了 ${f.tail} 周才下榜（最后一周第 ${f.last} 名）`);
  if (f.gaps > 0) parts.push(`中间有 ${f.gaps} 周掉出榜单后重返`);
  const cmp = f.weeks > med ? '高于' : f.weeks < med ? '低于' : '等于';
  return `${parts.join('，')}。共在榜 ${f.weeks} 周，${cmp}${ERA_NAME[e]}入选题库歌曲的中位数 ${med} 周。${ERA_TEXT[e]}`;
}

export function buildClues(ans, year) {
  const words = ans.p.split(/\s+/);
  return [
    `上榜年份：${year}。`,
    `最高名次第 ${ans.k}，在榜 ${ans.w} 周。`,
    `歌手/乐队名共 ${words.length} 个词，各词首字母：${words.map((w) => w[0]).join(' · ')}。`,
    `歌名共 ${ans.t.length} 个字符，首字母 “${ans.t[0]}”。`,
    `歌手/乐队：${ans.p.replace(/[A-Za-z]/g, (ch, i) => (i % 2 ? '▇' : ch))}`,
  ];
}

export default {
  meta: {
    num: 54,
    slug: 'chart-run',
    title: 'Chart Run',
    tagline: '一首歌在 Billboard Hot 100 上逐周的名次曲线。先猜年份，再猜歌名。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '图里是一首歌登上 Billboard Hot 100 之后每周的名次，曲线越高名次越靠前，虚线是前十名的门槛。先根据爬升速度和在榜长度估计它是哪一年上榜的（不同年代的榜单规则不同，歌曲停留的时间差别很大）。',
      '年份揭晓后，从列表里选歌曲来猜，最多 6 次。每猜错一次多解锁一条线索。',
      '每次猜测会告诉你那首歌的上榜年份、最高名次和在榜周数；箭头表示答案在那一项上更晚、更靠前或更长（↑）/ 更早、更靠后或更短（↓），黄色表示接近。',
    ],
    scoring: '年份满分 100，差 5 年约 37 分；猜歌第 1 次猜中 100 分，之后每多一次少约 17 分，没猜中 0 分。两部分相加，满分 200。',
    sources: [
      { name: 'Billboard Hot 100 历史榜单（utdata/rwd-billboard-data 镜像）', url: 'https://github.com/utdata/rwd-billboard-data' },
      { name: 'Billboard Hot 100', url: 'https://www.billboard.com/charts/hot-100/' },
    ],
    dataNote: '数据为 1958–2026 年每周榜单快照，来自 utdata 的 GitHub 镜像（Billboard 官方没有免费公开 API）。题库为曾进入前 3 名且在榜 20 周以上、整段上榜过程已结束的歌，每年最多 3 首；候选列表包含更多前 10 名的歌曲。',
  },

  puzzle({ data, pick }) {
    return { i: data.puzzles.indexOf(pick(data.puzzles)) };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const pz = data.puzzles[p.i];
    const ans = data.options[pz.o];
    const year = yearOf(pz.start);
    const [y0, y1] = data.span;
    ctx.log('chart-run', ans.t, ans.p, year);

    const pts = pz.run.map((r, i) => ({ w: i + 1, r }));
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      x: { label: '上榜第几周' },
      y: { label: '名次', reverse: true, domain: [1, 100], type: 'sqrt', ticks: [1, 5, 10, 20, 40, 70, 100] },
      marks: [
        Plot.ruleY([10], { stroke: c.muted, strokeDasharray: '4 3' }),
        Plot.text([{ w: 1, r: 10 }], { x: 'w', y: 'r', text: () => '前十', dy: -7, textAnchor: 'start', fill: c.muted, fontSize: 10 }),
        Plot.areaY(pts, { x: 'w', y1: 100, y2: 'r', fill: c.accent, fillOpacity: 0.15 }),
        Plot.lineY(pts, { x: 'w', y: 'r', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(pts, { x: 'w', y: 'r', fill: c.accent, r: 2.5 }),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: '线索', title: '这首歌的逐周名次' }, chart));

    const r1 = await ctx.estimate({
      title: '它是哪一年上榜的？', answer: year, min: y0, max: y1, step: 1, initial: Math.round((y0 + y1) / 2),
      format: (v) => `${Math.round(v)} 年`, scoring: (g, a) => yearScore(Math.round(g), a) / 100,
    });

    const options = data.options.map((o, i) => ({ id: String(i), label: o.t, hint: o.p, aliases: [o.p] }));
    const res = await ctx.guess({
      title: '它是哪首歌？', options, answer: String(pz.o), maxGuesses: 6, clues: buildClues(ans, year), cluesTitle: '线索',
      columns: ['上榜年份', '最高名次', '在榜周数'],
      scoring: (n, won) => songScore(n, won),
      near: (g) => Math.abs(data.options[+g.id].y - year) <= 2,
      feedback: (g) => {
        const o = data.options[+g.id]; const dy = year - o.y;
        const cmp = (a, b) => (a === b ? 'hit' : Math.abs(a - b) <= 3 ? 'near' : undefined);
        return [
          { text: dy === 0 ? `${o.y} 同年` : `${o.y} ${dy > 0 ? '↑' : '↓'}`, state: dy === 0 ? 'hit' : Math.abs(dy) <= 2 ? 'near' : undefined, num: true },
          { text: `#${o.k} ${o.k > ans.k ? '↑' : o.k < ans.k ? '↓' : ''}`, state: cmp(o.k, ans.k), num: true },
          { text: `${o.w} ${ans.w > o.w ? '↑' : ans.w < o.w ? '↓' : ''}`, state: cmp(o.w, ans.w), num: true },
        ];
      },
    });

    const out = ctx.combine([r1, res]);
    const f = runFacts(pz.run);
    out.detail = ui.kv([
      ['答案', `${ans.t} — ${ans.p}`],
      ['上榜', `${pz.start}（${year} 年）入榜，最高第 ${f.peak}，在榜 ${f.weeks} 周，第 ${f.peakIdx + 1} 周到达峰值`],
      ['规律', patternText(pz, ans, data)],
    ]);
    return out;
  },
};
