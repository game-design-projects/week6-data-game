// #3 Sky Over — tonight's sky rendered from a mystery city (Hipparcos stars + Moon + planets).
// Polaris altitude = latitude; where the celestial equator crosses the meridian (sidereal time) minus GMST = longitude.
import { mod, gmstDeg, altAz, project, precess, centuries, planets, moon, sunAlt } from './astro.js';

export { gmstDeg, altAz, project };

const DARK_SUN_ALT = -12; // nautical twilight is over: stars are really out
const POLARIS = 11767;
const PLANET_ZH = { Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
const PLANET_COLOR = { Mercury: '#c9c2b8', Venus: '#fff2b8', Mars: '#ff8a65', Jupiter: '#ffd9a8', Saturn: '#e8d28a' };

const hm = (h) => {
  let m = Math.round(mod(h, 24) * 60);
  if (m >= 1440) m -= 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const hmShort = (h) => { const m = Math.round(mod(h, 24) * 60) % 1440; return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const wrap180 = (x) => mod(x + 180, 360) - 180;

export function localSolarMs(date, solar, lng) {
  const utcH = mod(solar - lng / 15, 24);
  return Date.parse(`${date}T00:00:00Z`) + Math.round(utcH * 4) / 4 * 3600000;
}

/** Pure puzzle: a city and a UTC instant at which it is properly dark there (Sun below −12°). */
export function makePuzzle({ data, date, pick, rng }) {
  const city = pick(data.cities);
  let solar = 21 + Math.round(rng.float(0, 5.5) * 4) / 4; // local mean solar hour 21:00 – 02:30
  let ms = localSolarMs(date, solar, city.lng);
  for (let i = 0; i < 28 && sunAlt(ms, city.lat, city.lng) > DARK_SUN_ALT; i++) { solar += 0.25; ms = localSolarMs(date, solar, city.lng); }
  return { city, ms, solar: mod(solar, 24) };
}

/** Everything the sky shows, in coordinates of date, for an observer. */
export function skyAt(data, p) {
  const T = centuries(p.ms), { lat, lng } = p.city;
  const gmst = gmstDeg(p.ms), lst = mod(gmst + lng, 360);
  const aa = (ra, dec) => altAz(ra, dec, lat, lst);
  const stars = data.stars.map(([ra0, dec0, mag, name, hip]) => { const [ra, dec] = precess(ra0, dec0, T); return { mag, name, hip, ...aa(ra, dec) }; });
  const pl = planets(p.ms);
  const bodies = Object.keys(PLANET_ZH).map((k) => ({ key: k, name: PLANET_ZH[k], ...aa(pl[k][0], pl[k][1]) }));
  const mn = moon(p.ms);
  const m = { ...mn, ...aa(mn.ra, mn.dec) };
  m.alt -= 0.95 * Math.cos(m.alt * Math.PI / 180); // topocentric parallax (~57′ at the horizon)
  return { T, gmst, lst, stars, bodies, moon: m, aa };
}

function moonPhaseName(m) {
  const e = m.elong;
  if (e < 12) return '新月前后';
  if (e < 80) return m.waxing ? '蛾眉月（渐盈）' : '残月（渐亏）';
  if (e < 100) return m.waxing ? '上弦月' : '下弦月';
  if (e < 168) return m.waxing ? '盈凸月' : '亏凸月';
  return '满月前后';
}

export default {
  meta: {
    num: 3,
    slug: 'sky-over',
    title: 'Sky Over',
    tagline: '一张从神秘城市仰望的星空图。北极星有多高，纬度就是多少；天赤道与子午线的交点，扣掉格林尼治恒星时，就是经度。',
    category: 'geo',
    data: 'computed',
    howTo: [
      '圆盘是整片天空：圆心是头顶，外圈是地平线，上北左东；同心圈标出 30° 与 60° 高度。图中还有月亮和五大行星。',
      '纬度：北半球北极星的高度角 ≈ 纬度；看不到北极星，说明在赤道附近或南半球。橙色虚线是天赤道，它在正南/正北方向的高度 = 90° − |纬度|。',
      '经度：竖直的细线是子午线。读出天赤道与它交叉处标的赤经（如 4h），就是当地恒星时 LST；再减去题面给出的格林尼治恒星时 GMST，每差 1 小时 = 经度 15°（LST 大于 GMST 为东经）。',
      '在地图上点出这座城市。0 km 得 100 分，每差约 1,500 km 降到约三分之一。',
    ],
    scoring: '100 × e^(−距离 / 1500 km)。',
    sources: [
      { name: 'HYG Database v4（Hipparcos / Yale / Gliese 合并星表）', url: 'https://github.com/astronexus/HYG-Database', note: '亮于 4.6 等的 1000 多颗 Hipparcos 恒星' },
      { name: 'd3-celestial 星座连线', url: 'https://github.com/ofrohn/d3-celestial' },
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: '人口 100 万以上的城市（同一都市圈只留最大者）作为候选地点' },
      { name: 'JPL 行星近似轨道根数（Standish）', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', note: '行星位置，精度约 0.3°' },
      { name: 'Meeus《Astronomical Algorithms》第 47 章', url: 'https://en.wikipedia.org/wiki/Jean_Meeus', note: '月亮位置（截取主要项，精度约 0.1°）' },
    ],
    dataNote: '恒星为 J2000 坐标，已做岁差修正到当天；未做大气折射。月亮与行星按轨道根数在浏览器中计算（约 0.3° 误差，不含周期摄动小项）。天象由坐标与时间计算，非实时观测；题目选在太阳低于地平线 12° 以下的时刻，保证天空全黑。',
  },

  puzzle: makePuzzle,

  async play(ctx, p) {
    const { ui, core, data } = ctx;
    const { lat, lng } = p.city;
    const sky = skyAt(data, p);
    const { lst, gmst, aa } = sky;
    const iso = new Date(p.ms).toISOString();
    ctx.log('sky', { city: p.city.name, lst: +lst.toFixed(1), gmst: +gmst.toFixed(1), utc: iso, moonAlt: +sky.moon.alt.toFixed(0) });

    const T = sky.T;
    const vis = sky.stars.filter((s) => s.alt > -2);
    const lines = data.lines.map((seg) => seg.map(([ra, dec]) => { const [r, d] = precess(ra, dec, T); return aa(r, d); }));
    const labels = data.labels.map(([code, ra, dec]) => { const [r, d] = precess(ra, dec, T); return { code, ...aa(r, d) }; }).filter((l) => l.alt > 8);
    const equator = []; for (let ra = 0; ra < 360; ra += 2) equator.push({ ra, ...aa(ra, 0) });
    const ticks = []; for (let h = 0; h < 24; h += 2) ticks.push({ h, ...aa(h * 15, 0) });
    const sunScreen = (() => { const [ra, dec] = planets(p.ms).Sun; return aa(ra, dec); })();

    const box = ui.h('div', { style: { maxWidth: '600px', margin: '0 auto' } });
    const panel = ui.panel({ kicker: `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`, title: '今晚头顶的星空', aside: ui.badge(`GMST ${hm(gmst / 15)}`) }, box);
    ctx.stage.append(panel);

    const cv = ctx.canvas({
      aspect: 1,
      onFrame(dt, g, s) {
        const narrow = s.w < 480;
        const R = Math.min(s.w, s.h) / 2 - (narrow ? 16 : 22), cx = s.w / 2, cy = s.h / 2;
        const P = (alt, az) => { const q = project(alt, az); return [cx + q.x * R, cy + q.y * R]; };
        const used = [];
        const label = (text, x, y, { prefer = 'r' } = {}) => {
          const w = g.measureText(text).width, hgt = 11;
          const spots = prefer === 'l' ? [[-w - 6, -4], [6, -4], [-w / 2, -10], [-w / 2, 14]] : [[6, -4], [-w - 6, -4], [-w / 2, -10], [-w / 2, 14]];
          for (const [dx, dy] of spots) {
            const r = [x + dx, y + dy - hgt + 2, x + dx + w, y + dy + 3];
            if (r[0] < 2 || r[2] > s.w - 2 || r[1] < 2 || r[3] > s.h - 2) continue;
            if (used.some((u) => r[0] < u[2] && r[2] > u[0] && r[1] < u[3] && r[3] > u[1])) continue;
            used.push(r); g.fillText(text, x + dx, y + dy); return true;
          }
          return false;
        };
        g.clearRect(0, 0, s.w, s.h);
        g.fillStyle = '#0b1026'; g.fillRect(0, 0, s.w, s.h);
        g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = '#10183a'; g.fill();
        g.strokeStyle = '#5b6aa8'; g.lineWidth = 1.5; g.stroke();
        g.font = '11px ui-monospace, monospace'; g.fillStyle = '#7f8cc4'; g.textAlign = 'left';
        for (const a of [30, 60]) { const rr = R * (90 - a) / 90; g.beginPath(); g.setLineDash([3, 4]); g.arc(cx, cy, rr, 0, 7); g.strokeStyle = '#2d3a73'; g.lineWidth = 1; g.stroke(); g.setLineDash([]); g.fillText(`${a}°`, cx + 3, cy - rr - 3); }
        // meridian (N–S line through the zenith) and zenith cross
        g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.strokeStyle = 'rgba(160,175,235,0.28)'; g.lineWidth = 1; g.stroke();
        g.beginPath(); g.moveTo(cx - 4, cy); g.lineTo(cx + 4, cy); g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 4); g.strokeStyle = 'rgba(190,200,245,0.6)'; g.stroke();
        g.textAlign = 'center'; g.fillStyle = '#b8c2ee'; g.font = 'bold 13px sans-serif';
        g.fillText('北', cx, cy - R - 6); g.fillText('南', cx, cy + R + 15); g.fillText('东', cx - R - 9, cy + 4); g.fillText('西', cx + R + 9, cy + 4);
        // celestial equator with RA ticks
        g.beginPath(); let pen = false;
        for (const e of equator) { if (e.alt < 0) { pen = false; continue; } const [x, y] = P(e.alt, e.az); if (pen) g.lineTo(x, y); else g.moveTo(x, y); pen = true; }
        g.setLineDash([6, 4]); g.strokeStyle = 'rgba(255,170,90,0.75)'; g.lineWidth = 1.4; g.stroke(); g.setLineDash([]);
        g.font = 'bold 10px ui-monospace, monospace'; g.fillStyle = '#ffb066'; g.textAlign = 'left';
        for (const t of ticks) {
          if (t.alt < 4) continue; const [x, y] = P(t.alt, t.az);
          g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); label(`${t.h}h`, x, y);
        }
        // constellation lines (clipped at the horizon)
        g.strokeStyle = 'rgba(120,140,220,0.35)'; g.lineWidth = 1;
        for (const seg of lines) {
          g.beginPath(); let pn = false;
          for (const a of seg) { if (a.alt < 0) { pn = false; continue; } const [x, y] = P(a.alt, a.az); if (pn) g.lineTo(x, y); else g.moveTo(x, y); pn = true; }
          g.stroke();
        }
        // stars (labels for the brightest, collision-avoided)
        const bright = [];
        for (const st of vis) {
          if (st.alt < 0) continue;
          const [x, y] = P(st.alt, st.az);
          g.beginPath(); g.arc(x, y, Math.max(0.8, 3.4 - st.mag * 0.62), 0, 7);
          g.fillStyle = st.hip === POLARIS ? '#ffd166' : '#f4f6ff'; g.fill();
          if (st.hip === POLARIS) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.strokeStyle = '#ffd166'; g.lineWidth = 1.2; g.stroke(); }
          if (st.name && (!narrow || st.mag < 1.5 || st.hip === POLARIS)) bright.push([st, x, y]);
        }
        g.textAlign = 'left'; g.font = '10px sans-serif';
        for (const [st, x, y] of bright.sort((a, b) => a[0].mag - b[0].mag)) { g.fillStyle = st.hip === POLARIS ? '#ffd166' : '#d6dcf7'; label(st.name === 'Polaris' ? 'Polaris 北极星' : st.name, x, y); }
        // planets
        for (const b of sky.bodies) {
          if (b.alt < 0) continue; const [x, y] = P(b.alt, b.az);
          g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fillStyle = PLANET_COLOR[b.key]; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.stroke();
          g.font = 'bold 11px sans-serif'; g.fillStyle = PLANET_COLOR[b.key]; label(b.name, x, y);
        }
        // moon with phase (lit side faces the Sun)
        const m = sky.moon;
        if (m.alt > 0) {
          const [x, y] = P(m.alt, m.az), [sx, sy] = P(sunScreen.alt, sunScreen.az), r = narrow ? 6 : 7.5;
          const ang = Math.atan2(sy - y, sx - x), e = m.elong * Math.PI / 180;
          g.save(); g.translate(x, y); g.rotate(ang);
          g.beginPath(); g.arc(0, 0, r, 0, 7); g.fillStyle = '#2b3566'; g.fill();
          g.beginPath();
          for (let a = -90; a <= 90; a += 10) { const t = a * Math.PI / 180; g.lineTo(r * Math.cos(t), r * Math.sin(t)); }
          for (let a = 90; a >= -90; a -= 10) { const t = a * Math.PI / 180; g.lineTo(r * Math.cos(t) * Math.cos(e), r * Math.sin(t)); }
          g.closePath(); g.fillStyle = '#fff6d8'; g.fill();
          g.beginPath(); g.arc(0, 0, r, 0, 7); g.strokeStyle = 'rgba(255,246,216,0.7)'; g.lineWidth = 1; g.stroke();
          g.restore();
          g.font = 'bold 11px sans-serif'; g.fillStyle = '#fff6d8'; g.textAlign = 'left'; label('月亮', x + r, y);
        }
      },
    });
    box.append(cv.el || cv.canvas || cv);
    cv.start();
    box.append(ui.h('div', { class: 'small muted', style: { marginTop: '8px' } },
      `上北左东，圆心 + 是天顶，竖线是子午线，橙色虚线是天赤道（标注赤经小时）。这一刻当地天已全黑（太阳至少在地平线下 12°）。格林尼治恒星时 GMST = ${hmShort(gmst / 15)}。`));

    const res = await ctx.pin({
      answer: { lat, lng, label: `${p.city.name}, ${p.city.country}` },
      view: { bounds: [[-56, -168], [72, 168]] },
      scale: 1500,
      setup: ({ map, el }) => { map.setMaxBounds([[-85, -540], [85, 540]]); el.style.background = 'var(--paper2)'; },
      title: '这是哪座城市的夜空？',
    });
    cv.stop();

    // teaching
    const polaris = vis.find((s) => s.hip === POLARIS);
    const zen = vis.filter((s) => s.mag < 3.5).sort((a, b) => b.alt - a.alt)[0];
    const dLng = wrap180(lst - gmst);
    const seen = sky.bodies.filter((b) => b.alt > 5).map((b) => `${b.name}（${b.alt.toFixed(0)}°）`);
    const m = sky.moon;
    const g = res.guess || {};
    const latErr = Number.isFinite(g.lat) ? g.lat - lat : null, lngErr = Number.isFinite(g.lng) ? wrap180(g.lng - lng) : null;
    const eqAlt = 90 - Math.abs(lat);
    res.detail = ui.kv([
      ['地点', `${p.city.name}，${p.city.country}（${lat.toFixed(1)}°, ${lng.toFixed(1)}°）`],
      ['纬度怎么看', (polaris && polaris.alt > 0 ? `北极星高 ${polaris.alt.toFixed(1)}°，约等于纬度 ${lat.toFixed(1)}°。` : `北极星在地平线下，说明在${lat < 0 ? '南半球' : '赤道附近'}。`)
        + `天赤道在正${lat >= 0 ? '南' : '北'}方高 ${eqAlt.toFixed(0)}° = 90° − ${Math.abs(lat).toFixed(0)}°。`],
      ['经度怎么看', `子午线上天赤道对应赤经约 ${(lst / 15).toFixed(2)} h（地方恒星时 LST）；题面 GMST = ${(gmst / 15).toFixed(2)} h；差 ${(dLng / 15).toFixed(2)} h × 15 = ${dLng.toFixed(1)}°，即${dLng >= 0 ? '东' : '西'}经 ${Math.abs(dLng).toFixed(1)}°。`],
      ['当地时间', `平太阳时 ${hm(p.solar)}（UTC ${iso.slice(11, 16)}，经度每 15° 差 1 小时）`],
      ['头顶的星', zen ? `${zen.name || `HIP ${zen.hip}`}（${zen.mag.toFixed(1)} 等，高度 ${zen.alt.toFixed(0)}°）：天顶的赤纬 ≈ 纬度` : '—'],
      ['月亮与行星', `${m.alt > 0 ? `月亮在地平线上（${moonPhaseName(m)}，受光 ${Math.round(m.illum * 100)}%，高 ${m.alt.toFixed(0)}°）` : `月亮在地平线下（${moonPhaseName(m)}）`}；${seen.length ? `可见行星：${seen.join('、')}` : '地平线上没有明亮行星'}。月亮和行星在恒星间的位置对各地几乎相同，不提供定位线索。`],
      ...(latErr == null ? [] : [['你的读数', `纬度差 ${Math.abs(latErr).toFixed(1)}°，经度差 ${Math.abs(lngErr).toFixed(1)}°`]]),
    ]);
    return res;
  },
};
