// #89 Ticker Runner — a platformer whose terrain is one trading day of an index (5-minute bars).
// Coins sit on the strongest rallies, spikes on the sharpest sell-offs.

export const V = 6; // bars per second
export const GRAV = 3.27, JUMP = 1.2; // heights in fractions of screen height → apex ≈ 0.22
export const COIN_H = 0.14, SPIKE_W = 0.45;

const spaced = (idx, gap, k) => {
  const out = [];
  for (const i of idx) if (out.length < k && out.every((j) => Math.abs(i - j) >= gap)) out.push(i);
  return out;
};

/** Pure: turn a day's bars into coins, spikes and a normalised ground line. */
export function buildCourse(bars) {
  const lo = Math.min(...bars), hi = Math.max(...bars);
  const ground = bars.map((p) => (p - lo) / (hi - lo || 1));
  const n = bars.length;
  const span = (i) => bars[Math.min(n - 1, i + 3)] - bars[i];
  const idx = [...Array(n - 6).keys()].map((i) => i + 4);
  const up = spaced([...idx].sort((a, b) => span(b) - span(a) || a - b), 9, 5);
  const down = spaced([...idx].sort((a, b) => span(a) - span(b) || a - b).filter((i) => up.every((u) => Math.abs(u - i) >= 5)), 9, 4);
  const coins = up.sort((a, b) => a - b).flatMap((i) => [i, i + 1, i + 2].map((x) => ({ x, grp: i })));
  const spikes = down.sort((a, b) => a - b).map((i) => ({ x: i + 1 }));
  return { n, ground, coins, spikes, lo, hi, up, down };
}

export const groundAt = (c, x) => {
  const i = Math.max(0, Math.min(c.n - 1, Math.floor(x))), j = Math.min(c.n - 1, i + 1);
  return c.ground[i] + (c.ground[j] - c.ground[i]) * Math.max(0, Math.min(1, x - i));
};

export const newRun = () => ({ x: 0, h: 0, vy: 0, got: new Set(), hits: 0, inv: 0, done: false });

/** Pure fixed-step physics shared by the game and the tests. */
export function step(c, s, dt, jump) {
  if (s.done) return s;
  if (jump && s.h === 0) s.vy = JUMP;
  s.vy -= GRAV * dt; s.h += s.vy * dt;
  if (s.h <= 0) { s.h = 0; s.vy = 0; }
  s.x += V * dt; s.inv = Math.max(0, s.inv - dt);
  c.coins.forEach((k, i) => { if (!s.got.has(i) && Math.abs(k.x - s.x) < 0.7 && Math.abs(s.h - COIN_H) < 0.09) s.got.add(i); });
  if (!s.inv) for (const k of c.spikes) if (Math.abs(k.x - s.x) < SPIKE_W && s.h < 0.05) { s.hits++; s.inv = 1; break; }
  if (s.x >= c.n - 1) s.done = true;
  return s;
}

export const scoreRun = (c, s) => Math.max(0, Math.round(100 * s.got.size / c.coins.length - 10 * s.hits));

/** A simple bot: jump 2.2 bars before each coin group / spike. */
export function botJumps(c) {
  return [...c.up, ...c.spikes.map((k) => k.x - 1)].sort((a, b) => a - b).map((x) => x - 2.2);
}
export function simulate(c, jumpXs, dt = 1 / 60) {
  const s = newRun(); let k = 0;
  while (!s.done) { const j = k < jumpXs.length && s.x >= jumpXs[k]; if (j) k++; step(c, s, dt, j); }
  return s;
}

