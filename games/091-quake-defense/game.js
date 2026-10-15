// #91 Quake Defense — enemies are the M4.5+ earthquakes of one real UTC day; magnitude sets HP.
export const L = 10; // lane cells
export const BUDGET = 6;
export const MAX_QUAKES = 32; // a day's first 32 quakes (median day has ~20)
export const MIN_QUAKES = 10;
export const TOWERS = [
  null,
  { id: 'gun', name: '机枪', short: '枪', cost: 1, dmg: 3, range: 1 },
  { id: 'cannon', name: '加农炮', short: '炮', cost: 2, dmg: 10, range: 1 },
  { id: 'laser', name: '激光', short: '光', cost: 3, dmg: 6, range: 3 },
];
export const hpOf = (m) => Math.round(Math.pow(2, (m - 4.5) * 2) * 24);
export const costOf = (layout) => layout.reduce((s, t) => s + (TOWERS[t]?.cost ?? 0), 0);

/** USGS GeoJSON (one UTC day) -> {date, quakes:[{m,t,place}]}. */
export function toPuzzle(geo, date) {
  const quakes = (geo?.features ?? [])
    .map((f) => ({ ms: +f.properties?.time, m: Number(f.properties?.mag), place: String(f.properties?.place ?? '') }))
    .filter((q) => Number.isFinite(q.ms) && Number.isFinite(q.m) && q.m >= 4.5 && new Date(q.ms).toISOString().slice(0, 10) === date)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, MAX_QUAKES)
    .map((q) => ({
      m: Math.round(q.m * 10) / 10,
      t: new Date(q.ms).toISOString().slice(11, 16),
      place: q.place.replace(/^\d+(\.\d+)? km [NSEW]+ of /, '').trim() || '未命名区域',
    }));
  return quakes.length >= MIN_QUAKES ? { date, quakes } : null;
}

/** Deterministic lane simulation. Enemy i enters cell 0 at tick i and steps one cell per tick.
 *  Towers fire once per tick, left to right, at the enemy closest to the exit within range. */
export function simulate(quakes, layout, record = false) {
  const n = quakes.length;
  const max = quakes.map((q) => hpOf(q.m));
  const hp = max.slice();
  const towers = [];
  layout.forEach((ty, c) => { if (TOWERS[ty]) towers.push([c, TOWERS[ty].dmg, TOWERS[ty].range]); });
  const frames = [];
  for (let t = 0; t < n + L; t++) {
    for (const [c, dmg, r] of towers) {
      // enemy spawn s sits at cell t-s; in range when |t-s-c| <= r; smallest s = closest to the exit
      const lo = Math.max(0, t - c - r, t - L + 1);
      const hi = Math.min(n - 1, t - c + r, t);
      for (let s = lo; s <= hi; s++) if (hp[s] > 0) { hp[s] -= dmg; break; }
    }
    if (record) {
      const cells = Array(L).fill(null);
      for (let s = Math.max(0, t - L + 1); s <= Math.min(n - 1, t); s++) cells[t - s] = { i: s, hp: Math.max(0, hp[s]), max: max[s] };
      frames.push(cells);
    }
  }
  let killedHP = 0, kills = 0, totalHP = 0;
  const leaked = [];
  for (let i = 0; i < n; i++) {
    totalHP += max[i];
    killedHP += hp[i] <= 0 ? max[i] : max[i] - hp[i];
    if (hp[i] <= 0) kills++; else leaked.push(i);
  }
  return { killedHP, totalHP, kills, leaked, frames };
}

/** Every layout within budget (7,348 of them) — small enough to brute-force the true optimum. */
export function* layouts() {
  const cur = Array(L).fill(0);
  function* rec(c, left) {
    if (c === L) { yield cur.slice(); return; }
    for (let ty = 0; ty < TOWERS.length; ty++) {
      const cost = TOWERS[ty]?.cost ?? 0;
      if (cost > left) continue;
      cur[c] = ty;
      yield* rec(c + 1, left - cost);
    }
    cur[c] = 0;
  }
  yield* rec(0, BUDGET);
}

