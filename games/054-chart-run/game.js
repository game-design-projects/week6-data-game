// #54 Chart Run — a song's weekly Billboard Hot 100 trajectory: guess the year, then the song.
export function yearOf(start) { return +start.slice(0, 4); }

/** Rank-based score for the year guess: exact 100, 5 years off ≈ 37. */
export function yearScore(guess, answer) { return Math.round(100 * Math.exp(-Math.abs(guess - answer) / 5)); }

export default {
  meta: {
    num: 54,
    slug: 'chart-run',
    title: 'Chart Run',
    tagline: '一首歌在 Billboard Hot 100 上逐周的名次曲线。先猜年份，再猜歌名。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '图里是一首歌登上 Billboard Hot 100 之后每周的名次（越高越靠前）。先根据曲线形状和长度估计它是哪一年上榜的。',
      '年份揭晓后，从列表里选歌曲来猜，最多 6 次。每猜错一次多解锁一条线索。',
      '每次猜测会告诉你那首歌的上榜年份差、最高名次和在榜周数，帮你缩小范围。',
    ],
    scoring: '年份满分 100，差 5 年约 37 分；猜歌第 1 次猜中 100 分，之后每多一次少约 17 分。两部分取平均。',
    sources: [
      { name: 'Billboard Hot 100 历史榜单（utdata/rwd-billboard-data 镜像）', url: 'https://github.com/utdata/rwd-billboard-data' },
      { name: 'Billboard Hot 100', url: 'https://www.billboard.com/charts/hot-100/' },
    ],
    dataNote: '数据为 1958–2022 年每周榜单快照。题库为曾进入前 3 名且在榜 20 周以上的歌，每年最多 3 首；候选列表包含更多前 10 名的歌曲。',
  },

  puzzle({ data, pick }) {
    return { i: data.puzzles.indexOf(pick(data.puzzles)) };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const pz = data.puzzles[p.i];
    const ans = data.options[pz.o];
    const year = yearOf(pz.start);
    ctx.log('chart-run', ans.t, ans.p, year);

    const pts = pz.run.map((r, i) => ({ w: i + 1, r })).filter((d) => d.r != null);
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      x: { label: '上榜第几周' },
      y: { label: '名次', reverse: true, domain: [100, 1], type: 'sqrt' },
      marks: [Plot.areaY(pts, { x: 'w', y: 100, y1: 100, y2: 'r', fill: c.accent, fillOpacity: 0.15 }), Plot.lineY(pts, { x: 'w', y: 'r', stroke: c.accent, strokeWidth: 2 }), Plot.dot(pts, { x: 'w', y: 'r', fill: c.accent, r: 2.5 })],
    }));
    ctx.stage.append(ui.panel({ kicker: '线索', title: '这首歌的逐周名次' }, chart));

    const r1 = await ctx.estimate({
      title: '它是哪一年上榜的？', answer: year, min: 1958, max: 2022, step: 1, initial: 1990,
      format: (v) => `${Math.round(v)} 年`, scoring: (g, a) => yearScore(Math.round(g), a) / 100,
    });

    const first = pz.run.findIndex((x) => x != null);
    const clues = [
      `上榜年份：${year}。`,
      `最高名次第 ${ans.k}，在榜 ${ans.w} 周。`,
      `歌手/乐队名以 “${ans.p[0]}” 开头。`,
      `歌名共 ${ans.t.length} 个字符，首字母 “${ans.t[0]}”。`,
      `歌手/乐队：${ans.p.replace(/[A-Za-z]/g, (ch, i) => (i % 2 ? '▇' : ch))}`,
    ];
    const options = data.options.map((o, i) => ({ id: String(i), label: o.t, hint: o.p, aliases: [o.p] }));
    const res = await ctx.guess({
      title: '它是哪首歌？', options, answer: String(pz.o), maxGuesses: 6, clues, cluesTitle: '线索',
      columns: ['年份差', '最高名次', '在榜周数'],
      near: (g) => Math.abs(data.options[+g.id].y - year) <= 2,
      feedback: (g) => {
        const o = data.options[+g.id]; const dy = o.y - year;
        const cmp = (a, b) => (a === b ? 'hit' : Math.abs(a - b) <= 3 ? 'near' : undefined);
        return [
          { text: dy === 0 ? '同年' : `${o.y} ${dy > 0 ? '↓' : '↑'}`, state: dy === 0 ? 'hit' : Math.abs(dy) <= 2 ? 'near' : undefined, num: true },
          { text: `#${o.k} ${o.k > ans.k ? '↑' : o.k < ans.k ? '↓' : ''}`, state: cmp(o.k, ans.k), num: true },
          { text: `${o.w} ${o.w > ans.w ? '↓' : o.w < ans.w ? '↑' : ''}`, state: cmp(o.w, ans.w), num: true },
        ];
      },
    });

    const out = ctx.combine([r1, res]);
    out.detail = ui.kv([
      ['答案', `${ans.t} — ${ans.p}`],
      ['上榜', `${pz.start}（${year} 年），${ans.w} 周，最高第 ${ans.k}，第 ${pz.run.indexOf(ans.k) + 1} 周到达峰值`],
      ['规律', `从首周第 ${pz.run[first]} 名爬到峰值用了 ${pz.run.indexOf(ans.k)} 周，榜上共 ${pz.run.length} 周。${year < 1990 ? '早年榜单歌曲更新换代快，爬升和下榜都更迅速。' : year < 2013 ? '90 年代起按实际销量与电台播放统计，登顶歌曲停留更久。' : '流媒体计入榜单后，热门歌曲在榜时间明显拉长。'}`],
    ]);
    return out;
  },
};
