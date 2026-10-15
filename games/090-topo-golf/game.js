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

/** Search a single stroke that sinks the ball (angle offsets around the straight line × speed factors). null if none. */
export function solveShot(h, ball, hole) {
  const dx = hole[0] - ball[0]; const dy = hole[1] - ball[1]; const d = Math.hypot(dx, dy) || 1;
  const base = Math.atan2(dy, dx); const v0 = speedForDistance(d);
  for (let a = 0; a <= 40; a += 2) {
    for (const sgn of a ? [1, -1] : [1]) {
      const ang = base + (sgn * a * Math.PI) / 180;
      for (const f of [1, 0.92, 1.08, 0.84, 1.16, 1.3, 0.75]) {
        const v = Math.min(VMAX, v0 * f);
        if (simulate(h, ball, [Math.cos(ang) * v, Math.sin(ang) * v], hole).holed) return { offsetDeg: sgn * a, power: +(v / VMAX).toFixed(2) };
      }
    }
  }
  return null;
}

export const strokeScore = (n) => [100, 75, 55][n - 1] ?? 0;
export function puttScore(holedAt, bestDist, startDist) {
  if (holedAt) return strokeScore(holedAt);
  return Math.round(40 * Math.max(0, 1 - bestDist / startDist));
}

const hhmm = (v) => Math.round(v).toLocaleString('en-US');

/** A z11 web-mercator tile is 40075.017 / 2^11 km wide at the equator and shrinks with cos(latitude). */
export const EQ_KM = 40075.017 / 2048;
export const latFromKm = (km) => +((Math.acos(Math.min(1, km / EQ_KM)) * 180) / Math.PI).toFixed(1);

/** Where does a straight, correctly-weighted shot end up relative to the hole? left/right of travel + distance. */
export function straightShotBreak(h, ball, hole) {
  const dx = hole[0] - ball[0]; const dy = hole[1] - ball[1]; const d = Math.hypot(dx, dy) || 1;
  const v = speedForDistance(d);
  const r = simulate(h, ball, [(dx / d) * v, (dy / d) * v], hole);
  const ex = r.end[0] - hole[0]; const ey = r.end[1] - hole[1];
  const lateral = (dx / d) * ey - (dy / d) * ex; // >0: ended on the right of the line of travel (screen coordinates, y down)
  return { holed: r.holed, miss: Math.hypot(ex, ey), lateral };
}

