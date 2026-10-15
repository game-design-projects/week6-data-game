// Crossings: A -> B (open-water points just off each harbour), names in Chinese.
// The wind grid is N x N over a padded box; the land mask is a finer MW x MH raster of the same box (see build.mjs).
export const N = 9;
export const CELL_KM = 3; // land-mask cell size
export const STRAITS = [
  { id: 'channel', name: '英吉利海峡', a: ['朴茨茅斯', 50.75, -1.05], b: ['瑟堡', 49.69, -1.62] },
  { id: 'irish', name: '爱尔兰海', a: ['霍利黑德', 53.36, -4.7], b: ['都柏林', 53.3, -6.05] },
  { id: 'bass', name: '巴斯海峡', a: ['菲利普港湾口', -38.6, 144.8], b: ['塔斯马尼亚北岸', -40.95, 146.35] },
  { id: 'cook', name: '库克海峡', a: ['惠灵顿', -41.42, 174.85], b: ['尼尔森', -40.95, 173.6] },
  { id: 'georgia', name: '乔治亚海峡', a: ['温哥华', 49.0, -123.35], b: ['维多利亚', 48.35, -123.3] },
  { id: 'aegean', name: '爱琴海', a: ['比雷埃夫斯', 37.9, 23.55], b: ['圣托里尼', 36.3, 25.25] },
  { id: 'ligurian', name: '利古里亚海', a: ['热那亚', 44.3, 8.9], b: ['卡尔维', 42.65, 8.6] },
  { id: 'tyrrhenian', name: '第勒尼安海', a: ['那不勒斯', 40.72, 14.2], b: ['巴勒莫', 38.25, 13.4] },
  { id: 'adriatic', name: '亚得里亚海', a: ['安科纳', 43.65, 13.65], b: ['斯普利特', 43.45, 16.4] },
  { id: 'gulf-finland', name: '芬兰湾', a: ['赫尔辛基', 60.1, 24.95], b: ['塔林', 59.55, 24.7] },
  { id: 'florida', name: '佛罗里达海峡', a: ['基韦斯特', 24.4, -81.8], b: ['哈瓦那', 23.25, -82.3] },
  { id: 'alenuihaha', name: '阿勒奴伊哈哈海峡', a: ['毛伊岛', 20.9, -156.1], b: ['夏威夷岛', 20.05, -155.95] },
  { id: 'kattegat', name: '卡特加特海峡', a: ['哥德堡', 57.6, 11.7], b: ['日德兰', 56.75, 10.9] },
  { id: 'sicily', name: '西西里海峡', a: ['特拉帕尼', 37.9, 12.3], b: ['突尼斯', 36.9, 10.45] },
  { id: 'tsushima', name: '对马海峡', a: ['福冈', 33.75, 129.9], b: ['釜山', 35.0, 129.15] },
  { id: 'baltic', name: '波罗的海', a: ['哥特兰', 57.7, 18.2], b: ['利耶帕亚', 56.5, 20.9] },
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
