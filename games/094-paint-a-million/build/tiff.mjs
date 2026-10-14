// Minimal GeoTIFF reader: strips/tiles, deflate(8)/LZW(5)/none, predictor 1/2/3, float32/int/uint.
import zlib from 'node:zlib';
const TYPES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
function lzw(src) {
  const out = []; let table = []; let bits = 9, pos = 0, buf = 0, nb = 0;
  const reset = () => { table = []; for (let i = 0; i < 256; i++) table.push([i]); table.push(null, null); bits = 9; };
  reset(); let prev = null;
  for (;;) {
    while (nb < bits && pos < src.length) { buf = ((buf << 8) | src[pos++]) >>> 0; nb += 8; }
    if (nb < bits) break;
    const code = (buf >>> (nb - bits)) & ((1 << bits) - 1); nb -= bits; buf &= (1 << nb) - 1;
    if (code === 257) break;
    if (code === 256) { reset(); prev = null; continue; }
    const entry = code < table.length ? table[code] : prev.concat(prev[0]);
    for (const b of entry) out.push(b);
    if (prev) table.push(prev.concat(entry[0]));
    prev = entry;
    const L = table.length;
    bits = L >= 2047 ? 12 : L >= 1023 ? 11 : L >= 511 ? 10 : 9;
  }
  return Buffer.from(out);
}
export function readTiff(buf) {
  const le = buf.toString('ascii', 0, 2) === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const f64 = (o) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
  let off = u32(4);
  const n = u16(off);
  const tags = {};
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    const size = TYPES[type] * cnt;
    const vo = size <= 4 ? e + 8 : u32(e + 8);
    const vals = [];
    for (let k = 0; k < cnt; k++) {
      const o = vo + k * TYPES[type];
      vals.push(type === 3 ? u16(o) : type === 4 ? u32(o) : type === 12 ? f64(o) : type === 2 ? buf[o] : buf[o]);
    }
    tags[tag] = vals;
  }
  const W = tags[256][0], H = tags[257][0], bits = tags[258][0], comp = tags[259][0];
  const pred = tags[317]?.[0] ?? 1, fmt = tags[339]?.[0] ?? 1;
  const spp = tags[277]?.[0] ?? 1;
  const bps = bits / 8;
  const out = new Float32Array(W * H);
  const tiled = !!tags[322];
  const tw = tiled ? tags[322][0] : W, th = tiled ? tags[323][0] : (tags[278]?.[0] ?? H);
  const offs = tiled ? tags[324] : tags[273], cnts = tiled ? tags[325] : tags[279];
  const tilesX = Math.ceil(W / tw);
  const dec = (b) => {
    if (comp === 1) return b;
    if (comp === 8 || comp === 32946) return zlib.inflateSync(b);
    if (comp === 5) return lzw(b);
    throw new Error('compression ' + comp);
  };
  for (let t = 0; t < offs.length; t++) {
    let raw = dec(buf.subarray(offs[t], offs[t] + cnts[t]));
    const rowsHere = tiled ? th : Math.min(th, H - t * th);
    const rowBytes = tw * bps * spp;
    if (pred === 2) {
      for (let r = 0; r < rowsHere; r++) for (let c = spp; c < tw * spp; c++) {
        if (bps === 1) raw[r * rowBytes + c] = (raw[r * rowBytes + c] + raw[r * rowBytes + c - spp]) & 255;
      }
    } else if (pred === 3) {
      // floating-point predictor: byte-wise delta, then de-interleave bytes
      for (let r = 0; r < rowsHere; r++) {
        const s = r * rowBytes;
        for (let c = spp; c < rowBytes; c++) raw[s + c] = (raw[s + c] + raw[s + c - spp]) & 255;
        const tmp = Buffer.from(raw.subarray(s, s + rowBytes));
        const cntPx = tw * spp;
        for (let c = 0; c < cntPx; c++) for (let b = 0; b < bps; b++) raw[s + c * bps + b] = tmp[(le ? bps - 1 - b : b) * cntPx + c];
      }
    }
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const tx = tiled ? t % tilesX : 0, ty = tiled ? Math.floor(t / tilesX) : t;
    for (let r = 0; r < rowsHere; r++) {
      const y = ty * th + r; if (y >= H) break;
      for (let c = 0; c < tw; c++) {
        const x = tx * tw + c; if (x >= W) break;
        const o = r * rowBytes + c * bps * spp;
        let v;
        if (fmt === 3) v = bps === 4 ? dv.getFloat32(o, le) : dv.getFloat64(o, le);
        else if (bps === 2) v = fmt === 2 ? dv.getInt16(o, le) : dv.getUint16(o, le);
        else if (bps === 4) v = fmt === 2 ? dv.getInt32(o, le) : dv.getUint32(o, le);
        else v = raw[o];
        out[y * W + x] = v;
      }
    }
  }
  const scale = tags[33550], tie = tags[33922];
  const nodata = tags[42113] ? parseFloat(String.fromCharCode(...tags[42113]).replace(/\0/g, '')) : null;
  return { W, H, data: out, dx: scale[0], dy: scale[1], x0: tie[3], y0: tie[4], nodata };
}
