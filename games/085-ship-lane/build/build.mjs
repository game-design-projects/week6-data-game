// Downloads EMODnet Human Activities vessel-density crops (WMS GetMap, layer vesseldensity_allavg,
// annual average 2023, all vessel types) around named straits / ports and writes data.json + img/*.png.
// Raw PNGs are cached in build/raw/avg2023/. Each crop is also analysed (coverage, lane orientation)
// so the result card can say something true about the specific picture.
import { writeFileSync, existsSync, mkdirSync, copyFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..');
const rawDir = join(here, 'raw', 'avg2023');
mkdirSync(rawDir, { recursive: true });
mkdirSync(join(out, 'img'), { recursive: true });

// id, English name, kind, lat, lng, tight span (deg of latitude), clue note
export const P = [
  ['dover', 'Strait of Dover', 'strait', 51.0, 1.5, 1.0, 'One of the busiest straits on Earth: only about 34 km wide between England and France, with two opposing traffic lanes packed side by side.'],
  ['gibraltar', 'Strait of Gibraltar', 'strait', 35.97, -5.6, 1.0, 'The narrow gate between the Atlantic and the Mediterranean: the east-west main lane is pinched into a waist between the Spanish and North African coasts.'],
  ['bosphorus', 'Bosphorus', 'strait', 41.1, 29.05, 0.6, 'A river-thin red line links the Black Sea to the Sea of Marmara, with anchorages at both ends off Istanbul.'],
  ['dardanelles', 'Dardanelles', 'strait', 40.15, 26.4, 0.8, 'A long, thin northeast-southwest channel with the Aegean at one end and the Sea of Marmara at the other.'],
  ['oresund', 'Øresund', 'strait', 55.7, 12.75, 0.8, 'A narrow north-south waterway between Denmark and Sweden, the two shores almost parallel.'],
  ['greatbelt', 'Great Belt', 'strait', 55.4, 11.0, 0.8, 'The north-south channel between Denmark\'s two big islands; lanes wind between the islands.'],
  ['fehmarn', 'Fehmarn Belt', 'strait', 54.6, 11.3, 0.7, 'The Baltic entrance between Germany and Denmark\'s Lolland; lanes feed in toward Kiel Bay.'],
  ['messina', 'Strait of Messina', 'strait', 38.2, 15.6, 0.6, 'A slim gap between the toe of Italy and Sicily, with north-south lanes cut across by ferry crossings.'],
  ['bonifacio', 'Strait of Bonifacio', 'strait', 41.3, 9.2, 0.6, 'The narrow gap between Corsica and Sardinia. Traffic is thin: just one faint east-west line.'],
  ['otranto', 'Strait of Otranto', 'strait', 40.0, 18.8, 1.0, 'The mouth of the Adriatic between Italy\'s heel and Albania: north-south lanes plus crossing ferry lines.'],
  ['sicily', 'Sicily Channel', 'strait', 37.2, 12.0, 1.2, 'The hinge between the eastern and western Mediterranean: a busy east-west lane passes between Sicily and Tunisia.'],
  ['ushant', 'Ushant (Bay of Biscay)', 'strait', 48.5, -5.3, 1.0, 'Brittany\'s western tip: the English Channel\'s traffic bends here, with the coast filling just one corner of the frame.'],
  ['stvincent', 'Cape St Vincent', 'strait', 37.0, -9.0, 1.0, 'Iberia\'s southwest corner: ships rounding the Cape route turn the headland, and the frame is almost all sea.'],
  ['pentland', 'Pentland Firth', 'strait', 58.7, -3.1, 0.7, 'A tidal-race channel between Scotland\'s north tip and Orkney, with a sparse east-west lane.'],
  ['northchannel', 'North Channel', 'strait', 54.9, -5.4, 1.0, 'The narrow gap between Northern Ireland and Scotland: north-south lanes crossed by the Belfast and Stranraer ferries.'],
  ['gulffinland', 'Gulf of Finland', 'strait', 59.9, 25.0, 1.5, 'A long, narrow east-west gulf flanked by Helsinki and Tallinn, with one crowded lane down the middle and ferries crossing north-south.'],
  ['skagen', 'Skagen (Skagerrak)', 'strait', 57.7, 10.6, 1.0, 'The northern tip of Denmark\'s Jutland, where North Sea and Baltic traffic merge into a turning lane.'],
  ['rotterdam', 'Rotterdam', 'port', 51.95, 4.0, 0.7, 'Europe\'s biggest port: converging lanes and dense anchorages off the New Waterway, with the river running inland.'],
  ['antwerp', 'Antwerp', 'port', 51.3, 4.2, 0.5, 'The Scheldt estuary: one red line follows the river inland, with no open sea.'],
  ['hamburg', 'Hamburg (Elbe)', 'port', 53.9, 8.8, 0.9, 'The funnel of the Elbe estuary: lanes from the North Sea merge into a deep channel that runs upriver to Hamburg.'],
  ['piraeus', 'Piraeus', 'port', 37.9, 23.6, 0.7, 'Athens\' port: ferry lines fan out across the Saronic Gulf toward the islands.'],
  ['genoa', 'Genoa', 'port', 44.3, 8.9, 0.7, 'A port in northwest Italy, the coast pressed against the mountains, lanes converging from the south on a short stretch of harbor.'],
  ['marseille', 'Marseille', 'port', 43.3, 5.3, 0.7, 'France\'s biggest Mediterranean port: the coast bends north on the west side, with the red concentrated at Fos and the harbor.'],
  ['valencia', 'Valencia', 'port', 39.4, -0.2, 0.7, 'Spain\'s long straight east coast, with lanes converging off the port and running north-south along the shore.'],
  ['barcelona', 'Barcelona', 'port', 41.3, 2.2, 0.7, 'A northeast-southwest coastline with lanes converging off the port, plus ferry lines to the Balearic Islands.'],
  ['gdansk', 'Gdansk', 'port', 54.5, 18.7, 0.7, 'The hooked shape of the Bay of Gdansk and the Hel Peninsula on the Baltic\'s south coast, with lanes pointing into the port.'],
  ['gothenburg', 'Gothenburg', 'port', 57.7, 11.7, 0.7, 'Sweden\'s island-dotted west coast: winding archipelago lanes and ferry lines to Denmark outside the port.'],
  ['venice', 'Venice–Trieste', 'port', 45.4, 13.3, 1.0, 'The arc of the Adriatic\'s northern end, with lanes from Venice, Trieste and Koper converging at the head of the bay.'],
  ['thames', 'Thames Estuary', 'port', 51.5, 1.2, 0.9, 'The funnel of the Thames Estuary and a field of sandbanks, with the red line narrowing toward London.'],
  ['lehavre', 'Le Havre', 'port', 49.5, 0.1, 0.6, 'The Seine estuary on the English Channel\'s south shore: lanes gather in the Bay of the Seine before entering the river mouth.'],
  ['lisbon', 'Lisbon', 'port', 38.6, -9.4, 0.7, 'The Tagus estuary: one branch peels off the north-south Atlantic coastal lane into the river mouth.'],
  ['constanta', 'Constanța', 'port', 44.1, 28.8, 0.8, 'The Black Sea\'s straight west coast, with lanes converging off the port and the Danube mouth to the north.'],
  ['bilbao', 'Bilbao', 'port', 43.4, -3.1, 0.7, 'The east-west southern coast of the Bay of Biscay, with a short lane into the estuary.'],
  ['algeciras', 'Algeciras', 'port', 36.13, -5.43, 0.6, 'A huge anchorage on the north side of the Strait of Gibraltar, with a big patch of red from waiting ships beside the main lane.'],
  ['kiel', 'Kiel (Kiel Canal)', 'port', 54.35, 10.15, 0.6, 'The head of Kiel Bay: a red line enters the canal and joins the Baltic lanes.'],
  ['tallinn', 'Tallinn', 'port', 59.45, 24.8, 0.7, 'The south shore of the Gulf of Finland, where the ferry line to Helsinki is the reddest on the map.'],
  ['helsinki', 'Helsinki', 'port', 60.15, 24.95, 0.7, 'The island-studded north shore of the Gulf of Finland, with the ferry line pointing straight south to Tallinn.'],
  ['stockholm', 'Stockholm', 'port', 59.3, 18.8, 0.8, 'Archipelago waters: a winding channel leads from the Baltic into the Stockholm skerries.'],
  ['riga', 'Riga', 'port', 57.0, 24.0, 0.7, 'The south shore of the Gulf of Riga: a round bay with just a few lanes converging on the port.'],
  ['klaipeda', 'Klaipėda', 'port', 55.7, 21.1, 0.7, 'Lithuania\'s outlet to the sea, with the Curonian Spit squeezing the port into a narrow exit.'],
  ['zeebrugge', 'Zeebrugge', 'port', 51.33, 3.2, 0.6, 'Belgium\'s short coastline, with lanes off the port joining the north-south traffic of the Strait of Dover.'],
  ['southampton', 'Southampton', 'port', 50.8, -1.2, 0.7, 'The Isle of Wight carves out the Solent and Spithead channels, with the port on the inner side.'],
  ['felixstowe', 'Felixstowe', 'port', 51.95, 1.3, 0.7, 'England\'s east coast: lanes off Harwich link up with the traffic toward the Thames Estuary.'],
  ['liverpool', 'Liverpool', 'port', 53.45, -3.1, 0.7, 'The Mersey estuary and the Irish Sea: lanes join the river mouth from the west between jagged coasts.'],
  ['dublin', 'Dublin', 'port', 53.35, -6.1, 0.6, 'Ireland\'s east coast, with ferry lines running east from Dublin Bay straight to Holyhead in Wales.'],
  ['naples', 'Naples', 'port', 40.8, 14.2, 0.7, 'The Bay of Naples and nearby islands: ferry lines to Capri and Ischia shoot out of the bay mouth.'],
  ['taranto', 'Taranto', 'port', 40.45, 17.2, 0.7, 'The gulf in the sole of Italy\'s boot, with lanes running inward to the port of Taranto.'],
  ['laspezia', 'La Spezia', 'port', 44.1, 9.8, 0.7, 'The Ligurian coast: the port sits inside a small bay, with lanes linking toward Genoa.'],
  ['rijeka', 'Rijeka', 'port', 45.3, 14.4, 0.8, 'The Kvarner Gulf, where the Istrian Peninsula and the island of Krk pinch the lanes into narrow channels.'],
  ['malta', 'Malta', 'port', 35.9, 14.5, 0.6, 'A small island in the middle of the Mediterranean: the east-west main lane brushes past its south side, with a knot of red off Valletta.'],
  ['cagliari', 'Cagliari', 'port', 39.2, 9.1, 0.7, 'A port at Sardinia\'s southern end, with lanes converging in the Gulf of Cagliari.'],
  ['palermo', 'Palermo', 'port', 38.15, 13.35, 0.7, 'Sicily\'s north coast, with ferry lines running north from Palermo toward Naples and Sardinia.'],
  ['gioiatauro', 'Gioia Tauro', 'port', 38.45, 15.9, 0.6, 'A transshipment port at the toe of Italy, with most of the red concentrated in the anchorage outside.'],
  ['thessaloniki', 'Thessaloniki', 'port', 40.55, 22.9, 0.8, 'The Thermaic Gulf on the Aegean\'s north shore, a deep bay where lanes gather at the port.'],
  ['izmir', 'Izmir', 'port', 38.45, 26.9, 0.8, 'Turkey\'s west coast, where the long Gulf of Izmir cuts deep inland from the Aegean, with the island of Chios at its mouth.'],
  ['varna', 'Varna', 'port', 43.2, 27.95, 0.7, 'A bay on the Black Sea\'s west coast, with lanes running inward to the port by Lake Varna.'],
  ['burgas', 'Burgas', 'port', 42.5, 27.5, 0.6, 'Bulgaria\'s coastline, with a sheltered port inside the Gulf of Burgas.'],
  ['bergen', 'Bergen', 'port', 60.4, 5.2, 0.8, 'Norway\'s west coast of fjords and islands, with lanes zigzagging along narrow channels.'],
  ['oslofjord', 'Oslofjord', 'port', 59.5, 10.6, 0.9, 'A long, thin north-south fjord, with lanes following it up to Oslo.'],
  ['stavanger', 'Stavanger', 'port', 59.0, 5.6, 0.7, 'Norway\'s southwest coast: North Sea oil and gas supply ships set out from here, with lanes fanning west.'],
  ['esbjerg', 'Esbjerg', 'port', 55.5, 8.3, 0.7, 'Sandbars and shoals on Denmark\'s west coast, with lanes of North Sea wind-farm service ships outside the port.'],
  ['aarhus', 'Aarhus', 'port', 56.15, 10.3, 0.7, 'A bay on Jutland\'s east coast, with ferry lines running east from Aarhus to Zealand.'],
  ['szczecin', 'Szczecin–Świnoujście', 'port', 53.9, 14.4, 0.8, 'The Oder lagoon and Usedom island, with lanes entering from the Baltic\'s south shore.'],
  ['rostock', 'Rostock', 'port', 54.2, 12.1, 0.7, 'Germany\'s Baltic coast, with ferry lines running north to Gedser in Denmark and on to Sweden.'],
  ['ijmuiden', 'IJmuiden (Amsterdam)', 'port', 52.45, 4.5, 0.6, 'The Dutch coast is almost a vertical line, with a knot of converging red off the North Sea Canal entrance.'],
  ['cork', 'Cork', 'port', 51.8, -8.3, 0.7, 'Ireland\'s south coast: Cork Harbour is tucked in a small bay, with a sparse east-west lane offshore.'],
  ['sines', 'Sines', 'port', 37.95, -8.9, 0.6, 'Portugal\'s southwest coast, a deep-water oil port with north-south Atlantic lanes outside.'],
  ['cartagena', 'Cartagena', 'port', 37.55, -0.95, 0.7, 'Spain\'s southeast coast, a harbor deep in a bay, with lanes converging from the southeast.'],
  ['palma', 'Palma de Mallorca', 'port', 39.5, 2.7, 0.8, 'The Balearic Islands, where ferry lines between the islands form a radiating pattern.'],
  ['finisterre', 'Cape Finisterre', 'strait', 42.9, -9.3, 1.0, 'Spain\'s northwest corner: the north-south traffic separation scheme hugs the cape as it turns.'],
  ['littlebelt', 'Little Belt', 'strait', 55.5, 9.7, 0.6, 'The narrow channel between Jutland and Funen, with much thinner traffic than the Great Belt.'],
  ['kvarken', 'Kvarken', 'strait', 63.5, 21.0, 1.0, 'The narrow mouth of the Gulf of Bothnia at the Baltic\'s north end, with thin north-south lanes between islands.'],
  ['aland', 'Åland Sea', 'strait', 60.0, 19.5, 1.0, 'The channel between the Aland Islands and Sweden: ferries cross it, making some of the reddest lines in the Baltic.'],
  ['bornholm', 'Bornholm', 'strait', 55.1, 14.9, 1.0, 'A small island in the middle of the Baltic, with the east-west main lane brushing past its south side.'],
  ['kithira', 'Kythira Strait', 'strait', 36.3, 23.0, 1.0, 'The gap between the southern Peloponnese and Crete, where lanes bound for Piraeus turn.'],
  ['corinth', 'Corinth Canal', 'strait', 37.95, 23.0, 0.5, 'A small waterway joining the Saronic and Corinth gulfs, with very few ships in the frame.'],
  ['casquets', 'Central English Channel', 'strait', 49.7, -2.2, 1.2, 'Both shores sit at the edge of the frame, with the east-west traffic separation scheme between the English side and Normandy.'],
  ['fastnet', 'Fastnet (Celtic Sea)', 'strait', 51.4, -9.6, 1.2, 'The Atlantic approach off Ireland\'s southwest corner, with a stream of ships heading for the English Channel.'],
  ['irishsea', 'Irish Sea', 'strait', 53.9, -4.8, 1.2, 'The open water between Ireland and Britain, with ferry lines crossing near the Isle of Man.'],
  ['minch', 'The Minch', 'strait', 57.8, -6.3, 1.0, 'The water between the Outer Hebrides and mainland northwest Scotland, with sparse traffic following the islands.'],
  ['corfu', 'Corfu Strait', 'strait', 39.6, 19.9, 0.8, 'The narrow channel between Greece\'s Corfu and Albania, with lanes running north toward the Adriatic.'],
  ['piombino', 'Piombino Strait', 'strait', 42.9, 10.4, 0.8, 'Between Elba and Tuscany, with ferry lines fanning west from Piombino.'],
  ['irbe', 'Irbe Strait', 'strait', 57.75, 21.8, 0.8, 'Between Latvia and Saaremaa, the entrance to the Gulf of Riga.'],
];

// ---- tiny PNG decoder (8-bit palette PNGs from GeoServer) → alpha mask + rgb ----
function decodePng(buf) {
  let p = 8, w = 0, h = 0, pal = null, trns = null; const idat = [];
  let ctype = 0, depth = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; }
    else if (type === 'PLTE') pal = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (depth !== 8 || ![3, 6].includes(ctype)) throw new Error(`unsupported png ${depth}/${ctype}`);
  const bpp = ctype === 3 ? 1 : 4, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let r = v;
      if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[y * stride + x] = r & 255;
    }
  }
  const out = []; // {a, r, g, b}
  for (let i = 0; i < w * h; i++) {
    if (ctype === 3) { const k = px[i]; out.push({ a: trns && k < trns.length ? trns[k] : 255, r: pal[k * 3], g: pal[k * 3 + 1], b: pal[k * 3 + 2] }); }
    else out.push({ r: px[i * 4], g: px[i * 4 + 1], b: px[i * 4 + 2], a: px[i * 4 + 3] });
  }
  return { w, h, px: out };
}

