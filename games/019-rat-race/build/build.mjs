import fs from 'node:fs';
const rd = (f) => JSON.parse(fs.readFileSync(`raw/${f}.json`, 'utf8'));
const fail = rd('fail'), all = rd('all'), boro = rd('boro');
const bm = {};
for (const r of boro) if (!bm[r.zip_code] || +r.n > bm[r.zip_code].n) bm[r.zip_code] = { b: r.borough, n: +r.n };
const bshort = { Manhattan: '曼哈顿', Brooklyn: '布鲁克林', Queens: '皇后区', Bronx: '布朗克斯', 'Staten Island': '史坦顿岛' };
const tot = {};
for (const r of all) tot[`${r.zip_code}|${r.y}`] = +r.n;
const years = {};
for (const r of fail) {
  const t = tot[`${r.zip_code}|${r.y}`];
  if (!/^1\d{4}$/.test(r.zip_code) || !t || t < 150 || !bm[r.zip_code] || !bshort[bm[r.zip_code].b]) continue;
  (years[r.y] ||= []).push([r.zip_code, +r.n, t]);
}
const boros = {};
for (const z in bm) if (bshort[bm[z].b]) boros[z] = bshort[bm[z].b];
for (const y in years) if (years[y].length < 20) delete years[y];
fs.writeFileSync('../data.json', JSON.stringify({ years, boros }));
console.log(Object.entries(years).map(([y, a]) => y + ':' + a.length).join(' '));
