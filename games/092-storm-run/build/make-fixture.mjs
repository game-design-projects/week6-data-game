// Cut a small committed fixture (build/fixture.json) out of one cached raw composite so game.test.mjs can test
// toPuzzle() offline. Stores only the crop around one pool window, palette indices outside 7..21 zeroed, and only the 169 pixels per cell that crop() samples, deflated.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, COMPOSITE } from '../shape.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(dir, '..', 'data.json')));
const p = data.puzzles.find((q) => q.date === '2023-06-10');
const ox = Math.round((p.lon0 - COMPOSITE.lonW) / COMPOSITE.deg), oy = Math.round((COMPOSITE.latN - p.lat0) / COMPOSITE.deg);
const PAD = 30, cw = 900 + 2 * PAD, ch = 600 + 2 * PAD;
const hh = p.utc.slice(0, 2);
const img = await decodePNG(fs.readFileSync(path.join(dir, 'raw', `n0r_${p.date.replaceAll('-', '')}${hh}00.png`)));
// crop() only reads the 13x13 samples (every 2nd px) of each of the 36x24 cells of the window: store exactly those
const out = new Uint8Array(36 * 24 * 169);
let k = 0;
for (let cy = 0; cy < 24; cy++) for (let cx = 0; cx < 36; cx++) for (let y = 0; y < 25; y += 2) for (let x = 0; x < 25; x += 2) {
  const v = img.px[(oy + cy * 25 + y) * img.w + ox + cx * 25 + x];
  out[k++] = v >= 7 && v <= 21 ? v : 0;
}
const fx = { date: p.date, hh, w: cw, h: ch, pad: PAD, lonW: +(p.lon0 - PAD * COMPOSITE.deg).toFixed(2), latN: +(p.lat0 + PAD * COMPOSITE.deg).toFixed(2), z: zlib.deflateSync(out, { level: 9 }).toString('base64') };
fs.writeFileSync(path.join(dir, 'fixture.json'), JSON.stringify(fx));
console.log('fixture', fs.statSync(path.join(dir, 'fixture.json')).size, 'bytes');