export default {
  meta: {
    num: 90,
    slug: 'topo-golf',
    title: 'Topo Golf',
    tagline: '把地球上一块真实山地缩成一块推杆果岭：读坡、推球，再猜它到底在世界的哪里。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '画面是一块真实地形的等高线晕渲图：浅色是高处，深色是低处，小箭头指向下坡，球会顺着坡往低处滚。',
      '在果岭上拖动再松手：往反方向拉出弓弦，拉得越长力度越大，球朝拖动的反方向滚出。最多 3 杆，坡会让直推的球拐弯。',
      '进洞越早得分越高（100 / 75 / 55）；没进洞则按最近距离给最多 40 分。',
      '推完揭晓这块地形的海拔范围和宽度。宽度随纬度变窄，地图上会画出对应的纬度线；你再在线上挑一个经度标出位置，最多 100 分。',
    ],
    scoring: '推杆 0–100（第 1/2/3 杆进洞 100/75/55；未进洞按最近距离最多 40）+ 定位 100 × e^(−距离/2500 km)，总分 200。',
    sources: [
      { name: 'AWS Terrain Tiles (Terrarium)', url: 'https://registry.opendata.aws/terrain-tiles/', note: '由 SRTM、ETOPO1、GMTED 等 DEM 合成；每块取 zoom 11 的一个瓦片（约 19.6 km × cos 纬度宽），降采样为 32×32 网格' },
      { name: 'Mapzen terrain tile docs (Terrarium 编码)', url: 'https://github.com/tilezen/joerd/blob/master/docs/formats.md' },
      { name: 'Esri World Shaded Relief / Gray Canvas 底图', url: 'https://www.arcgis.com/home/item.html?id=1b243539f4514b6ba9e5db8acf2a6bc3' },
    ],
    dataNote: '88 个著名山地/峡谷/火山的真实高程，数据为快照（AWS 地形瓦片是静态文件，不随日期变化，所以没有「今日数据」可取）。为了能打球，每块地形的高差都被压缩到同一个约 4.5 格的高度并做了 3 次平滑，所以坡度是「缩放后」的（陡缓无法跨地点比较，真实高差看揭晓的海拔数字），但山脊、谷地和坡向是真实地形的形状。球洞与起点由当天的种子随机放置，并保证至少存在一种一杆进洞的打法。答案坐标取瓦片中心，距著名地标约 10 km 以内，远小于 2500 km 的计分尺度。',
  },

  puzzle({ data, rng, pick }) {
    const site = pick(data.sites);
    const h = buildTerrain(site.grid);
    // Prefer a layout where the slope bends a straight shot (so reading the terrain matters)
    // and that is provably holeable in one stroke (solveShot).
    let best = null;
    for (let k = 0; k < 40 && !(best && best.tier === 2); k++) {
      const hole = [rng.float(8, N - 8), rng.float(8, N - 8)];
      const a = rng.float(0, Math.PI * 2); const d = rng.float(9, 13);
      const ball = [hole[0] + Math.cos(a) * d, hole[1] + Math.sin(a) * d];
      if (ball[0] < 2 || ball[0] > N - 2 || ball[1] < 2 || ball[1] > N - 2) continue;
      if (best && best.tier >= 1 && k > 12) break;
      const v = speedForDistance(d);
      const st = simulate(h, ball, [((hole[0] - ball[0]) / d) * v, ((hole[1] - ball[1]) / d) * v], hole);
      const miss = Math.hypot(st.end[0] - hole[0], st.end[1] - hole[1]);
      const tier = st.holed ? 0 : miss >= 1.2 && miss <= 6 ? 2 : 1;
      if (best && tier <= best.tier) continue;
      const solve = solveShot(h, ball, hole);
      if (!solve) continue;
      best = { tier, hole, ball, solve, straightMiss: st.holed ? 0 : miss };
    }
    if (!best) { // extremely unlikely: fall back to the flattest spot
      const hole = [N / 2, N / 2]; best = { hole, ball: [N / 2 - 10, N / 2], solve: null, straightMiss: 0 };
    }
    const r = (v) => +v.toFixed(2);
    return { siteId: site.id, hole: best.hole.map(r), ball: best.ball.map(r), solve: best.solve, straightMiss: r(best.straightMiss) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const site = ctx.data.sites[p.siteId];
    const h = buildTerrain(site.grid);
    const lo = Math.min(...h); const hi = Math.max(...h);
    ctx.log('topo-golf start', { site: site.name, ball: p.ball, hole: p.hole });

    // pre-render hillshaded terrain
    const R = 320;
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
    // downhill arrows on a coarse grid
    og.strokeStyle = 'rgba(255,255,255,.55)'; og.fillStyle = 'rgba(255,255,255,.55)'; og.lineWidth = 1.4;
    for (let ay = 3; ay < N; ay += 4) for (let ax = 3; ax < N; ax += 4) {
      const [gx, gy] = gradAt(h, ax, ay); const m = Math.hypot(gx, gy);
      if (m < 0.04) continue;
      const len = Math.min(1.6, 0.5 + m * 2.4) * (R / N) * 0.5; const ux = -gx / m; const uy = -gy / m;
      const cx = (ax / N) * R; const cy = (ay / N) * R; const tx = cx + ux * len; const ty = cy + uy * len; const bx = cx - ux * len; const by = cy - uy * len;
      og.beginPath(); og.moveTo(bx, by); og.lineTo(tx, ty); og.stroke();
      og.beginPath(); og.moveTo(tx, ty); og.lineTo(tx - ux * 5 - uy * 3, ty - uy * 5 + ux * 3); og.lineTo(tx - ux * 5 + uy * 3, ty - uy * 5 - ux * 3); og.fill();
    }

    const st = { pos: p.ball.slice(), strokes: 0, holedAt: 0, best: Infinity, anim: null, drag: null, trail: [] };
    const d0 = Math.hypot(p.ball[0] - p.hole[0], p.ball[1] - p.hole[1]);
    const dist = (q) => Math.hypot(q[0] - p.hole[0], q[1] - p.hole[1]);
    st.best = d0;

    ctx.stage.append(ui.panel({ kicker: '第一步 · 推杆', title: '读坡，推进洞' },
      ui.h('p', { class: 'small muted', style: { margin: 0 } }, '浅色高、深色低，细线是等高线，小箭头指向下坡，球会顺着坡拐弯。白球在哪就从哪出发，向后拉再松手发球，最多 3 杆。')));

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
          s.hud.textContent = st.holedAt ? '进洞！' : `第 ${Math.min(3, st.strokes + (st.anim ? 0 : 1))}/3 杆 · 距洞 ${dist(st.pos).toFixed(1)} 格${st.drag ? ` · 力度 ${power}%` : ''}`;
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
    const lat = latFromKm(widthKm);
    ctx.log('topo-golf reveal', { site: site.name, widthKm, latEstimate: lat });
    ctx.stage.append(ui.panel({ kicker: '第二步 · 揭晓线索', title: `这块地形宽 ${widthKm.toFixed(2)} km` },
      ui.kv([
        ['最低 / 最高海拔', `${hhmm(site.min)} m / ${hhmm(site.max)} m`],
        ['高差', `${hhmm(site.max - site.min)} m`],
        ['宽度 → 纬度', `${EQ_KM.toFixed(2)} km × cos(纬度) = ${widthKm.toFixed(2)} km，所以纬度约 ±${lat}°`]]),
      ui.h('p', { class: 'small muted', style: { marginBottom: 0 } }, '果岭就是这块地形缩放而来（最亮处 = 最高点）。海拔高、高差大多是大山脉；海拔低但高差大多是峡谷或沿海山地。地图上的虚线是由宽度算出的南北纬线，答案在其中一条上。')));

    const pin = await ctx.pin({
      title: '它在世界的哪里？',
      prompt: `点在 ±${lat}° 两条纬线中的一条上，再用海拔线索判断经度。`,
      answer: { lat: site.lat, lng: site.lng, label: `${site.zh} ${site.name}（${site.region}）` },
      view: { bounds: [[-80, -175], [80, 175]] },
      scale: 2500,
      setup: async ({ map, L }) => {
        const c = ui.colors();
        for (const la of lat < 0.5 ? [0] : [lat, -lat]) {
          L.polyline([[la, -180], [la, 180]], { color: c.accent, weight: 2, dashArray: '6 6', opacity: 0.9, interactive: false })
            .bindTooltip(`${la > 0 ? '+' : ''}${la}°`, { permanent: true, direction: 'top', className: 'ds-tip' }).addTo(map);
        }
      },
    });

    const puttDesc = putt.holed ? `第 ${putt.holed} 杆进洞` : `3 杆未进，最近距洞 ${putt.best.toFixed(1)} 格（起点 ${d0.toFixed(1)}）`;
    const res = core.combine([
      { score: putt.score, max: 100, emoji: putt.holed ? `⛳${putt.holed}` : '🏌️', summary: puttDesc },
      pin,
    ]);
    const brk = straightShotBreak(h, p.ball, p.hole);
    const dz = ((heightAt(h, p.hole[0], p.hole[1]) - heightAt(h, p.ball[0], p.ball[1])) / RELIEF) * (site.max - site.min);
    const side = brk.lateral > 0 ? '右' : '左';
    const breakTxt = brk.holed ? '这一洞坡度很平，直推就能进。'
      : `球洞比起点${dz >= 0 ? '高' : '低'}约 ${hhmm(Math.abs(dz))} m（真实高差折算）；瞄准球洞直推会被坡带得偏向前进方向的${side}侧约 ${brk.miss.toFixed(1)} 格，要提前往${side === '右' ? '左' : '右'}瞄、顺着等高线读弯。`;
    const solveTxt = p.solve ? `一种一杆进洞的打法：从直指球洞的方向${p.solve.offsetDeg === 0 ? '不偏' : `${p.solve.offsetDeg > 0 ? '顺时针' : '逆时针'}偏 ${Math.abs(p.solve.offsetDeg)}°`}，力度约 ${Math.round(p.solve.power * 100)}%。` : '';
    res.detail = ui.panel({ plain: true }, ui.kv([
      ['地点', `${site.zh} ${site.name}（${site.kind}，${site.region}）`],
      ['瓦片中心', `${site.lat.toFixed(2)}°, ${site.lng.toFixed(2)}°`],
      ['海拔范围', `${hhmm(site.min)}–${hhmm(site.max)} m，高差 ${hhmm(site.max - site.min)} m`],
      ['宽度给出的纬度', `${widthKm.toFixed(2)} km → ±${lat}°；实际纬度 ${site.lat.toFixed(1)}°，${Math.abs(Math.abs(site.lat) - lat) < 1.5 ? '线索与答案吻合' : '线索只是近似'}。瓦片宽度只由纬度决定，这是定位最硬的线索。`],
      ['推杆', puttDesc],
      ['这一洞的坡', `${breakTxt}${solveTxt}`]]));
    return res;
  },
};
