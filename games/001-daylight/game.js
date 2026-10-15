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

/** Hours (may exceed 24) → HH:MM, rounding whole minutes first so 11.999 never prints 11:00. */
export const hhmm = (h) => {
  const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const dur = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} 小时 ${m % 60} 分`; };
const fmtMin = (m) => { const a = Math.round(Math.abs(m)); return a >= 60 ? `${Math.floor(a / 60)} 小时 ${a % 60} 分` : `${a} 分钟`; };
const fmtUtc = (h) => `UTC${h < 0 ? '−' : '+'}${Math.floor(Math.abs(h))}${Math.abs(h) % 1 ? `:${String(Math.round((Math.abs(h) % 1) * 60)).padStart(2, '0')}` : ''}`;

/** Standard-time UTC offset (hours) of a zone in a year: the smaller of the Jan and Jul offsets. */
export function stdOffsetHours(year, fmt) {
  const off = (m) => { let o = clockHours(Date.UTC(year, m, 1, 12), fmt) - 12; if (o > 14) o -= 24; if (o < -12) o += 24; return o; };
  return Math.min(off(0), off(6));
}

/** Dates (MM-DD) where the clock jumps: DST changes. */
export function dstJumps(days) {
  return days.filter((d, i) => i && Math.abs(d.noon - days[i - 1].noon) > 0.2).map((d) => d.iso.slice(5));
}

/** Puzzle-specific lesson: how latitude, longitude and DST show up in the curve. */
export function explain(city, days, year, fmt) {
  const rows = days.filter((d) => d.rise != null).map((d) => ({ ...d, len: d.set - d.rise }));
  const longest = rows.reduce((a, b) => (b.len > a.len ? b : a));
  const shortest = rows.reduce((a, b) => (b.len < a.len ? b : a));
  const range = longest.len - shortest.len;
  const north = Number(longest.iso.slice(5, 7)) >= 4 && Number(longest.iso.slice(5, 7)) <= 9;
  const std = stdOffsetHours(year, fmt);
  const dMin = (city.lng - std * 15) * 4; // minutes the sun reaches the meridian before (+) the zone's central meridian
  const jumps = dstJumps(days);
  const lat = `最长白昼 ${hhmm(longest.len)}（${longest.iso.slice(5)}）、最短 ${hhmm(shortest.len)}（${shortest.iso.slice(5)}），相差 ${dur(range)}；` +
    `最长白昼出现在${north ? '年中' : '年底年初'}，所以在${north ? '北' : '南'}半球。纬度 ${Math.abs(city.lat).toFixed(1)}°${city.lat < 0 ? 'S' : 'N'}：${Math.abs(city.lat) < 15 ? '落差很小，靠近赤道' : Math.abs(city.lat) > 50 ? '落差很大，靠近极圈' : '落差中等，位于中纬度'}。`;
  const lng = `时区 ${fmtUtc(std)} 的中央经线是 ${Math.abs(std * 15).toFixed(0)}°${std < 0 ? 'W' : 'E'}，城市在 ${Math.abs(city.lng).toFixed(1)}°${city.lng < 0 ? 'W' : 'E'}，` +
    (Math.abs(dMin) < 1 ? '几乎正好在中央经线上' : `${dMin > 0 ? '偏东' : '偏西'}，太阳正午比 12:00（标准时间）${dMin > 0 ? '早' : '晚'}约 ${fmtMin(dMin)}`) + '（另有 ±16 分钟的均时差）。';
  const dst = jumps.length ? `夏令时：钟表在 ${jumps.join('、')} 平移 1 小时，这套切换日期对应 ${city.country} 一带的规则。` : '全年没有平移，说明所在地不实行夏令时。';
  return { lat, lng, dst, jumps, longest, shortest, std };
}

export default {
  meta: {
    num: 1,
    slug: 'daylight',
    title: 'Daylight',
    tagline: '一座城市一整年的日出日落曲线。读出它的纬度、经度和夏令时，然后在地图上标出来。',
    category: 'geo',
    data: 'computed',
    howTo: [
      '图里是某座城市今年每天的日出（下沿）和日落（上沿）时刻，用当地钟表时间表示；虚线是太阳正午。高纬度夏天日落可能越过 24:00。',
      '曲线的振幅告诉你纬度：夏冬白昼差得越多，离赤道越远；6 月白昼长说明在北半球。',
      '正午偏离 12:00 多少，说明城市在时区里偏东还是偏西；曲线上突然平移 1 小时就是夏令时，跳变日期能暴露国家。',
      '在地图上点出你的答案。按距离计分：0 km 得 100 分，每差约 1,500 km 分数降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/1500 km)：差 0 km 得 100 分，差 1,500 km 约 37 分，跨洲基本为 0。只能猜一次。',
    dataNote: '城市来自 GeoNames（人口 ≥ 100 万的城市，以及人口 ≥ 10 万的首都；相距 150 km 内只留较大者），共 389 座。日出日落由坐标用日出方程（含 −0.833° 大气折射）在浏览器里计算，精度约几分钟；夏令时与时区规则取自浏览器内置的 IANA 时区数据库，不联网，也没有实时数据。',
    sources: [
      { name: 'GeoNames cities15000（CC BY 4.0）', url: 'https://download.geonames.org/export/dump/' },
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
      const rise = s.rise == null ? null : +clockHours(s.rise, fmt).toFixed(3);
      let set = s.set == null ? null : +clockHours(s.set, fmt).toFixed(3);
      if (rise != null && set <= rise) set = +(set + 24).toFixed(3); // sunset after local midnight (e.g. Reykjavik in summer)
      days.push({ iso, rise, set, noon: +clockHours(s.noon, fmt).toFixed(3) });
    }
    return { city, year, days };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const rows = p.days.filter((d) => d.rise != null).map((d) => ({ ...d, date: new Date(`${d.iso}T00:00:00Z`), len: d.set - d.rise }));
    const longest = rows.reduce((a, b) => (b.len > a.len ? b : a));
    const shortest = rows.reduce((a, b) => (b.len < a.len ? b : a));
    const today = rows.find((d) => d.iso.slice(5) === ctx.date.slice(5));

    const yMax = Math.max(24, Math.ceil(Math.max(...rows.map((d) => d.set)) / 3) * 3);
    const yTicks = Array.from({ length: yMax / 3 + 1 }, (_, i) => i * 3);
    const chart = await ui.plot((Plot, c) => ({
      height: 320,
      marginLeft: 48,
      x: { type: 'utc', tickFormat: '%b', label: null },
      y: { domain: [0, yMax], ticks: yTicks, tickFormat: (h) => h === 24 ? "24:00" : `${String(h % 24).padStart(2, "0")}:00`, label: null, grid: true },
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
      view: ctx.stage.clientWidth < 600 ? { bounds: [[-58, -170], [75, 180]] } : { center: [10, 10], zoom: 1 },
      scale: 1500,
      title: '它在哪里？',
    });

    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: p.city.tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    const ex = explain(p.city, p.days, p.year, fmt);
    res.detail = ui.panel({ plain: true },
      ui.kv([
        ['答案', `${p.city.name}，${p.city.country}（人口 ${core.fmtCompact(p.city.pop)}）`],
        ['坐标 · 时区', `${p.city.lat.toFixed(2)}°, ${p.city.lng.toFixed(2)}° · ${p.city.tz}`],
        ['纬度线索', ex.lat],
        ['经度线索', ex.lng],
        ['夏令时线索', ex.dst],
      ]));
    return res;
  },
};
