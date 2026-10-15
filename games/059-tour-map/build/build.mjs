// raw MusicBrainz event pages -> ../data.json (pool of tours)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(here, 'raw');
const artists = JSON.parse(fs.readFileSync(path.join(raw, 'artists.json'), 'utf8'));
const files = fs.readdirSync(raw);

const tours = new Map(); // series id -> {name, byArtist: Map(id -> stops[])}
for (const a of artists) {
  for (const f of files.filter((x) => x.startsWith(`ev-${a.id}-`))) {
    const d = JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8'));
    for (const e of d.events) {
      if (e.cancelled) continue;
      const date = e['life-span']?.begin;
      if (!date || date.length !== 10) continue;
      const rels = e.relations || [];
      const ser = rels.find((r) => r['target-type'] === 'series' && r.series?.type === 'Tour');
      const pl = rels.find((r) => r['target-type'] === 'place' && r.place?.coordinates);
      if (!ser || !pl) continue;
      const p = pl.place;
      const t = tours.get(ser.series.id) || { id: ser.series.id, name: ser.series.name, by: new Map() };
      tours.set(ser.series.id, t);
      const arr = t.by.get(a.id) || [];
      t.by.set(a.id, arr);
      arr.push({ date, lat: +p.coordinates.latitude, lng: +p.coordinates.longitude, venue: p.name, city: p.area?.name || '', ptype: p.type || '' });
    }
  }
}

