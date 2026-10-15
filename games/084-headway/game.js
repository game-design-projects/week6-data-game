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
export function difficulty(cv) { return cv < 0.35 ? 'Easy' : cv < 0.45 ? 'Medium' : 'Hard'; }

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
    ? `Only the ${routes[0]} stops at this platform, yet the gaps are still uneven (${f(Math.min(...gaps))}\u2013${f(Math.max(...gaps))} minutes): that is the line\u2019s own variation in departures at this hour.`
    : `The ${routes.join(', ')} (${routes.length} lines) each run on their own spacing, and stacked onto one platform the rhythm gets ragged: the tightest pair is trains ${mi + 1} and ${mi + 2}, only ${f(gaps[mi])} minutes apart, and the widest is trains ${ma + 1} and ${ma + 2}, ${f(gaps[ma])} minutes apart.`;
  if (chords) s += ` ${chords === 1 ? '1 chord note is' : `${chords} chord notes are`} several lines arriving within 30 seconds of each other, merged into one beat.`;
  s += ' Spot the repeating long-short pattern and you can anticipate the next beat before the note drops.';
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
    tagline: 'A rhythm game whose beats are the real scheduled arrival times at one New York subway platform.',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      'You get a stretch of real timetable from one platform: 15 minutes squeezed into about 22 seconds. Each train is a falling note, and lines arriving together merge into one beat.',
      'Tap to start, with a 2-second lead-in. Tap the screen (or press Space) as each note lands on the bottom line. With sound on, every note lands with a \u201cblip\u201d and your tap is a higher \u201cbeep\u201d.',
      'The timetable is uneven: dense at rush hour, long and short gaps where lines meet. Learn the long-short pattern and you can anticipate it.',
      'Within 80 ms is 100 points, within 150 ms 70, within 250 ms 40. Missed notes score 0, and each stray tap with no note nearby costs 4.',
    ],
    scoring: 'Total = average points per note \u2212 stray-tap penalty (minimum 0). Each note scores 100 / 70 / 40 / 0 by timing error.',
    sources: [
      { name: 'MTA NYC Subway static GTFS', url: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip', note: 'scheduled arrival times from stop_times.txt' },
    ],
    dataNote: 'This uses the MTA\u2019s published schedule (static GTFS), not live arrivals: GTFS-Realtime only offers protobuf predictions for now and later, with no history, so every player would see something different and there could be no shared daily puzzle. Hence a snapshot. Trains at the same platform within 30 seconds are merged into one note, and windows that are too regular (say, a train every 2 minutes) were filtered out.',
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
      { kicker: `${p.service} \u00b7 15 minutes from ${clock(p.startSec)}`, title: `${p.station} \u00b7 ${p.dir} (to ${p.head})` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: 'Trains', value: String(N), sub: N === 1 ? 'note' : 'notes' }),
        ui.stat({ label: 'Rhythm', value: difficulty(p.cv), sub: 'uneven = harder' }),
        ui.stat({ label: 'Lines', value: String(routes.length), sub: routes.join(' · ') }))),
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
          pops.push({ t: now, txt: pts === 100 ? 'Perfect' : pts === 70 ? 'Good' : pts === 40 ? 'OK' : '×', ok: pts > 0, dir: best >= 0 && now < times[best] ? 'early' : 'late' });
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
            st.hud.textContent = started ? `${clock(real)}  ·  ${taps.length} ${taps.length === 1 ? 'tap' : 'taps'}` : '';
            if (!started) {
              g.fillStyle = c.ink; g.font = '700 20px system-ui, sans-serif';
              g.fillText('Tap or press Space to start', x, st.h * 0.4);
              g.font = '14px system-ui, sans-serif'; g.fillStyle = c.muted;
              g.fillText('Tap again as each note hits the line', x, st.h * 0.4 + 28);
            }
            if (started && now > times[N - 1] + 0.8) { st.stop(); resolve(); }
          },
          onPointer(type) { if (type === 'down') doTap(); },
          onKey(type, e) { if (type === 'down' && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) doTap(); } },
        });
        if (au.ac) ctx.stage.append(ui.h('div', { class: 'ds-row' },
          ui.chips(['Sound: on', 'Sound: off'], { active: 'Sound: on', onClick: (v) => { sound = v === 'Sound: on'; } })));
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
      x: { label: 'Gap no.', tickFormat: (d) => String(d), ticks: gapsMin.length },
      y: { label: 'Gap (minutes)', grid: true },
      marks: [Plot.barY(gapsMin.map((v, i) => ({ i: i + 1, v })), { x: 'i', y: 'v', fill: c.accent }), Plot.ruleY([0])],
    }), { height: 150 });
    const hasErr = errs.length > 0;
    const errChart = hasErr ? await ui.plot((Plot, c) => ({
      height: 140, marginLeft: 40,
      x: { label: 'Note no.', tickFormat: (d) => String(d), ticks: N },
      y: { label: 'Error (ms, + = late)', grid: true },
      marks: [Plot.ruleY([0]), Plot.dot(g.res.map((r, i) => ({ i: i + 1, e: r.err == null ? null : Math.round(r.err * 1000) })).filter((d) => d.e != null), { x: 'i', y: 'e', fill: c.ink, r: 4 })],
    }), { height: 140 }) : null;
    const bias = !hasErr ? 'You hit no notes' : Math.abs(avg) < 0.02 ? 'Your timing was spot on' : avg > 0 ? `You were ${Math.round(avg * 1000)} ms late on average` : `You were ${Math.round(-avg * 1000)} ms early on average`;
    return {
      score: g.score, max: 100, win: g.score >= 70, emoji,
      summary: `${p.station} ${p.dir} \u00b7 ${perfect}/${N} perfect`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['Platform', `${p.station} \u00b7 ${p.dir} (${p.service}, from ${clock(p.startSec)})`],
          ['Shortest / longest gap', `${Math.min(...gapsMin).toFixed(1)} / ${Math.max(...gapsMin).toFixed(1)} min`],
          ['Average gap (headway)', `${(gapsMin.reduce((a, b) => a + b, 0) / gapsMin.length).toFixed(1)} min`],
          ['Your run', `${bias}; ${missed} missed, ${g.stray} stray ${g.stray === 1 ? 'tap' : 'taps'}`],
        ]),
        ui.h('div', { style: { marginTop: '12px' } }, chart),
        errChart ? ui.h('div', { style: { marginTop: '8px' } }, errChart) : null,
        ui.h('p', { class: 'small muted' }, explain(p))),
    };
  },
};
