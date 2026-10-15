// Crossings: A -> B (open-water points just off each harbour), names in English.
// The wind grid is N x N over a padded box; the land mask is a finer MW x MH raster of the same box (see build.mjs).
export const N = 9;
export const CELL_KM = 3; // land-mask cell size
export const STRAITS = [
  { id: 'channel', name: 'English Channel', a: ['Portsmouth', 50.75, -1.05], b: ['Cherbourg', 49.69, -1.62] },
  { id: 'irish', name: 'Irish Sea', a: ['Holyhead', 53.36, -4.7], b: ['Dublin', 53.3, -6.05] },
  { id: 'bass', name: 'Bass Strait', a: ['Port Phillip Heads', -38.6, 144.8], b: ['North Tasmania', -40.95, 146.35] },
  { id: 'cook', name: 'Cook Strait', a: ['Wellington', -41.42, 174.85], b: ['Nelson', -40.95, 173.6] },
  { id: 'georgia', name: 'Strait of Georgia', a: ['Vancouver', 49.0, -123.35], b: ['Victoria', 48.35, -123.3] },
  { id: 'aegean', name: 'Aegean Sea', a: ['Piraeus', 37.9, 23.55], b: ['Santorini', 36.3, 25.25] },
  { id: 'ligurian', name: 'Ligurian Sea', a: ['Genoa', 44.3, 8.9], b: ['Calvi', 42.65, 8.6] },
  { id: 'tyrrhenian', name: 'Tyrrhenian Sea', a: ['Naples', 40.72, 14.2], b: ['Palermo', 38.25, 13.4] },
  { id: 'adriatic', name: 'Adriatic Sea', a: ['Ancona', 43.65, 13.65], b: ['Split', 43.45, 16.4] },
  { id: 'gulf-finland', name: 'Gulf of Finland', a: ['Helsinki', 60.1, 24.95], b: ['Tallinn', 59.55, 24.7] },
  { id: 'florida', name: 'Straits of Florida', a: ['Key West', 24.4, -81.8], b: ['Havana', 23.25, -82.3] },
  { id: 'alenuihaha', name: 'Alenuihaha Channel', a: ['Maui', 20.9, -156.1], b: ['Hawaii Island', 20.05, -155.95] },
  { id: 'kattegat', name: 'Kattegat', a: ['Gothenburg', 57.6, 11.7], b: ['Jutland', 56.75, 10.9] },
  { id: 'sicily', name: 'Sicily Channel', a: ['Trapani', 37.9, 12.3], b: ['Tunis', 36.9, 10.45] },
  { id: 'tsushima', name: 'Tsushima Strait', a: ['Fukuoka', 33.75, 129.9], b: ['Busan', 35.0, 129.15] },
  { id: 'baltic', name: 'Baltic Sea', a: ['Gotland', 57.7, 18.2], b: ['Liepaja', 56.5, 20.9] },
];
export function box(s) {
  const [, la, lo] = s.a, [, lb, lob] = s.b;
  const padLat = Math.max(0.35, Math.abs(la - lb) * 0.25), padLng = Math.max(0.35, Math.abs(lo - lob) * 0.25);
  return { s: Math.min(la, lb) - padLat, n: Math.max(la, lb) + padLat, w: Math.min(lo, lob) - padLng, e: Math.max(lo, lob) + padLng };
}
export function gridPoints(s) {
  const b = box(s), pts = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++)
    pts.push([+(b.n - (b.n - b.s) * i / (N - 1)).toFixed(3), +(b.w + (b.e - b.w) * j / (N - 1)).toFixed(3)]); // row i from north, col j from west
  return pts;
}
