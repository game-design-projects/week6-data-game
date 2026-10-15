// #3 Sky Over — tonight's sky rendered from a mystery city (Hipparcos stars + Moon + planets).
// Polaris altitude = latitude; where the celestial equator crosses the meridian (sidereal time) minus GMST = longitude.
import { mod, gmstDeg, altAz, project, precess, centuries, planets, moon, sunAlt } from './astro.js';

export { gmstDeg, altAz, project };

const DARK_SUN_ALT = -12; // nautical twilight is over: stars are really out
const POLARIS = 11767;
const PLANET_NAME = { Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn' };
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
  const bodies = Object.keys(PLANET_NAME).map((k) => ({ key: k, name: PLANET_NAME[k], ...aa(pl[k][0], pl[k][1]) }));
  const mn = moon(p.ms);
  const m = { ...mn, ...aa(mn.ra, mn.dec) };
  m.alt -= 0.95 * Math.cos(m.alt * Math.PI / 180); // topocentric parallax (~57′ at the horizon)
  return { T, gmst, lst, stars, bodies, moon: m, aa };
}

function moonPhaseName(m) {
  const e = m.elong;
  if (e < 12) return 'around new moon';
  if (e < 80) return m.waxing ? 'waxing crescent' : 'waning crescent';
  if (e < 100) return m.waxing ? 'first quarter' : 'last quarter';
  if (e < 168) return m.waxing ? 'waxing gibbous' : 'waning gibbous';
  return 'around full moon';
}

