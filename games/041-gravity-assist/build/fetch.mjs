// Download heliocentric ecliptic state vectors (20-day grid) of the planets from JPL Horizons.
import fs from 'node:fs';
const BODIES = { mercury: 199, venus: 299, earth: 399, mars: 499, jupiter: 599, saturn: 699, uranus: 799 };
fs.mkdirSync('raw', { recursive: true });
for (const [name, id] of Object.entries(BODIES)) {
  const f = `raw/${name}.json`;
  if (fs.existsSync(f)) continue;
  const q = new URLSearchParams({ format: 'json', COMMAND: `'${id}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'", REF_PLANE: "'ECLIPTIC'", START_TIME: "'2027-01-01'", STOP_TIME: "'2062-01-01'", STEP_SIZE: "'20 d'", OUT_UNITS: "'KM-S'", VEC_TABLE: "'2'", CSV_FORMAT: "'YES'" });
  const r = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  const txt = await r.text();
  fs.writeFileSync(f, txt);
  console.log(name, txt.length);
  await new Promise((r) => setTimeout(r, 1500));
}
