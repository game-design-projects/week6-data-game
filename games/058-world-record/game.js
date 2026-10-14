// #58 World Record — a speedrun world-record progression curve; guess the game.

/** Seconds → "1:23:45" / "12:34.5" / "56.78 s". */
export function fmtT(s) {
  if (s >= 3600) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${(sec < 10 ? '0' : '') + sec.toFixed(sec % 1 ? 1 : 0)}`;
  }
  return `${s < 10 ? s.toFixed(2) : s.toFixed(1)} s`;
}

/** Percentage the record fell from first to latest, 0..100. */
export const dropPct = (pts) => Math.round((1 - pts[pts.length - 1][1] / pts[0][1]) * 100);

/** Year-gap feedback cell for a guessed game vs the answer. */
export function yearCell(g, a) {
  const d = a.year - g.year;
  if (d === 0) return { text: `${g.year}`, state: 'hit', num: true };
  return { text: `${g.year} ${d > 0 ? '↑' : '↓'}`, state: Math.abs(d) <= 3 ? 'near' : undefined, num: true };
}

/** Magnitude feedback: current record length on a log scale. */
export function lengthCell(g, a) {
  const r = Math.log10(g.wr / a.wr);
  const text = fmtT(g.wr);
  if (Math.abs(r) < 0.05) return { text, state: 'hit', num: true };
  return { text: `${text} ${r > 0 ? '↓' : '↑'}`, state: Math.abs(r) < 0.3 ? 'near' : undefined, num: true };
}

export default {
  meta: {
    num: 58,
    slug: 'world-record',
    title: 'World Record',
    tagline: '一款游戏速通世界纪录的演进曲线，只剩时间和年份。猜它是哪款游戏。',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '阶梯图里每一级台阶是一次新的世界纪录：横轴是日期，纵轴是通关用时（对数刻度）。',
      '从列表里选游戏来猜，最多 6 次。每猜错一次解锁一条线索：跑的分类、发售年、平台、纪录总数、首字母。',
      '读曲线：老游戏的纪录往往在十几年里一点点磨；突然的断崖说明发现了新的瞬移或跳关技巧；用时长短能排除大量游戏。',
      '每次猜测会告诉你那款游戏的发售年和当前纪录时长相对答案是偏大还是偏小。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'speedrun.com REST API v1', url: 'https://github.com/speedruncomorg/api', note: '已审核（verified）跑分记录，按提交日期推出每个分类的世界纪录演进' },
    ],
    dataNote: '纪录曲线由 speedrun.com 上已审核的历史跑分按日期推算：某日之前最快的成绩即当时的世界纪录。若分类有子分类，取默认子分类；部分热门分类受 API 条数限制只含最早的约 8000 条记录。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.games).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const games = ctx.data.games;
    const byId = new Map(games.map((g) => [g.id, g]));
    const ans = byId.get(p.id);
    const pts = ans.pts; // [[days since 1970-01-01? -> ISO date, seconds]]
    ctx.log('answer', ans.name, ans.cat, pts.length, 'records');

    const rows = pts.map(([d, s]) => ({ date: new Date(`${d}T00:00:00Z`), s }));
    const last = rows[rows.length - 1];
    const chart = await ui.plot((Plot, c) => ({
      height: 300,
      marginLeft: 56,
      x: { type: 'utc', label: null },
      y: { type: 'log', label: '通关用时', grid: true, tickFormat: (v) => fmtT(v), ticks: 6 },
      marks: [
        Plot.line(rows, { x: 'date', y: 's', stroke: c.accent, strokeWidth: 2, curve: 'step-after' }),
        Plot.dot(rows, { x: 'date', y: 's', fill: c.accent, r: 2.5 }),
        Plot.dot([last], { x: 'date', y: 's', fill: c.ink, r: 5 }),
        Plot.tip(rows, Plot.pointerX({ x: 'date', y: 's', title: (d) => `${d.date.toISOString().slice(0, 10)}\n${fmtT(d.s)}` })),
      ],
    }));

    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'small muted' }, `共 ${pts.length} 次世界纪录；黑点是最新一次。`)),
      `速通的分类是「${ans.cat}」。`,
      `这款游戏发售于 ${ans.year} 年。从第一个纪录到最新纪录，用时缩短了 ${dropPct(pts)}%。`,
      `主要平台：${ans.platforms.slice(0, 3).join(' / ')}。`,
      `第一个纪录是 ${fmtT(pts[0][1])}（${pts[0][0].slice(0, 4)} 年），现在是 ${fmtT(ans.wr)}。`,
      `游戏英文名以 “${ans.name[0]}” 开头，共 ${ans.name.length} 个字符。`,
    ];

    const res = await ctx.guess({
      options: games.map((g) => ({ id: g.id, label: g.name, hint: String(g.year) })),
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪款游戏的世界纪录？',
      placeholder: '输入游戏名…',
      clues,
      cluesTitle: '纪录曲线和线索',
      columns: ['发售年', '当前纪录'],
      near: (g, a) => Math.abs(byId.get(g.id).year - byId.get(a.id).year) <= 3,
      feedback: (g, a) => [yearCell(byId.get(g.id), byId.get(a.id)), lengthCell(byId.get(g.id), byId.get(a.id))],
    });

    // biggest single drop
    let big = null;
    for (let i = 1; i < pts.length; i++) {
      const dr = pts[i - 1][1] - pts[i][1];
      if (!big || dr > big.dr) big = { dr, from: pts[i - 1], to: pts[i] };
    }
    const span = (new Date(last.date) - rows[0].date) / (365.25 * 86400000);
    res.detail = ui.kv([
      ['答案', `${ans.name} · ${ans.cat}`],
      ['发售 / 平台', `${ans.year} · ${ans.platforms.slice(0, 3).join(' / ')}`],
      ['纪录演进', `${fmtT(pts[0][1])} → ${fmtT(ans.wr)}，${span.toFixed(1)} 年里刷新 ${pts.length} 次`],
      ['最大一跳', big ? `${big.to[0]}：${fmtT(big.from[1])} → ${fmtT(big.to[1])}（−${fmtT(big.dr)}）` : '—'],
      ['读图要点', '台阶越密越稳定地磨；断崖式下跌通常是新的瞬移/跳关技巧被发现。'],
    ]);
    return res;
  },
};
