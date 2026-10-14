// raw FRED CSVs -> ../data.json  (pool of puzzles: 4 series x 50 trading days around a known market shock)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const SER = {
  SP500: { name: '标普 500', kind: 'pct', unit: '指数', fred: 'SP500' },
  VIXCLS: { name: 'VIX 恐慌指数', kind: 'pct', unit: '点', fred: 'VIXCLS' },
  DGS10: { name: '10 年期美债收益率', kind: 'diff', unit: '%', fred: 'DGS10' },
  DGS2: { name: '2 年期美债收益率', kind: 'diff', unit: '%', fred: 'DGS2' },
  DCOILWTICO: { name: 'WTI 原油', kind: 'pct', unit: '美元/桶', fred: 'DCOILWTICO' },
  DEXUSEU: { name: '欧元/美元', kind: 'pct', unit: '美元', fred: 'DEXUSEU' },
  DEXJPUS: { name: '美元/日元', kind: 'pct', unit: '日元', fred: 'DEXJPUS' },
};
// [date, Chinese label, explanation]
const EVENTS = [
  ['1997-10-27', '亚洲金融风暴波及美股', '香港股市暴跌后，道指单日创当时最大点数跌幅，交易所触发熔断。'],
  ['1998-08-17', '俄罗斯债务违约', '俄罗斯宣布卢布贬值并暂停偿还国内债务，资金涌向美债避险。'],
  ['1998-10-08', '日元套利交易平仓', '对冲基金大规模平掉做空日元的头寸，美元兑日元单日暴跌。'],
  ['2001-01-03', '美联储意外降息', '美联储在两次会议之间突然降息 50 个基点。'],
  ['2001-09-17', '9·11 后美股重新开市', '纽交所停市四天后重开，恐慌指数与美债收益率剧烈波动。'],
  ['2003-03-20', '伊拉克战争开始', '美军开始空袭巴格达，油价在战前已大跌，战争打响后继续回落。'],
  ['2007-02-27', '上证暴跌引发全球抛售', '中国股市单日大跌约 9%，波及全球市场，VIX 跳升。'],
  ['2007-08-09', 'BNP 巴黎银行冻结基金', '法国巴黎银行冻结三只次贷基金赎回，信贷市场冻结的开端。'],
  ['2008-01-22', '美联储紧急降息 75 个基点', '全球股市暴跌后美联储在会议之外紧急降息。'],
  ['2008-03-17', '贝尔斯登被收购', '美联储撮合摩根大通收购濒临倒闭的贝尔斯登。'],
  ['2008-09-15', '雷曼兄弟破产', '雷曼申请破产保护，VIX 飙升，美债收益率暴跌。'],
  ['2008-10-13', '全球联合救市反弹', '多国宣布银行注资计划，股市单日暴涨，VIX 回落。'],
  ['2008-12-16', '美联储降息至接近零', '美联储把联邦基金利率目标降到 0–0.25%，并承诺量化宽松。'],
  ['2009-03-18', '美联储扩大量化宽松', '美联储宣布购买长期美债，10 年期收益率单日大跌。'],
  ['2010-05-06', '闪电崩盘', '道指在数分钟内暴跌近 1000 点后又迅速收回。'],
  ['2010-05-10', '欧盟 7500 亿欧元救助计划', '欧盟与 IMF 宣布救助希腊等国的巨额安排，风险资产大涨、欧元反弹。'],
  ['2011-08-08', '标普下调美国评级后的首个交易日', '标普把美国主权评级从 AAA 降到 AA+，周一股市暴跌、美债反而上涨。'],
  ['2011-09-22', '欧债危机恶化', '美联储“扭转操作”叠加欧洲忧虑，全球风险资产重挫。'],
  ['2012-07-26', '德拉吉：不惜一切代价', '欧洲央行行长承诺“不惜一切代价”保卫欧元，欧元止跌。'],
  ['2013-05-22', '伯南克暗示缩减购债', '伯南克国会证词暗示 QE 将缩减，引发“缩减恐慌”。'],
  ['2013-06-20', '美联储给出缩减时间表', '美联储会议后股债双杀，10 年期收益率跳升。'],
  ['2014-10-15', '美债闪崩式行情', '美债盘中收益率在几分钟内暴跌数十个基点，VIX 同日冲高。'],
  ['2014-11-28', 'OPEC 拒绝减产', '感恩节后 OPEC 决定不减产，油价单日暴跌约 10%。'],
  ['2015-01-15', '瑞士央行放弃欧元下限', '瑞士央行突然取消 1.20 汇率下限，欧元对瑞郎瞬间崩塌，波及全球外汇。'],
  ['2015-08-24', '中国股灾“黑色星期一”', '中国股市大跌拖累全球，道指开盘一度暴跌逾 1000 点。'],
  ['2016-06-24', '英国脱欧公投结果', '公投意外胜出，英镑暴跌，避险资金涌入美债和日元。'],
  ['2016-11-09', '特朗普当选', '特朗普意外获胜，美债收益率与美股次日走出“特朗普行情”。'],
  ['2018-02-05', 'Volmageddon 波动率崩盘', '道指单日暴跌 1175 点，VIX 单日接近翻倍，做空波动率的产品崩溃。'],
  ['2018-12-24', '圣诞前夜抛售', '美联储加息叠加政府停摆担忧，标普触及熊市边缘后反弹。'],
  ['2019-08-05', '人民币破 7', '中美贸易战升级，人民币贬破 7，全球风险资产与美债收益率下行。'],
  ['2019-09-16', '沙特阿美设施遇袭', '沙特最大炼油设施遇袭，油价单日暴涨约 15%。'],
  ['2020-03-09', '沙特俄罗斯价格战与疫情', '沙特发动价格战，油价单日暴跌约 25%，美股首次熔断。'],
  ['2020-03-16', '新冠恐慌达到顶峰', '美联储紧急降息至零，美股再次熔断，VIX 创历史新高。'],
  ['2020-11-09', '辉瑞疫苗有效消息', '辉瑞宣布疫苗有效率超 90%，资金从“居家概念”轮向周期股，油价大涨。'],
  ['2021-11-26', 'Omicron 变异株出现', '感恩节后世卫组织宣布 Omicron，油价单日暴跌逾 10%。'],
  ['2022-02-24', '俄罗斯入侵乌克兰', '战争爆发当天油价冲上 100 美元，股市先跌后涨。'],
  ['2022-06-15', '美联储加息 75 个基点', '美联储自 1994 年来最大幅度加息，市场此前已大幅反映。'],
  ['2022-09-23', '英国“迷你预算”冲击', '英国宣布大规模减税，英债暴跌，波及全球债市与美元。'],
  ['2022-11-10', '10 月 CPI 低于预期', '通胀数据低于预期，美股单日大涨、美元和美债收益率齐跌。'],
  ['2023-03-13', '硅谷银行倒闭后的首个交易日', '监管接管 SVB，2 年期美债收益率两天内暴跌，押注降息。'],
  ['2024-08-05', '日元套利交易平仓', '日本央行加息叠加美国就业疲软，日经暴跌 12%，VIX 盘中飙升。'],
  ['2025-04-04', '“解放日”关税冲击', '美国宣布大规模对等关税，股市大跌、油价暴跌，VIX 飙升。'],
  ['2025-04-09', '关税暂缓 90 天', '特朗普宣布暂缓对等关税，标普单日大涨约 9.5%。'],
];

