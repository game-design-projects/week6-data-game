// Fetch AWS Terrain Tiles (terrarium PNG, derived from SRTM/ETOPO1/etc.), downsample to 32x32 grids.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const Z = 11, N = 32;
const SITES = `Mt Fuji|volcano|35.36|138.73|Japan
Matterhorn|alpine peak|45.98|7.66|Switzerland/Italy
Grand Canyon|canyon|36.1|-112.1|USA
Mt Rainier|volcano|46.85|-121.76|USA
Kilimanjaro|volcano|-3.07|37.35|Tanzania
Everest|alpine peak|27.99|86.93|Nepal/China
Mt St Helens|volcano|46.2|-122.19|USA
Yosemite Valley|canyon|37.74|-119.57|USA
Denali|alpine peak|63.07|-151.0|USA
Aconcagua|alpine peak|-32.65|-70.01|Argentina
Torres del Paine|alpine peak|-51.0|-73.0|Chile
Mt Etna|volcano|37.75|15.0|Italy
Vesuvius|volcano|40.82|14.43|Italy
Mauna Kea|volcano|19.82|-155.47|Hawaii, USA
Haleakala|volcano|20.71|-156.25|Hawaii, USA
Kilauea|volcano|19.42|-155.29|Hawaii, USA
Aoraki / Mt Cook|alpine peak|-43.59|170.14|New Zealand
Milford Sound|fjord|-44.67|167.93|New Zealand
Tongariro|volcano|-39.16|175.63|New Zealand
Zhangjiajie|sandstone pillars|29.32|110.43|China
Huangshan|granite mountain|30.13|118.17|China
Heaven Lake (Tian Shan)|alpine peak|43.88|88.13|China
Mt Kailash|alpine peak|31.07|81.31|Tibet, China
K2|alpine peak|35.88|76.51|Pakistan/China
Annapurna|alpine peak|28.6|83.82|Nepal
Fitz Roy|alpine peak|-49.27|-72.94|Argentina
Machu Picchu|canyon|-13.16|-72.55|Peru
Cotopaxi|volcano|-0.68|-78.44|Ecuador
Pico de Orizaba|volcano|19.03|-97.27|Mexico
Popocatepetl|volcano|19.02|-98.62|Mexico
Crater Lake|volcano|42.94|-122.1|USA
Mt Whitney|alpine peak|36.58|-118.29|USA
Death Valley|basin|36.23|-116.77|USA
Zion|canyon|37.3|-113.0|USA
Bryce Canyon|canyon|37.59|-112.19|USA
Mt Hood|volcano|45.37|-121.7|USA
Grand Teton|alpine peak|43.74|-110.8|USA
Glacier National Park|alpine peak|48.7|-113.7|USA
Mt Washington|alpine peak|44.27|-71.3|USA
Lake Louise|alpine peak|51.42|-116.18|Canada
Mt Logan|alpine peak|60.57|-140.4|Canada
Sakurajima|volcano|31.58|130.66|Japan
Hallasan|volcano|33.36|126.53|South Korea
Seoraksan|granite mountain|38.12|128.47|South Korea
Mt Kinabalu|granite mountain|6.08|116.56|Malaysia
Bromo|volcano|-7.94|112.95|Indonesia
Merapi|volcano|-7.54|110.44|Indonesia
Pinatubo|volcano|15.13|120.35|Philippines
Elbrus|volcano|43.35|42.44|Russia
Ararat|volcano|39.7|44.3|Turkey
Olympus|alpine peak|40.09|22.36|Greece
Tre Cime|dolomite peaks|46.62|12.3|Italy
Mont Blanc|alpine peak|45.83|6.86|France/Italy
Eiger|alpine peak|46.58|8.0|Switzerland
Teide|volcano|28.27|-16.64|Canary Islands, Spain
Ben Nevis|highlands|56.8|-5.0|UK
Snowdon|highlands|53.07|-4.08|UK
Geiranger|fjord|62.1|7.2|Norway
Lofoten|fjord|68.2|13.6|Norway
Landmannalaugar|volcano|63.99|-19.06|Iceland
Hvannadalshnukur|volcano|64.0|-16.7|Iceland
Mt Sinai|desert mountains|28.54|33.97|Egypt
Petra|desert mountains|30.33|35.44|Jordan
Ngorongoro|volcano|-3.17|35.58|Tanzania
Drakensberg|escarpment|-28.74|28.89|South Africa/Lesotho
Simien Mountains|escarpment|13.25|38.07|Ethiopia
Rwenzori|alpine peak|0.38|29.87|Uganda/DR Congo
Kosciuszko|highlands|-36.46|148.26|Australia
Ojos del Salado|volcano|-27.11|-68.54|Chile/Argentina
Roraima|tepui|5.14|-60.76|Venezuela/Guyana
Sugarloaf Mountain|coastal granite|-22.95|-43.16|Brazil
Table Mountain|tepui|-33.96|18.4|South Africa
Mt Erebus|volcano|-77.53|167.15|Antarctica
Paektu|volcano|42.0|128.06|China/North Korea border
Taranaki|volcano|-39.3|174.06|New Zealand
Grossglockner|alpine peak|47.07|12.69|Austria
Triglav|alpine peak|46.38|13.84|Slovenia
Gran Sasso|alpine peak|42.47|13.57|Italy
Gerlach Peak (Tatras)|alpine peak|49.16|20.13|Slovakia
Mt Cameroon|volcano|4.2|9.17|Cameroon
Mt Kenya|volcano|-0.15|37.31|Kenya
Atlas Toubkal|alpine peak|31.06|-7.92|Morocco
Hunza Karakoram|alpine peak|36.32|74.65|Pakistan
Nanga Parbat|alpine peak|35.24|74.59|Pakistan
Kangchenjunga|alpine peak|27.7|88.15|Nepal/India
Hakone|volcano|35.23|139.02|Japan
Mt Hotaka|alpine peak|36.29|137.65|Japan
Jade Dragon Snow Mountain|alpine peak|27.1|100.18|China
Yarlung Tsangpo Grand Canyon|canyon|29.63|95.0|Tibet, China
Mt Meru|volcano|-3.25|36.75|Tanzania
Kazbek|volcano|42.66|44.52|Georgia`.split('\n').map((l) => { const [name, kind, lat, lng, region] = l.split('|'); return { name, kind, lat: +lat, lng: +lng, region }; });

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
  const c = tileCenter(x, y); const km = +(40075.017 * Math.cos(c.lat * Math.PI / 180) / 2 ** Z).toFixed(2);
  sites.push({ id: sites.length, name: s.name, kind: s.kind, region: s.region, lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), km, min: Math.min(...grid), max: Math.max(...grid), grid });
}
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify({ n: N, z: Z, sites }));
console.log('sites', sites.length, 'bytes', fs.statSync(path.join(here, '..', 'data.json')).size);
