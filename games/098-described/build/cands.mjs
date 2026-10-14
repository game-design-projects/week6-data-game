import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(path.dirname(new URL(import.meta.url).pathname), 'raw');
const out = [];
for (const f of fs.readdirSync(raw).filter((x) => x.endsWith('.json') && x !== 'cands.json')) {
  const city = f.replace('.json','').replace(/_/g,' ');
  const j = JSON.parse(fs.readFileSync(path.join(raw, f)));
  const pages = Object.values(j.query?.pages ?? {});
  const c = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1000 || ii.width < ii.height * 1.2) continue;
    const cats = (p.categories ?? []).map((x) => x.title).join('|');
    const t = p.title;
    if (!/street|road|avenue|boulevard|highway|square|alley|market|lane|promenade/i.test(cats + t)) continue;
    if (/night|interior|panorama|map|poster|sign\b|plaque|portrait/i.test(t + cats)) continue;
    const co = p.coordinates?.[0]; if (!co) continue;
    const m = ii.url.split('?')[0].match(/commons\/(\w)\/(\w\w)\/(.+)$/); if (!m) continue;
    const thumb = `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/500px-${m[3]}`;
    const em = ii.extmetadata ?? {};
    c.push({ city, title: t.replace('File:',''), lat: co.lat, lng: co.lon, thumb, page: ii.descriptionurl, artist: (em.Artist?.value ?? '').replace(/<[^>]+>/g,'').slice(0,60), lic: em.LicenseShortName?.value ?? '' });
  }
  out.push(...c.slice(0, 4));
}
fs.writeFileSync(path.join(raw, 'cands.json'), JSON.stringify(out, null, 1));
console.log(out.length);
