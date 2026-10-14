// #1 Daylight — a city's sunrise/sunset curve for the year; pin the city.
// Amplitude ↔ latitude, clock offset of solar noon ↔ longitude within the
// time zone, DST jumps ↔ country rules.

const RAD = Math.PI / 180;

/** UTC instants (ms) of sunrise and sunset on a date (sunrise equation). */
export function sunUTC(iso, lat, lng) {
  const jdNoon = Date.parse(`${iso}T12:00:00Z`) / 86400000 + 2440587.5;
  const n = Math.round(jdNoon - 2451545.0 + 0.0008);
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinD = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinD) / (Math.cos(lat * RAD) * cosD);
  const toMs = (jd) => (jd - 2440587.5) * 86400000;
  if (cosW > 1) return { rise: null, set: null, noon: toMs(jTransit) }; // polar night
  if (cosW < -1) return { rise: null, set: null, noon: toMs(jTransit), allDay: true }; // midnight sun
  const w = Math.acos(cosW) / RAD;
  return { rise: toMs(jTransit - w / 360), set: toMs(jTransit + w / 360), noon: toMs(jTransit) };
}

/** Local clock hours (e.g. 6.5 = 06:30) of a UTC instant in an IANA zone. */
export function clockHours(ms, fmt) {
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') + get('minute') / 60;
}

const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
const dur = (h) => `${Math.floor(h)} 小时 ${Math.round((h % 1) * 60)} 分`;

export default {
  meta: {
    num: 1,
    slug: 'daylight',
    title: 'Daylight',
    tagline: '一座城市一整年的日出日落曲线。读出它的纬度、经度和夏令时，然后在地图上标出来。',
    category: 'geo',
    data: 'computed',
    howTo: [
      '图里是某座城市今年每天的日出（下沿）和日落（上沿）时刻，用当地钟表时间表示。',
      '曲线的振幅告诉你纬度：夏冬白昼差得越多，离赤道越远；6 月白昼长说明在北半球。',
      '正午偏离 12:00 多少，说明城市在时区里偏东还是偏西；曲线上突然平移 1 小时就是夏令时，跳变日期能暴露国家。',
      '在地图上点出你的答案。按距离计分：0 km 得 100 分，每差约 1,500 km 分数降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/1500 km)。',
    sources: [
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/' },
      { name: 'Sunrise equation', url: 'https://en.wikipedia.org/wiki/Sunrise_equation', note: '日出日落时刻由坐标计算，时区规则来自浏览器内置的 IANA tz 数据库' },
    ],
  },

  puzzle({ data, date, pick }) {
    const city = pick(data.cities);
    const year = Number(date.slice(0, 4));
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: city.tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    const days = [];
    for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 86400000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const s = sunUTC(iso, city.lat, city.lng);
      days.push({
        iso,
        rise: s.rise == null ? null : +clockHours(s.rise, fmt).toFixed(3),
        set: s.set == null ? null : +clockHours(s.set, fmt).toFixed(3),
        noon: +clockHours(s.noon, fmt).toFixed(3),
      });
    }
    return { city, year, days };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const rows = p.days.filter((d) => d.rise != null).map((d) => ({ ...d, date: new Date(`${d.iso}T00:00:00Z`), len: d.set - d.rise }));
    const longest = rows.reduce((a, b) => (b.len > a.len ? b : a));
    const shortest = rows.reduce((a, b) => (b.len < a.len ? b : a));
    const today = rows.find((d) => d.iso.slice(5) === ctx.date.slice(5));

    const chart = await ui.plot((Plot, c) => ({
      height: 320,
      marginLeft: 48,
      x: { type: 'utc', tickFormat: '%b', label: null },
      y: { domain: [0, 24], ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24], tickFormat: (h) => `${String(h).padStart(2, '0')}:00`, label: null, grid: true },
      marks: [
        Plot.areaY(rows, { x: 'date', y1: 'rise', y2: 'set', fill: c.accent, fillOpacity: 0.16, curve: 'step' }),
        Plot.lineY(rows, { x: 'date', y: 'rise', stroke: c.accent, strokeWidth: 2, curve: 'step' }),
        Plot.lineY(rows, { x: 'date', y: 'set', stroke: c.ink, strokeWidth: 2, curve: 'step' }),
        Plot.lineY(rows, { x: 'date', y: 'noon', stroke: c.muted, strokeDasharray: '3 4', curve: 'step' }),
        Plot.ruleY([12], { stroke: c.muted, strokeOpacity: 0.5 }),
        today && Plot.ruleX([today.date], { stroke: c.ink, strokeOpacity: 0.35 }),
        Plot.tip(rows, Plot.pointerX({ x: 'date', y: 'set', title: (d) => `${d.iso}\n日出 ${hhmm(d.rise)} · 日落 ${hhmm(d.set)}\n白昼 ${dur(d.len)}` })),
      ],
    }));

    ctx.stage.append(ui.panel(
      { kicker: `${p.year} 年 · 当地钟表时间`, title: '这座城市一年的白昼' },
      chart,
      ui.h('div', { class: 'ds-row small mono ink2', style: { marginTop: '10px', gap: '16px' } },
        ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '━'), ' 日出'),
        ui.h('span', '━ 日落'),
        ui.h('span', { class: 'muted' }, '┄ 太阳正午')),
      ui.h('div', { class: 'ds-grid', style: { '--min': '150px', marginTop: '14px' } },
        ui.stat({ label: '最长白昼', value: hhmm(longest.len), sub: longest.iso.slice(5) }),
        ui.stat({ label: '最短白昼', value: hhmm(shortest.len), sub: shortest.iso.slice(5) }),
        ui.stat({ label: '今天日出', value: today ? hhmm(today.rise) : '—', sub: today ? `日落 ${hhmm(today.set)}` : '' })),
    ));

    const res = await ctx.pin({
      answer: { lat: p.city.lat, lng: p.city.lng, label: `${p.city.name}, ${p.city.country}` },
      view: { center: [25, 10], zoom: 2 },
      scale: 1500,
      title: '它在哪里？',
    });

    const dstJumps = rows.filter((d, i) => i && Math.abs(d.noon - rows[i - 1].noon) > 0.5).map((d) => d.iso.slice(5));
    res.detail = ui.panel({ plain: true },
      ui.kv([
        ['城市', `${p.city.name}，${p.city.country}`],
        ['坐标', `${p.city.lat.toFixed(2)}°, ${p.city.lng.toFixed(2)}°`],
        ['时区', p.city.tz],
        ['夏令时', dstJumps.length ? `切换日 ${dstJumps.join('、')}` : '不实行'],
        ['人口', core.fmtCompact(p.city.pop)],
      ]));
    return res;
  },
};
