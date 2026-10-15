// #30 Concurrent — five 24-hour "players online" curves from Steam, paired to five games.
// Data: steamcharts.com hourly Steam concurrent-player samples (last ~4 weeks, snapshot in data.json).

/** Time zones used in the explanation (fixed offsets; every date in the pool is before the Oct-25 EU clock change). */
export const ZONES = [['北京', 8], ['柏林', 2], ['纽约', -4]];

/** Wall-clock label for a UTC hour at an offset, e.g. localHour(13, 8) -> "21:00". */
export function localHour(utc, off) {
  const h = (((utc + off) % 24) + 24) % 24;
  return `${String(Math.floor(h)).padStart(2, '0')}:00`;
}

/** "85.6 万" / "9,800" style label for a player count. */
export function fmtPlayers(n) {
  if (n >= 1e6) return `${(n / 1e4).toFixed(0)} 万`;
  if (n >= 1e5) return `${(n / 1e4).toFixed(0)} 万`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万`;
  return Math.round(n).toLocaleString('en-US');
}

export const peakHour = (v) => v.indexOf(Math.max(...v));
export const depth = (v) => Math.min(...v) / Math.max(...v);

/** Turn a game's shape into a one-line, puzzle-specific tell. */
export function tell(item) {
  const d = depth(item.v), ph = peakHour(item.v);
  const dep = Math.round(d * 100);
  const shape = d < 0.2 ? `谷底极深：最低时只有峰值的 ${dep}%，玩家集中在相邻的少数时区`
    : d < 0.45 ? `昼夜起伏明显：最低为峰值的 ${dep}%，主力玩家在某一片地区`
    : `曲线偏平：最低仍有峰值的 ${dep}%，玩家分布在全球各个时区`;
  const loc = ZONES.map(([n, o]) => `${n} ${localHour(ph, o)}`).join(' · ');
  return `${shape}；峰值在 UTC ${String(ph).padStart(2, '0')}:00（${loc}）。`;
}

export default {
  meta: {
    num: 30, slug: 'concurrent', title: 'Concurrent', category: 'tech', data: 'snapshot',
    tagline: '五条 Steam 在线人数的 24 小时曲线，配给五款游戏。时区峰值与人气规模就是破绽。',
    howTo: [
      '每张卡片是一款游戏某天 24 小时（UTC）的同时在线人数，曲线按自己当天的峰值归一化，右上角标出当天的绝对峰值人数。',
      '先看形状：谷底很深、峰值落在亚洲晚上，多半是以亚洲玩家为主的游戏；曲线偏平，说明玩家遍布各个时区。再结合人气规模判断。',
      '为每条曲线选一款游戏（每款只能用一次），提交后会标出哪些配对正确，一共 3 次机会。',
    ],
    scoring: '每对满分 20 分：第 1 次提交就配对正确得 100%，第 2 次得 67%，第 3 次得 33%，3 次后仍错得 0。',
    sources: [
      { name: 'Steam Charts（steamcharts.com）', url: 'https://steamcharts.com/', note: '各游戏 chart-data.json 中的逐小时同时在线人数采样，约 28 天' },
      { name: 'Steam Web API：GetNumberOfCurrentPlayers', url: 'https://partner.steamgames.com/doc/webapi/ISteamUserStats#GetNumberOfCurrentPlayers', note: '官方接口只给「此刻」人数，没有历史，所以没有用于出题' },
    ],
    dataNote: '数据是 2026-09-17 至 2026-10-14（剔除在线人数塌到峰值 5% 以下的停服日） 之间的 Steam 同时在线人数（steamcharts 约每小时采样一次，取每个 UTC 小时的均值）。Steam 官方 API 只返回当前人数，SteamDB 屏蔽脚本访问，steamcharts 的数据接口没有 CORS 头，浏览器里无法实时抓取，所以是构建时下载的快照。个别采样掉线（单点骤降）已用相邻小时插值修复。题库共 90 道：51 款游戏、约 28 个日期的随机组合（同一游戏在不同日期的曲线略有不同）。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    const items = p.ids.map((id) => {
      const g = data.games[id], d = g.days[p.date];
      return { id: String(id), name: g.name, note: g.note ?? null, peak: d.p, v: d.v };
    });
    return { date: p.date, items };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const order = ctx.rng.shuffle([...p.items]);
    ctx.log('puzzle', p.date, p.items.map((i) => i.name).join(' | '));
    const bodies = await Promise.all(order.map((it, i) => ui.plot((Plot, c) => ({
      height: 130, width: 300, marginLeft: 38, marginBottom: 24, marginTop: 8,
      x: { domain: [0, 23], ticks: [0, 6, 12, 18], tickFormat: (h) => String(h).padStart(2, '0'), label: null },
      y: { domain: [0, 100], ticks: [0, 50, 100], label: null, tickFormat: (v) => `${v}%` },
      marks: [
        Plot.areaY(it.v.map((v, h) => ({ h, v: v / 10 })), { x: 'h', y: 'v', fill: c.series[i % c.series.length], fillOpacity: 0.18, curve: 'monotone-x' }),
        Plot.lineY(it.v.map((v, h) => ({ h, v: v / 10 })), { x: 'h', y: 'v', stroke: c.series[i % c.series.length], strokeWidth: 2, curve: 'monotone-x' }),
        Plot.ruleY([0], { stroke: c.muted, strokeOpacity: 0.4 }),
      ],
    }))));
    ctx.stage.append(ui.panel({ kicker: `${p.date} · UTC`, title: '哪条曲线是哪款游戏？' },
      ui.h('p', { class: 'small muted' }, '横轴是 UTC 小时，纵轴是同时在线人数占当天峰值的百分比。换算小抄：UTC 12:00 = 北京 20:00 = 柏林 14:00 = 纽约 08:00。')));
    const res = await ctx.match({
      left: order.map((it, i) => ({ id: it.id, label: `当天峰值 ${fmtPlayers(it.peak)} 人在线`, body: bodies[i] })),
      right: [...p.items].sort((a, b) => a.name.localeCompare(b.name)).map((it) => ({ id: it.id, label: it.name })),
      answer: Object.fromEntries(order.map((it) => [it.id, it.id])),
      attempts: 3, title: '把曲线配给游戏', minWidth: 280,
    });
    // teaching: overlay of all five curves + one block per game with its tell
    const overlay = await ui.plot((Plot, c) => ({
      height: 200, marginLeft: 40, marginRight: 10, marginTop: 10,
      x: { domain: [0, 23], ticks: [0, 6, 12, 18, 23], tickFormat: (h) => String(h).padStart(2, '0'), label: null },
      y: { domain: [0, 100], ticks: [0, 50, 100], label: null, tickFormat: (v) => `${v}%` },
      marks: [
        ...p.items.map((it, i) => Plot.lineY(it.v.map((v, h) => ({ h, v: v / 10 })), { x: 'h', y: 'v', stroke: c.series[i % c.series.length], strokeWidth: 2, curve: 'monotone-x' })),
        ...p.items.map((it, i) => Plot.dot([{ h: peakHour(it.v), v: 100 }], { x: 'h', y: 'v', fill: c.series[i % c.series.length], r: 3.5 })),
      ],
    }));
    const col = ui.colors().series;
    const byPeak = [...p.items].sort((a, b) => peakHour(a.v) - peakHour(b.v));
    const early = byPeak[0], late = byPeak.at(-1);
    const sortedByDepth = [...p.items].sort((a, b) => depth(a.v) - depth(b.v));
    const hh = (it) => String(peakHour(it.v)).padStart(2, '0');
    const blocks = byPeak.map((it) => ui.h('div', { style: { borderLeft: `4px solid ${col[p.items.indexOf(it) % col.length]}`, padding: '2px 0 2px 10px', margin: '8px 0' } },
      ui.h('div', {}, ui.h('b', {}, it.name), ui.h('span', { class: 'small muted' }, `　当天峰值 ${fmtPlayers(it.peak)} 人在线`)),
      ui.h('div', { class: 'small' }, tell(it) + (it.note ? ` ${it.note}` : ''))));
    res.detail = ui.h('div', {},
      ui.h('p', { class: 'small' }, `这天五条曲线里，${early.name} 的峰值最早（UTC ${hh(early)}:00，东半球的晚上），${late.name} 最晚（UTC ${hh(late)}:00，美洲的晚上）；谷底最深的是 ${sortedByDepth[0].name}（最低只有峰值的 ${Math.round(depth(sortedByDepth[0].v) * 100)}%），最平的是 ${sortedByDepth.at(-1).name}（${Math.round(depth(sortedByDepth.at(-1).v) * 100)}%）。`),
      overlay,
      ui.h('div', {}, blocks),
      ui.h('p', { class: 'small muted' }, '规律：玩家主要所在的时区决定峰值落在 UTC 几点（当地晚上 8–10 点），玩家越集中在单一地区，谷底越深；全球游戏则因为总有人醒着而偏平。'));
    return res;
  },
};
