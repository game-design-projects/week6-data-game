// #89 Ticker Runner — a platformer whose terrain is one trading day of an index (5-minute bars).
// Coins sit on the strongest rallies, spikes on the sharpest sell-offs.

export const V = 6; // bars per second
export const GRAV = 3.27, JUMP = 1.2; // heights in fractions of screen height → apex ≈ 0.22
export const COIN_H = 0.17, SPIKE_W = 0.45, COIN_TOL = 0.05, COIN_DX = 0.55, JUMP_FREE = 3, JUMP_COST = 4;

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
  const byDrop = [...idx].sort((a, b) => span(a) - span(b) || a - b).filter((i) => up.every((u) => Math.abs(u - i) >= 5));
  let down = [];
  for (const gap of [9, 7, 6, 5]) { down = spaced(byDrop, gap, 4); if (down.length === 4) break; } // relax spacing if the greedy pick got boxed in
  const coins = up.sort((a, b) => a - b).flatMap((i) => [i, i + 1, i + 2].map((x) => ({ x, grp: i })));
  const spikes = down.sort((a, b) => a - b).map((i) => ({ x: i + 1 }));
  return { n, ground, coins, spikes, lo, hi, up, down };
}

export const groundAt = (c, x) => {
  const i = Math.max(0, Math.min(c.n - 1, Math.floor(x))), j = Math.min(c.n - 1, i + 1);
  return c.ground[i] + (c.ground[j] - c.ground[i]) * Math.max(0, Math.min(1, x - i));
};

export const newRun = () => ({ x: 0, h: 0, vy: 0, got: new Set(), hits: 0, hitAt: [], jumps: 0, inv: 0, done: false });

/** Pure fixed-step physics shared by the game and the tests. */
export function step(c, s, dt, jump) {
  if (s.done) return s;
  if (jump && s.h === 0) { s.vy = JUMP; s.jumps++; }
  s.vy -= GRAV * dt; s.h += s.vy * dt;
  if (s.h <= 0) { s.h = 0; s.vy = 0; }
  s.x += V * dt; s.inv = Math.max(0, s.inv - dt);
  c.coins.forEach((k, i) => { if (!s.got.has(i) && Math.abs(k.x - s.x) < COIN_DX && Math.abs(s.h - COIN_H) < COIN_TOL) s.got.add(i); });
  if (!s.inv) for (const k of c.spikes) if (Math.abs(k.x - s.x) < SPIKE_W && s.h < 0.05) { s.hits++; s.hitAt.push(k.x); s.inv = 1; break; }
  if (s.x >= c.n - 1) s.done = true;
  return s;
}

export const jumpBudget = (c) => c.up.length + c.spikes.length + JUMP_FREE;
export const scoreRun = (c, s) => Math.max(0, Math.round(100 * s.got.size / c.coins.length - 10 * s.hits - JUMP_COST * Math.max(0, s.jumps - jumpBudget(c))));

