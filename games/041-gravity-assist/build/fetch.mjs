// Download (cached in build/raw/, git-ignored):
//  1. JPL "Approximate Positions of the Planets" page (Keplerian elements, Table 1, valid 1800–2050) — the game's ephemeris.
//  2. JPL Horizons heliocentric state vectors 2027–2062 (20-day grid, DE441) — only used to VALIDATE the Keplerian positions.
import fs from 'node:fs';
const RAW = new URL('./raw/', import.meta.url);
fs.mkdirSync(RAW, { recursive: true });
const UA = { 'User-Agent': 'daily-data-games/1.0 (class project)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = new URL('approx_pos.html', RAW);
if (!fs.existsSync(page)) {
  const r = await fetch('https://ssd.jpl.nasa.gov/planets/approx_pos.html', { headers: UA });
  fs.writeFileSync(page, await r.text());
  console.log('approx_pos.html saved');
  await sleep(1500);
}
const BODIES = { mercury: 199, venus: 299, earth: 399, mars: 499, jupiter: 599, saturn: 699 };
for (const [name, id] of Object.entries(BODIES)) {
  const f = new URL(`${name}.json`, RAW);
  if (fs.existsSync(f)) continue;
  const q = new URLSearchParams({ format: 'json', COMMAND: `'${id}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'", REF_PLANE: "'ECLIPTIC'", START_TIME: "'2027-01-01'", STOP_TIME: "'2050-01-01'", STEP_SIZE: "'20 d'", OUT_UNITS: "'KM-S'", VEC_TABLE: "'2'", CSV_FORMAT: "'YES'" });
  const r = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`, { headers: UA });
  const txt = await r.text();
  fs.writeFileSync(f, txt);
  console.log(name, txt.length);
  await sleep(1500);
}
