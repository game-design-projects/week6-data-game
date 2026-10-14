// Fetch AWS Terrain Tiles (terrarium PNG, derived from SRTM/ETOPO1/etc.), downsample to 32x32 grids.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const Z = 11, N = 32;
const SITES = `Mt Fuji|35.36|138.73|日本
Matterhorn|45.98|7.66|瑞士/意大利
Grand Canyon|36.1|-112.1|美国
Mt Rainier|46.85|-121.76|美国
Kilimanjaro|-3.07|37.35|坦桑尼亚
Everest|27.99|86.93|尼泊尔/中国
Mt St Helens|46.2|-122.19|美国
Yosemite Valley|37.74|-119.57|美国
Denali|63.07|-151.0|美国
Aconcagua|-32.65|-70.01|阿根廷
Torres del Paine|-51.0|-73.0|智利
Mt Etna|37.75|15.0|意大利
Vesuvius|40.82|14.43|意大利
Mauna Kea|19.82|-155.47|美国夏威夷
Haleakala|20.71|-156.25|美国夏威夷
Kilauea|19.42|-155.29|美国夏威夷
Aoraki Mt Cook|-43.59|170.14|新西兰
Milford Sound|-44.67|167.93|新西兰
Tongariro|-39.16|175.63|新西兰
Zhangjiajie|29.32|110.43|中国
Huangshan|30.13|118.17|中国
Tianshan Heaven Lake|43.88|88.13|中国
Mt Kailash|31.07|81.31|中国西藏
K2|35.88|76.51|巴基斯坦/中国
Annapurna|28.6|83.82|尼泊尔
Fitz Roy|-49.27|-72.94|阿根廷
Machu Picchu|-13.16|-72.55|秘鲁
Cotopaxi|-0.68|-78.44|厄瓜多尔
Pico de Orizaba|19.03|-97.27|墨西哥
Popocatepetl|19.02|-98.62|墨西哥
Crater Lake|42.94|-122.1|美国
Mt Whitney|36.58|-118.29|美国
Death Valley|36.23|-116.77|美国
Zion|37.3|-113.0|美国
Bryce Canyon|37.59|-112.19|美国
Mt Hood|45.37|-121.7|美国
Grand Teton|43.74|-110.8|美国
Glacier NP|48.7|-113.7|美国
Mt Washington|44.27|-71.3|美国
Lake Louise|51.42|-116.18|加拿大
Mt Logan|60.57|-140.4|加拿大
Sakurajima|31.58|130.66|日本
Hallasan|33.36|126.53|韩国
Seoraksan|38.12|128.47|韩国
Mt Kinabalu|6.08|116.56|马来西亚
Bromo|-7.94|112.95|印度尼西亚
Merapi|-7.54|110.44|印度尼西亚
Pinatubo|15.13|120.35|菲律宾
Elbrus|43.35|42.44|俄罗斯
Ararat|39.7|44.3|土耳其
Olympus|40.09|22.36|希腊
Tre Cime|46.62|12.3|意大利
Mont Blanc|45.83|6.86|法国/意大利
Eiger|46.58|8.0|瑞士
Teide|28.27|-16.64|西班牙加那利
Ben Nevis|56.8|-5.0|英国
Snowdon|53.07|-4.08|英国
Geiranger|62.1|7.2|挪威
Lofoten|68.2|13.6|挪威
Landmannalaugar|63.99|-19.06|冰岛
Hvannadalshnukur|64.0|-16.7|冰岛
Mt Sinai|28.54|33.97|埃及
Petra|30.33|35.44|约旦
Ngorongoro|-3.17|35.58|坦桑尼亚
Drakensberg|-28.74|28.89|南非/莱索托
Simien Mountains|13.25|38.07|埃塞俄比亚
Rwenzori|0.38|29.87|乌干达/刚果
Kosciuszko|-36.46|148.26|澳大利亚
Ojos del Salado|-27.11|-68.54|智利/阿根廷
Roraima|5.14|-60.76|委内瑞拉/圭亚那
Sugarloaf Rio|-22.95|-43.16|巴西
Table Mountain|-33.96|18.4|南非
Mt Erebus|-77.53|167.15|南极洲
Paektu|42.0|128.06|中朝边境
Taranaki|-39.3|174.06|新西兰
Cerro Fitz Roy Chalten|-49.33|-72.9|阿根廷
Grossglockner|47.07|12.69|奥地利
Triglav|46.38|13.84|斯洛文尼亚
Gran Sasso|42.47|13.57|意大利
Tatra Gerlach|49.16|20.13|斯洛伐克
Mt Cameroon|4.2|9.17|喀麦隆
Mt Kenya|-0.15|37.31|肯尼亚
Atlas Toubkal|31.06|-7.92|摩洛哥
Hunza Karakoram|36.32|74.65|巴基斯坦
Nanga Parbat|35.24|74.59|巴基斯坦
Kangchenjunga|27.7|88.15|尼泊尔/印度
Mt Fuji Hakone|35.23|139.02|日本
Mt Hotaka|36.29|137.65|日本
Jade Dragon Snow Mt|27.1|100.18|中国
Yarlung Tsangpo Bend|29.63|95.0|中国西藏
Mt Meru|-3.25|36.75|坦桑尼亚`.split('\n').map((l) => { const [name, lat, lng, region] = l.split('|'); return { name, lat: +lat, lng: +lng, region }; });

function decodePNG(buf) {
  let p = 8, w, h, bpp, ct; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0) throw new Error('unsupported png'); bpp = { 2: 3, 6: 4, 0: 1, 4: 2 }[ct]; }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp; const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
const tileXY = (lat, lng) => { const n = 2 ** Z; const x = Math.floor((lng + 180) / 360 * n); const r = lat * Math.PI / 180; const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); return { x, y }; };
const tileCenter = (x, y) => { const n = 2 ** Z; const lng = (x + 0.5) / n * 360 - 180; const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI; return { lat, lng }; };

const sites = [];
for (const s of SITES) {
  const { x, y } = tileXY(s.lat, s.lng);
  const f = path.join(here, 'raw', `${Z}_${x}_${y}.png`);
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`, { headers: { 'User-Agent': 'daily-data-games-class-project' } });
    if (!r.ok) { console.warn('skip', s.name, r.status); continue; }
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); await new Promise((r2) => setTimeout(r2, 250));
  }
  const png = decodePNG(fs.readFileSync(f)); const B = png.w / N; const grid = [];
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    let sum = 0;
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const o = ((gy * B + j) * png.w + gx * B + i) * png.bpp; sum += png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768; }
    grid.push(Math.round(sum / (B * B)));
  }
  const flat0 = grid.filter((v) => v <= 0).length / grid.length; const range = Math.max(...grid) - Math.min(...grid);
  if (flat0 > 0.3 && Math.min(...grid) > -50) { console.warn('skip ocean', s.name); continue; }
  if (range < 150) { console.warn('skip flat', s.name); continue; }
  const c = tileCenter(x, y); const km = +(40075.017 * Math.cos(c.lat * Math.PI / 180) / 2 ** Z).toFixed(1);
  sites.push({ id: sites.length, name: s.name, region: s.region, lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), km, min: Math.min(...grid), max: Math.max(...grid), grid });
}
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify({ n: N, z: Z, sites }));
console.log('sites', sites.length, 'bytes', fs.statSync(path.join(here, '..', 'data.json')).size);
