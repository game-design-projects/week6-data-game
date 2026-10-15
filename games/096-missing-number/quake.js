// Daily USGS earthquake brief: shaping of a GeoJSON/FDSN response into one puzzle record. Pure; shared by game.js and build/.
export const QUAKE_RANGE = {
  q25: [0, 250], q45: [0, 100], q5: [0, 40], qmag: [4.5, 9], qdep: [0, 800],
};
const region = (p) => String(p ?? '').replace(/^.*? of /, '').replace(/^the /i, '').trim() || 'unknown';

/** @param features GeoJSON features (properties.mag/place, geometry.coordinates[2] = depth km) of ONE UTC day, M2.5+ */
export function dayStats(features, date) {
  const ev = (features ?? []).map((f) => ({ mag: Number(f?.properties?.mag), depth: Number(f?.geometry?.coordinates?.[2]), place: region(f?.properties?.place) }))
    .filter((e) => Number.isFinite(e.mag) && Number.isFinite(e.depth) && e.mag >= 2.5);
  if (ev.length < 10) return null;
  const top = ev.reduce((a, b) => (b.mag > a.mag ? b : a));
  const deep = ev.reduce((a, b) => (b.depth > a.depth ? b : a));
  const s = {
    d: date, q25: ev.length, q45: ev.filter((e) => e.mag >= 4.5).length, q5: ev.filter((e) => e.mag >= 5).length,
    qmag: Math.round(top.mag * 10) / 10, qdep: Math.round(deep.depth), magPlace: top.place, depPlace: deep.place,
  };
  for (const [k, [lo, hi]] of Object.entries(QUAKE_RANGE)) if (!(s[k] >= lo && s[k] <= hi)) return null; // would fall outside the slider
  return s;
}
