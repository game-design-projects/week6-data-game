import fs from 'node:fs';
const byDay = {};
for (const f of fs.readdirSync('raw').filter((x) => x.endsWith('.json'))) {
  for (const q of JSON.parse(fs.readFileSync('raw/' + f)).features) {
    const p = q.properties; if (p.mag == null || p.type !== 'earthquake') continue;
    const d = new Date(p.time).toISOString().slice(0, 10);
    (byDay[d] ||= []).push({ m: p.mag, lat: q.geometry.coordinates[1], lng: q.geometry.coordinates[0], place: p.place, id: q.id, t: p.time });
  }
}
const puzzles = [];
for (const [date, qs] of Object.entries(byDay).sort()) {
  qs.sort((a, b) => b.m - a.m);
  const [top, second] = qs;
  if (top.m < 5.0 || top.m - second.m < 0.3 || qs.length < 40) continue;
  const r = (x) => +x.toFixed(2);
  puzzles.push({
    date, n: qs.length,
    top: { lat: r(top.lat), lng: r(top.lng), mag: top.m, place: top.place, id: top.id, time: new Date(top.t).toISOString().slice(11, 16) },
    others: qs.slice(1).map((q) => [r(q.lat), r(q.lng), q.m]),
  });
}
fs.writeFileSync('../data.json', JSON.stringify({ puzzles }));
console.log(puzzles.length, fs.statSync('../data.json').size);