const load = (id) => {
  const m = new Map();
  for (const line of readFileSync(join(here, 'raw', `${id}.csv`), 'utf8').split('\n').slice(1)) {
    const [d, v] = line.trim().split(',');
    if (d && v && v !== '.' && !isNaN(+v)) m.set(d, +v);
  }
  return m;
};
const raw = Object.fromEntries(Object.keys(SER).map((k) => [k, load(k)]));
const cal = [...raw.VIXCLS.keys()].sort(); // trading calendar = days VIX published
const idxOf = new Map(cal.map((d, i) => [d, i]));
// forward-filled aligned series
const aligned = {};
for (const k of Object.keys(SER)) {
  let last = null;
  aligned[k] = cal.map((d) => { if (raw[k].has(d)) last = raw[k].get(d); return { v: last, real: raw[k].has(d) }; });
}
const change = (k, i) => {
  const a = aligned[k][i], b = aligned[k][i - 1];
  if (!a?.real || !b?.v || b.v <= 0 || a.v <= 0) return null;
  return SER[k].kind === 'pct' ? (a.v - b.v) / b.v : a.v - b.v;
};
const zScore = (k, i) => {
  const c = change(k, i); if (c == null) return -1;
  const prev = []; for (let j = i - 60; j < i; j++) { const x = change(k, j); if (x != null) prev.push(x); }
  if (prev.length < 40) return -1;
  const sd = Math.sqrt(prev.reduce((s, x) => s + x * x, 0) / prev.length);
  return sd ? Math.abs(c) / sd : -1;
};
const N = 50;
const puzzles = [];
const events = [];
let skipped = 0;
for (const [date, label, why] of EVENTS) {
  let i = cal.findIndex((d) => d >= date);
  if (i < 0 || cal[i] > date.slice(0, 8) + '31') continue;
  const avail = Object.keys(SER).filter((k) => aligned[k][i]?.real && aligned[k][i - N] ?.v);
  const z = avail.map((k) => ({ k, z: zScore(k, i), c: change(k, i) })).sort((a, b) => b.z - a.z);
  if (z.length < 5 || z[0].z < 3) { console.log('skip', date, z.slice(0, 2)); skipped++; continue; }
  events.push({ date, label, why });
  const evId = events.length - 1;
  const variants = [[0, 1, 2, 3], [0, 2, 3, 4], [0, 1, 3, 4]];
  variants.forEach((rk, vi) => {
    const keys = rk.map((r) => z[r].k);
    const off = [18, 30, 24][vi]; // shock day index inside the window (1-based = off+1)
    // order the panels by fixed list order so the strongest series is not always first
    const order = Object.keys(SER).filter((k) => keys.includes(k));
    const start = i - off;
    const series = order.map((k) => {
      const base = aligned[k][start].v;
      const vals = aligned[k].slice(start, start + N).map((p) => p.v);
      const zi = z.find((x) => x.k === k);
      const mv = SER[k].kind === 'pct' ? `${(zi.c * 100 >= 0 ? '+' : '')}${(zi.c * 100).toFixed(1)}%` : `${zi.c >= 0 ? '+' : ''}${(zi.c * 100).toFixed(0)} bp`;
      return { id: k, name: SER[k].name, kind: SER[k].kind, unit: SER[k].unit, base, v: vals.map((x) => +x.toFixed(3)), move: mv, z: +zi.z.toFixed(1) };
    });
    puzzles.push({ ev: evId, ans: off + 1, n: N, from: cal[start], to: cal[start + N - 1], series });
  });
}
const out = {
  asOf: cal[cal.length - 1],
  sources: Object.fromEntries(Object.entries(SER).map(([k, v]) => [k, `https://fred.stlouisfed.org/series/${v.fred}`])),
  events, puzzles,
};
writeFileSync(join(here, '..', 'data.json'), JSON.stringify(out));
console.log('events', events.length, 'skipped', skipped, 'puzzles', puzzles.length, 'bytes', JSON.stringify(out).length);
