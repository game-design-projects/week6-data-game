// Downloads EMODnet Human Activities vessel-density crops (WMS GetMap, 2017-2023 all vessel types)
// around named straits / ports and writes data.json + img/*.png. Raw PNGs cached in build/raw/.
import { writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..');
mkdirSync(join(here, 'raw'), { recursive: true });

// id, 中文, English, kind, lat, lng, tight span (deg of latitude)
const P = [
  ['dover', '多佛尔海峡', 'Strait of Dover', 'strait', 51.0, 1.5, 1.0],
  ['gibraltar', '直布罗陀海峡', 'Strait of Gibraltar', 'strait', 35.97, -5.6, 1.0],
  ['bosphorus', '博斯普鲁斯海峡', 'Bosphorus', 'strait', 41.1, 29.05, 0.6],
  ['dardanelles', '达达尼尔海峡', 'Dardanelles', 'strait', 40.15, 26.4, 0.8],
  ['oresund', '厄勒海峡', 'Øresund', 'strait', 55.7, 12.75, 0.8],
  ['greatbelt', '大贝尔特海峡', 'Great Belt', 'strait', 55.4, 11.0, 0.8],
  ['fehmarn', '费马恩海峡', 'Fehmarn Belt', 'strait', 54.6, 11.3, 0.7],
  ['messina', '墨西拿海峡', 'Strait of Messina', 'strait', 38.2, 15.6, 0.6],
  ['bonifacio', '博尼法乔海峡', 'Strait of Bonifacio', 'strait', 41.3, 9.2, 0.6],
  ['otranto', '奥特朗托海峡', 'Strait of Otranto', 'strait', 40.0, 18.8, 1.0],
  ['sicily', '西西里海峡', 'Sicily Channel', 'strait', 37.2, 12.0, 1.2],
  ['ushant', '韦桑岛海域', 'Ushant (Bay of Biscay)', 'strait', 48.5, -5.3, 1.0],
  ['stvincent', '圣维森特角', 'Cape St Vincent', 'strait', 37.0, -9.0, 1.0],
  ['pentland', '彭特兰湾', 'Pentland Firth', 'strait', 58.7, -3.1, 0.7],
  ['northchannel', '北海峡', 'North Channel', 'strait', 54.9, -5.4, 0.8],
  ['gulffinland', '芬兰湾', 'Gulf of Finland', 'strait', 59.9, 25.0, 1.5],
  ['skagen', '斯卡恩角', 'Skagen (Skagerrak)', 'strait', 57.7, 10.6, 1.0],
  ['rotterdam', '鹿特丹', 'Rotterdam', 'port', 51.95, 4.0, 0.7],
  ['antwerp', '安特卫普', 'Antwerp', 'port', 51.3, 4.2, 0.5],
  ['hamburg', '汉堡 / 易北河口', 'Hamburg (Elbe)', 'port', 53.9, 8.8, 0.9],
  ['piraeus', '比雷埃夫斯', 'Piraeus', 'port', 37.9, 23.6, 0.7],
  ['genoa', '热那亚', 'Genoa', 'port', 44.3, 8.9, 0.7],
  ['marseille', '马赛', 'Marseille', 'port', 43.3, 5.3, 0.7],
  ['valencia', '瓦伦西亚', 'Valencia', 'port', 39.4, -0.2, 0.7],
  ['barcelona', '巴塞罗那', 'Barcelona', 'port', 41.3, 2.2, 0.7],
  ['gdansk', '格但斯克', 'Gdansk', 'port', 54.5, 18.7, 0.7],
  ['gothenburg', '哥德堡', 'Gothenburg', 'port', 57.7, 11.7, 0.7],
  ['venice', '威尼斯 / 的里雅斯特', 'Venice–Trieste', 'port', 45.4, 13.3, 1.0],
  ['thames', '泰晤士河口', 'Thames Estuary', 'port', 51.5, 1.2, 0.9],
  ['lehavre', '勒阿弗尔', 'Le Havre', 'port', 49.5, 0.1, 0.6],
  ['lisbon', '里斯本', 'Lisbon', 'port', 38.6, -9.4, 0.7],
  ['constanta', '康斯坦察', 'Constanța', 'port', 44.1, 28.8, 0.8],
  ['bilbao', '毕尔巴鄂', 'Bilbao', 'port', 43.4, -3.1, 0.7],
];
const R = 6378137, mx = (lng) => (lng * Math.PI / 180) * R, my = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R;
const mult = [1, 3, 9]; // tight / medium / wide
const SZ = 240;
const places = [];
for (const [id, zh, en, kind, lat, lng, s] of P) {
  const files = [];
  for (let i = 0; i < 3; i++) {
    const half = (s * mult[i] * 111320) / 2; // metres in 3857 (approx, scaled by 1/cos at lat)
    const k = 1 / Math.cos(lat * Math.PI / 180);
    const cx = mx(lng), cy = my(lat), h = half * k;
    const bbox = [cx - h, cy - h, cx + h, cy + h].map((v) => v.toFixed(0)).join(',');
    const raw = join(here, 'raw', `${id}-${i}.png`);
    if (!existsSync(raw)) {
      const url = `https://ows.emodnet-humanactivities.eu/wms?service=WMS&version=1.1.1&request=GetMap&layers=vesseldensity_all&styles=&srs=EPSG:3857&bbox=${bbox}&width=${SZ}&height=${SZ}&format=image/png&transparent=true`;
      const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
      if (!r.ok) throw new Error(`${id} ${r.status}`);
      writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
      await new Promise((r2) => setTimeout(r2, 400));
    }
    copyFileSync(raw, join(out, 'img', `${id}-${i}.png`));
    files.push(`${id}-${i}.png`);
  }
  const bytes = statSync(join(out, 'img', `${id}-0.png`)).size;
  places.push({ id, zh, en, kind, lat, lng, files, spanKm: [0, 1, 2].map((i) => Math.round(s * mult[i] * 111)), tightBytes: bytes });
}
writeFileSync(join(out, 'data.json'), JSON.stringify({ places, source: 'EMODnet Human Activities vessel density (all types), WMS GetMap, EPSG:3857, 240px' }));
console.log(places.map((p) => `${p.id}:${p.tightBytes}`).join(' '));
