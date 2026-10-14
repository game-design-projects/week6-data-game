import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(path.dirname(new URL(import.meta.url).pathname), 'raw');
const c = JSON.parse(fs.readFileSync(raw + '/cands.json'));
for (let i = 0; i < c.length; i++) {
  const f = `${raw}/img/${i}.jpg`;
  if (fs.existsSync(f) && fs.statSync(f).size > 2000) continue;
  for (let a = 0; a < 4; a++) {
    const r = await fetch(c[i].thumb, { headers: { 'User-Agent': 'daily-data-games-class-project/1.0 (student; lishuyustevenli@gmail.com)' } });
    if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; }
    await new Promise((s) => setTimeout(s, 5000 * (a + 1)));
  }
  await new Promise((s) => setTimeout(s, 1200));
}
console.log('done');
