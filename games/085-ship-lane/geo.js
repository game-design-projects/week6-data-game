// Pure helpers: great-circle distance + compass arrow.
export function distKm(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}
export function bearing(a, b) {
  const r = Math.PI / 180, dLng = (b.lng - a.lng) * r;
  const y = Math.sin(dLng) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dLng);
  return (Math.atan2(y, x) / r + 360) % 360;
}
export const arrow = (deg) => '↑↗→↘↓↙←↖'[Math.round(deg / 45) % 8];
