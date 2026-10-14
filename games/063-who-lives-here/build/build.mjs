// raw Census Reporter JSON (ACS 2020-2024 5-year) + candidate centroids -> data.json
import fs from 'node:fs';
const raw = new URL('./raw/', import.meta.url).pathname;
const out = new URL('../data.json', import.meta.url).pathname;
const cand = new Map(JSON.parse(fs.readFileSync(raw + 'cand.json', 'utf8')).map((c) => [c.id, c]));
const pct = (a, b) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null);
const tracts = [];
for (const f of fs.readdirSync(raw).filter((x) => /^cr_\d+\.json$/.test(x))) {
  const j = JSON.parse(fs.readFileSync(raw + f, 'utf8'));
  for (const [gid, d] of Object.entries(j.data)) {
    const id = gid.slice(7), c = cand.get(id); if (!c) continue;
    const e = (t, n) => d[t]?.estimate?.[t + String(n).padStart(3, '0')];
    const name = j.geography[gid].name; // "Census Tract 201, Autauga, AL"
    const [tr, county] = name.split(', ');
    const o = {
      pop: e('B01003', 1), inc: e('B19013', 1), rent: e('B25064', 1), val: e('B25077', 1), age: e('B01002', 1), yr: e('B25035', 1),
      wk: e('B08301', 1), wTransit: e('B08301', 10), wWalk: e('B08301', 19), wHome: e('B08301', 21), wDrive: e('B08301', 3),
      hh: e('B25044', 1), nc1: e('B25044', 3), nc2: e('B25044', 10),
      ed: e('B15003', 1), b1: e('B15003', 22), b2: e('B15003', 23), b3: e('B15003', 24), b4: e('B15003', 25),
      occ: e('B25003', 1), owner: e('B25003', 2),
      eth: e('B03002', 1), white: e('B03002', 3), black: e('B03002', 4), asian: e('B03002', 6), hisp: e('B03002', 12),
      fbT: e('B05002', 1), fb: e('B05002', 13), povT: e('B17001', 1), pov: e('B17001', 2),
      un: e('B25024', 1), un1: e('B25024', 2), u20: e('B25024', 9), u50: e('B25024', 10),
    };
    if (c.st === 'PR') continue; // keep the pin map continental/Alaska/Hawaii
    if (Object.values(o).some((v) => v == null || v < 0)) continue;
    if (o.pop < 1500 || o.wk < 400 || o.hh < 500 || o.un < 300) continue;
    tracts.push({
      id, state: c.st, county, tract: tr.replace('Census Tract ', ''), lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4),
      pop: o.pop, inc: o.inc, rent: o.rent, val: o.val, age: o.age, yr: o.yr,
      transit: pct(o.wTransit, o.wk), walk: pct(o.wWalk, o.wk), home: pct(o.wHome, o.wk), drive: pct(o.wDrive, o.wk),
      noCar: pct(o.nc1 + o.nc2, o.hh), bach: pct(o.b1 + o.b2 + o.b3 + o.b4, o.ed), owner: pct(o.owner, o.occ),
      white: pct(o.white, o.eth), black: pct(o.black, o.eth), asian: pct(o.asian, o.eth), hisp: pct(o.hisp, o.eth),
      fb: pct(o.fb, o.fbT), pov: pct(o.pov, o.povT), detached: pct(o.un1, o.un), big: pct(o.u20 + o.u50, o.un),
    });
  }
}
tracts.sort((a, b) => (a.id < b.id ? -1 : 1));
fs.writeFileSync(out, JSON.stringify({ release: 'ACS 2024 5-year (2020-2024)', tracts }));
console.log(tracts.length, 'tracts', fs.statSync(out).size, 'bytes', new Set(tracts.map((t) => t.state)).size, 'states');