// MusicBrainz lacks a country for some artists; fill from the artist's own area (verified by hand)
const COUNTRY_FIX = { 'Harry Styles': 'GB', 'Stray Kids': 'KR', 'BTS': 'KR' };
const countryOf = (a) => a.country || COUNTRY_FIX[a.name] || null;
const WD_OK = (iso, year) => {
  let n = 0;
  const wd = new Date(`${iso}T12:00:00Z`).getUTCDay();
  for (let y = 1965; y <= 2026; y++) if (new Date(`${y}-${iso.slice(5)}T12:00:00Z`).getUTCDay() === wd) n++;
  return n >= 3 && n <= 14;
};
// Venues stored under a local-script name in MusicBrainz get an English name (keys are \u-escaped source names)
const VENUE_EN = {"\u0e2d\u0e34\u0e21\u0e41\u0e1e\u0e47\u0e04 \u0e2d\u0e32\u0e23\u0e35\u0e19\u0e48\u0e32 \u0e40\u0e21\u0e37\u0e2d\u0e07\u0e17\u0e2d\u0e07\u0e18\u0e32\u0e19\u0e35": "Impact Arena, Muang Thong Thani", "\u30ef\u30fc\u30eb\u30c9\u8a18\u5ff5\u30db\u30fc\u30eb": "World Memorial Hall", "\u5e55\u5f35\u30e1\u30c3\u30bb \u30a4\u30d9\u30f3\u30c8\u30db\u30fc\u30eb": "Makuhari Messe Event Hall", "\u6771\u4eac\u30ac\u30fc\u30c7\u30f3\u30b7\u30a2\u30bf\u30fc": "Tokyo Garden Theater", "\u3055\u3044\u305f\u307e\u30b9\u30fc\u30d1\u30fc\u30a2\u30ea\u30fc\u30ca": "Saitama Super Arena", "\u5927\u962a\u539a\u751f\u5e74\u91d1\u4f1a\u9928 \u5927\u30db\u30fc\u30eb": "Osaka Kosei Nenkin Kaikan Main Hall", "\u306a\u3093\u3070Hatch": "Namba Hatch", "\u6a2a\u6d5c\u30a2\u30ea\u30fc\u30ca": "Yokohama Arena", "\u5927\u962a\u57ce\u30db\u30fc\u30eb": "Osaka-jo Hall", "\u4eac\u30bb\u30e9\u30c9\u30fc\u30e0\u5927\u962a": "Kyocera Dome Osaka", "\u6771\u4eac\u30c9\u30fc\u30e0": "Tokyo Dome", "\u0e23\u0e32\u0e0a\u0e21\u0e31\u0e07\u0e04\u0e25\u0e32\u0e01\u0e35\u0e2c\u0e32\u0e2a\u0e16\u0e32\u0e19": "Rajamangala Stadium", "\u041d\u0430\u0446\u0438\u043e\u043d\u0430\u043b\u0435\u043d \u0441\u0442\u0430\u0434\u0438\u043e\u043d \u201e\u0412\u0430\u0441\u0438\u043b \u041b\u0435\u0432\u0441\u043a\u0438\u201c": "Vasil Levski National Stadium", "\uc62c\ub9bc\ud53d\uccb4\uc870\uacbd\uae30\uc7a5": "Olympic Gymnastics Arena (Seoul)", "\u570b\u7acb\u9ad4\u80b2\u5927\u5b78\u7d9c\u5408\u9ad4\u80b2\u9928": "National Taiwan Sport University Arena", "\u307f\u305a\u307bPayPay\u30c9\u30fc\u30e0\u798f\u5ca1": "Mizuho PayPay Dome Fukuoka", "\u6a2a\u6d5c\u30b9\u30bf\u30b8\u30a2\u30e0": "Yokohama Stadium", "\u05d0\u05e6\u05d8\u05d3\u05d9\u05d5\u05df \u05e8\u05de\u05ea \u05d2\u05df": "Ramat Gan Stadium", "\u0428\u0442\u0430\u0440\u043a \u0430\u0440\u0435\u043d\u0430": "Stark Arena", "\u6709\u660e\u30a2\u30ea\u30fc\u30ca": "Ariake Arena", "\u4e21\u56fd\u56fd\u6280\u9928": "Ryogoku Kokugikan", "\u51ef\u8fea\u62c9\u514b\u4e2d\u5fc3": "Cadillac Arena", "\u6885\u8d5b\u5fb7\u65af-\u5954\u9a70\u6587\u5316\u4e2d\u5fc3": "Mercedes-Benz Arena", "\u041e\u043b\u0438\u043c\u043f\u0438\u0439\u0441\u043a\u0438\u0439": "Olimpiysky Arena", "\uace0\uc591\uc885\ud569\uc6b4\ub3d9\uc7a5": "Goyang Stadium", "\u555f\u5fb7\u4e3b\u5834\u9928": "Kai Tak Main Stadium", "\u0645\u0636\u0645\u0627\u0631 \u0645\u064a\u062f\u0627\u0646": "Meydan Racecourse", "\u05e4\u05d0\u05e8\u05e7 \u05d4\u05d9\u05e8\u05e7\u05d5\u05df": "Yarkon Park", "\u6a02\u5929\u6843\u5712\u68d2\u7403\u5834": "Rakuten Taoyuan Baseball Stadium", "\uace0\ucc99\uc2a4\uce74\uc774\ub3d4": "Gocheok Sky Dome", "\uc7a0\uc2e4\uccb4\uc721\uad00": "Jamsil Arena", "\u0e2d\u0e34\u0e21\u0e41\u0e1e\u0e47\u0e04 \u0e0a\u0e32\u0e40\u0e25\u0e19\u0e40\u0e08\u0e2d\u0e23\u0e4c": "Impact Challenger", "\u0421\u0442\u0430\u0434\u0438\u043e\u043d \u201e\u041b\u043e\u043a\u043e\u043c\u043e\u0442\u0438\u0432\u201c": "Lokomotiv Stadium", "\u30d9\u30eb\u30fc\u30ca\u30c9\u30fc\u30e0": "Belluna Dome", "\u041b\u0435\u0434\u043e\u0432\u044b\u0439 \u0434\u0432\u043e\u0440\u0435\u0446": "Ice Palace", "\u0412\u0422\u0411 \u0410\u0440\u0435\u043d\u0430": "VTB Arena", "\u041d\u0421\u041a \u00ab\u041e\u043b\u0456\u043c\u043f\u0456\u0439\u0441\u044c\u043a\u0438\u0439\u00bb": "NSC Olimpiyskiy", "\u30bc\u30d3\u30aa\u30a2\u30ea\u30fc\u30ca\u4ed9\u53f0": "Xebio Arena Sendai", "\u76db\u5ca1\u30bf\u30ab\u30e4\u30a2\u30ea\u30fc\u30ca": "Morioka Takaya Arena", "\u611b\u77e5\u770c\u4f53\u80b2\u9928": "Aichi Prefectural Gymnasium", "\uc11c\uc6b8\uc62c\ub9bc\ud53d\uc8fc\uacbd\uae30\uc7a5": "Seoul Olympic Stadium", "\u81fa\u5317\u5357\u6e2f\u5c55\u89bd\u99281": "Taipei Nangang Exhibition Center Hall 1", "\u0410\u0440\u0435\u043d\u0430 \u0410\u0440\u043c\u0435\u0435\u0446 \u0421\u043e\u0444\u0438\u044f": "Arena Armeec Sofia", "\u0421\u041a\u041a \u00ab\u041f\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433\u0441\u043a\u0438\u0439\u00bb": "Petersburg Sports and Concert Complex", "\u03ba\u03bb\u03b5\u03b9\u03c3\u03c4\u03cc \u03b3\u03ae\u03c0\u03b5\u03b4\u03bf \u03bc\u03c0\u03ac\u03c3\u03ba\u03b5\u03c4 \u039f\u0391\u039a\u0391": "OAKA Indoor Basketball Arena", "\u0414\u0432\u043e\u0440\u0435\u0446 \u0441\u043f\u043e\u0440\u0442\u0430 \u00ab\u041c\u0415\u0413\u0410\u0421\u041f\u041e\u0420\u0422\u00bb": "Megasport Sports Palace", "\u8c4a\u6d32PIT": "Toyosu PIT", "\u65e5\u672c\u6b66\u9053\u9928": "Nippon Budokan", "ZOZO\u30de\u30ea\u30f3\u30b9\u30bf\u30b8\u30a2\u30e0": "ZOZO Marine Stadium", "\u821e\u6d32\u30a2\u30ea\u30fc\u30ca": "Maishima Arena", "\u6771\u4eac\u56fd\u969b\u30d5\u30a9\u30fc\u30e9\u30e0": "Tokyo International Forum", "\ud074\ub7fd \uc564\uc368": "Club Answer", "\u5e55\u5f35\u30e1\u30c3\u30bb": "Makuhari Messe", "\u05de\u05e8\u05db\u05d6 \u05d4\u05d9\u05e8\u05d9\u05d3\u05d9\u05dd \u05d5\u05d4\u05e7\u05d5\u05e0\u05d2\u05e8\u05e1\u05d9\u05dd \u05d1\u05d9\u05e9\u05e8\u05d0\u05dc": "Israel Trade Fairs & Convention Center", "\u0e2a\u0e19\u0e32\u0e21\u0e28\u0e38\u0e20\u0e0a\u0e25\u0e32\u0e28\u0e31\u0e22": "Supachalasai Stadium", "\u0645\u0631\u0633\u0648\u0644 \u0628\u0627\u0631\u0643": "Marsool Park", "\u0627\u0644\u0627\u062a\u062d\u0627\u062f \u0628\u0627\u0631\u0643": "Al Etihad Park", "\u9280\u6cb3\u570b\u969b\u6703\u8b70\u4e2d\u5fc3": "Galaxy International Convention Center", "\u798f\u5ca1\u56fd\u969b\u30bb\u30f3\u30bf\u30fc": "Fukuoka Kokusai Center", "\u56fd\u7acb\u4ee3\u3005\u6728\u7af6\u6280\u5834": "Yoyogi National Gymnasium", "\u0421\u0442\u0430\u0434\u0438\u043e\u043d \u00ab\u041b\u0443\u0436\u043d\u0438\u043a\u0438\u00bb": "Luzhniki Stadium", "\u0420\u0416\u0414 \u0410\u0440\u0435\u043d\u0430": "RZD Arena", "\u041d\u0430\u0446\u0456\u043e\u043d\u0430\u043b\u044c\u043d\u0438\u0439 \u043f\u0430\u043b\u0430\u0446 \u043c\u0438\u0441\u0442\u0435\u0446\u0442\u0432 \"\u0423\u043a\u0440\u0430\u0457\u043d\u0430\"": "Ukraine Palace of Arts", "\u041c\u0456\u043d\u0441\u043a-\u0410\u0440\u044d\u043d\u0430": "Minsk-Arena", "\u041a\u0440\u043e\u043a\u0443\u0441 \u0421\u0438\u0442\u0438 \u0425\u043e\u043b\u043b": "Crocus City Hall", "\u65e5\u672c\u30ac\u30a4\u30b7\u30db\u30fc\u30eb": "Nippon Gaishi Hall", "\u0417\u0421\u041a \u00ab\u0421\u043f\u043e\u0440\u0442-\u0414\u043e\u043d\u00bb": "Sport-Don Sports Complex", "\u041a\u0420\u041a \u00ab\u0410\u0440\u0435\u043d\u0430 \u0423\u0440\u0430\u043b\u0435\u0446\u00bb": "Uralets Arena", "\u041f\u043b\u0430\u0442\u0438\u043d\u0443\u043c \u0410\u0440\u0435\u043d\u0430": "Platinum Arena", "\u0421\u0442\u0430\u0434\u0438\u043e\u043d \"\u0410\u0432\u0430\u043d\u0433\u0430\u0440\u0434\"": "Avangard Stadium", "\u0426\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\u044b\u0439": "Central Stadium", "\u53f0\u5317\u5c0f\u5de8\u86cb": "Taipei Arena"};
const venueEn = (v) => VENUE_EN[v] || v;
const pool = [];
const usedArtists = new Set();
for (const t of tours.values()) {
  const ranked = [...t.by.entries()].sort((a, b) => b[1].length - a[1].length);
  const [aid, stops0] = ranked[0];
  const total = ranked.reduce((s, [, v]) => s + v.length, 0);
  if (stops0.length / total < 0.7) continue; // shared/co-headline tour -> ambiguous
  // de-dup identical event rows (same date+venue)
  const seen = new Set();
  const stops = stops0.filter((s) => { const k = s.date + s.venue; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.date.localeCompare(b.date));
  const places = new Set(stops.map((s) => `${s.lat.toFixed(1)},${s.lng.toFixed(1)}`));
  if (stops.length < 8 || places.size < 6) continue;
  const span = (Date.parse(stops.at(-1).date) - Date.parse(stops[0].date)) / 864e5;
  if (span > 1500) continue;
  const year = +stops[0].date.slice(0, 4);
  if (year < 1965 || year > 2026) continue;
  const art = artists.find((x) => x.id === aid);
  if (!countryOf(art) || !WD_OK(stops[0].date) || stops.some((s) => !s.venue || (Math.abs(s.lat) < 0.01 && Math.abs(s.lng) < 0.01))) continue;
  usedArtists.add(aid);
  pool.push({
    id: t.id, tour: t.name, artist: aid, year,
    stops: stops.slice(0, 140).map((s) => [s.date, +s.lat.toFixed(4), +s.lng.toFixed(4), s.city, venueEn(s.venue), s.ptype]),
  });
}
pool.sort((a, b) => a.id.localeCompare(b.id));
const out = {
  artists: artists.filter((a) => usedArtists.has(a.id)).map((a) => ({ id: a.id, name: a.name, query: a.query, country: countryOf(a) })),
  tours: pool,
};
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify(out));
console.log('tours', pool.length, 'artists', out.artists.length, 'bytes', fs.statSync(path.join(here, '..', 'data.json')).size);
