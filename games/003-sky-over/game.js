// #3 Sky Over — tonight's sky rendered from a mystery city (Hipparcos stars).
// Polaris altitude = latitude; which stars sit on the meridian = longitude (given UTC).
const RAD = Math.PI / 180;
const mod = (a, n) => ((a % n) + n) % n;

/** Greenwich mean sidereal time in degrees for a UTC instant (ms). */
export function gmstDeg(ms) {
  const jd = ms / 86400000 + 2440587.5;
  return mod(280.46061837 + 360.98564736629 * (jd - 2451545.0), 360);
}

/** Altitude/azimuth (deg; az from N through E) of RA/Dec (deg) for an observer. */
export function altAz(raDeg, decDeg, latDeg, lstDeg) {
  const ha = (lstDeg - raDeg) * RAD, d = decDeg * RAD, f = latDeg * RAD;
  const sinAlt = Math.sin(d) * Math.sin(f) + Math.cos(d) * Math.cos(f) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.cos(d) * Math.sin(ha), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(ha));
  return { alt: alt / RAD, az: mod(az / RAD, 360) };
}

/** Planisphere projection (looking up: N at top, E at left), unit circle. */
export function project(alt, az) {
  const r = (90 - alt) / 90;
  return { x: -r * Math.sin(az * RAD), y: -r * Math.cos(az * RAD) };
}

const hhmm = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

