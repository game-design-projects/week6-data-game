// #90 Topo Golf — a real patch of Earth's terrain (SRTM-derived DEM) shrunk to a putting green.
// Read the slopes, putt, then guess where on Earth the green really is.

export const N = 32; // grid cells per side
const RELIEF = 4.5; // whole patch rescaled to this many board units of height
const G = 7; // slope → acceleration
const DECEL = 2.4; // constant rolling resistance
const VISC = 0.35; // viscous drag
const VMAX = 9;
const HOLE_R = 0.85;
const SINK_V = 3.6;
const DT = 1 / 120;

/** Smooth + rescale an integer DEM grid into board units. */
export function buildTerrain(grid) {
  let g = Float64Array.from(grid);
  for (let pass = 0; pass < 3; pass++) {
    const o = new Float64Array(g.length);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0; let c = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = Math.min(N - 1, Math.max(0, x + i)); const yy = Math.min(N - 1, Math.max(0, y + j));
        s += g[yy * N + xx]; c++;
      }
      o[y * N + x] = s / c;
    }
    g = o;
  }
  const lo = Math.min(...g); const hi = Math.max(...g);
  return g.map((v) => ((v - lo) / (hi - lo || 1)) * RELIEF);
}

/** Bilinear height at board point (x, y); cell centres sit at i + 0.5. */
export function heightAt(h, x, y) {
  const u = Math.min(N - 1.001, Math.max(0, x - 0.5)); const v = Math.min(N - 1.001, Math.max(0, y - 0.5));
  const i = Math.floor(u); const j = Math.floor(v); const fx = u - i; const fy = v - j;
  const a = h[j * N + i]; const b = h[j * N + i + 1]; const c = h[(j + 1) * N + i]; const d = h[(j + 1) * N + i + 1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

export function gradAt(h, x, y) {
  const e = 0.25;
  return [(heightAt(h, x + e, y) - heightAt(h, x - e, y)) / (2 * e), (heightAt(h, x, y + e) - heightAt(h, x, y - e)) / (2 * e)];
}

/** Roll a ball from `pos` with initial velocity `vel`. Pure + deterministic. */
export function simulate(h, pos, vel, hole) {
  let [x, y] = pos; let [vx, vy] = vel;
  const path = [[x, y]];
  let holed = false;
  for (let step = 0; step < 120 * 14; step++) {
    const [gx, gy] = gradAt(h, x, y);
    vx -= G * gx * DT; vy -= G * gy * DT;
    const sp = Math.hypot(vx, vy);
    if (sp > 0) {
      const dec = Math.min(sp, (DECEL + VISC * sp) * DT);
      vx -= (vx / sp) * dec; vy -= (vy / sp) * dec;
    }
    x += vx * DT; y += vy * DT;
    if (x < 0.3) { x = 0.3; vx = Math.abs(vx) * 0.5; }
    if (x > N - 0.3) { x = N - 0.3; vx = -Math.abs(vx) * 0.5; }
    if (y < 0.3) { y = 0.3; vy = Math.abs(vy) * 0.5; }
    if (y > N - 0.3) { y = N - 0.3; vy = -Math.abs(vy) * 0.5; }
    const sp2 = Math.hypot(vx, vy);
    if (Math.hypot(x - hole[0], y - hole[1]) < HOLE_R && sp2 < SINK_V) { x = hole[0]; y = hole[1]; holed = true; path.push([x, y]); break; }
    if (step % 3 === 0) path.push([x, y]);
    // stopped: slow AND the slope cannot overcome rolling resistance
    if (sp2 < 0.06 && G * Math.hypot(gx, gy) < DECEL * 0.9) break;
  }
  if (!holed) path.push([x, y]);
  return { path, end: [x, y], holed };
}

/** Launch speed that carries a ball `d` units on flat ground (numeric inverse). */
export function speedForDistance(d) {
  let lo = 0; let hi = VMAX * 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2; let v = mid; let dist = 0;
    while (v > 0.05) { v -= (DECEL + VISC * v) * DT; dist += v * DT; }
    if (dist < d) lo = mid; else hi = mid;
  }
  return Math.min(VMAX, (lo + hi) / 2);
}

export const strokeScore = (n) => [100, 75, 55][n - 1] ?? 0;
export function puttScore(holedAt, bestDist, startDist) {
  if (holedAt) return strokeScore(holedAt);
  return Math.round(40 * Math.max(0, 1 - bestDist / startDist));
}

const hhmm = (v) => Math.round(v).toLocaleString('en-US');

export default {
  meta: {
    num: 90,
    slug: 'topo-golf',
    title: 'Topo Golf',
    tagline: '把地球上一块真实山地缩成一块推杆果岭：读坡、推球，再猜它到底在世界的哪里。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '画面是一块真实地形的等高线晕渲图：浅色是高处，深色是低处，球会顺着坡往低处滚。',
      '在果岭上拖动再松手：往反方向拉出弓弦，拉得越长力度越大，球朝拖动的反方向滚出。最多 3 杆。',
      '进洞越早得分越高（100 / 75 / 55）；没进洞则按最近距离给最多 40 分。',
      '推完揭晓地形的海拔范围与宽度，在世界地图上标出这块地形的位置，再得最多 100 分。',
    ],
    scoring: '推杆 0–100（进洞杆数 / 最近距离）+ 定位 100 × e^(−距离/2500 km)。',
    sources: [
      { name: 'AWS Terrain Tiles (Terrarium)', url: 'https://registry.opendata.aws/terrain-tiles/', note: '由 SRTM、ETOPO1、GMTED 等 DEM 合成；每块取 zoom 11 的一个瓦片，降采样为 32×32 网格' },
      { name: 'Mapzen terrain tile docs', url: 'https://github.com/tilezen/joerd/blob/master/docs/formats.md' },
    ],
    dataNote: '88 个著名山地/峡谷/火山的真实高程。为了能打球，高差被统一压缩到约 4.5 个格子高并做了平滑，所以坡度是「缩放后」的，但山脊、谷地和坡向都是真实地形的形状。答案坐标取瓦片中心，距著名地标约 10 km 以内。',
  },

  puzzle({ data, rng, pick }) {
    const site = pick(data.sites);
    const h = buildTerrain(site.grid);
    let best = null;
    for (let k = 0; k < 80; k++) {
      const hole = [rng.float(8, N - 8), rng.float(8, N - 8)];
      const a = rng.float(0, Math.PI * 2); const d = rng.float(9, 13);
      const ball = [hole[0] + Math.cos(a) * d, hole[1] + Math.sin(a) * d];
      if (ball[0] < 2 || ball[0] > N - 2 || ball[1] < 2 || ball[1] > N - 2) continue;
      const slope = Math.hypot(...gradAt(h, hole[0], hole[1]));
      if (!best || slope < best.slope) best = { slope, hole, ball };
      if (slope < 0.12) break;
    }
    const r = (v) => +v.toFixed(2);
    return { siteId: site.id, hole: best.hole.map(r), ball: best.ball.map(r) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const site = ctx.data.sites[p.siteId];
    const h = buildTerrain(site.grid);
    const lo = Math.min(...h); const hi = Math.max(...h);
    ctx.log('topo-golf start', { site: site.name, ball: p.ball, hole: p.hole });

    // pre-render hillshaded terrain
    const R = 192;
    const off = document.createElement('canvas'); off.width = R; off.height = R;
    const og = off.getContext('2d'); const img = og.createImageData(R, R);
    const lowC = [38, 92, 58]; const highC = [214, 226, 160];
    for (let py = 0; py < R; py++) for (let px = 0; px < R; px++) {
      const x = ((px + 0.5) / R) * N; const y = ((py + 0.5) / R) * N;
      const z = heightAt(h, x, y); const t = (z - lo) / (hi - lo || 1);
      const [gx, gy] = gradAt(h, x, y);
      const shade = Math.min(1.25, Math.max(0.65, 1 + (-gx - gy) * 0.55));
      const band = Math.floor(z / 0.3); const bandR = Math.floor(heightAt(h, x + N / R, y) / 0.3); const bandD = Math.floor(heightAt(h, x, y + N / R) / 0.3);
      const line = band !== bandR || band !== bandD ? 0.8 : 1;
      const o = (py * R + px) * 4;
      for (let c = 0; c < 3; c++) img.data[o + c] = Math.min(255, (lowC[c] + (highC[c] - lowC[c]) * t) * shade * line);
      img.data[o + 3] = 255;
    }
    og.putImageData(img, 0, 0);

    const st = { pos: p.ball.slice(), strokes: 0, holedAt: 0, best: Infinity, anim: null, drag: null, trail: [] };
    const d0 = Math.hypot(p.ball[0] - p.hole[0], p.ball[1] - p.hole[1]);
    const dist = (q) => Math.hypot(q[0] - p.hole[0], q[1] - p.hole[1]);
    st.best = d0;

    ctx.stage.append(ui.panel({ kicker: '第一步 · 推杆', title: '读坡，推进洞' },
      ui.h('p', { class: 'small muted', style: { margin: 0 } }, '浅色高、深色低，细线是等高线。球会往低处滚。向后拉再松手发球，最多 3 杆。')));

    const putt = await new Promise((resolve) => {
      const finish = () => { s.stop(); resolve({ score: puttScore(st.holedAt, st.best, d0), max: 100, holed: st.holedAt, strokes: st.strokes, best: st.best }); };
      const shoot = (vel) => {
        st.strokes++;
        const r = simulate(h, st.pos, vel, p.hole);
        st.anim = { r, t: 0, idx: 0 };
        st.trail.push(r.path);
        if (ctx.autoplay) settle(); // no animation under test
        ctx.log('stroke', { n: st.strokes, speed: +Math.hypot(...vel).toFixed(2), end: r.end.map((v) => +v.toFixed(1)), holed: r.holed });
      };
      const settle = () => {
        const a = st.anim; st.anim = null; st.pos = a.r.end;
        st.best = Math.min(st.best, dist(a.r.end));
        if (a.r.holed) { st.holedAt = st.strokes; setTimeout(finish, 500); }
        else if (st.strokes >= 3) setTimeout(finish, 500);
      };
      const maxPx = () => s.w * 0.4;
      const s = ctx.canvas({
        aspect: 1,
        onFrame(dt, g) {
          const k = s.w / N;
          g.drawImage(off, 0, 0, s.w, s.h);
          // earlier trails
          g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.45)'; g.setLineDash([4, 5]);
          for (const tr of st.trail) { g.beginPath(); tr.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.stroke(); }
          g.setLineDash([]);
          // hole + flag
          const hx = p.hole[0] * k; const hy = p.hole[1] * k;
          g.fillStyle = '#111'; g.beginPath(); g.arc(hx, hy, HOLE_R * k * 0.8, 0, 7); g.fill();
          g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, hy - k * 2.6); g.stroke();
          g.fillStyle = s.colors.accent; g.beginPath(); g.moveTo(hx, hy - k * 2.6); g.lineTo(hx + k * 1.5, hy - k * 2.1); g.lineTo(hx, hy - k * 1.6); g.fill();
          // animation
          if (st.anim) {
            st.anim.t += dt; const a = st.anim; const n = a.r.path.length;
            a.idx = Math.min(n - 1, Math.floor(a.t * (ctx.autoplay ? 800 : 90)));
            st.pos = a.r.path[a.idx];
            if (a.idx >= n - 1) settle();
          }
          // aim line
          if (st.drag && !st.anim) {
            const bx = st.pos[0] * k; const by = st.pos[1] * k;
            const dx = st.drag.x - bx; const dy = st.drag.y - by; const len = Math.min(maxPx(), Math.hypot(dx, dy));
            const ang = Math.atan2(-dy, -dx);
            g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([2, 6]);
            g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ang) * len * 1.6, by + Math.sin(ang) * len * 1.6); g.stroke(); g.setLineDash([]);
            g.strokeStyle = s.colors.accent; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - Math.cos(ang) * len * 0.5, by - Math.sin(ang) * len * 0.5); g.stroke();
          }
          // ball
          g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5;
          g.beginPath(); g.arc(st.pos[0] * k, st.pos[1] * k, Math.max(4, k * 0.45), 0, 7); g.fill(); g.stroke();
          const power = st.drag ? Math.round(Math.min(1, Math.hypot(st.drag.x - st.pos[0] * k, st.drag.y - st.pos[1] * k) / maxPx()) * 100) : 0;
          s.hud.textContent = st.holedAt ? '进洞！' : `第 ${Math.min(3, st.strokes + (st.anim ? 0 : 1))}/3 杆 · 距洞 ${dist(st.pos).toFixed(1)}${st.drag ? ` · 力度 ${power}%` : ''}`;
        },
        onPointer(type, pt) {
          if (st.anim || st.holedAt || st.strokes >= 3) return;
          if (type === 'down') { pt.e.target.setPointerCapture?.(pt.e.pointerId); st.drag = { x: pt.x, y: pt.y }; }
          else if (type === 'move' && st.drag) st.drag = { x: pt.x, y: pt.y };
          else if (type === 'up' && st.drag) {
            const k = s.w / N; const dx = pt.x - st.pos[0] * k; const dy = pt.y - st.pos[1] * k; const len = Math.hypot(dx, dy);
            st.drag = null;
            if (len < 10) return;
            const v = VMAX * Math.min(1, len / maxPx());
            shoot([(-dx / len) * v, (-dy / len) * v]);
          }
        },
      });
      s.canvas.style.touchAction = 'none';
      s.start();
      if (ctx.autoplay) {
        // bot: aim straight at the hole, up to 3 strokes
        (async () => {
          for (let i = 0; i < 3 && !st.holedAt; i++) {
            const dx = p.hole[0] - st.pos[0]; const dy = p.hole[1] - st.pos[1]; const d = Math.hypot(dx, dy) || 1;
            const v = speedForDistance(d);
            shoot([(dx / d) * v, (dy / d) * v]);
            await ctx.sleep(30);
          }
        })();
      }
    });

    // clue before the pin
    const widthKm = site.km;
    ctx.stage.append(ui.panel({ kicker: '第二步 · 揭晓线索', title: `这块地形宽 ${widthKm} km` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '130px' } },
        ui.stat({ label: '最低海拔', value: `${hhmm(site.min)} m` }),
        ui.stat({ label: '最高海拔', value: `${hhmm(site.max)} m` }),
        ui.stat({ label: '高差', value: `${hhmm(site.max - site.min)} m` })),
      ui.h('p', { class: 'small muted' }, '你刚才推的果岭就是这块地形缩放而来。最高海拔越高越可能在大山脉，高差大说明有深谷或陡峰。')));

    const pin = await ctx.pin({
      title: '它在世界的哪里？',
      answer: { lat: site.lat, lng: site.lng, label: `${site.name}（${site.region}）` },
      view: { center: [25, 10], zoom: 2 },
      scale: 2500,
    });

    const puttDesc = putt.holed ? `第 ${putt.holed} 杆进洞` : `3 杆未进，最近距洞 ${putt.best.toFixed(1)} 格（起点 ${d0.toFixed(1)}）`;
    const res = core.combine([
      { score: putt.score, max: 100, emoji: putt.holed ? `⛳${putt.holed}` : '🏌️', summary: puttDesc },
      pin,
    ]);
    res.detail = ui.panel({ plain: true }, ui.kv([
      ['地点', `${site.name}，${site.region}`],
      ['瓦片中心', `${site.lat.toFixed(2)}°, ${site.lng.toFixed(2)}°`],
      ['海拔范围', `${hhmm(site.min)}–${hhmm(site.max)} m（宽 ${widthKm} km）`],
      ['推杆', puttDesc],
      ['怎么推理', '果岭上颜色最浅的地方是这块地形的最高点。真实山地的最高点和高差，配合海拔和宽度，能帮你猜出是哪条山脉。']]));
    return res;
  },
};
