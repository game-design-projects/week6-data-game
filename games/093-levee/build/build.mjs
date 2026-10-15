// Fetch terrain (AWS Terrain Tiles = USGS 3DEP + SRTM etc.) and OSM buildings for flood-prone towns,
// then build a pool of 16x16 puzzle windows with a precomputed greedy reference.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { N, simulate, dryCount, total, greedy, refine, cellCounts } from '../sim.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(here, 'raw');
fs.mkdirSync(raw, { recursive: true });
const UA = 'daily-data-games/1.0 (class project)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Z = 14;
const CELL = 100; // m

const SITES = `Cedar Rapids IA|41.9779|-91.6656
Dubuque IA|42.5006|-90.6646
Hannibal MO|39.7084|-91.3585
Cape Girardeau MO|37.3059|-89.5181
Grand Forks ND|47.9253|-97.0329
Minot ND|48.2330|-101.2923
Pierre SD|44.3683|-100.3510
Johnstown PA|40.3267|-78.9220
Wilkes-Barre PA|41.2459|-75.8813
Harrisburg PA|40.2732|-76.8867
Binghamton NY|42.0987|-75.9180
Elmira NY|42.0898|-76.8077
Hartford CT|41.7658|-72.6734
Brattleboro VT|42.8509|-72.5579
Montpelier VT|44.2601|-72.5754
Waterbury VT|44.3379|-72.7568
Asheville NC|35.5951|-82.5515
Chattanooga TN|35.0456|-85.3097
Nashville TN|36.1627|-86.7816
Louisville KY|38.2527|-85.7585
Cincinnati OH|39.1031|-84.5120
Huntington WV|38.4192|-82.4452
Charleston WV|38.3498|-81.6326
Pittsburgh PA|40.4406|-79.9959
Austin TX|30.2672|-97.7431
San Marcos TX|29.8833|-97.9414
Kerrville TX|30.0474|-99.1403
Houston TX|29.7604|-95.3698
Sacramento CA|38.5816|-121.4944
Yuba City CA|39.1404|-121.6169
Napa CA|38.2975|-122.2869
Boise ID|43.6150|-116.2023
Missoula MT|46.8721|-113.9940
Billings MT|45.7833|-108.5007
Great Falls MT|47.5002|-111.3008
Boulder CO|40.0150|-105.2705
Fort Collins CO|40.5853|-105.0844
Pueblo CO|38.2544|-104.6091
Salt Lake City UT|40.7608|-111.8910
Albuquerque NM|35.0844|-106.6504
Portland OR|45.5152|-122.6784
Eugene OR|44.0521|-123.0868
Tacoma WA|47.2529|-122.4443
Wenatchee WA|47.4235|-120.3103
Spokane WA|47.6588|-117.4260
Lewiston ID|46.4165|-117.0177
Rapid City SD|44.0805|-103.2310
Lincoln NE|40.8136|-96.7026
Omaha NE|41.2565|-95.9345
Sioux City IA|42.4969|-96.4003
Des Moines IA|41.5868|-93.6250
Iowa City IA|41.6611|-91.5302
Columbia SC|34.0007|-81.0348
Raleigh NC|35.7796|-78.6382
Fayetteville NC|35.0527|-78.8784
Lumberton NC|34.6182|-79.0087
Charlottesville VA|38.0293|-78.4767
Richmond VA|37.5407|-77.4360
Ellicott City MD|39.2673|-76.7983
Frederick MD|39.4143|-77.4105
Burlington VT|44.4759|-73.2121
Concord NH|43.2081|-71.5376
Augusta ME|44.3106|-69.7795
Albany NY|42.6526|-73.7562
Utica NY|43.1009|-75.2327
Rochester NY|43.1566|-77.6088
Flint MI|43.0125|-83.6875
Grand Rapids MI|42.9634|-85.6681
Wausau WI|44.9591|-89.6301
La Crosse WI|43.8014|-91.2396
Rockford IL|42.2711|-89.0940
Peoria IL|40.6936|-89.5890
Springfield MO|37.2090|-93.2923
Little Rock AR|34.7465|-92.2896
Tulsa OK|36.1540|-95.9928
Wichita KS|37.6872|-97.3301
Jackson MS|32.2988|-90.1848
Baton Rouge LA|30.4515|-91.1871
Savannah GA|32.0809|-81.0912
Tallahassee FL|30.4383|-84.2807
Hilo HI|19.7297|-155.0900
Honolulu HI|21.3069|-157.8583`.split('\n').map((l) => { const [name, lat, lng] = l.split('|'); return { name, lat: +lat, lng: +lng }; });

// ---------- PNG (terrarium) decode ----------
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const data = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * bpp);
  const stride = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = data[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = data[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[y * stride + x] = r & 255;
    }
  }
  return { w, h, bpp, px: out };
}

async function getTile(x, y) {
  const f = path.join(raw, `tile_${Z}_${x}_${y}.png`);
  if (!fs.existsSync(f)) {
    for (let a = 0; a < 3; a++) {
      try {
        const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
        if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; }
      } catch (e) { console.warn('tile err', e.message); }
      await sleep(1500);
    }
  }
  return decodePng(fs.readFileSync(f));
}
const tileCache = new Map();
async function tile(x, y) { const k = `${x}/${y}`; if (!tileCache.has(k)) tileCache.set(k, await getTile(x, y)); return tileCache.get(k); }