export default {
  meta: {
    num: 3,
    slug: 'sky-over',
    title: 'Sky Over',
    tagline: '一张从神秘城市仰望的星空图。北极星有多高，纬度就是多少；再看头顶是哪些星，推出经度。',
    category: 'geo',
    data: 'computed',
    howTo: [
      '圆盘是整片天空：圆心是头顶，外圈是地平线，上北、左东。同心圈标出 30° 和 60° 高度。',
      '北半球：北极星的高度角 ≈ 观测者纬度。看不到北极星（或它贴着地平线）说明在赤道附近或南半球。',
      '经度：图里给出了 UTC 时刻。星空是夜晚的，所以当地时间大约在 21 点到次日 2 点，由此圈出一条经度带；再看哪些星在正南/头顶，进一步缩小。',
      '在地图上点出答案。0 km 得 100 分，每差约 2,000 km 降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/2000 km)。',
    sources: [
      { name: 'HYG Database v4（Hipparcos / Yale / Gliese 合并星表）', url: 'https://github.com/astronexus/HYG-Database', note: '亮于 4.6 等的 1000 多颗 Hipparcos 恒星' },
      { name: 'd3-celestial 星座连线', url: 'https://github.com/ofrohn/d3-celestial' },
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: '人口 120 万以上的城市作为候选地点' },
    ],
    dataNote: '星位为 J2000 坐标，未做岁差、大气折射修正（误差 < 0.5°）；图中不含月亮与行星。天象由坐标与时间在浏览器中计算。',
  },

  puzzle({ data, date, pick, rng }) {
    const city = pick(data.cities);
    const solar = 21 + Math.round(rng.float(0, 5.5) * 4) / 4; // local mean solar hour 21:00 – 02:30
    const utcH = mod(solar - city.lng / 15, 24);
    const ms = Date.parse(`${date}T00:00:00Z`) + Math.round(utcH * 4) / 4 * 3600000;
    return { city, ms, solar: mod(solar, 24) };
  },

  async play(ctx, p) {
    const { ui, core, data } = ctx;
    const { lat, lng } = p.city;
    const lst = mod(gmstDeg(p.ms) + lng, 360);
    const iso = new Date(p.ms).toISOString();
    ctx.log('sky', { city: p.city.name, lst: +lst.toFixed(1), utc: iso });

    const vis = data.stars.map(([ra, dec, mag, name, hip]) => ({ mag, name, hip, ...altAz(ra, dec, lat, lst) })).filter((s) => s.alt > -2);
    const polaris = vis.find((s) => s.hip === 11767);
    const pos = (ra, dec) => altAz(ra, dec, lat, lst);

    const sky = ui.panel({ kicker: `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`, title: '今晚头顶的星空' });
    ctx.stage.append(sky);
    const cv = ctx.canvas({
      aspect: 1,
      onFrame(dt, g, s) {
        const R = Math.min(s.w, s.h) / 2 - 20, cx = s.w / 2, cy = s.h / 2;
        const P = (alt, az) => { const q = project(alt, az); return [cx + q.x * R, cy + q.y * R]; };
        g.clearRect(0, 0, s.w, s.h);
        g.fillStyle = '#0b1026'; g.fillRect(0, 0, s.w, s.h);
        g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = '#10183a'; g.fill();
        g.strokeStyle = '#5b6aa8'; g.lineWidth = 1.5; g.stroke();
        g.font = '11px ui-monospace, monospace'; g.fillStyle = '#7f8cc4'; g.textAlign = 'left';
        for (const a of [30, 60]) { g.beginPath(); g.setLineDash([3, 4]); g.arc(cx, cy, R * (90 - a) / 90, 0, 7); g.strokeStyle = '#2d3a73'; g.lineWidth = 1; g.stroke(); g.setLineDash([]); g.fillText(`${a}°`, cx + 3, cy - R * (90 - a) / 90 - 3); }
        g.textAlign = 'center'; g.fillStyle = '#b8c2ee'; g.font = 'bold 13px sans-serif';
        g.fillText('北', cx, cy - R - 6); g.fillText('南', cx, cy + R + 15); g.fillText('东', cx - R - 10, cy + 4); g.fillText('西', cx + R + 10, cy + 4);
        // constellation lines (clipped at the horizon)
        g.strokeStyle = 'rgba(120,140,220,0.35)'; g.lineWidth = 1;
        for (const seg of data.lines) {
          g.beginPath(); let pen = false;
          for (const [ra, dec] of seg) {
            const a = pos(ra, dec);
            if (a.alt < 0) { pen = false; continue; }
            const [x, y] = P(a.alt, a.az);
            if (pen) g.lineTo(x, y); else g.moveTo(x, y);
            pen = true;
          }
          g.stroke();
        }
        g.font = '9px sans-serif'; g.fillStyle = s.w < 520 ? 'rgba(0,0,0,0)' : 'rgba(150,165,230,0.55)';
        for (const [code, ra, dec] of data.labels) { const a = pos(ra, dec); if (a.alt > 8) { const [x, y] = P(a.alt, a.az); g.fillText(code, x, y); } }
        for (const st of vis) {
          if (st.alt < 0) continue;
          const [x, y] = P(st.alt, st.az);
          g.beginPath(); g.arc(x, y, Math.max(0.8, 3.4 - st.mag * 0.62), 0, 7);
          g.fillStyle = st.hip === 11767 ? '#ffd166' : '#f4f6ff'; g.fill();
          if (st.hip === 11767) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.strokeStyle = '#ffd166'; g.stroke(); }
          if (st.name && (s.w > 520 || st.mag < 1.6 || st.hip === 11767)) { g.fillStyle = st.hip === 11767 ? '#ffd166' : '#d6dcf7'; g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillText(st.name === 'Polaris' ? 'Polaris 北极星' : st.name, x + 6, y - 5); }
        }
      },
    });
    sky.append(cv.el || cv.canvas || cv);
    cv.start();
    sky.append(ui.h('div', { class: 'small muted', style: { marginTop: '8px' } },
      '上北左东，圆心是天顶。当地时间在 21:00–02:30 之间（夜晚）；每向东 15°，当地时间比 UTC 早 1 小时。'));

    const res = await ctx.pin({
      answer: { lat, lng, label: `${p.city.name}, ${p.city.country}` },
      view: { center: [20, 10], zoom: 2 },
      scale: 2000,
      title: '这是哪座城市的夜空？',
    });
    cv.stop();

    // teaching: the star nearest the zenith has dec ≈ latitude and RA ≈ LST
    const zen = vis.filter((s) => s.mag < 3.5).sort((a, b) => b.alt - a.alt)[0];
    res.detail = ui.kv([
      ['地点', `${p.city.name}，${p.city.country}（${lat.toFixed(1)}°, ${lng.toFixed(1)}°）`],
      ['北极星高度角', polaris && polaris.alt > 0 ? `${polaris.alt.toFixed(1)}°，约等于纬度 ${lat.toFixed(1)}°` : '在地平线下——观测者在赤道以南或附近'],
      ['当地平太阳时', `${hhmm(p.solar)}（UTC ${iso.slice(11, 16)}，经度 ${lng.toFixed(1)}° ⇒ ${lng >= 0 ? '+' : ''}${(lng / 15).toFixed(1)} 小时）`],
      ['恒星时', `${(lst / 15).toFixed(2)} h：赤经约这个值的星正过子午线`],
      ['头顶的星', zen ? `${zen.name || `HIP ${zen.hip}`}（${zen.mag.toFixed(1)} 等，高度 ${zen.alt.toFixed(0)}°）` : '—'],
    ]);
    return res;
  },
};
