// Downloads EMODnet Human Activities vessel-density crops (WMS GetMap, layer vesseldensity_allavg,
// annual average 2023, all vessel types) around named straits / ports and writes data.json + img/*.png.
// Raw PNGs are cached in build/raw/avg2023/. Each crop is also analysed (coverage, lane orientation)
// so the result card can say something true about the specific picture.
import { writeFileSync, existsSync, mkdirSync, copyFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..');
const rawDir = join(here, 'raw', 'avg2023');
mkdirSync(rawDir, { recursive: true });
mkdirSync(join(out, 'img'), { recursive: true });

// id, 中文, English, kind, lat, lng, tight span (deg of latitude), 线索说明 (Chinese)
export const P = [
  ['dover', '多佛尔海峡', 'Strait of Dover', 'strait', 51.0, 1.5, 1.0, '全球最繁忙的海峡之一：英法之间只有约 34 km 宽，南北两条相反方向的分道通航带紧贴在一起。'],
  ['gibraltar', '直布罗陀海峡', 'Strait of Gibraltar', 'strait', 35.97, -5.6, 1.0, '大西洋与地中海之间的窄口，东西向的主航道被北非和西班牙海岸夹成一条束腰。'],
  ['bosphorus', '博斯普鲁斯海峡', 'Bosphorus', 'strait', 41.1, 29.05, 0.6, '一条细得像河的红线把黑海和马尔马拉海连起来，两端是伊斯坦布尔外的锚地。'],
  ['dardanelles', '达达尼尔海峡', 'Dardanelles', 'strait', 40.15, 26.4, 0.8, '细长的东北—西南向通道，一端通爱琴海，一端通向马尔马拉海。'],
  ['oresund', '厄勒海峡', 'Øresund', 'strait', 55.7, 12.75, 0.8, '丹麦与瑞典之间的狭窄南北向水道，东西两岸海岸线几乎平行。'],
  ['greatbelt', '大贝尔特海峡', 'Great Belt', 'strait', 55.4, 11.0, 0.8, '丹麦两大岛之间的南北通道，航线在岛屿之间曲折穿行。'],
  ['fehmarn', '费马恩海峡', 'Fehmarn Belt', 'strait', 54.6, 11.3, 0.7, '德国与丹麦洛兰岛之间的波罗的海入口，航线从这里汇入基尔湾方向。'],
  ['messina', '墨西拿海峡', 'Strait of Messina', 'strait', 38.2, 15.6, 0.6, '意大利靴尖与西西里岛之间的窄缝，南北向航线中夹着横渡的渡轮线。'],
  ['bonifacio', '博尼法乔海峡', 'Strait of Bonifacio', 'strait', 41.3, 9.2, 0.6, '科西嘉与撒丁岛之间的窄口，船流很稀，只有一条东西向的细线。'],
  ['otranto', '奥特朗托海峡', 'Strait of Otranto', 'strait', 40.0, 18.8, 1.0, '意大利靴跟与阿尔巴尼亚之间连接亚得里亚海的口子，南北向航线加上横渡的渡轮线。'],
  ['sicily', '西西里海峡', 'Sicily Channel', 'strait', 37.2, 12.0, 1.2, '地中海东西两半的连接处，东西向的繁忙航道在西西里与突尼斯之间穿过。'],
  ['ushant', '韦桑岛海域', 'Ushant (Bay of Biscay)', 'strait', 48.5, -5.3, 1.0, '布列塔尼西端：英吉利海峡的船流在这里拐弯，海岸只占画面一角。'],
  ['stvincent', '圣维森特角', 'Cape St Vincent', 'strait', 37.0, -9.0, 1.0, '伊比利亚西南角：绕过好望角航线的船流在此拐过海角，画面里几乎全是海。'],
  ['pentland', '彭特兰湾', 'Pentland Firth', 'strait', 58.7, -3.1, 0.7, '苏格兰北端与奥克尼群岛之间的急流水道，东西向的稀疏航线。'],
  ['northchannel', '北海峡', 'North Channel', 'strait', 54.9, -5.4, 1.0, '北爱尔兰与苏格兰之间的窄口，南北向航线，Belfast 和 Stranraer 的渡轮线横穿。'],
  ['gulffinland', '芬兰湾', 'Gulf of Finland', 'strait', 59.9, 25.0, 1.5, '又长又窄的东西向海湾，两岸是赫尔辛基和塔林，中间是一条拥挤的航道，渡轮线南北横渡。'],
  ['skagen', '斯卡恩角', 'Skagen (Skagerrak)', 'strait', 57.7, 10.6, 1.0, '丹麦日德兰半岛北尖：北海与波罗的海的船流在这里汇合成转弯的航道。'],
  ['rotterdam', '鹿特丹', 'Rotterdam', 'port', 51.95, 4.0, 0.7, '欧洲第一大港：新水道口外是汇聚的航线和密集的锚地，河道向内陆延伸。'],
  ['antwerp', '安特卫普', 'Antwerp', 'port', 51.3, 4.2, 0.5, '斯海尔德河口：一条红线沿河道深入内陆，没有开阔海面。'],
  ['hamburg', '汉堡 / 易北河口', 'Hamburg (Elbe)', 'port', 53.9, 8.8, 0.9, '易北河口的漏斗形：航线从北海汇入一条深水道，沿河上行到汉堡。'],
  ['piraeus', '比雷埃夫斯', 'Piraeus', 'port', 37.9, 23.6, 0.7, '雅典的港口：萨罗尼科斯湾里的渡轮线呈放射状散开，通向各个岛屿。'],
  ['genoa', '热那亚', 'Genoa', 'port', 44.3, 8.9, 0.7, '意大利西北的港口，海岸线紧贴山脉，航线从南面汇聚到一小段港区。'],
  ['marseille', '马赛', 'Marseille', 'port', 43.3, 5.3, 0.7, '法国南岸最大的港口，海岸线在西侧向北弯，红色集中在福斯和港区。'],
  ['valencia', '瓦伦西亚', 'Valencia', 'port', 39.4, -0.2, 0.7, '西班牙东岸平直的海岸线，航线在港口外汇聚，沿海岸南北延伸。'],
  ['barcelona', '巴塞罗那', 'Barcelona', 'port', 41.3, 2.2, 0.7, '西北—东南向的海岸线，港口外是汇聚的航线，加上去巴利阿里群岛的渡轮线。'],
  ['gdansk', '格但斯克', 'Gdansk', 'port', 54.5, 18.7, 0.7, '波罗的海南岸格但斯克湾和赫尔半岛的钩形，航线指向湾内的港口。'],
  ['gothenburg', '哥德堡', 'Gothenburg', 'port', 57.7, 11.7, 0.7, '瑞典西岸多岛屿的海岸，港口外有曲折的群岛航道和去丹麦的渡轮线。'],
  ['venice', '威尼斯 / 的里雅斯特', 'Venice–Trieste', 'port', 45.4, 13.3, 1.0, '亚得里亚海最北端的弧形海湾，威尼斯、的里雅斯特和科佩尔的航线向湾顶汇聚。'],
  ['thames', '泰晤士河口', 'Thames Estuary', 'port', 51.5, 1.2, 0.9, '泰晤士河口的漏斗形和一片沙洲，红线沿河口向伦敦方向收窄。'],
  ['lehavre', '勒阿弗尔', 'Le Havre', 'port', 49.5, 0.1, 0.6, '塞纳河口，英吉利海峡南岸，航线在塞纳湾汇聚后进入河口。'],
  ['lisbon', '里斯本', 'Lisbon', 'port', 38.6, -9.4, 0.7, '塔古斯河口：南北向的大西洋沿岸航线中，有一条分支进入河口。'],
  ['constanta', '康斯坦察', 'Constanța', 'port', 44.1, 28.8, 0.8, '黑海西岸平直的海岸线，港口外有汇聚的航线，多瑙河口在北边。'],
  ['bilbao', '毕尔巴鄂', 'Bilbao', 'port', 43.4, -3.1, 0.7, '比斯开湾南岸的东西向海岸线，河口湾里的航线很短。'],
  ['algeciras', '阿尔赫西拉斯', 'Algeciras', 'port', 36.13, -5.43, 0.6, '直布罗陀海峡北侧的巨型锚地，主航道旁边有一大片红色的停泊船。'],
  ['kiel', '基尔 / 基尔运河', 'Kiel (Kiel Canal)', 'port', 54.35, 10.15, 0.6, '基尔湾顶端：一条红线进入运河，与波罗的海的航线相接。'],
  ['tallinn', '塔林', 'Tallinn', 'port', 59.45, 24.8, 0.7, '芬兰湾南岸，塔林与赫尔辛基之间的渡轮线是最红的一条。'],
  ['helsinki', '赫尔辛基', 'Helsinki', 'port', 60.15, 24.95, 0.7, '芬兰湾北岸多岛屿的海岸，港口外的渡轮线直指南面的塔林。'],
  ['stockholm', '斯德哥尔摩', 'Stockholm', 'port', 59.3, 18.8, 0.8, '群岛海域，一条曲折的航道从波罗的海深入斯德哥尔摩群岛。'],
  ['riga', '里加', 'Riga', 'port', 57.0, 24.0, 0.7, '里加湾南岸，圆形的海湾里只有几条汇聚到港口的航线。'],
  ['klaipeda', '克莱佩达', 'Klaipėda', 'port', 55.7, 21.1, 0.7, '立陶宛的出海口，库尔斯沙嘴把港口夹在狭窄的出口。'],
  ['zeebrugge', '泽布吕赫', 'Zeebrugge', 'port', 51.33, 3.2, 0.6, '比利时的短海岸线，港口外汇入多佛尔海峡的南北向航线。'],
  ['southampton', '南安普顿', 'Southampton', 'port', 50.8, -1.2, 0.7, '怀特岛夹出 Solent 和 Spithead 两条水道，港口在内侧。'],
  ['felixstowe', '费利克斯托', 'Felixstowe', 'port', 51.95, 1.3, 0.7, '英格兰东岸，哈里奇港口外的航线与泰晤士河口方向的航线相接。'],
  ['liverpool', '利物浦', 'Liverpool', 'port', 53.45, -3.1, 0.7, '默西河口和爱尔兰海：航线从西面汇入河口，两侧是锯齿状海岸线。'],
  ['dublin', '都柏林', 'Dublin', 'port', 53.35, -6.1, 0.6, '爱尔兰东岸，渡轮线从都柏林湾向东直指英国的霍利黑德。'],
  ['naples', '那不勒斯', 'Naples', 'port', 40.8, 14.2, 0.7, '那不勒斯湾和旁边的岛屿：卡普里岛、伊斯基亚岛的渡轮线从湾口射出。'],
  ['taranto', '塔兰托', 'Taranto', 'port', 40.45, 17.2, 0.7, '意大利靴底的海湾，航线向内汇入塔兰托的港口。'],
  ['laspezia', '拉斯佩齐亚', 'La Spezia', 'port', 44.1, 9.8, 0.7, '利古里亚海岸，港口在一个小海湾内，航线与热那亚方向相连。'],
  ['rijeka', '里耶卡', 'Rijeka', 'port', 45.3, 14.4, 0.8, '克瓦内尔湾，伊斯特拉半岛和克尔克岛把航线夹成窄道。'],
  ['malta', '马耳他', 'Malta', 'port', 35.9, 14.5, 0.6, '地中海中央的小岛：东西向的主航线从岛南擦过，瓦莱塔港外有一团红。'],
  ['cagliari', '卡利亚里', 'Cagliari', 'port', 39.2, 9.1, 0.7, '撒丁岛南端的港口，航线在卡利亚里湾汇聚。'],
  ['palermo', '巴勒莫', 'Palermo', 'port', 38.15, 13.35, 0.7, '西西里岛北岸，渡轮线从巴勒莫向北通向那不勒斯和撒丁岛。'],
  ['gioiatauro', '焦亚陶罗', 'Gioia Tauro', 'port', 38.45, 15.9, 0.6, '意大利靴尖的转运港，主要的红点集中在港口外的锚地。'],
  ['thessaloniki', '塞萨洛尼基', 'Thessaloniki', 'port', 40.55, 22.9, 0.8, '爱琴海北岸的萨洛尼卡湾，向内凹进去的海湾里航线汇聚到港口。'],
  ['izmir', '伊兹密尔', 'Izmir', 'port', 38.45, 26.9, 0.8, '土耳其西岸，长长的伊兹密尔湾从爱琴海深深切入，湾口有希俄斯岛。'],
  ['varna', '瓦尔纳', 'Varna', 'port', 43.2, 27.95, 0.7, '黑海西岸的海湾，航线向内汇入瓦尔纳湖外的港口。'],
  ['burgas', '布尔加斯', 'Burgas', 'port', 42.5, 27.5, 0.6, '保加利亚的海岸线：布尔加斯湾内有一个封闭的港口。'],
  ['bergen', '卑尔根', 'Bergen', 'port', 60.4, 5.2, 0.8, '挪威西岸峡湾和群岛，航线沿着狭窄的水道曲折前进。'],
  ['oslofjord', '奥斯陆峡湾', 'Oslofjord', 'port', 59.5, 10.6, 0.9, '细长的南北向峡湾，航线沿着峡湾通向奥斯陆。'],
  ['stavanger', '斯塔万格', 'Stavanger', 'port', 59.0, 5.6, 0.7, '挪威西南岸，北海油气区的补给船从这里出发，航线向西散开。'],
  ['esbjerg', '埃斯比约', 'Esbjerg', 'port', 55.5, 8.3, 0.7, '丹麦西岸的沙洲和浅滩，港口外是北海风电场的服务船航线。'],
  ['aarhus', '奥胡斯', 'Aarhus', 'port', 56.15, 10.3, 0.7, '日德兰东岸的海湾，渡轮线从奥胡斯向东通往西兰岛。'],
  ['szczecin', '什切青 / 希维诺乌伊希切', 'Szczecin–Świnoujście', 'port', 53.9, 14.4, 0.8, '奥得河口的潟湖和乌瑟多姆岛，航线从波罗的海南岸汇入。'],
  ['rostock', '罗斯托克', 'Rostock', 'port', 54.2, 12.1, 0.7, '波罗的海德国海岸，渡轮线向北通往丹麦的格斯泰兹和瑞典。'],
  ['ijmuiden', '埃默伊登 / 阿姆斯特丹', 'IJmuiden (Amsterdam)', 'port', 52.45, 4.5, 0.6, '荷兰海岸线几乎是一条竖直线，北海运河口外有一团汇聚的红色。'],
  ['cork', '科克', 'Cork', 'port', 51.8, -8.3, 0.7, '爱尔兰南岸，科克港藏在一个小湾内，外面是稀疏的东西向航线。'],
  ['sines', '锡尼什', 'Sines', 'port', 37.95, -8.9, 0.6, '葡萄牙西南岸，一个深水油港，外面是南北向的大西洋航线。'],
  ['cartagena', '卡塔赫纳', 'Cartagena', 'port', 37.55, -0.95, 0.7, '西班牙东南岸，一个深入的海湾港口，航线向东南汇聚。'],
  ['palma', '马略卡岛 / 帕尔马', 'Palma de Mallorca', 'port', 39.5, 2.7, 0.8, '巴利阿里群岛：岛屿之间的渡轮线形成放射状的线条。'],
  ['finisterre', '菲尼斯特雷角', 'Cape Finisterre', 'strait', 42.9, -9.3, 1.0, '西班牙西北角：沿大西洋岸南北向的分道通航带紧贴海角转弯。'],
  ['littlebelt', '小贝尔特海峡', 'Little Belt', 'strait', 55.5, 9.7, 0.6, '日德兰半岛与菲英岛之间的窄水道，船流比大贝尔特海峡稀得多。'],
  ['kvarken', '库瓦克海峡', 'Kvarken', 'strait', 63.5, 21.0, 1.0, '波罗的海北端波的尼亚湾的窄口，南北向的细航线夹在群岛之间。'],
  ['aland', '奥兰海', 'Åland Sea', 'strait', 60.0, 19.5, 1.0, '奥兰群岛与瑞典之间的水道，渡轮线横穿，波罗的海里最红的几条之一。'],
  ['bornholm', '博恩霍尔姆海域', 'Bornholm', 'strait', 55.1, 14.9, 1.0, '波罗的海中央的小岛，东西向的主航线从岛南擦过。'],
  ['kithira', '基西拉海峡', 'Kythira Strait', 'strait', 36.3, 23.0, 1.0, '伯罗奔尼撒半岛南端与克里特之间的口子，通往比雷埃夫斯的航线在此转弯。'],
  ['corinth', '科林斯运河', 'Corinth Canal', 'strait', 37.95, 23.0, 0.5, '连接萨罗尼科斯湾和科林斯湾的小水道，画面里只有很少的船。'],
  ['casquets', '英吉利海峡中段', 'Central English Channel', 'strait', 49.7, -2.2, 1.2, '两岸都在画面边缘：英国一侧和诺曼底一侧之间是东西向的分道通航带。'],
  ['fastnet', '费斯奈特海域', 'Fastnet (Celtic Sea)', 'strait', 51.4, -9.6, 1.2, '爱尔兰西南角外的大西洋入口，一束船流指向英吉利海峡。'],
  ['irishsea', '爱尔兰海', 'Irish Sea', 'strait', 53.9, -4.8, 1.2, '爱尔兰与英国之间的开阔海面，渡轮线在曼岛附近交叉。'],
  ['minch', '明奇海峡', 'The Minch', 'strait', 57.8, -6.3, 1.0, '苏格兰西北的外赫布里底群岛与大陆之间，船流很稀，航线沿着群岛。'],
  ['corfu', '科孚海峡', 'Corfu Strait', 'strait', 39.6, 19.9, 0.8, '希腊科孚岛与阿尔巴尼亚之间的窄道，航线向北通向亚得里亚海。'],
  ['piombino', '皮翁比诺海峡', 'Piombino Strait', 'strait', 42.9, 10.4, 0.8, '厄尔巴岛与托斯卡纳之间，渡轮线从皮翁比诺向西发散。'],
  ['irbe', '伊尔贝海峡', 'Irbe Strait', 'strait', 57.75, 21.8, 0.8, '拉脱维亚与萨雷马岛之间，里加湾的入口。'],
];

// ---- tiny PNG decoder (8-bit palette PNGs from GeoServer) → alpha mask + rgb ----
function decodePng(buf) {
  let p = 8, w = 0, h = 0, pal = null, trns = null; const idat = [];
  let ctype = 0, depth = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; }
    else if (type === 'PLTE') pal = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (depth !== 8 || ![3, 6].includes(ctype)) throw new Error(`unsupported png ${depth}/${ctype}`);
  const bpp = ctype === 3 ? 1 : 4, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let r = v;
      if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[y * stride + x] = r & 255;
    }
  }
  const out = []; // {a, r, g, b}
  for (let i = 0; i < w * h; i++) {
    if (ctype === 3) { const k = px[i]; out.push({ a: trns && k < trns.length ? trns[k] : 255, r: pal[k * 3], g: pal[k * 3 + 1], b: pal[k * 3 + 2] }); }
    else out.push({ r: px[i * 4], g: px[i * 4 + 1], b: px[i * 4 + 2], a: px[i * 4 + 3] });
  }
  return { w, h, px: out };
}

