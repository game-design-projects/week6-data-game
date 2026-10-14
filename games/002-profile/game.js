// #2 Profile — an elevation profile along a hidden 240 km west→east line; pin the line's midpoint.
// Data: Copernicus GLO-90 DEM via Open-Meteo elevation API.

/** Summarise a profile: min/max/relief and the position (0..1) of the highest point. */
export function summarize(elev) {
  const max = Math.max(...elev), min = Math.min(...elev);
  return { max, min, relief: max - min, peakAt: elev.indexOf(max) / (elev.length - 1) };
}

export default {
  meta: {
    num: 2,
    slug: 'profile',
    title: 'Profile',
    tagline: '沿一条隐藏直线切开大地：看海拔剖面图，猜这条线在哪。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '图里是一条 240 公里长、自西向东的直线上的海拔剖面，左边是西端，右边是东端。',
      '读它的形状：海平面附近说明靠海，一路平坦是高原或平原，陡峭起伏是造山带，深切的 V 形是峡谷或裂谷。',
      '地图已限定在这条线所在的大洲，底图只有山体阴影，没有地名。点出这条线的中点。',
      '按距离计分：0 km 得 100 分，每差约 600 km 分数降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/600 km)。',
    sources: [
      { name: 'Copernicus DEM GLO-90', url: 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model', note: '90 米分辨率全球数字高程模型' },
      { name: 'Open-Meteo Elevation API', url: 'https://open-meteo.com/en/docs/elevation-api', note: '以 Copernicus DEM 为底层，沿线每 3 公里取样一点' },
      { name: 'Esri World Hillshade', url: 'https://www.arcgis.com/home/item.html?id=1b243539f4514b6ba35e7d995890db1d', note: '地图底图' },
    ],
    dataNote: '约 70 条精选样线（覆盖六大洲的高山、高原、峡谷、平原与海岛），由我们离线采样存入 data.json；每个难度同样随机。',
  },

  puzzle({ data, pick }) {
    return { ...pick(data.puzzles), lenKm: data.lenKm };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const reg = ctx.data.regions[p.region];
    const n = p.elev.length;
    const pts = p.elev.map((e, i) => ({ km: (i * p.lenKm) / (n - 1), e }));
    const s = summarize(p.elev);
    ctx.log('profile', p.id, p.place, s);

    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 44,
      x: { label: '← 西    距离 (km)    东 →' },
      y: { label: null, grid: true, tickFormat: (v) => core.fmtNum(v) },
      marks: [
        Plot.areaY(pts, { x: 'km', y: (d) => Math.max(d.e, 0), fill: c.accent, fillOpacity: 0.25 }),
        Plot.lineY(pts, { x: 'km', y: 'e', stroke: c.accent, strokeWidth: 2 }),
        Plot.ruleY([0], { stroke: c.muted }),
        Plot.tip(pts, Plot.pointerX({ x: 'km', y: 'e', title: (d) => `${Math.round(d.km)} km · ${core.fmtNum(d.e)} m` })),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: `在${reg.name} · 海拔 (m)`, title: '这条线的海拔剖面' },
      chart,
      ui.h('div', { class: 'ds-grid', style: { '--min': '90px', marginTop: '12px' } },
        ui.stat({ label: '最高 (m)', value: core.fmtNum(s.max) }),
        ui.stat({ label: '最低 (m)', value: core.fmtNum(s.min) }),
        ui.stat({ label: '起伏 (m)', value: core.fmtNum(s.relief) }))));

    const res = await ctx.pin({
      title: '这条线的中点在哪里？',
      answer: { lat: p.lat, lng: p.lng, label: p.place },
      view: { center: reg.center, zoom: reg.zoom },
      basemap: 'hillshade',
      scale: 600,
      reveal: async ({ L, map }) => {
        const dLng = p.lenKm / (111.32 * Math.cos((p.lat * Math.PI) / 180)) / 2;
        const line = L.polyline([[p.lat, p.lng - dLng], [p.lat, p.lng + dLng]], { color: '#e11', weight: 4 }).addTo(map);
        map.fitBounds(line.getBounds().pad(4), { maxZoom: 8 });
      },
    });

    res.detail = ui.kv([
      ['答案', `${p.place}（${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°）`],
      ['最高点', `${core.fmtNum(s.max)} m，位于线上约 ${Math.round(s.peakAt * p.lenKm)} km 处`],
      ['线索', s.max < 150 ? '全程近海平面：滨海平原或岛屿。' : s.min > 1500 ? '全程高海拔：高原或山间盆地。' : s.relief > 2500 ? '起伏巨大：年轻的造山带。' : s.relief < 300 ? '起伏很小：平原或老高原。' : '中等起伏：丘陵或山麓。'],
    ]);
    return res;
  },
};