/** Exhaustive search: true best layout (ties → first found) plus a mid-field reference. */
export function optimise(quakes) {
  let best = null, bestV = -1;
  for (const l of layouts()) {
    const v = simulate(quakes, l).killedHP;
    if (v > bestV) { bestV = v; best = l; }
  }
  return { layout: best, killedHP: bestV };
}

/** Score = 100 × (your damage ÷ best possible damage)². Squared so that a lazy layout (≈ 70% of the
 *  optimum on a typical day) lands near 50 and only careful placement approaches 100. */
export const score = (killedHP, optHP) => (optHP <= 0 ? 100 : Math.round(100 * Math.pow(Math.min(1, killedHP / optHP), 2)));

export const show = (l) => l.map((t) => TOWERS[t]?.short ?? '·').join(' ');

/** Puzzle-specific teaching text. */
export function explain(quakes, leakedIdx, optLayout) {
  const hps = quakes.map((q) => hpOf(q.m));
  const tot = hps.reduce((a, b) => a + b, 0);
  const top = hps.indexOf(Math.max(...hps));
  const small = quakes.filter((q) => q.m < 5).length;
  const share = Math.round((100 * hps[top]) / tot);
  const byPlace = {};
  quakes.forEach((q) => { byPlace[q.place] = (byPlace[q.place] ?? 0) + 1; });
  const [cp, cn] = Object.entries(byPlace).sort((a, b) => b[1] - a[1])[0];
  const parts = [`这一天最大的 M${quakes[top].m.toFixed(1)}（${quakes[top].place}，UTC ${quakes[top].t}）一个就占了总血量的 ${share}%，其余 ${small} 个 M<5 的小震合计只有 ${Math.round((100 * hps.reduce((s, h, i) => s + (quakes[i].m < 5 ? h : 0), 0)) / tot)}%——古登堡-里克特定律：震级每低 1 级，次数约多 10 倍，血量却只有 1/4，所以“量多血薄”和“量少血厚”并存。`];
  if (cn >= 3) parts.push(`${cp} 一带连续出现 ${cn} 次，是余震群：它们挤在队伍里，炮塔的射程内同时有好几个靶子。`);
  const cannons = optLayout.filter((t) => t === 2).length, lasers = optLayout.filter((t) => t === 3).length, guns = optLayout.filter((t) => t === 1).length;
  parts.push(`最优布阵用了 ${[cannons && `${cannons} 门加农炮`, lasers && `${lasers} 台激光`, guns && `${guns} 挺机枪`].filter(Boolean).join('、')}：${top > 0 ? `头目排在第 ${top + 1} 位出场，炮塔要在它经过时凑够火力，` : '头目排在最前面出场，'}同时别把 10 点伤害浪费在小怪身上（溢出的伤害不会传给下一个）。`);
  if (leakedIdx.length) parts.push(`你的布阵漏过了 ${leakedIdx.length} 个敌人（最大 M${Math.max(...leakedIdx.map((i) => quakes[i].m)).toFixed(1)}）。`);
  return parts;
}

