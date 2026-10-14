// raw FRED csv -> data.json (monthly series, aligned to a common month axis)
import fs from 'node:fs';
const raw = (id) => fs.readFileSync(new URL(`./raw/${id}.csv`, import.meta.url), 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')).filter((r) => r[1] && r[1] !== '.');
const monthly = (rows) => { // average within month; carry quarterly values forward
  const m = new Map(); for (const [d, v] of rows) { const k = d.slice(0, 7); (m.get(k) ?? m.set(k, []).get(k)).push(+v); }
  return new Map([...m].map(([k, a]) => [k, a.reduce((x, y) => x + y) / a.length]));
};
const addM = (k, n) => { const [y, mo] = k.split('-').map(Number); const t = y * 12 + mo - 1 + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const S = [
  { id: 'UNRATE', zh: '美国失业率', yoy: false, tip: '衰退中和衰退后失业率飙升，复苏时缓慢回落——锯齿状的"上升陡、下降缓"。' },
  { id: 'CPIAUCSL', zh: '美国通胀率（CPI 同比）', yoy: true, tip: '1970s 和 2021-22 年的大尖峰，1980 年代后长期低而稳；2009 年和 2020 年有短暂负值。' },
  { id: 'FEDFUNDS', zh: '联邦基金利率', yoy: false, tip: '衰退前利率被推高、衰退中急剧下调；1980 年代初的高点和 2009-15 的零利率是标志。' },
  { id: 'GS10', zh: '10 年期美债收益率', yoy: false, tip: '1981 年见顶后四十年单边下行，比联邦基金利率平滑得多。' },
  { id: 'INDPRO', zh: '工业产出（同比）', yoy: true, tip: '衰退阴影里几乎总是深度负增长，波动幅度比 GDP 大得多。' },
  { id: 'PAYEMS', zh: '非农就业人数（同比）', yoy: true, tip: '平时稳定正增长，衰退时转负；2020 年那次是断崖式的。' },
  { id: 'HOUST', zh: '新屋开工数', yoy: false, tip: '对利率最敏感，衰退前先塌；2006-09 年住房崩盘是标志。' },
  { id: 'UMCSENT', from: '1978-01', zh: '密歇根消费者信心指数', yoy: false, tip: '噪声大、没有明显趋势；衰退和油价冲击时急跌。' },
  { id: 'M2SL', zh: 'M2 货币供应（同比）', yoy: true, tip: '2020-21 年史无前例的飙升是最明显的标志，其余时间在 0-12% 间摆动。' },
  { id: 'DEXJPUS', zh: '日元兑美元汇率', yoy: false, tip: '1971-1995 年间长期下行（日元升值），1995 年后在 80-160 间摆动。' },
  { id: 'GDPC1', zh: '实际 GDP（同比）', yoy: true, tip: '季度数据，所以曲线呈阶梯形；仅少数时期为负。' },
  { id: 'TOTALSA', zh: '汽车及轻卡销量（年化百万辆）', yoy: false, tip: '2009 年和 2020 年 4 月的两个深坑；季节调整后仍对衰退极敏感。' },
  { id: 'MORTGAGE30US', zh: '30 年期抵押贷款利率', yoy: false, tip: '与十年期国债走势相似，1981 年超过 18%，2021 年跌到 3% 以下。' },
  { id: 'CIVPART', zh: '劳动参与率', yoy: false, tip: '1960-2000 年大幅上升（女性入职），2000 年后趋势性下降；衰退影响缓慢。' },
  { id: 'PSAVERT', zh: '个人储蓄率', yoy: false, tip: '1970s 高、1990-2005 持续下滑，2020 年疫情补助期出现史无前例的飙升。' },
];
const rec = monthly(raw('USREC'));
const last = [...rec.keys()].sort().pop();
const out = { source: 'FRED', rec: { start: [...rec.keys()].sort()[0], vals: '' }, series: [] };
for (const s of S) {
  const mm = monthly(raw(s.id));
  const keys = [...mm.keys()].sort();
  let first = keys[0], end = keys[keys.length - 1];
  if (s.id === 'GDPC1') { // forward-fill quarters to months
    for (const k of keys) for (const n of [1, 2]) if (!mm.has(addM(k, n))) mm.set(addM(k, n), mm.get(k));
    end = addM(end, 2);
  }
  let vals = []; let start = s.from ?? first;
  if (s.yoy) { start = addM(first, 12); }
  for (let k = start; k <= end; k = addM(k, 1)) {
    const v = mm.get(k); if (v == null) { console.log("gap, truncating", s.id, k); break; }
    vals.push(s.yoy ? (v / mm.get(addM(k, -12)) - 1) * 100 : v);
  }
  const mag = Math.max(...vals.map(Math.abs));
  const dp = mag >= 1000 ? 0 : mag >= 100 ? 1 : 2;
  out.series.push({ id: s.id, zh: s.zh, tip: s.tip, yoy: s.yoy, start, vals: vals.map((v) => +v.toFixed(dp)) });
}
const rk = [...rec.keys()].sort(); out.rec.vals = rk.map((k) => (rec.get(k) > 0.5 ? 1 : 0)).join('');
out.rec.start = rk[0];
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(out.series.map((s) => `${s.id} ${s.start} n=${s.vals.length}`).join('\n'), 'rec', out.rec.start, rk.at(-1));
