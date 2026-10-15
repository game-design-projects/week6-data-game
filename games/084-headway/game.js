// #84 Headway — a rhythm game whose beats are the scheduled arrival times of
// trains at one real NYC subway platform (MTA static GTFS), time-compressed.

export const SPEED = 1.5; // game seconds per real minute
export const LEAD = 2.2; // seconds a note is visible before it lands
export const WINDOWS = [[0.08, 100], [0.15, 70], [0.25, 40]]; // |error| s -> points
export const STRAY_PENALTY = 4;

/** Points for a tap that is `err` seconds away from a note (0 = outside window). */
export function judge(err) {
  const a = Math.abs(err);
  for (const [w, p] of WINDOWS) if (a <= w) return p;
  return 0;
}

/** Game-clock time (s) of every note of a puzzle. */
export const noteTimes = (p) => p.notes.map(([s]) => (s / 60) * SPEED);

/** Match taps (game seconds) to notes greedily; returns per-note result and stray count. */
export function grade(times, taps) {
  const res = times.map(() => ({ pts: 0, err: null }));
  let stray = 0;
  for (const t of [...taps].sort((a, b) => a - b)) {
    let best = -1;
    let bd = Infinity;
    times.forEach((nt, i) => {
      const d = Math.abs(t - nt);
      if (res[i].err == null && d < bd) { bd = d; best = i; }
    });
    if (best >= 0 && judge(bd)) res[best] = { pts: judge(bd), err: t - times[best] };
    else stray++;
  }
  const raw = res.reduce((a, r) => a + r.pts, 0) / times.length - stray * STRAY_PENALTY;
  return { res, stray, score: Math.max(0, Math.round(raw)) };
}

