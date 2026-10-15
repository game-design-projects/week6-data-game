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

const NICE = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 900, 1800, 3600, 5400, 7200, 10800, 14400, 21600, 36000, 54000, 72000, 108000, 172800];

/** Round time ticks (1 min, 10 min, 1 h…) inside [lo, hi] for the log axis. */
export function timeTicks(lo, hi) {
  const t = NICE.filter((v) => v >= lo && v <= hi);
  if (t.length < 3) { // narrow range: log-spaced ticks rounded to a sensible unit
    const unit = hi >= 3600 ? 60 : hi >= 300 ? 10 : 1;
    const out = [0, 1, 2, 3].map((i) => Math.round((lo * (hi / lo) ** ((i + 0.5) / 4)) / unit) * unit);
    return [...new Set(out)];
  }
  if (t.length <= 7) return t;
  const step = Math.ceil(t.length / 6);
  return t.filter((_, i) => i % step === 0);
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

/** Whole days between two ISO dates (b - a). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Largest single relative drop between consecutive records. */
export function biggestDrop(pts) {
  let big = null;
  for (let i = 1; i < pts.length; i++) {
    const frac = 1 - pts[i][1] / pts[i - 1][1];
    if (!big || frac > big.frac) big = { frac, from: pts[i - 1], to: pts[i] };
  }
  return big;
}

/** Puzzle-specific "what gave it away" sentences, from the curve itself. */
export function readingNotes(g, today) {
  const pts = g.pts;
  const notes = [];
  const lag = +pts[0][0].slice(0, 4) - g.year;
  if (lag >= 8) notes.push(`发售于 ${g.year} 年，但第一条纪录要到 ${pts[0][0].slice(0, 4)} 年才出现：这是靠社区后来“考古”起来的老游戏，曲线整体起点很晚。`);
  else if (lag <= 1) notes.push(`发售 ${g.year} 年，当年就有纪录：曲线从发售期开始，早期台阶陡，说明玩家在快速摸索路线。`);
  else notes.push(`发售于 ${g.year} 年，纪录从 ${pts[0][0].slice(0, 4)} 年开始，相隔 ${lag} 年。`);
  const big = biggestDrop(pts);
  if (big && big.frac >= 0.12) notes.push(`最大的断崖在 ${big.to[0]}：${fmtT(big.from[1])} → ${fmtT(big.to[1])}（−${Math.round(big.frac * 100)}%），通常是发现了新的跳关/瞬移技巧或换了路线。`);
  else notes.push(`没有明显断崖，最大一次也只快了 ${Math.round((big?.frac ?? 0) * 100)}%：一点点磨出来的曲线，接近技术极限。`);
  const stale = daysBetween(pts.at(-1)[0], today) / 365.25;
  if (stale >= 3) notes.push(`最近一次刷新在 ${pts.at(-1)[0]}，已有 ${stale.toFixed(1)} 年没人破纪录，圈子趋于“收官”。`);
  else if (stale < 0.5) notes.push(`最近一次刷新在 ${pts.at(-1)[0]}，半年内还有人在破纪录，游戏仍然活跃。`);
  const span = daysBetween(pts[0][0], pts.at(-1)[0]) / 365.25;
  notes.push(`${span.toFixed(1)} 年里共 ${pts.length} 次刷新，平均每年 ${(pts.length / Math.max(span, 0.5)).toFixed(1)} 次。`);
  return notes;
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
      '阶梯图里每一级台阶是一次新的世界纪录：横轴是日期，纵轴是通关用时（对数刻度），黑点是最新一次。',
      '从列表里选游戏来猜，最多 6 次。每猜错一次解锁一条线索：速通分类、发售年和降幅、平台、首末纪录、英文名首字母。',
      '读曲线：老游戏的纪录往往在十几年里一点点磨；突然的断崖说明发现了新的瞬移或跳关技巧；用时长短能排除大量游戏。',
      '每次猜测会告诉你那款游戏的发售年和当前纪录时长相对答案是偏大还是偏小（↑ 答案更大，↓ 答案更小）。',
    ],
    scoring: '第 1 次猜中 100 分，第 2 次约 83 分，之后每多一次再少约 17 分；6 次都没猜中 0 分。',
    sources: [
      { name: 'speedrun.com REST API v1', url: 'https://github.com/speedruncomorg/api/blob/master/version1/README.md', note: '已审核（verified）跑分记录，按提交日期推出每个分类的世界纪录演进' },
    ],
    dataNote: '数据是快照（2026-10-15 抓取）：speedrun.com API 带 CORS，但本游戏不需要“昨天”的数据，历史曲线才是谜面，所以没有做实时加载。纪录曲线由已审核的历史跑分按提交日期推算：某日之前最快的成绩即当时的世界纪录；有子分类的分类取默认子分类。每个分类最多取最早和最新各 10000 条记录（API 偏移上限），已覆盖绝大多数分类。提示里的分类名已去掉含有游戏名的词，平台列表去掉了后来的移植/复刻平台。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.games).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const games = ctx.data.games;
    const byId = new Map(games.map((g) => [g.id, g]));
    const ans = byId.get(p.id);
    const pts = ans.pts;
    ctx.log('answer', ans.name, ans.cat, pts.length, 'records');

    const rows = pts.map(([d, s]) => ({ date: new Date(`${d}T00:00:00Z`), s }));
    const last = rows[rows.length - 1];
    const lo = Math.min(...pts.map((q) => q[1])) * 0.85, hi = Math.max(...pts.map((q) => q[1])) * 1.15;
    const chart = await ui.plot((Plot, c) => ({
      height: 300,
      marginLeft: 58,
      marginTop: 28,
      x: { type: 'utc', label: null },
      y: { type: 'log', label: '通关用时', grid: true, tickFormat: (v) => fmtT(v), domain: [lo, hi], ticks: timeTicks(lo, hi) },
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
      ans.platforms.length ? `主要平台：${ans.platforms.join(' / ')}。` : '这款游戏在 speedrun.com 上没有标注平台。',
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

    res.detail = ui.kv([
      ['答案', `${ans.name} · ${ans.cat}`],
      ['发售 / 平台', `${ans.year}${ans.platforms.length ? ' · ' + ans.platforms.join(' / ') : ''}`],
      ['纪录演进', `${fmtT(pts[0][1])} → ${fmtT(ans.wr)}（${pts[0][0]} → ${pts.at(-1)[0]}）`],
      ['这条曲线的特征', ui.h('div', ...readingNotes(ans, ctx.date).map((t) => ui.h('div', { style: { marginBottom: '4px' } }, t)))],
    ]);
    return res;
  },
};