export default {
  meta: {
    num: 91,
    slug: 'quake-defense',
    title: 'Quake Defense',
    tagline: '塔防：敌人就是昨天全球的真实地震，震级决定血量。在 10 格通道上布防，挡住地动山摇。',
    category: 'levels',
    data: 'live',
    howTo: [
      `昨天（UTC）全球所有 M4.5 以上的地震（最多取前 ${MAX_QUAKES} 次）按发生时间排成一队，每个滴答前进一格；震级每高 1 级，血量 ×4。`,
      `点格子循环放置 机枪(1 点，伤害 3)、加农炮(2 点，伤害 10)、激光(3 点，伤害 6、射程 3 格)，总预算 ${BUDGET} 点。炮塔每个滴答只开一枪，打射程内最靠近出口的敌人。`,
      '点“开战”观看回放。分数 = 100 ×（你造成的伤害 ÷ 最高可能伤害）²。最高伤害由穷举全部 7,348 种合法布阵得出，不是近似。',
    ],
    scoring: '100 × (你的总伤害 ÷ 穷举得到的最优总伤害)²。0 分 = 没造成伤害，100 分 = 达到最优；随手摆一套大约 50 分。',
    sources: [{ name: 'USGS Earthquake Catalog (FDSN event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: '实时读取昨天 (UTC) 的 M4.5+ 地震；失败时用 2026-06-01 至 2026-10-14 的快照' }],
    dataNote: '关卡 = 昨天（UTC 日）的真实地震，每位玩家拿到同一份名单；读取失败或当天不足 10 次时改用快照中的真实历史日。USGS 偶尔会修订震级，快照与实时可能相差 0.1 级。血量公式 HP = 8·4^(M−4.5) 和炮塔数值是游戏设定。',
  },

  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -1);
    const next = ctx.core.addDays(ctx.date, 0);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${day}&endtime=${next}&minmagnitude=4.5&orderby=time-asc&limit=500`;
    const raw = await ctx.fetchJSON(url, { timeout: 8000 });
    const live = toPuzzle(raw, day);
    ctx.log('live', { day, quakes: live?.quakes.length ?? 0 });
    return live ? { ...ctx.data, live } : null;
  },

  puzzle({ data, pick }) {
    const d = data.live ?? pick(data.pool);
    const opt = optimise(d.quakes);
    return { date: d.date, quakes: d.quakes, opt, live: !!data.live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const log = ctx.log.scope('qd');
    const layout = Array(L).fill(0);
    const hps = p.quakes.map((q) => hpOf(q.m));
    const tot = hps.reduce((s, h) => s + h, 0);
    const top = [...p.quakes.keys()].sort((a, b) => hps[b] - hps[a]).slice(0, 4).sort((a, b) => a - b);

    const chart = await ui.plot((Plot, c) => ({
      marks: [
        Plot.barY(p.quakes.map((q, i) => ({ i: i + 1, hp: hps[i], m: q.m, big: q.m >= 6 })), { x: 'i', y: 'hp', fill: (d) => (d.big ? c.accent : c.muted), title: (d) => `#${d.i}  M${d.m.toFixed(1)}  HP ${d.hp}` }),
        Plot.ruleY([0]),
      ],
      x: { label: null, tickFormat: (d) => d },
      y: { label: 'HP', grid: true },
    }), { height: 190 });
    ctx.stage.append(ui.panel({ kicker: `${p.date}（UTC）· ${p.quakes.length} 次地震 · 总血量 ${tot}`, title: '来袭的敌人（横轴 = 出场顺序）' },
      chart,
      ui.table({ columns: [{ key: 'n', label: '#', num: true }, { key: 't', label: 'UTC' }, { key: 'm', label: '震级', num: true, fmt: (v) => v.toFixed(1) }, { key: 'hp', label: 'HP', num: true }, { key: 'place', label: '地点' }], rows: top.map((i) => ({ n: i + 1, ...p.quakes[i], hp: hps[i] })) }),
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, '上表是血量最厚的 4 个“头目”。敌人从左进、右出，没被打死的按已造成的伤害计分。')));

    const budgetEl = ui.h('div', { class: 'mono' });
    const cells = ui.h('div', { class: 'ds-row', style: { gap: '4px', flexWrap: 'nowrap' } });
    const slots = ui.h('div', { class: 'ds-row mono small', style: { gap: '4px', flexWrap: 'nowrap', marginTop: '6px' } });
    let locked = false;
    const btns = layout.map((_, c) => ui.button('', { onClick: () => {
      if (locked) return;
      const prev = layout[c];
      for (let k = 1; k <= 4; k++) {
        layout[c] = (prev + k) % 4;
        if (costOf(layout) <= BUDGET) break;
      }
      refresh();
    } }));
    btns.forEach((b) => { b.style.flex = '1 1 0'; b.style.minWidth = '0'; b.style.padding = '12px 0'; b.style.minHeight = '44px'; cells.append(b); });
    const slotEls = layout.map(() => { const s = ui.h('div', { style: { flex: '1 1 0', minWidth: '0', textAlign: 'center', minHeight: '1.4em' } }); slots.append(s); return s; });
    const refresh = () => {
      btns.forEach((b, c) => { b.textContent = TOWERS[layout[c]]?.short ?? '＋'; b.setAttribute('aria-label', `第 ${c + 1} 格：${TOWERS[layout[c]]?.name ?? '空'}`); });
      budgetEl.textContent = `已用 ${costOf(layout)} / ${BUDGET} 点`;
    };
    refresh();
    const go = ui.button('开战', { variant: 'accent' });
    const clear = ui.button('清空', { variant: 'ghost', onClick: () => { if (locked) return; layout.fill(0); refresh(); } });
    ctx.stage.append(ui.panel({ kicker: '布防', title: '布置炮塔' },
      ui.kv(TOWERS.slice(1).map((t) => [`${t.short} ${t.name}`, `${t.cost} 点 · 伤害 ${t.dmg} · 射程 ${t.range} 格`])),
      ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, '点格子依次切换 空 → 枪 → 炮 → 光。炮塔每个滴答开一枪，只打自己所在格前后射程内的敌人。'),
      ui.h('div', { style: { height: '10px' } }), cells, slots, ui.h('div', { style: { height: '8px' } }), budgetEl,
      ui.h('div', { style: { height: '8px' } }), ui.row(go, clear)));

    if (ctx.autoplay) { layout[2] = 2; layout[5] = 2; layout[7] = 1; refresh(); } else await new Promise((r) => go.addEventListener('click', r));
    locked = true; go.disabled = true; clear.disabled = true;
    const sim = simulate(p.quakes, layout, true);
    if (!ctx.autoplay) {
      for (const fr of sim.frames) {
        fr.forEach((e, c) => { slotEls[c].textContent = e ? (e.hp > 0 ? String(e.hp) : '✕') : ''; slotEls[c].style.opacity = e && e.hp <= 0 ? '0.4' : '1'; slotEls[c].style.color = e && e.hp > 0 ? 'var(--accent)' : 'var(--muted)'; });
        await ctx.sleep(110);
      }
      slotEls.forEach((s) => { s.textContent = ''; });
    }
    const sc = score(sim.killedHP, p.opt.killedHP);
    log('result', { layout, killed: sim.killedHP, opt: p.opt.killedHP, sc });
    const blocks = Math.round(sc / 10);
    const res = {
      score: sc, max: 100, win: sim.leaked.length === 0,
      summary: `击杀 ${sim.kills}/${p.quakes.length} · 伤害 ${sim.killedHP}/${tot}`,
      emoji: `🌋 ${p.date}\n${'█'.repeat(blocks)}${'░'.repeat(10 - blocks)} ${sc}`,
    };
    const leakTxt = sim.leaked.length ? sim.leaked.slice(0, 8).map((i) => `M${p.quakes[i].m.toFixed(1)}`).join('、') + (sim.leaked.length > 8 ? ` 等 ${sim.leaked.length} 个` : '') : '无';
    res.detail = ui.kv([
      ['你的布阵', `${show(layout)}（伤害 ${sim.killedHP}）`],
      ['最优布阵', `${show(p.opt.layout)}（伤害 ${p.opt.killedHP}，穷举所有布阵）`],
      ['漏过的敌人', leakTxt],
      ...explain(p.quakes, sim.leaked, p.opt.layout).map((t, i) => [i === 0 ? '规律' : '', t]),
    ]);
    return res;
  },
};
