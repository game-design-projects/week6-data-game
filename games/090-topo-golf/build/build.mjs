// Fetch AWS Terrain Tiles (terrarium PNG, derived from SRTM/ETOPO1/etc.), downsample to 32x32 grids.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const Z = 11, N = 32;
const SITES = `Mt Fuji|富士山|火山|35.36|138.73|日本
Matterhorn|马特洪峰|高山|45.98|7.66|瑞士/意大利
Grand Canyon|科罗拉多大峡谷|峡谷|36.1|-112.1|美国
Mt Rainier|雷尼尔山|火山|46.85|-121.76|美国
Kilimanjaro|乞力马扎罗山|火山|-3.07|37.35|坦桑尼亚
Everest|珠穆朗玛峰|高山|27.99|86.93|尼泊尔/中国
Mt St Helens|圣海伦斯火山|火山|46.2|-122.19|美国
Yosemite Valley|优胜美地谷|峡谷|37.74|-119.57|美国
Denali|德纳利（麦金利山）|高山|63.07|-151.0|美国
Aconcagua|阿空加瓜山|高山|-32.65|-70.01|阿根廷
Torres del Paine|百内塔|高山|-51.0|-73.0|智利
Mt Etna|埃特纳火山|火山|37.75|15.0|意大利
Vesuvius|维苏威火山|火山|40.82|14.43|意大利
Mauna Kea|冒纳凯阿火山|火山|19.82|-155.47|美国夏威夷
Haleakala|哈莱阿卡拉火山|火山|20.71|-156.25|美国夏威夷
Kilauea|基拉韦厄火山|火山|19.42|-155.29|美国夏威夷
Aoraki Mt Cook|库克山|高山|-43.59|170.14|新西兰
Milford Sound|米尔福德峡湾|峡湾|-44.67|167.93|新西兰
Tongariro|汤加里罗|火山|-39.16|175.63|新西兰
Zhangjiajie|张家界|砂岩峰林|29.32|110.43|中国
Huangshan|黄山|花岗岩山|30.13|118.17|中国
Tianshan Heaven Lake|天山天池|高山|43.88|88.13|中国
Mt Kailash|冈仁波齐|高山|31.07|81.31|中国西藏
K2|乔戈里峰（K2）|高山|35.88|76.51|巴基斯坦/中国
Annapurna|安纳普尔纳|高山|28.6|83.82|尼泊尔
Fitz Roy|菲茨罗伊峰|高山|-49.27|-72.94|阿根廷
Machu Picchu|马丘比丘|峡谷|-13.16|-72.55|秘鲁
Cotopaxi|科托帕希火山|火山|-0.68|-78.44|厄瓜多尔
Pico de Orizaba|奥里萨巴火山|火山|19.03|-97.27|墨西哥
Popocatepetl|波波卡特佩特火山|火山|19.02|-98.62|墨西哥
Crater Lake|火山口湖|火山|42.94|-122.1|美国
Mt Whitney|惠特尼山|高山|36.58|-118.29|美国
Death Valley|死亡谷|盆地|36.23|-116.77|美国
Zion|锡安峡谷|峡谷|37.3|-113.0|美国
Bryce Canyon|布莱斯峡谷|峡谷|37.59|-112.19|美国
Mt Hood|胡德山|火山|45.37|-121.7|美国
Grand Teton|大提顿山|高山|43.74|-110.8|美国
Glacier NP|冰川国家公园|高山|48.7|-113.7|美国
Mt Washington|华盛顿山|高山|44.27|-71.3|美国
Lake Louise|路易斯湖|高山|51.42|-116.18|加拿大
Mt Logan|洛根山|高山|60.57|-140.4|加拿大
Sakurajima|樱岛|火山|31.58|130.66|日本
Hallasan|汉拿山|火山|33.36|126.53|韩国
Seoraksan|雪岳山|花岗岩山|38.12|128.47|韩国
Mt Kinabalu|京那巴鲁山|花岗岩山|6.08|116.56|马来西亚
Bromo|布罗莫火山|火山|-7.94|112.95|印度尼西亚
Merapi|默拉皮火山|火山|-7.54|110.44|印度尼西亚
Pinatubo|皮纳图博火山|火山|15.13|120.35|菲律宾
Elbrus|厄尔布鲁士山|火山|43.35|42.44|俄罗斯
Ararat|阿拉拉特山|火山|39.7|44.3|土耳其
Olympus|奥林匹斯山|高山|40.09|22.36|希腊
Tre Cime|三峰山|白云岩山|46.62|12.3|意大利
Mont Blanc|勃朗峰|高山|45.83|6.86|法国/意大利
Eiger|艾格峰|高山|46.58|8.0|瑞士
Teide|泰德峰|火山|28.27|-16.64|西班牙加那利
Ben Nevis|本尼维斯山|高地|56.8|-5.0|英国
Snowdon|斯诺登山|高地|53.07|-4.08|英国
Geiranger|盖朗厄尔峡湾|峡湾|62.1|7.2|挪威
Lofoten|罗弗敦群岛|峡湾|68.2|13.6|挪威
Landmannalaugar|兰德曼纳劳卡|火山|63.99|-19.06|冰岛
Hvannadalshnukur|华纳达尔斯努克峰|火山|64.0|-16.7|冰岛
Mt Sinai|西奈山|荒漠山地|28.54|33.97|埃及
Petra|佩特拉|荒漠山地|30.33|35.44|约旦
Ngorongoro|恩戈罗恩戈罗火山口|火山|-3.17|35.58|坦桑尼亚
Drakensberg|德拉肯斯堡|断崖|-28.74|28.89|南非/莱索托
Simien Mountains|塞米恩山|断崖|13.25|38.07|埃塞俄比亚
Rwenzori|鲁文佐里山|高山|0.38|29.87|乌干达/刚果
Kosciuszko|科修斯科山|高地|-36.46|148.26|澳大利亚
Ojos del Salado|奥霍斯-德尔萨拉多山|火山|-27.11|-68.54|智利/阿根廷
Roraima|罗赖马山|桌山|5.14|-60.76|委内瑞拉/圭亚那
Sugarloaf Rio|里约面包山|海岸花岗岩山|-22.95|-43.16|巴西
Table Mountain|桌山|桌山|-33.96|18.4|南非
Mt Erebus|埃里伯斯火山|火山|-77.53|167.15|南极洲
Paektu|长白山（白头山）|火山|42.0|128.06|中朝边境
Taranaki|塔拉纳基山|火山|-39.3|174.06|新西兰
Grossglockner|大格洛克纳山|高山|47.07|12.69|奥地利
Triglav|特里格拉夫山|高山|46.38|13.84|斯洛文尼亚
Gran Sasso|大萨索山|高山|42.47|13.57|意大利
Tatra Gerlach|盖尔拉赫峰|高山|49.16|20.13|斯洛伐克
Mt Cameroon|喀麦隆山|火山|4.2|9.17|喀麦隆
Mt Kenya|肯尼亚山|火山|-0.15|37.31|肯尼亚
Atlas Toubkal|图卜卡勒峰|高山|31.06|-7.92|摩洛哥
Hunza Karakoram|罕萨喀喇昆仑|高山|36.32|74.65|巴基斯坦
Nanga Parbat|南迦帕尔巴特峰|高山|35.24|74.59|巴基斯坦
Kangchenjunga|干城章嘉峰|高山|27.7|88.15|尼泊尔/印度
Mt Fuji Hakone|箱根|火山|35.23|139.02|日本
Mt Hotaka|穗高岳|高山|36.29|137.65|日本
Jade Dragon Snow Mt|玉龙雪山|高山|27.1|100.18|中国
Yarlung Tsangpo Bend|雅鲁藏布大峡谷|峡谷|29.63|95.0|中国西藏
Mt Meru|梅鲁山|火山|-3.25|36.75|坦桑尼亚
Kazbek|卡兹别克山|火山|42.66|44.52|格鲁吉亚`.split('\n').map((l) => { const [name, zh, kind, lat, lng, region] = l.split('|'); return { name, zh, kind, lat: +lat, lng: +lng, region }; });

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
  sites.push({ id: sites.length, name: s.name, zh: s.zh, kind: s.kind, region: s.region, lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), km, min: Math.min(...grid), max: Math.max(...grid), grid });
}
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify({ n: N, z: Z, sites }));
console.log('sites', sites.length, 'bytes', fs.statSync(path.join(here, '..', 'data.json')).size);