// signal coverage, share of bright (yellow→red) pixels and their principal axis
export function analyse(png) {
  const { w, h, px } = png; let n = 0; const hot = [];
  px.forEach((q, i) => { if (q.a > 0) { n++; if (q.r > 170) hot.push([i % w, i / w | 0]); } });
  const pts = hot; // bright (yellow→red) pixels = the busiest lanes
  let angle = null;
  if (pts.length >= 40) {
    const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // axis angle in image coords (y down)
    const ratio = (sxx + syy + Math.hypot(sxx - syy, 2 * sxy)) / Math.max(1e-9, sxx + syy - Math.hypot(sxx - syy, 2 * sxy));
    // compass bearing of the axis, 0..180 (0 = N-S, 90 = E-W)
    angle = { bearing: Math.round(((90 + th * 180 / Math.PI) % 180 + 180) % 180), elong: +ratio.toFixed(1) };
  }
  return { cover: +(n / (w * h)).toFixed(3), hot: +(hot.length / Math.max(1, n)).toFixed(3), axis: angle };
}

const R = 6378137, mxm = (lng) => (lng * Math.PI / 180) * R, mym = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R;
const mult = [1, 3, 9]; // tight / medium / wide
const SZ = 240;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const f of readdirSync(join(out, 'img'))) rmSync(join(out, 'img', f));
  const places = [], dropped = [];
  for (const [idx, [id, zh, en, kind, lat, lng, s, note]] of P.entries()) {
    const crops = [];
    for (let i = 0; i < 3; i++) {
      const k = 1 / Math.cos(lat * Math.PI / 180), h = (s * mult[i] * 111320 / 2) * k;
      const cx = mxm(lng), cy = mym(lat);
      const bbox = [cx - h, cy - h, cx + h, cy + h].map((v) => v.toFixed(0)).join(',');
      const raw = join(rawDir, `${id}-${i}.png`);
      if (!existsSync(raw)) {
        const url = `https://ows.emodnet-humanactivities.eu/wms?service=WMS&version=1.1.1&request=GetMap&layers=vesseldensity_allavg&styles=&srs=EPSG:3857&bbox=${bbox}&width=${SZ}&height=${SZ}&format=image/png&transparent=true&time=2023-01-01`;
        const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
        if (!r.ok) throw new Error(`${id} ${r.status}`);
        writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
        await sleep(400);
      }
      crops.push({ raw, half: Math.round(h) });
    }
    const stats = crops.map((c) => analyse(decodePng(readFileSync(c.raw))));
    if (stats[0].cover < 0.08 || stats[2].cover < 0.08) { dropped.push(`${id} cover ${stats.map((q) => q.cover)}`); continue; }
    const n = places.length;
    const files = crops.map((c, i) => { const f = `c${String(n).padStart(2, '0')}-${i}.png`; copyFileSync(c.raw, join(out, 'img', f)); return f; });
    places.push({
      id, zh, en, kind, lat, lng, files, note,
      spanKm: [0, 1, 2].map((i) => Math.round(s * mult[i] * 111)),
      half: crops.map((c) => c.half), // half-width of each crop in EPSG:3857 metres
      cover: stats.map((q) => q.cover), hot: stats[0].hot, axis: stats[0].axis,
    });
  }
  writeFileSync(join(out, 'data.json'), JSON.stringify({ places, source: 'EMODnet Human Activities vessel density (all types, annual average 2023), WMS GetMap, EPSG:3857, 240px' }));
  console.log(`${places.length} places, dropped: ${dropped.join('; ') || 'none'}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