const hhmm = (k, n) => { const m = 570 + Math.round(k * 390 / (n - 1)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

export default {
  meta: {
    num: 89,
    slug: 'ticker-runner',
    title: 'Ticker Runner',
    tagline: '横版跳跃，地形就是某个交易日美股指数的日内走势：吃涨幅金币，跳过暴跌尖刺。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '每天的关卡是一个真实交易日的 5 分钟走势（最近约 60 个交易日的标普 500、纳指、道指、罗素 2000），地形越高价格越高。',
      '角色自动向右跑，点击屏幕（或按空格）起跳。落在滑翔高度时可以吃到金币。',
      '金币出现在当天涨得最快的 5 段上；红色尖刺出现在跌得最狠的 4 段，要提前起跳跳过去。',
      '起跳到顶点大约需要 2 根 K 线的时间：看到陡坡就要提前跳。',
    ],
    scoring: '吃到的金币占总数的百分比，每踩中一次尖刺扣 10 分。',
    sources: [{ name: 'Yahoo Finance chart API（5 分钟 K 线）', url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=60d&interval=5m', note: '标普 500 ^GSPC、纳指 ^IXIC、道指 ^DJI、罗素 2000 ^RUT；每日 78 根 K 线收盘价' }],
    dataNote: '数据是构建时下载的快照（Yahoo 只提供最近 60 天的 5 分钟数据），所以每天的关卡来自这批历史交易日，不是实时的“昨天”。',
  },

  puzzle({ data, pick }) {
    const d = pick(data.days);
    return { sym: d.sym, name: d.name, date: d.date, bars: d.bars };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const c = buildCourse(p.bars);
    const log = ctx.log.scope('runner');
    log('course', p.sym, p.date, { coins: c.coins.length, spikes: c.spikes.length });
    ctx.stage.append(ui.panel({ kicker: `${p.date} · ${p.name}`, title: '今天的地形' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: '最低', value: core.fmtNum(c.lo, 0) }), ui.stat({ label: '最高', value: core.fmtNum(c.hi, 0) }),
        ui.stat({ label: '金币', value: String(c.coins.length) }), ui.stat({ label: '尖刺', value: String(c.spikes.length) }))));

    const W = 20; // visible bars
    const run = await new Promise((resolve) => {
      const s = newRun();
      let wait = ctx.autoplay ? 0 : 1.2, jumpQ = false, fin = false;
      const bot = ctx.autoplay ? botJumps(c) : []; let bk = 0;
      const end = () => { if (fin) return; fin = true; st.stop(); log('end', { coins: s.got.size, hits: s.hits }); resolve(s); };
      const st = ctx.canvas({
        aspect: 1.6,
        onPointer(type) { if (type === 'down') jumpQ = true; },
        onKey(type, e) { if (type === 'down' && (e.code === 'Space' || e.key === 'ArrowUp')) { e.preventDefault(); jumpQ = true; } },
        onFrame(dt, g, k) {
          if (ctx.autoplay) { // fast-forward the bot run
            for (let i = 0; i < 2000 && !s.done; i++) { const j = bk < bot.length && s.x >= bot[bk]; if (j) bk++; step(c, s, 1 / 60, j); }
            return end();
          }
          if (wait > 0) wait -= dt; else { const sub = Math.max(1, Math.ceil(dt * 60)); for (let i = 0; i < sub; i++) step(c, s, dt / sub, i === 0 && jumpQ); jumpQ = false; }
          const col = k.colors, px = k.w / W, camX = s.x - W * 0.25;
          const gy = (x) => k.h * (0.78 - 0.5 * groundAt(c, x));
          const X = (x) => (x - camX) * px;
          g.clearRect(0, 0, k.w, k.h);
          g.fillStyle = col.paper2; g.fillRect(0, 0, k.w, k.h);
          g.beginPath(); g.moveTo(0, k.h);
          for (let sx = 0; sx <= k.w; sx += 4) g.lineTo(sx, gy(camX + sx / px));
          g.lineTo(k.w, k.h); g.closePath(); g.fillStyle = col.card; g.fill();
          g.strokeStyle = col.ink; g.lineWidth = 2.5; g.stroke();
          c.coins.forEach((q, i) => {
            if (s.got.has(i)) return; const x = X(q.x); if (x < -10 || x > k.w + 10) return;
            g.beginPath(); g.arc(x, gy(q.x) - COIN_H * k.h, Math.max(5, px * 0.28), 0, 7); g.fillStyle = col.near; g.fill(); g.strokeStyle = col.ink; g.lineWidth = 1.5; g.stroke();
          });
          for (const q of c.spikes) {
            const x = X(q.x), y = gy(q.x); if (x < -20 || x > k.w + 20) continue;
            const w = px * SPIKE_W;
            g.beginPath(); g.moveTo(x - w, y + 1); g.lineTo(x, y - k.h * 0.09); g.lineTo(x + w, y + 1); g.closePath(); g.fillStyle = col.bad; g.fill();
          }
          const py = gy(s.x) - s.h * k.h, r = Math.max(8, px * 0.4);
          g.globalAlpha = s.inv && Math.floor(s.t * 20) % 2 ? 0.35 : 1;
          g.beginPath(); g.arc(X(s.x), py - r, r, 0, 7); g.fillStyle = col.accent; g.fill(); g.strokeStyle = col.ink; g.lineWidth = 2; g.stroke();
          g.globalAlpha = 1;
          k.hud.textContent = wait > 0 ? '准备…点击屏幕起跳' : `${hhmm(s.x, c.n)} · 金币 ${s.got.size}/${c.coins.length} · 尖刺 ${s.hits}`;
          if (s.done) end();
        },
      });
      st.hud.style.cssText = 'position:absolute;left:10px;top:8px;font:600 13px var(--font-mono);color:var(--ink)';
      st.start();
    });

    const sc = scoreRun(c, run);
    const best = simulate(c, botJumps(c));
    const biggest = c.up[0], worst = c.down[0];
    const open = p.bars[0], close = p.bars[p.bars.length - 1];
    return {
      score: sc, max: 100, win: sc >= 60,
      emoji: `🏃 ${p.sym}\n${'🟡'.repeat(run.got.size >= 1 ? Math.min(5, Math.ceil(run.got.size / 3)) : 0)}${'⬜'.repeat(5 - Math.min(5, Math.ceil(run.got.size / 3)))}${run.hits ? ' 🔺'.repeat(run.hits) : ''}`,
      summary: `${run.got.size}/${c.coins.length} 金币 · ${run.hits} 次受伤`,
      detail: ui.kv([
        ['这一天', `${p.date} ${p.name}：开 ${core.fmtNum(open, 0)} → 收 ${core.fmtNum(close, 0)}（${core.fmtPct((close - open) / open, 2)}）`],
        ['最陡的上坡', `${hhmm(biggest, c.n)} 起 15 分钟涨 ${core.fmtNum(p.bars[biggest + 3] - p.bars[biggest], 1)} 点`],
        ['最狠的下跌', `${hhmm(worst, c.n)} 起 15 分钟跌 ${core.fmtNum(p.bars[worst] - p.bars[worst + 3], 1)} 点`],
        ['规律', '陡坡上起跳的时机固定：提前约 2 根 K 线（0.4 秒），顶点正好落在金币高度；尖刺前同样提前起跳。'],
        ['满分参考', `机器人跳法 ${scoreRun(c, best)} 分`],
      ]),
    };
  },
};