// signal coverage, share of bright (yellow→red) pixels and their principal axis
export function analyse(png) {
  const { w, h, px } = png; let n = 0; const hot = [];
  px.forEach((q, i) => { if (q.a > 0) { n++; if (q.r > 170) hot.push([i % w, i / w | 0]); } });
  const pts = hot; // bright (yellow→red) pixels = the busiest lanes
  let angle = null;
  if (pts.length >= 40) {
    const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // axis angle in image coords (y down)
    const ratio = (sxx + syy + Math.hypot(sxx - syy, 2 * sxy)) / Math.max(1e-9, sxx + syy - Math.hypot(sxx - syy, 2 * sxy));
    // compass bearing of the axis, 0..180 (0 = N-S, 90 = E-W)
    angle = { bearing: Math.round(((90 + th * 180 / Math.PI) % 180 + 180) % 180), elong: +ratio.toFixed(1) };
  }
  return { cover: +(n / (w * h)).toFixed(3), hot: +(hot.length / Math.max(1, n)).toFixed(3), axis: angle };
}

const R = 6378137, mxm = (lng) => (lng * Math.PI / 180) * R, mym = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R;
const mult = [1, 3, 9]; // tight / medium / wide
const SZ = 240;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const f of readdirSync(join(out, 'img'))) rmSync(join(out, 'img', f));
  const places = [], dropped = [];
  for (const [idx, [id, en, kind, lat, lng, s, note]] of P.entries()) {
    const crops = [];
    for (let i = 0; i < 3; i++) {
      const k = 1 / Math.cos(lat * Math.PI / 180), h = (s * mult[i] * 111320 / 2) * k;
      const cx = mxm(lng), cy = mym(lat);
      const bbox = [cx - h, cy - h, cx + h, cy + h].map((v) => v.toFixed(0)).join(',');
      const raw = join(rawDir, `${id}-${i}.png`);
      if (!existsSync(raw)) {
        const url = `https://ows.emodnet-humanactivities.eu/wms?service=WMS&version=1.1.1&request=GetMap&layers=vesseldensity_allavg&styles=&srs=EPSG:3857&bbox=${bbox}&width=${SZ}&height=${SZ}&format=image/png&transparent=true&time=2023-01-01`;
        const r = await fetch(url, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
        if (!r.ok) throw new Error(`${id} ${r.status}`);
        writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
        await sleep(400);
      }
      crops.push({ raw, half: Math.round(h) });
    }
    const stats = crops.map((c) => analyse(decodePng(readFileSync(c.raw))));
    if (stats[0].cover < 0.08 || stats[2].cover < 0.08) { dropped.push(`${id} cover ${stats.map((q) => q.cover)}`); continue; }
    const n = places.length;
    const files = crops.map((c, i) => { const f = `c${String(n).padStart(2, '0')}-${i}.png`; copyFileSync(c.raw, join(out, 'img', f)); return f; });
    places.push({
      id, en, kind, lat, lng, files, note,
      spanKm: [0, 1, 2].map((i) => Math.round(s * mult[i] * 111)),
      half: crops.map((c) => c.half), // half-width of each crop in EPSG:3857 metres
      cover: stats.map((q) => q.cover), hot: stats[0].hot, axis: stats[0].axis,
    });
  }
  writeFileSync(join(out, 'data.json'), JSON.stringify({ places, source: 'EMODnet Human Activities vessel density (all types, annual average 2023), WMS GetMap, EPSG:3857, 240px' }));
  console.log(`${places.length} places, dropped: ${dropped.join('; ') || 'none'}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
