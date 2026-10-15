// Filter pass-2 geosearch results into raw/cands2.json (same shape as cands.json), then fetch 500px thumbs into raw/img2/.
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(path.dirname(new URL(import.meta.url).pathname), 'raw');
const out = [];
for (const f of fs.readdirSync(raw).filter((x) => x.startsWith('r2_') && x.endsWith('.json'))) {
  const city = f.replace(/^r2_/, '').replace('.json', '').replace(/_/g, ' ');
  const j = JSON.parse(fs.readFileSync(path.join(raw, f)));
  const c = [];
  for (const p of Object.values(j.query?.pages ?? {})) {
    const ii = p.imageinfo?.[0]; if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1000 || ii.width < ii.height * 1.2) continue;
    const cats = (p.categories ?? []).map((x) => x.title).join('|');
    const t = p.title;
    if (!/street|road|avenue|boulevard|highway|square|alley|market|lane|promenade|quality images/i.test(cats + t)) continue;
    if (/night|interior|panorama|map|poster|sign\b|plaque|portrait|protest|demonstration|riot|aerial|train|airport|bus\b/i.test(t + cats)) continue;
    const co = p.coordinates?.[0]; if (!co) continue;
    const m = ii.url.split('?')[0].match(/commons\/(\w)\/(\w\w)\/(.+)$/); if (!m) continue;
    const thumb = `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/500px-${m[3]}`;
    const em = ii.extmetadata ?? {};
    c.push({ city, title: t.replace('File:', ''), lat: co.lat, lng: co.lon, thumb, page: ii.descriptionurl, artist: (em.Artist?.value ?? '').replace(/<[^>]+>/g, '').slice(0, 60), lic: em.LicenseShortName?.value ?? '' });
  }
  out.push(...c.slice(0, 8));
}
fs.writeFileSync(path.join(raw, 'cands2.json'), JSON.stringify(out, null, 1));
console.log('cands2', out.length);
fs.mkdirSync(path.join(raw, 'img2'), { recursive: true });
const UA = 'daily-data-games-class-project/1.0 (student; lishuyustevenli@gmail.com)';
for (let i = 0; i < out.length; i++) {
  const f = path.join(raw, `img2/${i}.jpg`);
  if (fs.existsSync(f) && fs.statSync(f).size > 2000) continue;
  for (let a = 0; a < 4; a++) {
    const r = await fetch(out[i].thumb, { headers: { 'User-Agent': UA } });
    if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; }
    await new Promise((s) => setTimeout(s, 5000 * (a + 1)));
  }
  await new Promise((s) => setTimeout(s, 1200));
}
const per = 12;
for (let s = 0; s * per < out.length; s++) {
  const cells = out.slice(s * per, (s + 1) * per).map((x, k) => { const i = s * per + k;
    return `<div style="width:316px;float:left;margin:2px"><img src="img2/${i}.jpg" style="width:316px;height:210px;object-fit:cover;display:block"><b style="font:bold 15px sans-serif">${i} ${x.city}</b></div>`; }).join('');
  fs.writeFileSync(path.join(raw, `sheet2_${s}.html`), `<body style="margin:0;width:980px">${cells}</body>`);
}
console.log('done');