const lng2x = (lng) => ((lng + 180) / 360) * 2 ** Z;
const lat2y = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** Z; };

async function elevAt(lat, lng) {
  const fx = lng2x(lng), fy = lat2y(lat);
  const t = await tile(Math.floor(fx), Math.floor(fy));
  const px = Math.min(255, Math.floor((fx % 1) * 256)), py = Math.min(255, Math.floor((fy % 1) * 256));
  const i = (py * 256 + px) * t.bpp;
  return t.px[i] * 256 + t.px[i + 1] + t.px[i + 2] / 256 - 32768;
}

// ---------- OSM buildings ----------
async function buildings(site, radiusM) {
  const f = path.join(raw, `bld_${site.name.replace(/\W+/g, '_')}.json`);
  if (!fs.existsSync(f)) {
    const dLat = radiusM / 111320, dLng = radiusM / (111320 * Math.cos((site.lat * Math.PI) / 180));
    const bbox = `${site.lat - dLat},${site.lng - dLng},${site.lat + dLat},${site.lng + dLng}`;
    const q = `[out:json][timeout:90];way["building"](${bbox});out center qt;`;
    for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
      try {
        const r = await fetch(ep, { method: 'POST', signal: AbortSignal.timeout(100000), headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: 'data=' + encodeURIComponent(q) });
        if (r.ok) { const j = await r.json(); fs.writeFileSync(f, JSON.stringify(j.elements.map((e) => [e.center.lat, e.center.lon]))); break; }
        console.warn('overpass', r.status, site.name);
      } catch (e) { console.warn('overpass err', site.name, e.message); }
      await sleep(5000);
    }
    await sleep(2500);
  }
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

const OFFS = [[0, 0], [0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]; // km east/north
const RAINS = [0.4, 0.8, 1.5, 3, 5];

async function windowFor(site, bl, eKm, nKm) {
  const mLat = 111320, mLng = 111320 * Math.cos((site.lat * Math.PI) / 180);
  const c0lat = site.lat + (nKm * 1000) / mLat, c0lng = site.lng + (eKm * 1000) / mLng;
  const z = new Array(N * N), pts = [];
  const north = c0lat + ((N / 2) * CELL) / mLat, west = c0lng - ((N / 2) * CELL) / mLng;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    let s = 0, n = 0;
    for (let a = 0; a < 3; a++) for (let d = 0; d < 3; d++) {
      s += await elevAt(north - ((r + (a + 0.5) / 3) * CELL) / mLat, west + ((c + (d + 0.5) / 3) * CELL) / mLng); n++;
    }
    z[r * N + c] = s / n;
  }
  for (const [la, lo] of bl) {
    const y = Math.round((((north - la) * mLat) / CELL) * 10), x = Math.round((((lo - west) * mLng) / CELL) * 10);
    if (x >= 0 && x < N * 10 && y >= 0 && y < N * 10) pts.push(x, y);
  }
  const zmin = Math.min(...z);
  const b = cellCounts(pts);
  return { lat: +c0lat.toFixed(5), lng: +c0lng.toFixed(5), z: z.map((v) => +(v - zmin).toFixed(1)), pts, b };
}

const [shard, shards] = (process.env.SHARD || '0/1').split('/').map(Number);
const resFile = (site) => path.join(raw, `res2_${site.name.replace(/\W+/g, '_')}.json`);
if (shards > 0 && !process.env.MERGE_ONLY) for (const [idx, site] of SITES.entries()) {
  if (idx % shards !== shard || fs.existsSync(resFile(site))) continue;
  const bl = await buildings(site, 2000);
  if (!bl) { console.warn('skip', site.name); continue; }
  let best = null;
  for (const [e, n] of OFFS) {
    const w = await windowFor(site, bl, e, n);
    const nb = total(w.b);
    const relief = Math.max(...w.z);
    if (nb < 40 || relief < 3) continue;
    let pickR = null, pd = 9;
    for (const R of RAINS) {
      const frac = dryCount(w.b, simulate(w.z, R)) / nb;
      if (Math.abs(frac - 0.5) < pd) { pd = Math.abs(frac - 0.5); pickR = R; }
    }
    const base = dryCount(w.b, simulate(w.z, pickR));
    if (base / nb > 0.9 || base / nb < 0.1) continue;
    const g = greedy(w.z, w.b, pickR, 3);
    const gain = g.dry - base;
    if (gain < 8 || gain < 0.05 * nb) continue;
    if (!best || gain > best.gain) best = { ...w, rain: pickR, levees: g.levees, gain, base, nb };
  }
  let ok = !!best;
  if (ok) { const rf = refine(best.z, best.b, best.rain, best.levees); best.levees = rf.levees; best.gain = rf.dry - best.base; }
  fs.writeFileSync(resFile(site), JSON.stringify(ok ? { name: site.name, lat: best.lat, lng: best.lng, rain: best.rain, z: best.z, pts: best.pts, ref: best.levees } : null));
  console.log(ok ? 'ok' : 'drop', site.name, best ? `bld ${best.nb} base ${best.base} gain ${best.gain} R ${best.rain}` : '');
}
if (!process.env.SHARD || process.env.MERGE_ONLY) {
  const pool = SITES.map((s) => (fs.existsSync(resFile(s)) ? JSON.parse(fs.readFileSync(resFile(s), 'utf8')) : null)).filter(Boolean);
  fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify({ cell: CELL, sites: pool }));
  console.log('pool', pool.length);
}
