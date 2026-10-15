// raw WorldPop rasters -> data.json (pool of 30x30 km windows). Run: node build/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTiff } from './tiff.mjs';
import { optimalCells } from '../game.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const N = 30, STRIDE = 5, MIN = 1.6e6, MAX = 8.0e6, PER_COUNTRY = 3, MAX_ZERO = 0.4, MIN_K = 8, MAX_K = 300;
const NAMES = { NLD: '荷兰', BEL: '比利时', CHE: '瑞士', AUT: '奥地利', PRT: '葡萄牙', DNK: '丹麦', ISR: '以色列', LBN: '黎巴嫩', KOR: '韩国', GHA: '加纳', KEN: '肯尼亚', RWA: '卢旺达', JOR: '约旦', ECU: '厄瓜多尔', UGA: '乌干达', SEN: '塞内加尔', CIV: '科特迪瓦', LKA: '斯里兰卡', NPL: '尼泊尔', PHL: '菲律宾', VNM: '越南', GRC: '希腊', HUN: '匈牙利', CZE: '捷克', IRL: '爱尔兰', CHL: '智利', CUB: '古巴', DOM: '多米尼加', GTM: '危地马拉', TUN: '突尼斯', MAR: '摩洛哥', PER: '秘鲁', COL: '哥伦比亚', MYS: '马来西亚', KHM: '柬埔寨', SGP: '新加坡', HKG: '中国香港', TWN: '中国台湾', ITA: '意大利', GBR: '英国', EGY: '埃及', NGA: '尼日利亚', PAK: '巴基斯坦', BGD: '孟加拉国', THA: '泰国', MEX: '墨西哥', ARG: '阿根廷', TUR: '土耳其', IRN: '伊朗', IRQ: '伊拉克', SAU: '沙特阿拉伯', ZAF: '南非', ETH: '埃塞俄比亚', TZA: '坦桑尼亚', AGO: '安哥拉', DZA: '阿尔及利亚', SYR: '叙利亚', AFG: '阿富汗', VEN: '委内瑞拉', UZB: '乌兹别克斯坦', MMR: '缅甸', SDN: '苏丹', BOL: '玻利维亚', CMR: '喀麦隆', MLI: '马里', BFA: '布基纳法索', SOM: '索马里', MOZ: '莫桑比克', ZMB: '赞比亚', ZWE: '津巴布韦', MDG: '马达加斯加', HTI: '海地', SLV: '萨尔瓦多', HND: '洪都拉斯', NIC: '尼加拉瓜', PAN: '巴拿马', CRI: '哥斯达黎加', URY: '乌拉圭', PRY: '巴拉圭', SRB: '塞尔维亚', ROU: '罗马尼亚', BGR: '保加利亚', POL: '波兰', SWE: '瑞典', NOR: '挪威', FIN: '芬兰', UKR: '乌克兰', BLR: '白俄罗斯', KAZ: '哈萨克斯坦', AZE: '阿塞拜疆', GEO: '格鲁吉亚', ARM: '亚美尼亚', KWT: '科威特', ARE: '阿联酋', OMN: '阿曼', YEM: '也门', LAO: '老挝', PRK: '朝鲜', MNG: '蒙古', IND: '印度', IDN: '印度尼西亚', JPN: '日本', FRA: '法国', DEU: '德国', ESP: '西班牙', BRA: '巴西', CHN: '中国', USA: '美国', RUS: '俄罗斯', CAN: '加拿大', AUS: '澳大利亚', COD: '刚果（金）' };
const ISO2 = { NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT', PRT: 'PT', DNK: 'DK', ISR: 'IL', LBN: 'LB', KOR: 'KR', GHA: 'GH', KEN: 'KE', RWA: 'RW', JOR: 'JO', ECU: 'EC', UGA: 'UG', SEN: 'SN', CIV: 'CI', LKA: 'LK', NPL: 'NP', PHL: 'PH', VNM: 'VN', GRC: 'GR', HUN: 'HU', CZE: 'CZ', IRL: 'IE', CHL: 'CL', CUB: 'CU', DOM: 'DO', GTM: 'GT', TUN: 'TN', MAR: 'MA', PER: 'PE', COL: 'CO', MYS: 'MY', KHM: 'KH', SGP: 'SG', HKG: 'HK', TWN: 'TW', ITA: 'IT', GBR: 'GB', EGY: 'EG', NGA: 'NG', PAK: 'PK', BGD: 'BD', THA: 'TH', MEX: 'MX', ARG: 'AR', TUR: 'TR', IRN: 'IR', IRQ: 'IQ', SAU: 'SA', ZAF: 'ZA', ETH: 'ET', TZA: 'TZ', AGO: 'AO', DZA: 'DZ', SYR: 'SY', AFG: 'AF', VEN: 'VE', UZB: 'UZ', MMR: 'MM', SDN: 'SD', BOL: 'BO', CMR: 'CM', MLI: 'ML', BFA: 'BF', SOM: 'SO', MOZ: 'MZ', ZMB: 'ZM', ZWE: 'ZW', MDG: 'MG', HTI: 'HT', SLV: 'SV', HND: 'HN', NIC: 'NI', PAN: 'PA', CRI: 'CR', URY: 'UY', PRY: 'PY', SRB: 'RS', ROU: 'RO', BGR: 'BG', POL: 'PL', SWE: 'SE', NOR: 'NO', FIN: 'FI', UKR: 'UA', BLR: 'BY', KAZ: 'KZ', AZE: 'AZ', GEO: 'GE', ARM: 'AM', KWT: 'KW', ARE: 'AE', OMN: 'OM', YEM: 'YE', LAO: 'LA', PRK: 'KP', MNG: 'MN', IND: 'IN', IDN: 'ID', JPN: 'JP', FRA: 'FR', DEU: 'DE', ESP: 'ES', BRA: 'BR', CHN: 'CN', USA: 'US', RUS: 'RU', CAN: 'CA', AUS: 'AU', COD: 'CD' };
const cities = fs.readFileSync(path.join(here, 'raw/cities15000.txt'), 'utf8').split('\n').filter(Boolean).map((l) => {
  const f = l.split('\t'); return { name: f[1], lat: +f[4], lng: +f[5], cc: f[8], pop: +f[14] };
});
// nearest city (by distance, discounted by size); null if none within 40 km
const near = (lat, lng, cc) => {
  let best = null, bd = 1e9;
  for (const c of cities) {
    if (c.cc !== cc) continue;
    const d = Math.hypot((c.lat - lat) * 111, (c.lng - lng) * 111 * Math.cos(lat * Math.PI / 180)) - Math.log10(c.pop) * 3;
    if (d < bd) { bd = d; best = c; }
  }
  return best && bd < 40 ? best.name : null;
};
let seed = 94;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pool = [];
for (const iso of Object.keys(NAMES)) {
  const f = path.join(here, 'raw', `${iso.toLowerCase()}.tif`);
  if (!fs.existsSync(f)) continue;
  const t = readTiff(fs.readFileSync(f));
  const cand = [];
  for (let y = 0; y + N <= t.H; y += STRIDE) for (let x = 0; x + N <= t.W; x += STRIDE) {
    let s = 0, bad = 0, zero = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = t.data[(y + j) * t.W + x + i]; if (!(v >= 0)) bad++; else { s += v; if (v < 0.5) zero++; } }
    if (s >= MIN && s <= MAX && bad < N * N * 0.03 && zero < N * N * MAX_ZERO) cand.push({ x, y, s });
  }
  cand.sort(() => rnd() - 0.5);
  const chosen = [];
  for (const c of cand) {
    if (chosen.length >= PER_COUNTRY) break;
    if (!chosen.every((o) => Math.abs(o.x - c.x) >= N + 5 || Math.abs(o.y - c.y) >= N + 5)) continue;
    const cells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = t.data[(c.y + j) * t.W + c.x + i]; cells.push(v >= 0 ? Math.round(v) : 0); }
    const k = optimalCells(cells).k;
    if (k < MIN_K || k > MAX_K) continue; // too trivial / too flat to be a fair puzzle
    chosen.push({ ...c, cells });
  }
  for (const c of chosen) {
    const lat = t.y0 - (c.y + N / 2) * t.dy, lng = t.x0 + (c.x + N / 2) * t.dx, cells = c.cells;
    const km2 = +((t.dx * 111.32 * Math.cos(lat * Math.PI / 180)) * (t.dy * 110.57)).toFixed(3);
    pool.push({ iso, country: NAMES[iso], place: near(lat, lng, ISO2[iso]), lat: +lat.toFixed(3), lng: +lng.toFixed(3), km2, total: cells.reduce((a, b) => a + b, 0), cells });
  }
  console.log(iso, cand.length, chosen.length);
}
// deterministic shuffle so consecutive days differ in country
pool.sort(() => rnd() - 0.5);
fs.writeFileSync(path.join(here, '../data.json'), JSON.stringify({ n: N, year: 2020, puzzles: pool }));
console.log('puzzles', pool.length, fs.statSync(path.join(here, '../data.json')).size);
