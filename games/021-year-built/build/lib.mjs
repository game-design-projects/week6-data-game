// Shared by the build steps: Wikidata rows (raw/wd.json, query in q.rq) -> candidate buildings.
import fs from 'node:fs';
export function candidates() {
  const rows = JSON.parse(fs.readFileSync(new URL('./raw/wd.json', import.meta.url))).results.bindings;
  const m = new Map();
  for (const x of rows) {
    const id = x.b.value.split('/').pop();
    if (m.has(id)) continue;
    m.set(id, { id, name: x.bLabel.value, year: +x.inc.value.slice(0, 4), file: decodeURIComponent(x.img.value.split('FilePath/').pop()), lat: +(+x.lat.value).toFixed(5), lng: +(+x.lon.value).toFixed(5) });
  }
  return [...m.values()].filter((b) => /\.jpe?g$/i.test(b.file) && b.year >= 1750 && b.year <= 2025
    && !/\d{4}/.test(b.name) && !/^Q\d+$/.test(b.name)
    && !/(map|plan|view of|panorama|skyline|aerial|plaque|sign|interior|inside|night|ruins|demolish)/i.test(b.file)
    && !/(alma mater|boardwalk|street$|statue|station|bridge|park$|cemetery|subway|tunnel|historic district|^[a-z ]*monument|memorial|fountain|ferry|pier|lighthouse)/i.test(b.name));
}
