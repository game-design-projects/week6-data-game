// #91 Quake Defense — enemies are the M4.5+ earthquakes of one real day; magnitude sets HP.
export const L = 10; // lane cells
export const BUDGET = 6;
export const TOWERS = [
  null,
  { id: 'gun', name: '机枪', cost: 1, dmg: 3, range: 1, icon: '·' },
  { id: 'cannon', name: '加农炮', cost: 2, dmg: 10, range: 1, icon: '◎' },
  { id: 'laser', name: '激光', cost: 3, dmg: 6, range: 3, icon: '≋' },
];
export const hpOf = (m) => Math.round(Math.pow(2, (m - 4.5) * 2) * 8);
export const costOf = (layout) => layout.reduce((s, t) => s + (TOWERS[t]?.cost ?? 0), 0);

/** Deterministic lane simulation. layout: array of L ints (0 = empty, else TOWERS index). */
export function simulate(quakes, layout) {
  const en = quakes.map((q, i) => ({ i, hp: hpOf(q.m), max: hpOf(q.m), spawn: i }));
  const dead = new Set();
  const frames = [];
  for (let t = 0; t < quakes.length + L + 1; t++) {
    const alive = en.filter((e) => !dead.has(e.i) && t >= e.spawn && t - e.spawn < L);
    layout.forEach((ty, c) => {
      const tw = TOWERS[ty];
      if (!tw) return;
      const tgt = alive.filter((e) => e.hp > 0 && Math.abs(t - e.spawn - c) <= tw.range).sort((a, b) => b.spawn - a.spawn)[0] ?? null;
      const front = alive.filter((e) => e.hp > 0 && Math.abs(t - e.spawn - c) <= tw.range).sort((a, b) => a.spawn - b.spawn)[0];
      const x = front ?? tgt;
      if (x) { x.hp -= tw.dmg; if (x.hp <= 0) dead.add(x.i); }
    });
    frames.push(alive.map((e) => ({ i: e.i, pos: t - e.spawn, hp: Math.max(0, e.hp) })));
  }
  const killedHP = en.reduce((s, e) => s + (e.hp <= 0 ? e.max : e.max - e.hp), 0);
  const leaked = en.filter((e) => e.hp > 0);
  return { killedHP, totalHP: en.reduce((s, e) => s + e.max, 0), leaked: leaked.map((e) => e.i), kills: dead.size, frames };
}

/** Random-restart hill climbing for a near-optimal layout (deterministic through rng). */
export function optimise(quakes, rng, iters = 1500) {
  const feasible = (l) => costOf(l) <= BUDGET;
  let best = Array(L).fill(0), bestV = 0;
  let cur = best.slice(), curV = 0;
  for (let k = 0; k < iters; k++) {
    const c = cur.slice();
    c[rng.int(0, L - 1)] = rng.int(0, 3);
    if (rng.chance(0.3)) c[rng.int(0, L - 1)] = rng.int(0, 3);
    if (!feasible(c)) continue;
    const v = simulate(quakes, c).killedHP;
    if (v >= curV) { cur = c; curV = v; }
    if (v > bestV) { best = c; bestV = v; }
    if (k % 300 === 299) { cur = best.slice(); curV = bestV; }
  }
  return { layout: best, killedHP: bestV };
}

export const score = (killedHP, optHP) => Math.min(100, Math.round((100 * killedHP) / Math.max(1, optHP)));