const clock = (s) => { const t = Math.floor(s) % 86400; return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`; };

/** Rhythm difficulty from the coefficient of variation of the gaps. */
export function difficulty(cv) { return cv < 0.35 ? '简单' : cv < 0.45 ? '中等' : '困难'; }

/** Gaps between consecutive notes, in real minutes. */
export const gapsOf = (p) => p.notes.slice(1).map((n, i) => (n[0] - p.notes[i][0]) / 60);

/** Puzzle-specific explanation of why the rhythm looks the way it does. */
export function explain(p) {
  const gaps = gapsOf(p);
  const routes = [...new Set(p.notes.flatMap((n) => n[1].split(' ')))];
  const mi = gaps.indexOf(Math.min(...gaps));
  const ma = gaps.indexOf(Math.max(...gaps));
  const chords = p.notes.filter((n) => n[1].includes(' ')).length;
  const f = (v) => v.toFixed(1);
  let s = routes.length === 1
    ? `这个站台只有 ${routes[0]} 线停靠，但间隔仍不均匀（${f(Math.min(...gaps))}–${f(Math.max(...gaps))} 分钟）：这是该线在这个钟点的发车间隔自身的波动。`
    : `${routes.join('、')} 共 ${routes.length} 条线各自按自己的间隔发车，叠加到同一站台后节奏就乱了：最挤的是第 ${mi + 1} 与第 ${mi + 2} 趟之间只隔 ${f(gaps[mi])} 分钟，最空的是第 ${ma + 1} 与第 ${ma + 2} 趟之间隔 ${f(gaps[ma])} 分钟。`;
  if (chords) s += ` 有 ${chords} 个和弦音符，是几条线在 30 秒内先后进站、被合并成了一拍。`;
  s += ' 听出重复的"长—短"组合，就能在音符落下前预判下一拍。';
  return s;
}

/** Tiny WebAudio helper; every call is a no-op if audio is unavailable. */
function makeAudio() {
  let ac = null;
  try { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (AC) ac = new AC(); } catch { ac = null; }
  const blip = (when, freq, dur, vol) => {
    if (!ac) return;
    try {
      const o = ac.createOscillator(); const gn = ac.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      gn.gain.setValueAtTime(vol, when); gn.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(gn); gn.connect(ac.destination); o.start(when); o.stop(when + dur + 0.02);
    } catch { /* ignore */ }
  };
  return { ac, blip, close() { try { ac && ac.close(); } catch { /* ignore */ } } };
}

export default {
  meta: {
    num: 84,
    slug: 'headway',
    title: 'Headway',
    tagline: '节奏游戏：鼓点就是纽约某个地铁站台的真实列车到站时间。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '今天给你一个真实站台的一段列车时刻表：15 分钟被压缩成约 22 秒，每趟车是一颗下落的音符，几条线同时进站会合并成一拍。',
      '点击开始后有 2 秒预备。音符落到底部的线上时点击屏幕（或按空格）；有声音时每个音符落线都会"嘀"一声，你的点击是更高的"嘟"。',
      '时刻表不是均匀的：高峰密集、线路交汇处忽长忽短，记住"长—短"的规律就能提前预判。',
      '误差 80 毫秒内 100 分，150 毫秒内 70 分，250 毫秒内 40 分；漏掉的音符 0 分；没有音符时乱点每次扣 4 分。',
    ],
    scoring: '总分 = 每个音符得分的平均值 − 乱点惩罚（最低 0）。每个音符的得分按误差取 100 / 70 / 40 / 0。',
    sources: [
      { name: 'MTA NYC Subway static GTFS', url: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip', note: 'stop_times.txt 的计划到站时刻' },
    ],
    dataNote: '用的是 MTA 公布的计划时刻表（GTFS static），不是当天的实时到站：MTA 的 GTFS-Realtime 只提供"当前与未来"的 protobuf 预测、没有历史，每位玩家看到的会不一样，无法做成每天同一题，所以保留快照。同一站台 30 秒内到达的多条线合并为一个音符；节奏过于均匀（如固定 2 分钟一班）的时段已被剔除。',
  },

  puzzle({ data, pick }) {
    return pick(data.puzzles);
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const times = noteTimes(p);
    const N = times.length;
    ctx.log(`headway: ${p.station} ${p.dir} ${p.service}, ${N} notes`);
    const gapsMin = gapsOf(p);
    const routes = [...new Set(p.notes.flatMap((n) => n[1].split(' ')))];

    ctx.stage.append(ui.panel(
      { kicker: `${p.service} · ${clock(p.startSec)} 起的 15 分钟`, title: `${p.station} · ${p.dir}（开往 ${p.head}）` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: '列车', value: String(N), sub: '个音符' }),
        ui.stat({ label: '节奏难度', value: difficulty(p.cv), sub: '间隔越不齐越难' }),
        ui.stat({ label: '线路', value: `${routes.length} 条`, sub: routes.join(' · ') }))),
    );

    const taps = [];
    const matched = new Set();
    const pops = []; // judgment popups {t, txt, color}
    let sound = true;
    if (ctx.autoplay) {
      // deterministic bot: small jitter around every note
      times.forEach((t, i) => taps.push(t + ((i % 5) - 2) * 0.02));
    } else {
      const au = makeAudio();
      await new Promise((resolve) => {
        let started = false;
        let t0 = 0;
        let a0 = 0;
        let now = -LEAD;
        let flash = 0;
        const doTap = () => {
          if (!started) {
            started = true; t0 = s.t;
            if (au.ac) {
              try { au.ac.resume(); } catch { /* ignore */ }
              a0 = au.ac.currentTime;
              if (sound) times.forEach((nt) => au.blip(a0 + LEAD + nt, 700, 0.07, 0.12));
            }
            return;
          }
          taps.push(now);
          flash = 0.12;
          let best = -1; let bd = Infinity;
          times.forEach((nt, i) => { const d = Math.abs(now - nt); if (!matched.has(i) && d < bd) { bd = d; best = i; } });
          const pts = best >= 0 ? judge(bd) : 0;
          if (pts) matched.add(best);
          pops.push({ t: now, txt: pts === 100 ? '完美' : pts === 70 ? '不错' : pts === 40 ? '勉强' : '×', ok: pts > 0, dir: best >= 0 && now < times[best] ? '早' : '晚' });
          if (au.ac && sound) au.blip(au.ac.currentTime + 0.001, 1100, 0.09, 0.2);
          ctx.log(`tap ${now.toFixed(3)} ${pts ? 'note ' + best + ' ' + pts : 'stray'}`);
        };
        const s = ctx.canvas({
          aspect: 0.85,
          onFrame(dt, g, st) {
            const c = st.colors;
            g.clearRect(0, 0, st.w, st.h);
            if (started) now = (au.ac ? au.ac.currentTime - a0 : st.t - t0) - LEAD;
            const x = st.w / 2;
            const hy = st.h * 0.82;
            const speed = (hy - 20) / LEAD;
            g.fillStyle = c.paper2; g.fillRect(x - 46, 0, 92, st.h);
            g.strokeStyle = c.rule; g.lineWidth = 1;
            for (let m = 0; m <= 16; m++) { // minute ticks
              const y = hy - (m * SPEED - now) * speed;
              if (y > 0 && y < st.h) { g.beginPath(); g.moveTo(x - 46, y); g.lineTo(x + 46, y); g.stroke(); }
            }
            g.strokeStyle = flash > 0 ? c.hit : c.accent; g.lineWidth = 4;
            g.beginPath(); g.moveTo(x - 70, hy); g.lineTo(x + 70, hy); g.stroke();
            flash = Math.max(0, flash - dt);
            g.font = '700 14px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            times.forEach((nt, i) => {
              const y = hy - (nt - now) * speed;
              if (y < -20 || y > st.h + 20) return;
              g.globalAlpha = matched.has(i) && y > hy - 4 ? 0.25 : 1;
              g.fillStyle = c.accent;
              g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill();
              g.fillStyle = c.paper;
              g.fillText(p.notes[i][1].split(' ')[0] + (p.notes[i][1].includes(' ') ? '+' : ''), x, y + 1);
              g.globalAlpha = 1;
            });
            for (const pp of pops) {
              const age = now - pp.t;
              if (age < 0 || age > 0.8) continue;
              g.globalAlpha = 1 - age / 0.8;
              g.fillStyle = pp.ok ? c.hit : c.bad;
              g.font = '700 16px system-ui, sans-serif';
              g.fillText(pp.ok ? pp.txt : '×', x + 90, hy - 10 - age * 30);
              g.globalAlpha = 1;
            }
            const real = p.startSec + (Math.max(0, now) / SPEED) * 60;
            st.hud.textContent = started ? `${clock(real)}  ·  ${taps.length} 次点击` : '';
            if (!started) {
              g.fillStyle = c.ink; g.font = '700 20px system-ui, sans-serif';
              g.fillText('点击屏幕或按空格开始', x, st.h * 0.4);
              g.font = '14px system-ui, sans-serif'; g.fillStyle = c.muted;
              g.fillText('音符落到线上时再点一下', x, st.h * 0.4 + 28);
            }
            if (started && now > times[N - 1] + 0.8) { st.stop(); resolve(); }
          },
          onPointer(type) { if (type === 'down') doTap(); },
          onKey(type, e) { if (type === 'down' && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) doTap(); } },
        });
        if (au.ac) ctx.stage.append(ui.h('div', { class: 'ds-row' },
          ui.chips(['声音：开', '声音：关'], { active: '声音：开', onClick: (v) => { sound = v === '声音：开'; } })));
        s.start();
      });
      au.close();
    }

    const g = grade(times, taps);
    const perfect = g.res.filter((r) => r.pts === 100).length;
    const missed = g.res.filter((r) => r.err == null).length;
    const errs = g.res.filter((r) => r.err != null).map((r) => r.err);
    const avg = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
    const sq = g.res.map((r) => ({ 100: '🟩', 70: '🟨', 40: '🟧', 0: '⬛' }[r.pts]));
    const emoji = sq.reduce((a, e, i) => a + e + ((i + 1) % 8 === 0 ? '\n' : ''), '').trim();
    ctx.log(`graded: score ${g.score}, perfect ${perfect}/${N}, missed ${missed}, stray ${g.stray}`);

    const chart = await ui.plot((Plot, c) => ({
      height: 150, marginLeft: 40,
      x: { label: '第几个间隔', tickFormat: (d) => String(d), ticks: gapsMin.length },
      y: { label: '间隔（分钟）', grid: true },
      marks: [Plot.barY(gapsMin.map((v, i) => ({ i: i + 1, v })), { x: 'i', y: 'v', fill: c.accent }), Plot.ruleY([0])],
    }), { height: 150 });
    const hasErr = errs.length > 0;
    const errChart = hasErr ? await ui.plot((Plot, c) => ({
      height: 140, marginLeft: 40,
      x: { label: '第几个音符', tickFormat: (d) => String(d), ticks: N },
      y: { label: '误差（毫秒，+ 偏晚）', grid: true },
      marks: [Plot.ruleY([0]), Plot.dot(g.res.map((r, i) => ({ i: i + 1, e: r.err == null ? null : Math.round(r.err * 1000) })).filter((d) => d.e != null), { x: 'i', y: 'e', fill: c.ink, r: 4 })],
    }), { height: 140 }) : null;
    const bias = !hasErr ? '你一个音符都没点中' : Math.abs(avg) < 0.02 ? '你的节拍很准' : avg > 0 ? `你平均偏晚 ${Math.round(avg * 1000)} 毫秒` : `你平均偏早 ${Math.round(-avg * 1000)} 毫秒`;
    return {
      score: g.score, max: 100, win: g.score >= 70, emoji,
      summary: `${p.station} ${p.dir} · ${perfect}/${N} 完美`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['站台', `${p.station} · ${p.dir}（${p.service}，${clock(p.startSec)} 起）`],
          ['最短 / 最长间隔', `${Math.min(...gapsMin).toFixed(1)} / ${Math.max(...gapsMin).toFixed(1)} 分钟`],
          ['平均间隔 (headway)', `${(gapsMin.reduce((a, b) => a + b, 0) / gapsMin.length).toFixed(1)} 分钟`],
          ['你的表现', `${bias}；漏掉 ${missed} 个，乱点 ${g.stray} 次`],
        ]),
        ui.h('div', { style: { marginTop: '12px' } }, chart),
        errChart ? ui.h('div', { style: { marginTop: '8px' } }, errChart) : null,
        ui.h('p', { class: 'small muted' }, explain(p))),
    };
  },
};
