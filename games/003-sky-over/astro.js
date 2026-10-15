// Low-precision positional astronomy (pure, no DOM): precession, Sun/Moon/planets, GMST.
// Planets: JPL "Keplerian elements for approximate positions 1800-2050" (Standish). Moon: truncated Meeus ch. 47.
const RAD = Math.PI / 180;
export const mod = (a, n) => ((a % n) + n) % n;
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD);

export const jdFromMs = (ms) => ms / 86400000 + 2440587.5;
export const centuries = (ms) => (jdFromMs(ms) - 2451545.0) / 36525;

/** Greenwich mean sidereal time in degrees for a UTC instant (ms). */
export function gmstDeg(ms) {
  return mod(280.46061837 + 360.98564736629 * (jdFromMs(ms) - 2451545.0), 360);
}

/** Altitude/azimuth (deg; az from N through E) of RA/Dec (deg) for an observer at latitude, local sidereal time. */
export function altAz(raDeg, decDeg, latDeg, lstDeg) {
  const ha = (lstDeg - raDeg) * RAD, d = decDeg * RAD, f = latDeg * RAD;
  const sinAlt = Math.sin(d) * Math.sin(f) + Math.cos(d) * Math.cos(f) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.cos(d) * Math.sin(ha), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(ha));
  return { alt: alt / RAD, az: mod(az / RAD, 360) };
}

/** Planisphere projection (looking up: N at top, E at left), unit circle. */
export function project(alt, az) {
  const r = (90 - alt) / 90;
  return { x: -r * Math.sin(az * RAD), y: -r * Math.cos(az * RAD) };
}

/** Precess J2000 equatorial coords (deg) to the mean equator/equinox of date (T = Julian centuries since J2000). */
export function precess(ra, dec, T) {
  const zeta = (2306.2181 * T + 0.30188 * T * T) / 3600, z = (2306.2181 * T + 1.09468 * T * T) / 3600, th = (2004.3109 * T - 0.42665 * T * T) / 3600;
  const A = cos(dec) * sin(ra + zeta), B = cos(th) * cos(dec) * cos(ra + zeta) - sin(th) * sin(dec), C = sin(th) * cos(dec) * cos(ra + zeta) + cos(th) * sin(dec);
  return [mod(Math.atan2(A, B) / RAD + z, 360), Math.asin(Math.max(-1, Math.min(1, C))) / RAD];
}

const eclToEq = (lon, lat, eps) => [
  mod(Math.atan2(sin(lon) * cos(eps) - Math.tan(lat * RAD) * sin(eps), cos(lon)) / RAD, 360),
  Math.asin(sin(lat) * cos(eps) + cos(lat) * sin(eps) * sin(lon)) / RAD,
];

// [a, a', e, e', I, I', L, L', varpi, varpi', Omega, Omega']
const ELEMENTS = {
  Mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  Venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  Earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  Mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  Jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  Saturn: [9.53667594, -0.1250600e-2, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
};

/** Heliocentric ecliptic-J2000 rectangular coords (AU). */
function helio(name, T) {
  const E = ELEMENTS[name], v = (i) => E[i] + E[i + 1] * T;
  const a = v(0), e = v(2), I = v(4), L = v(6), w = v(8), O = v(10);
  const M = mod(L - w, 360), om = w - O;
  let Ea = M + e / RAD * sin(M);
  for (let i = 0; i < 8; i++) Ea += (M - (Ea - e / RAD * sin(Ea))) / (1 - e * cos(Ea));
  const xp = a * (cos(Ea) - e), yp = a * Math.sqrt(1 - e * e) * sin(Ea);
  return [
    (cos(om) * cos(O) - sin(om) * sin(O) * cos(I)) * xp + (-sin(om) * cos(O) - cos(om) * sin(O) * cos(I)) * yp,
    (cos(om) * sin(O) + sin(om) * cos(O) * cos(I)) * xp + (-sin(om) * sin(O) + cos(om) * cos(O) * cos(I)) * yp,
    sin(om) * sin(I) * xp + cos(om) * sin(I) * yp,
  ];
}

/** Sun + planets: equatorial coords of date (deg). */
export function planets(ms) {
  const T = centuries(ms), earth = helio('Earth', T), eps = 23.43928;
  const out = {};
  const toEq = (g) => {
    const lon = mod(Math.atan2(g[1], g[0]) / RAD, 360), lat = Math.atan2(g[2], Math.hypot(g[0], g[1])) / RAD;
    const [ra, dec] = eclToEq(lon, lat, eps);
    return precess(ra, dec, T);
  };
  out.Sun = toEq(earth.map((x) => -x));
  for (const n of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
    const p = helio(n, T);
    out[n] = toEq([p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]]);
  }
  return out;
}

/** Moon: equatorial coords of date (deg) plus elongation from the Sun (deg). */
export function moon(ms) {
  const T = centuries(ms);
  const Lp = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T, F = 93.272095 + 483202.0175233 * T;
  const lonT = [[6288774, 0, 0, 1, 0], [1274027, 2, 0, -1, 0], [658314, 2, 0, 0, 0], [213618, 0, 0, 2, 0], [-185116, 0, 1, 0, 0], [-114332, 0, 0, 0, 2], [58793, 2, 0, -2, 0], [57066, 2, -1, -1, 0], [53322, 2, 0, 1, 0], [45758, 2, -1, 0, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0], [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2], [10980, 0, 0, 1, -2]];
  const latT = [[5128122, 0, 0, 0, 1], [280602, 0, 0, 1, 1], [277693, 0, 0, 1, -1], [173237, 2, 0, 0, -1], [55413, 2, 0, -1, 1], [46271, 2, 0, -1, -1], [32573, 2, 0, 0, 1], [17198, 0, 0, 2, 1], [9266, 2, 0, 1, -1], [8822, 0, 0, 2, -1]];
  const sum = (tab, f) => tab.reduce((s, [c, d, m, mp, ff]) => s + c * f(d * D + m * M + mp * Mp + ff * F), 0) / 1e6;
  const lon = mod(Lp + sum(lonT, sin), 360), lat = sum(latT, sin);
  const eps = 23.43929 - 0.0130042 * T;
  const [ra, dec] = eclToEq(lon, lat, eps);
  const sun = planets(ms).Sun;
  const e = Math.acos(Math.max(-1, Math.min(1, sin(dec) * sin(sun[1]) + cos(dec) * cos(sun[1]) * cos(ra - sun[0])))) / RAD;
  return { ra, dec, elong: e, illum: (1 - cos(e)) / 2, waxing: mod(ra - sun[0], 360) < 180 };
}

/** Sun altitude (deg) for an observer. */
export function sunAlt(ms, lat, lng) {
  const [ra, dec] = planets(ms).Sun;
  return altAz(ra, dec, lat, mod(gmstDeg(ms) + lng, 360)).alt;
}