export default {
  meta: {
    num: 3,
    slug: 'sky-over',
    title: 'Sky Over',
    tagline: 'A star chart from a mystery city. Polaris\'s height is the latitude; where the celestial equator crosses the meridian, minus Greenwich sidereal time, is the longitude.',
    category: 'geo',
    data: 'computed',
    howTo: [
      'The disc is the whole sky: the center is straight overhead, the rim is the horizon, north is up and east is left; the rings mark 30° and 60° altitude. The Moon and the five bright planets are drawn too.',
      'Latitude: in the Northern Hemisphere, Polaris\'s altitude is about the latitude. No Polaris means you are near the equator or in the Southern Hemisphere. The dashed orange line is the celestial equator; its height due south (or north) is 90° − |latitude|.',
      'Longitude: the thin vertical line is the meridian. Read the right ascension where the celestial equator crosses it (say 4h): that is the local sidereal time (LST). Subtract the Greenwich sidereal time (GMST) given on the page; each hour of difference is 15° of longitude (east if LST is larger than GMST).',
      'Pin the city on the map. 0 km scores 100, and every ~1,500 km cuts the score to about a third.',
    ],
    scoring: '100 × e^(−distance / 1500 km).',
    sources: [
      { name: 'HYG Database v4 (merged Hipparcos / Yale / Gliese catalog)', url: 'https://github.com/astronexus/HYG-Database', note: 'Over 1,000 Hipparcos stars brighter than magnitude 4.6' },
      { name: 'd3-celestial constellation lines', url: 'https://github.com/ofrohn/d3-celestial' },
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: 'Cities over 1 million people (only the largest in each metro area) as candidate locations' },
      { name: 'JPL approximate planetary orbital elements (Standish)', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', note: 'Planet positions, accurate to about 0.3°' },
      { name: 'Meeus, Astronomical Algorithms, chapter 47', url: 'https://en.wikipedia.org/wiki/Jean_Meeus', note: 'Moon position (main terms only, accurate to about 0.1°)' },
    ],
    dataNote: 'Stars use J2000 coordinates corrected by precession to the day; atmospheric refraction is ignored. The Moon and planets are computed in the browser from orbital elements (about 0.3° error, without the small periodic perturbation terms). The sky is computed from coordinates and time, not observed live; the puzzle is set at a moment when the Sun is more than 12° below the horizon so the sky is fully dark.',
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
    const panel = ui.panel({ kicker: `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`, title: 'The sky overhead tonight', aside: ui.badge(`GMST ${hm(gmst / 15)}`) }, box);
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
        g.fillText('N', cx, cy - R - 6); g.fillText('S', cx, cy + R + 15); g.fillText('E', cx - R - 9, cy + 4); g.fillText('W', cx + R + 9, cy + 4);
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
        for (const [st, x, y] of bright.sort((a, b) => a[0].mag - b[0].mag)) { g.fillStyle = st.hip === POLARIS ? '#ffd166' : '#d6dcf7'; label(st.name, x, y); }
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
          g.font = 'bold 11px sans-serif'; g.fillStyle = '#fff6d8'; g.textAlign = 'left'; label('Moon', x + r, y);
        }
      },
    });
    box.append(cv.el || cv.canvas || cv);
    cv.start();
    box.append(ui.h('div', { class: 'small muted', style: { marginTop: '8px' } },
      `North is up and east is left. The + at the center is the zenith, the vertical line is the meridian, and the dashed orange line is the celestial equator (marked in hours of right ascension). The sky is fully dark here (the Sun is at least 12° below the horizon). Greenwich sidereal time GMST = ${hmShort(gmst / 15)}.`));

    const res = await ctx.pin({
      answer: { lat, lng, label: `${p.city.name}, ${p.city.country}` },
      view: { bounds: [[-56, -168], [72, 168]] },
      scale: 1500,
      setup: ({ map, el }) => { map.setMaxBounds([[-85, -540], [85, 540]]); el.style.background = 'var(--paper2)'; },
      title: 'Which city\'s night sky is this?',
    });
    cv.stop();

    // teaching
    const polaris = vis.find((s) => s.hip === POLARIS);
    const zen = vis.filter((s) => s.mag < 3.5).sort((a, b) => b.alt - a.alt)[0];
    const dLng = wrap180(lst - gmst);
    const seen = sky.bodies.filter((b) => b.alt > 5).map((b) => `${b.name} (${b.alt.toFixed(0)}°)`);
    const m = sky.moon;
    const g = res.guess || {};
    const latErr = Number.isFinite(g.lat) ? g.lat - lat : null, lngErr = Number.isFinite(g.lng) ? wrap180(g.lng - lng) : null;
    const eqAlt = 90 - Math.abs(lat);
    res.detail = ui.kv([
      ['Location', `${p.city.name}, ${p.city.country} (${lat.toFixed(1)}°, ${lng.toFixed(1)}°)`],
      ['Reading latitude', (polaris && polaris.alt > 0 ? `Polaris stands ${polaris.alt.toFixed(1)}° high, about the latitude of ${lat.toFixed(1)}°. ` : `Polaris is below the horizon, so this is ${lat < 0 ? 'the Southern Hemisphere' : 'near the equator'}. `)
        + `The celestial equator is ${eqAlt.toFixed(0)}° high due ${lat >= 0 ? 'south' : 'north'} = 90° − ${Math.abs(lat).toFixed(0)}°.`],
      ['Reading longitude', `On the meridian the celestial equator sits at right ascension about ${(lst / 15).toFixed(2)} h (local sidereal time, LST); the GMST on the page is ${(gmst / 15).toFixed(2)} h; the difference is ${(dLng / 15).toFixed(2)} h × 15 = ${dLng.toFixed(1)}°, i.e. ${Math.abs(dLng).toFixed(1)}° ${dLng >= 0 ? 'east' : 'west'}.`],
      ['Local time', `Mean solar time ${hm(p.solar)} (UTC ${iso.slice(11, 16)}; every 15° of longitude is 1 hour)`],
      ['Star overhead', zen ? `${zen.name || `HIP ${zen.hip}`} (magnitude ${zen.mag.toFixed(1)}, altitude ${zen.alt.toFixed(0)}°): the declination at the zenith ≈ the latitude` : '—'],
      ['Moon and planets', `${m.alt > 0 ? `The Moon is above the horizon (${moonPhaseName(m)}, ${Math.round(m.illum * 100)}% lit, ${m.alt.toFixed(0)}° high)` : `The Moon is below the horizon (${moonPhaseName(m)})`}; ${seen.length ? `visible planets: ${seen.join(', ')}` : 'no bright planets above the horizon'}. The Moon and planets sit at almost the same place among the stars everywhere on Earth, so they give no location clue.`],
      ...(latErr == null ? [] : [['Your error', `${Math.abs(latErr).toFixed(1)}° off in latitude, ${Math.abs(lngErr).toFixed(1)}° off in longitude`]]),
    ]);
    return res;
  },
};
