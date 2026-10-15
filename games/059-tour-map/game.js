// #59 Tour Map — a tour's stops drawn on a map; name the artist, then the year.
// Data: MusicBrainz events that belong to a "Tour" series (CC0).
import { haversineKm } from '../../engine/core.js';

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const PLACE_ZH = { Stadium: '体育场', Arena: '体育馆', 'Indoor arena': '室内体育馆', Venue: '剧场/场馆', 'Religious building': '教堂', Studio: '录音棚', Other: '其他' };
const zhRegion = (cc) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return cc; } };

/** Rough continent of a coordinate (coarse boxes, enough for a clue). */
export function regionOf(lat, lng) {
  if (lng < -30) return lat <= 12 && lng >= -82 && !(lat > 8 && lng < -77) ? '南美洲' : '北美洲';
  if (lat < -10 && lng > 110) return '大洋洲';
  if (lng >= -20 && lng < 52 && lat < 35.5 && (lng < 34.5 || lat < 12)) return '非洲';
  if (lng >= -30 && lng < 45 && lat >= 35.5) return '欧洲';
  return '亚洲';
}
export const cityOf = (s) => s[3] || s[4];

/** stop = [date, lat, lng, city, venue, placeType] */
export function summarize(stops) {
  const cityCount = new Map();
  const types = new Map();
  const regions = new Map();
  for (const s of stops) {
    if (s[3]) cityCount.set(s[3], (cityCount.get(s[3]) || 0) + 1);
    const rg = regionOf(s[1], s[2]);
    regions.set(rg, (regions.get(rg) || 0) + 1);
    const t = PLACE_ZH[s[5]] || '其他';
    types.set(t, (types.get(t) || 0) + 1);
  }
  const first = stops[0][0];
  const last = stops[stops.length - 1][0];
  let km = 0;
  for (let i = 1; i < stops.length; i++) km += haversineKm({ lat: stops[i - 1][1], lng: stops[i - 1][2] }, { lat: stops[i][1], lng: stops[i][2] });
  return {
    n: stops.length,
    cities: cityCount.size,
    top: [...cityCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3),
    types: [...types.entries()].sort((a, b) => b[1] - a[1]),
    regions: [...regions.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    first, last,
    spanDays: Math.round((Date.parse(last) - Date.parse(first)) / 864e5),
    km: Math.round(km),
  };
}

/** Years in [lo,hi] in which month-day `md` ('05-10') falls on weekday `wd` (0=Sun). */
export function yearsWithWeekday(md, wd, lo = 1965, hi = 2026) {
  const out = [];
  for (let y = lo; y <= hi; y++) if (new Date(`${y}-${md}T12:00:00Z`).getUTCDay() === wd) out.push(y);
  return out;
}

export default {
  meta: {
    num: 59,
    slug: 'tour-map',
    title: 'Tour Map',
    tagline: '一次巡演的全部站点画在地图上，没有名字、没有年份。先猜是谁的巡演，再猜哪一年。',
    category: 'culture',
    data: 'snapshot',
    wide: true,
    howTo: [
      '地图上的圆点是某次巡演的每一站（粗圈是首站），虚线按演出先后连起来。地图没有地名，线索栏会给出场次、大洲分布、场馆类型等信息。',
      '第一步：从列表里选出艺人，最多 6 次，每猜错一次解锁一条新线索；猜完后地图会显示地名。',
      '第二步：猜这次巡演最早一场所在的年份。我们会告诉你那天是星期几，只有少数几年的这一天是这个星期几，再结合艺人的职业生涯来判断。',
      '场馆类型是规模的指纹：体育场巡演属于已经封神的阶段，剧场和俱乐部多是早期或小众巡演。',
    ],
    scoring: '艺人：第 1 次猜中 100 分，每多一次少约 17 分；年份：差 0 年 100 分，差约 2 年降到约 37 分（共 2 次机会，第二次扣 10%）。总分 200。',
    sources: [
      { name: 'MusicBrainz Web Service (events, series, places)', url: 'https://musicbrainz.org/doc/MusicBrainz_API', note: '数据为 CC0；用艺人事件按 “Tour” 系列归并' },
      { name: 'setlist.fm API', url: 'https://api.setlist.fm/docs/1.0/index.html', note: '想法里的原始建议来源；它需要 API Key（不能放进浏览器），因此改用 MusicBrainz 的同类事实' },
    ],
    dataNote: 'MusicBrainz 是社区维护的数据库，巡演站点并不完整（常缺场次，热门艺人更全），所以“最早一场”指数据库里收录的最早一场。只保留至少 8 场、6 个不同地点、基本由单一艺人主导的巡演，在构建时离线整理成快照；不是实时数据（setlist.fm 需要密钥，MusicBrainz 的巡演数据也不会每天变化）。艺人以欧美为主，亚洲艺人在 MusicBrainz 的巡演记录很少。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.tours).id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const tour = ctx.data.tours.find((t) => t.id === p.id);
    const artist = ctx.data.artists.find((a) => a.id === tour.artist);
    const sum = summarize(tour.stops);
    const place = (x) => x[3] || x[4];
    ctx.log('tour', tour.tour, artist.name, tour.year, sum);

    // map of stops (label-free basemap while guessing; names come back on reveal)
    const bounds = tour.stops.reduce(([[s, w], [n, e]], x) => [[Math.min(s, x[1]), Math.min(w, x[2])], [Math.max(n, x[1]), Math.max(e, x[2])]], [[90, 180], [-90, -180]]);
    const m = await ui.createMap({ bounds, height: window.innerWidth < 600 ? 300 : 380, basemap: 'gray', minZoom: 1 });
    const c = ui.colors();
    const pts = tour.stops.map((x) => [x[1], x[2]]);
    m.L.polyline(pts, { color: c.accent, weight: 1.5, opacity: 0.55, dashArray: '4 5' }).addTo(m.map);
    const markers = tour.stops.map((x, i) => m.L.circleMarker([x[1], x[2]], { radius: i === 0 ? 8 : 5, color: i === 0 ? c.ink : c.accent, weight: i === 0 ? 2 : 1, fillColor: c.accent, fillOpacity: 0.8 })
      .bindTooltip(i === 0 ? '首站' : `第 ${i + 1} 站`).addTo(m.map));
    ctx.stage.append(ui.panel({ kicker: '线索', title: '这次巡演去过的地方' }, m.el,
      ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '8px' } },
        ui.h('span', `${sum.n} 场`), ui.h('span', `${sum.cities} 座城市`), ui.h('span', `虚线总长约 ${core.fmtNum(sum.km)} km`), ui.h('span', '粗圈 = 首站'))));
    // the map can be measured before layout settles: refit once the panel is in the page and on every resize
    const fit = () => { if (!m.el.clientWidth) return; m.map.invalidateSize(); m.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7 }); };
    requestAnimationFrame(fit);
    setTimeout(fit, 300);
    if (typeof ResizeObserver !== 'undefined') { let w = 0; new ResizeObserver(() => { if (m.el.clientWidth && m.el.clientWidth !== w) { w = m.el.clientWidth; fit(); } }).observe(m.el); }

    const cityList = (xs) => xs.map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join('、');
    const first = tour.stops[0];
    const last = tour.stops.at(-1);
    const clues = [
      `数据库里收录了 ${sum.n} 场，走了 ${sum.cities} 座城市，从首场到末场跨度 ${sum.spanDays} 天。`,
      `场次分布：${sum.regions.map(([r, k]) => `${r} ${k} 场`).join('，')}。`,
      `首站在 ${place(first)}${first[3] ? `（${first[4]}）` : ''}，末站在 ${place(last)}${last[3] ? `（${last[4]}）` : ''}。`,
      `停留最多的城市：${cityList(sum.top)}。场馆类型：${sum.types.map(([t, k]) => `${t} ${k}`).join('，')}。`,
      `其中几个场馆：${[...new Set(tour.stops.map((x) => x[4]))].slice(2, 6).join('、')}。`,
      `艺人来自${artist.country ? zhRegion(artist.country) : '未知地区'}，英文名首字母 “${artist.name[0].toUpperCase()}”。`,
    ];
    const byId = new Map(ctx.data.artists.map((a) => [a.id, a]));
    const r1 = await ctx.guess({
      title: '这是谁的巡演？',
      placeholder: '输入艺人名…',
      options: ctx.data.artists.map((a) => ({ id: a.id, label: a.name, hint: a.country ? zhRegion(a.country) : '', aliases: [a.query] })),
      answer: artist.id,
      maxGuesses: 6,
      clues,
      cluesTitle: '线索',
      columns: ['地区'],
      near: (g) => byId.get(g.id).country && byId.get(g.id).country === artist.country,
      feedback: (g) => {
        const ga = byId.get(g.id);
        const same = ga.country && ga.country === artist.country;
        return [{ text: ga.country ? zhRegion(ga.country) : '—', state: same ? 'near' : undefined }];
      },
    });
    ctx.log('artist stage', r1.win, r1.summary);
    // reveal: place names on the map
    m.setLabels(true);
    markers.forEach((mk, i) => mk.setTooltipContent(`${i + 1}. ${place(tour.stops[i])} · ${tour.stops[i][0]}`));

    // stage 2: year
    const [d0] = first;
    const wd = new Date(`${d0}T12:00:00Z`).getUTCDay();
    const cand = yearsWithWeekday(d0.slice(5), wd);
    const mdZh = `${+d0.slice(5, 7)} 月 ${+d0.slice(8)} 日`;
    const stadium = sum.types.find((t) => t[0] === '体育场')?.[1] || 0;
    ctx.stage.append(ui.panel({ kicker: `答案：${artist.name}`, title: '年份线索' },
      ui.h('div', { class: 'ds-stack' },
        ui.h('div', `数据库里最早的一场在 ${mdZh}，${WD[wd]}。`),
        ui.h('div', { class: 'small ink2' }, `1965–2026 年里，${mdZh}是${WD[wd]}的年份有：`, ui.h('span', { class: 'mono' }, cand.join('、'))),
        ui.h('div', { class: 'small ink2' }, `体育场 ${stadium} 场 / 共 ${sum.n} 场；再结合 ${artist.name} 的职业生涯，挑一个年份。`))));
    const r2 = await ctx.estimate({
      title: '这次巡演最早一场是哪一年？',
      answer: tour.year, min: 1965, max: 2026, step: 1, initial: 2005,
      format: (v) => `${Math.round(v)} 年`, scoring: 'abs', scale: 2, attempts: 2, tolerance: 0.5,
    });

    const res = ctx.combine([r1, r2]);
    const nearest = cand.filter((y) => y !== tour.year).sort((a, b) => Math.abs(a - tour.year) - Math.abs(b - tour.year))[0];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['巡演', tour.tour], ['艺人', artist.name], ['最早一场', `${first[0]} · ${place(first)}`], ['最晚一场', `${last[0]} · ${place(last)}`], ['规模', `${sum.n} 场 / ${sum.cities} 座城市 / 约 ${core.fmtNum(sum.km)} km`]]),
      ui.h('div', { class: 'small ink2' }, `怎么看出来的：场次分布是 ${sum.regions.map(([r, k]) => `${r} ${k}`).join('、')}，场馆以 ${sum.types.slice(0, 2).map(([t, k]) => `${t} ${k}`).join('、')} 为主` +
        `${stadium / sum.n >= 0.4 ? '（体育场占比高，是顶级巨星规模的巡演）' : stadium === 0 ? '（没有体育场，多是中小型场馆的巡演）' : ''}。${mdZh}是${WD[wd]}，1965–2026 年里只有 ${cand.length} 个年份符合` +
        `${nearest ? `（最接近的另一个是 ${nearest} 年）` : ''}，答案 ${tour.year} 年就在其中。` + (artist.country ? ` ${artist.name} 来自${zhRegion(artist.country)}。` : '')),
      ui.table({ columns: [{ key: 'd', label: '日期' }, { key: 'c', label: '城市' }, { key: 'v', label: '场馆' }], rows: tour.stops.slice(0, 12).map((x) => ({ d: x[0], c: x[3] || '—', v: x[4] })) }),
      tour.stops.length > 12 ? ui.h('div', { class: 'small muted' }, `仅列出前 12 场，共 ${tour.stops.length} 场。`) : null);
    return res;
  },
};