/** Bot: one jump per coin group / spike, then a few passes of coordinate ascent on each jump's timing. */
export function botJumps(c) {
  const js = [...c.up.map((x) => x + 1), ...c.spikes.map((k) => k.x - 1)].sort((a, b) => a - b).map((x) => x - 2.2);
  let best = scoreRun(c, simulate(c, js));
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < js.length; i++) for (const d of [-0.6, -0.4, -0.2, 0.2, 0.4, 0.6]) {
    const t = js.slice(); t[i] += d; t.sort((a, b) => a - b);
    const sc = scoreRun(c, simulate(c, t));
    if (sc > best) { best = sc; js.splice(0, js.length, ...t); }
  }
  return js;
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
      '每天的关卡是一个真实交易日的 5 分钟走势（最近约 60 个交易日里的标普 500、纳指、道指或罗素 2000），地形越高价格越高。每天的地形都被拉伸到同样高度，所以平静的一天也有起伏。',
      '角色自动向右跑，点击屏幕（或按空格 / 上箭头）起跳，落地后才能再跳。',
      '金币悬在当天涨得最快的 5 段上，要在跳到最高点附近时才吃得到；红色尖刺立在跌得最狠的 4 段，要提前起跳跳过去。',
      '起跳到最高点大约需要 2 根 K 线（0.37 秒）：看到陡坡就要提前跳。别乱跳，多余的跳跃会扣分。',
    ],
    scoring: '吃到的金币占总数的百分比；每踩中一次尖刺扣 10 分；起跳次数超过「金币组 + 尖刺 + 3」后，每多跳一次扣 4 分。60 分以上算通关。',
    sources: [{ name: 'Yahoo Finance chart API（5 分钟 K 线）', url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=60d&interval=5m', note: '标普 500 ^GSPC、纳指 ^IXIC、道指 ^DJI、罗素 2000 ^RUT；每日重采样为 78 根收盘价' }],
    dataNote: '数据是构建时下载的快照（最近约 60 个交易日），不是实时的“昨天”。原创意要求实时行情，但已逐一验证过的免费端点都不能在浏览器直接调用：Yahoo Finance chart API 与 Cboe 延迟行情（cdn.cboe.com，仅最近一天的分钟线）、Stooq、FRED 均不返回 Access-Control-Allow-Origin；Twelve Data、Polygon、Financial Modeling Prep、MarketData 需要 API Key。密钥不能放进前端，也不做代理，所以保留快照。',
  },

  puzzle({ data, pick }) {
    const d = pick(data.days);
    return { sym: d.sym, name: d.name, date: d.date, bars: d.bars };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const c = buildCourse(p.bars);
    const log = ctx.log.scope('runner');
    const open = p.bars[0], close = p.bars[p.bars.length - 1];
    log('course', p.sym, p.date, { coins: c.coins.length, spikes: c.spikes.length });
    ctx.stage.append(ui.panel({ kicker: `${p.date} · ${p.name}`, title: '今天的地形' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '100px' } },
        ui.stat({ label: '日内振幅', value: core.fmtPct((c.hi - c.lo) / open, 2) }), ui.stat({ label: '最低', value: core.fmtNum(c.lo, 0) }), ui.stat({ label: '最高', value: core.fmtNum(c.hi, 0) }),
        ui.stat({ label: '金币', value: String(c.coins.length) }), ui.stat({ label: '尖刺', value: String(c.spikes.length) }))));

    const W = 20; // visible bars
    const draw = (g, k, s, wait) => {
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
      g.globalAlpha = s.inv && Math.floor((k.t || 0) * 20) % 2 ? 0.35 : 1;
      g.beginPath(); g.arc(X(s.x), py - r, r, 0, 7); g.fillStyle = col.accent; g.fill(); g.strokeStyle = col.ink; g.lineWidth = 2; g.stroke();
      g.globalAlpha = 1;
      k.hud.textContent = wait > 0 ? '准备…点击屏幕起跳' : `${hhmm(s.x, c.n)} · 金币 ${s.got.size}/${c.coins.length} · 尖刺 ${s.hits} · 起跳 ${s.jumps}`;
    };
    const run = await new Promise((resolve) => {
      const s = newRun();
      let settle = 0, wait = ctx.autoplay ? 0 : 1.2, jumpQ = false, fin = false;
      const bot = ctx.autoplay ? botJumps(c) : []; let bk = 0;
      const end = () => { if (fin) return; fin = true; st.stop(); log('end', { coins: s.got.size, hits: s.hits, jumps: s.jumps }); resolve(s); };
      const st = ctx.canvas({
        aspect: 1.6,
        onPointer(type) { if (type === 'down') jumpQ = true; },
        onKey(type, e) { if (type === 'down' && (e.code === 'Space' || e.key === 'ArrowUp')) { e.preventDefault(); jumpQ = true; } },
        onFrame(dt, g, k) {
          if (ctx.autoplay) { // fast-forward the bot run, then draw the final frame
            for (let i = 0; i < 2000 && !s.done; i++) { const j = bk < bot.length && s.x >= bot[bk]; if (j) bk++; step(c, s, 1 / 60, j); }
            draw(g, k, s, 0);
            if (++settle < 3) return; // let the canvas settle so the final frame stays visible
            return end();
          }
          if (wait > 0) wait -= dt; else { const sub = Math.max(1, Math.ceil(dt * 60)); for (let i = 0; i < sub; i++) step(c, s, dt / sub, i === 0 && jumpQ); jumpQ = false; }
          draw(g, k, s, wait);
          if (s.done) end();
        },
      });
      st.hud.style.cssText = 'position:absolute;left:10px;top:8px;font:600 13px var(--font-mono);color:var(--ink)';
      st.start();
    });

    const sc = scoreRun(c, run);
    const best = simulate(c, botJumps(c));
    const t = (i) => hhmm(i, c.n);
    const gotIn = (g) => c.coins.reduce((n, q, i) => n + (q.grp === g && run.got.has(i) ? 1 : 0), 0);
    const missed = c.up.filter((g) => gotIn(g) < 3).sort((a, b) => a - b);
    const biggest = c.up[0], worst = c.down[0];
    const trend = close >= open ? '收涨' : '收跌';
    return {
      score: sc, max: 100, win: sc >= 60,
      emoji: `🏃 ${p.name} ${p.date}\n${c.up.slice().sort((a, b) => a - b).map((g) => (gotIn(g) === 3 ? '🟡' : gotIn(g) ? '🟠' : '⚪')).join('')}${run.hits ? ' ' + '🔺'.repeat(run.hits) : ''}`,
      summary: `${run.got.size}/${c.coins.length} 金币 · ${run.hits} 次受伤 · 起跳 ${run.jumps} 次`,
      detail: ui.kv([
        ['这一天', `${p.date} ${p.name}：开 ${core.fmtNum(open, 0)} → 收 ${core.fmtNum(close, 0)}（${core.fmtPct((close - open) / open, 2)}，${trend}），日内振幅 ${core.fmtPct((c.hi - c.lo) / open, 2)}`],
        ['金币在哪', `5 组金币对应当天涨得最快的 5 个 15 分钟：${c.up.slice().sort((a, b) => a - b).map((g) => `${t(g)}（+${core.fmtNum(p.bars[g + 3] - p.bars[g], 1)} 点）`).join('、')}`],
        ['尖刺在哪', `4 根尖刺对应跌得最狠的 15 分钟：${c.down.slice().sort((a, b) => a - b).map((g) => `${t(g)}（−${core.fmtNum(p.bars[g] - p.bars[g + 3], 1)} 点）`).join('、')}。最狠的是 ${t(worst)}，最陡的上坡在 ${t(biggest)}`],
        ['你的失误', missed.length || run.hits ? `${missed.length ? `没吃满的金币组：${missed.map(t).join('、')}。` : ''}${run.hits ? `踩中尖刺 ${run.hits} 次（${run.hitAt.map((x) => t(x)).join('、')}）。` : ''}` : '金币全吃、尖刺全躲，没有失误。'],
        ['规律', `起跳到最高点要 2.2 根 K 线：金币组悬在上涨起点之后，要在上涨开始前约 1 根 K 线起跳；尖刺在下跌起点，要在下跌开始前约 2 根 K 线起跳。本局你跳了 ${run.jumps} 次，免扣分额度是 ${jumpBudget(c)} 次。`],
        ['满分参考', `机器人最优跳法 ${scoreRun(c, best)} 分（${best.jumps} 次起跳）`],
      ]),
    };
  },
};