export default {
  meta: {
    num: 91,
    slug: 'quake-defense',
    title: 'Quake Defense',
    tagline: '塔防：敌人就是某一天全球的真实地震，震级决定血量。在 10 格通道上布防，挡住地动山摇。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '一天里全球 M4.5 以上的地震按发生时间依次排队走过通道，震级越大血越厚（震级每高 1 级，血量×4）。',
      `点格子循环放置 机枪(1 点)、加农炮(2 点)、激光(3 点，射程 3 格)，总预算 ${BUDGET} 点。炮塔会优先打最先进入射程的敌人。`,
      '点“开战”看结果。你的分数 = 你造成的伤害 ÷ 电脑搜索出的近似最优布阵造成的伤害。',
    ],
    scoring: '100 × 你的总伤害 ÷ 近似最优总伤害（上限 100）。',
    sources: [{ name: 'USGS Earthquake Catalog (FDSN event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: '2026-06-01 至 2026-10-13，M4.5+' }],
    dataNote: '快照数据：每个关卡是一个真实日期的地震（取当天最早的 16 次）。血量公式 HP = 8·4^(M−4.5) 是游戏设定。最优解由爬山搜索得到，不保证全局最优。',
  },

  puzzle({ data, pick, rng }) {
    const d = pick(data.pool);
    const quakes = d.quakes;
    const opt = optimise(quakes, rng);
    return { date: d.date, quakes, opt };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const log = ctx.log.scope('qd');
    const layout = Array(L).fill(0);
    const tot = p.quakes.reduce((s, q) => s + hpOf(q.m), 0);
    ctx.stage.append(ui.panel({ kicker: `${p.date} · ${p.quakes.length} 次地震`, title: '来袭的敌人（按发生时间）' },
      ui.table({ columns: [{ key: 't', label: 'UTC' }, { key: 'm', label: '震级', num: true }, { key: 'hp', label: 'HP', num: true }, { key: 'place', label: '地点' }], rows: p.quakes.map((q) => ({ ...q, hp: hpOf(q.m) })) }),
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, `总血量 ${tot}。敌人从左进、右出，漏过去的血量不计分。`)));

    const budgetEl = ui.h('div', { class: 'mono' });
    const cells = ui.h('div', { class: 'ds-row', style: { gap: '4px', flexWrap: 'nowrap' } });
    const btns = layout.map((_, c) => ui.button('', { onClick: () => {
      const prev = layout[c];
      for (let k = 1; k <= 4; k++) {
        layout[c] = (prev + k) % 4;
        if (costOf(layout) <= BUDGET) break;
      }
      refresh();
    } }));
    btns.forEach((b) => { b.style.flex = '1 1 0'; b.style.minWidth = '0'; b.style.padding = '10px 0'; cells.append(b); });
    const refresh = () => {
      btns.forEach((b, c) => { b.textContent = TOWERS[layout[c]]?.icon ?? '＋'; });
      budgetEl.textContent = `已用 ${costOf(layout)} / ${BUDGET} 点`;
    };
    refresh();
    const out = ui.h('div');
    const go = ui.button('开战', { variant: 'accent' });
    ctx.stage.append(ui.panel({ kicker: '布防', title: '点格子切换炮塔' },
      ui.h('div', { class: 'small muted' }, '＋空 · 机枪 1点 · ◎ 加农炮 2点（伤害高） · ≋ 激光 3点（射程长）'),
      ui.h('div', { style: { height: '8px' } }), cells, ui.h('div', { style: { height: '8px' } }), budgetEl, ui.h('div', { style: { height: '8px' } }), go, out));

    if (ctx.autoplay) { layout[2] = 2; layout[5] = 2; layout[7] = 1; } else await new Promise((r) => go.addEventListener('click', r));
    go.disabled = true;
    const sim = simulate(p.quakes, layout);
    const sc = score(sim.killedHP, p.opt.killedHP);
    log('result', { layout, killed: sim.killedHP, opt: p.opt.killedHP, sc });
    const show = (l) => l.map((t) => TOWERS[t]?.icon ?? '＋').join(' ');
    const res = {
      score: sc, max: 100, win: sim.leaked.length === 0,
      summary: `击杀 ${sim.kills}/${p.quakes.length} · 伤害 ${sim.killedHP}/${tot}`,
      emoji: `🌋 ${p.date}\n${'█'.repeat(Math.round(sc / 10))}${'░'.repeat(10 - Math.round(sc / 10))} ${sc}`,
    };
    res.detail = ui.kv([
      ['你的布阵', show(layout)],
      ['近似最优', `${show(p.opt.layout)}（伤害 ${p.opt.killedHP}）`],
      ['漏过的敌人', sim.leaked.length ? sim.leaked.map((i) => `M${p.quakes[i].m}`).join('、') : '无'],
      ['规律', '地震数量服从古登堡-里克特定律：震级每低 1 级，次数约多 10 倍。所以队伍里小怪成群、大怪罕见——近距小炮清杂兵，加农炮集中处理 M6+ 的头目。'],
    ]);
    return res;
  },
};
