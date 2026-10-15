// #91 Quake Defense — enemies are the M4.5+ earthquakes of one real UTC day; magnitude sets HP.
export const L = 10; // lane cells
export const BUDGET = 6;
export const MAX_QUAKES = 32; // a day's first 32 quakes (median day has ~20)
export const MIN_QUAKES = 10;
export const TOWERS = [
  null,
  { id: 'gun', name: 'Gun', short: 'G', cost: 1, dmg: 3, range: 1 },
  { id: 'cannon', name: 'Cannon', short: 'C', cost: 2, dmg: 10, range: 1 },
  { id: 'laser', name: 'Laser', short: 'L', cost: 3, dmg: 6, range: 3 },
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
      place: q.place.replace(/^\d+(\.\d+)? km [NSEW]+ of /, '').trim() || 'Unnamed region',
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
  const parts = [`The day\u2019s biggest, M${quakes[top].m.toFixed(1)} (${quakes[top].place}, ${quakes[top].t} UTC), alone is ${share}% of total HP, while the ${small} quakes under M5 add up to only ${Math.round((100 * hps.reduce((s, h, i) => s + (quakes[i].m < 5 ? h : 0), 0)) / tot)}%. That is the Gutenberg-Richter law: each magnitude step down brings about 10 times as many quakes but only 1/4 the HP, so \u201cmany but thin\u201d and \u201cfew but thick\u201d coexist.`];
  if (cn >= 3) parts.push(`${cp} shows up ${cn} times in a row: an aftershock cluster. They bunch up in the queue, so several targets sit inside a tower\u2019s range at once.`);
  const cannons = optLayout.filter((t) => t === 2).length, lasers = optLayout.filter((t) => t === 3).length, guns = optLayout.filter((t) => t === 1).length;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  parts.push(`The optimal layout uses ${[cannons && plural(cannons, 'cannon'), lasers && plural(lasers, 'laser'), guns && plural(guns, 'gun')].filter(Boolean).join(', ')}. ${top > 0 ? `The boss enters at position ${top + 1}, so the towers must add up enough firepower as it passes,` : 'The boss enters first,'} and you should not waste 10-damage shots on small fry (overkill does not carry over to the next enemy).`);
  if (leakedIdx.length) parts.push(`Your layout let ${leakedIdx.length} ${leakedIdx.length === 1 ? 'enemy' : 'enemies'} through (largest M${Math.max(...leakedIdx.map((i) => quakes[i].m)).toFixed(1)}).`);
  return parts;
}

export default {
  meta: {
    num: 91,
    slug: 'quake-defense',
    title: 'Quake Defense',
    tagline: 'Tower defense where the enemies are yesterday\u2019s real earthquakes and magnitude sets HP. Build a 10-cell lane and hold the line.',
    category: 'levels',
    data: 'live',
    howTo: [
      `Yesterday\u2019s (UTC) M4.5+ earthquakes worldwide (the first ${MAX_QUAKES} at most) line up in the order they happened and advance one cell per tick. Each magnitude step up multiplies HP by 4.`,
      `Tap a cell to cycle through Gun (1 point, damage 3), Cannon (2 points, damage 10) and Laser (3 points, damage 6, range 3 cells). Total budget ${BUDGET} points. Each tower fires once per tick at the enemy nearest the exit within range.`,
      'Hit \u201cFight\u201d to watch the replay. Score = 100 × (your damage ÷ best possible damage)². The best possible is found by brute-forcing all 7,348 legal layouts, not approximated.',
    ],
    scoring: '100 × (your total damage ÷ the brute-force optimal damage)². 0 = no damage, 100 = optimal; a casual layout scores around 50.',
    sources: [{ name: 'USGS Earthquake Catalog (FDSN event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: 'Reads yesterday\u2019s (UTC) M4.5+ quakes live; falls back to a snapshot of 2026-06-01 to 2026-10-14' }],
    dataNote: 'The level is yesterday\u2019s (UTC day) real earthquakes, the same list for every player. If the fetch fails or the day has fewer than 10 quakes, a real historical day from the snapshot is used. USGS sometimes revises magnitudes, so snapshot and live values can differ by 0.1. The HP formula HP = 8·4^(M−4.5) and the tower stats are game design.',
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
    ctx.stage.append(ui.panel({ kicker: `${p.date} (UTC) · ${p.quakes.length} quakes · total HP ${tot}`, title: 'Incoming enemies (x axis = order of arrival)' },
      chart,
      ui.table({ columns: [{ key: 'n', label: '#', num: true }, { key: 't', label: 'UTC' }, { key: 'm', label: 'Mag.', num: true, fmt: (v) => v.toFixed(1) }, { key: 'hp', label: 'HP', num: true }, { key: 'place', label: 'Place' }], rows: top.map((i) => ({ n: i + 1, ...p.quakes[i], hp: hps[i] })) }),
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'The table lists the 4 thickest-HP \u201cbosses\u201d. Enemies enter on the left and exit on the right; any that survive still score for the damage already dealt.')));

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
      btns.forEach((b, c) => { b.textContent = TOWERS[layout[c]]?.short ?? '+'; b.setAttribute('aria-label', `Cell ${c + 1}: ${TOWERS[layout[c]]?.name ?? 'empty'}`); });
      budgetEl.textContent = `${costOf(layout)} / ${BUDGET} points used`;
    };
    refresh();
    const go = ui.button('Fight', { variant: 'accent' });
    const clear = ui.button('Clear', { variant: 'ghost', onClick: () => { if (locked) return; layout.fill(0); refresh(); } });
    ctx.stage.append(ui.panel({ kicker: 'Defense', title: 'Place your towers' },
      ui.kv(TOWERS.slice(1).map((t) => [`${t.short} ${t.name}`, `${t.cost} ${t.cost === 1 ? 'point' : 'points'} · damage ${t.dmg} · range ${t.range} ${t.range === 1 ? 'cell' : 'cells'}`])),
      ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Tap a cell to cycle empty → G → C → L. Each tower fires once per tick, only at enemies within range of its own cell.'),
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
      summary: `Kills ${sim.kills}/${p.quakes.length} · damage ${sim.killedHP}/${tot}`,
      emoji: `🌋 ${p.date}\n${'█'.repeat(blocks)}${'░'.repeat(10 - blocks)} ${sc}`,
    };
    const leakTxt = sim.leaked.length ? sim.leaked.slice(0, 8).map((i) => `M${p.quakes[i].m.toFixed(1)}`).join(', ') + (sim.leaked.length > 8 ? ` and ${sim.leaked.length - 8} more` : '') : 'none';
    res.detail = ui.kv([
      ['Your layout', `${show(layout)} (damage ${sim.killedHP})`],
      ['Best layout', `${show(p.opt.layout)} (damage ${p.opt.killedHP}, brute-forced over all layouts)`],
      ['Leaked enemies', leakTxt],
      ...explain(p.quakes, sim.leaked, p.opt.layout).map((t, i) => [i === 0 ? 'Pattern' : '', t]),
    ]);
    return res;
  },
};
