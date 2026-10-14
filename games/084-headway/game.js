// #84 Headway — a rhythm game whose beats are the scheduled arrival times of
// trains at one real NYC subway platform (MTA static GTFS), time-compressed.

export const SPEED = 1.5; // game seconds per real minute
export const LEAD = 2.2; // seconds a note is visible before it lands
export const WINDOWS = [[0.07, 100], [0.14, 70], [0.25, 40]]; // |error| s -> points
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

export default {
  meta: {
    num: 84,
    slug: 'headway',
    title: 'Headway',
    tagline: '节奏游戏：鼓点就是纽约某个地铁站台的真实列车到站时间。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '今天给你一个真实站台、一个时段的列车时刻表。15 分钟被压缩成约 22 秒，每趟车是一颗下落的音符。',
      '音符落到底部的线上时点击屏幕（或按空格）。点击开始后有 2 秒预备。',
      '时刻表的间隔不是均匀的：高峰期密集，几条线同时进站会叠成一个和弦，偶尔还会出现长长的空档，记住节奏就能提前量。',
      '误差 70 毫秒内 100 分，140 毫秒内 70 分，250 毫秒内 40 分；没有音符时乱点每次扣 4 分。',
    ],
    scoring: '总分 = 每个音符得分的平均值 − 乱点惩罚（最低 0）。',
    sources: [
      { name: 'MTA NYC Subway static GTFS', url: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip', note: 'stop_times.txt 的计划到站时刻' },
    ],
    dataNote: '用的是 MTA 公布的计划时刻表（GTFS static），不是当天的实时到站；同一站台 15 秒内到达的多条线合并为一个音符。',
  },

  puzzle({ data, pick }) {
    return pick(data.puzzles);
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const times = noteTimes(p);
    const N = times.length;
    ctx.log(`headway: ${p.station} ${p.dir} ${p.service}, ${N} notes`);
    const gapsMin = p.notes.slice(1).map((n, i) => (n[0] - p.notes[i][0]) / 60);

    ctx.stage.append(ui.panel(
      { kicker: `${p.service} · ${clock(p.startSec)} 起的 15 分钟`, title: `${p.station} · ${p.dir}（开往 ${p.head}）` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: '列车', value: String(N), sub: '个音符' }),
        ui.stat({ label: '压缩', value: `${60 / SPEED}×`, sub: `1 分钟 = ${SPEED} 秒` }),
        ui.stat({ label: '线路', value: [...new Set(p.notes.flatMap((n) => n[1].split(' ')))].join(' ') })),
    ));

    const taps = [];
    let now = -LEAD;
    if (ctx.autoplay) {
      // deterministic bot: small jitter around every note
      times.forEach((t, i) => taps.push(t + ((i % 5) - 2) * 0.02));
    } else {
      await new Promise((resolve) => {
        let started = false;
        let t0 = 0;
        let flash = 0;
        const doTap = () => {
          if (!started) { started = true; t0 = s.t; return; }
          taps.push(now);
          flash = 0.12;
          const hit = times.findIndex((nt) => Math.abs(nt - now) <= 0.25);
          ctx.log(`tap ${now.toFixed(3)} ${hit >= 0 ? 'near note ' + hit : 'stray'}`);
        };
        const s = ctx.canvas({
          aspect: 0.85,
          onFrame(dt, g, st) {
            const c = st.colors;
            g.clearRect(0, 0, st.w, st.h);
            if (started) now = st.t - t0 - LEAD;
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
              const done = taps.some((tp) => Math.abs(tp - nt) <= 0.25);
              g.globalAlpha = done && y > hy ? 0.25 : 1;
              g.fillStyle = c.accent;
              g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill();
              g.fillStyle = c.paper;
              g.fillText(p.notes[i][1].split(' ')[0] + (p.notes[i][1].includes(' ') ? '+' : ''), x, y + 1);
              g.globalAlpha = 1;
            });
            const real = p.startSec + (Math.max(0, now) / SPEED) * 60;
            st.hud.textContent = started ? `${clock(real)}  ·  ${taps.length} 次点击` : '';
            if (!started) {
              g.fillStyle = c.ink; g.font = '700 20px system-ui, sans-serif';
              g.fillText('点击屏幕开始', x, st.h * 0.4);
              g.font = '14px system-ui, sans-serif'; g.fillStyle = c.muted;
              g.fillText('音符落到线上时再点一下', x, st.h * 0.4 + 28);
            }
            if (started && now > times[N - 1] + 0.8) { st.stop(); resolve(); }
          },
          onPointer(type, pt) { if (type === 'down') doTap(); },
          onKey(type, e) { if (type === 'down' && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) doTap(); } },
        });
        s.start();
      });
    }

    const g = grade(times, taps);
    const perfect = g.res.filter((r) => r.pts === 100).length;
    const errs = g.res.filter((r) => r.err != null).map((r) => r.err);
    const avg = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
    const sq = g.res.map((r) => ({ 100: '🟩', 70: '🟨', 40: '🟧', 0: '⬛' }[r.pts]));
    const emoji = sq.reduce((a, e, i) => a + e + ((i + 1) % 8 === 0 ? '\n' : ''), '').trim();
    ctx.log(`graded: score ${g.score}, perfect ${perfect}/${N}, stray ${g.stray}`);

    const chart = await ui.plot((Plot, c) => ({
      height: 150, marginLeft: 40,
      x: { label: '第几个间隔' }, y: { label: '间隔（分钟）', grid: true },
      marks: [Plot.barY(gapsMin.map((v, i) => ({ i: i + 1, v })), { x: 'i', y: 'v', fill: c.accent }), Plot.ruleY([0])],
    }), { height: 150 });
    const bias = Math.abs(avg) < 0.02 ? '你的节拍很准' : avg > 0 ? `你平均偏晚 ${Math.round(avg * 1000)} 毫秒` : `你平均偏早 ${Math.round(-avg * 1000)} 毫秒`;
    return {
      score: g.score, max: 100, win: g.score >= 70, emoji,
      summary: `${p.station} ${p.dir} · ${perfect}/${N} 完美`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['站台', `${p.station} · ${p.dir}（${p.service}）`],
          ['最短 / 最长间隔', `${Math.min(...gapsMin).toFixed(1)} / ${Math.max(...gapsMin).toFixed(1)} 分钟`],
          ['平均间隔 (headway)', `${(gapsMin.reduce((a, b) => a + b, 0) / gapsMin.length).toFixed(1)} 分钟`],
          ['你的表现', `${bias}；乱点 ${g.stray} 次`],
        ]),
        ui.h('div', { style: { marginTop: '12px' } }, chart),
        ui.h('p', { class: 'small muted' }, '柱子越不齐，节奏越难：间隔忽长忽短说明多条线在这里交汇、或处在发车高低峰的交界。')),
    };
  },
};
