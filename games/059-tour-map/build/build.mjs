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
    stops: stops.slice(0, 140).map((s) => [s.date, +s.lat.toFixed(4), +s.lng.toFixed(4), s.city, s.venue, s.ptype]),
  });
}
pool.sort((a, b) => a.id.localeCompare(b.id));
const out = {
  artists: artists.filter((a) => usedArtists.has(a.id)).map((a) => ({ id: a.id, name: a.name, query: a.query, country: countryOf(a) })),
  tours: pool,
};
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify(out));
console.log('tours', pool.length, 'artists', out.artists.length, 'bytes', fs.statSync(path.join(here, '..', 'data.json')).size);
