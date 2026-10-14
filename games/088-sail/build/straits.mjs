// Crossings: A -> B, names in Chinese. Grid is N x N over a padded box.
export const N = 9;
export const STRAITS = [
  { id: 'channel', name: '英吉利海峡', a: ['朴茨茅斯', 50.78, -1.1], b: ['瑟堡', 49.65, -1.62] },
  { id: 'irish', name: '爱尔兰海', a: ['霍利黑德', 53.31, -4.63], b: ['都柏林', 53.35, -6.05] },
  { id: 'bass', name: '巴斯海峡', a: ['墨尔本', -38.4, 144.9], b: ['塔斯马尼亚', -40.9, 145.9] },
  { id: 'cook', name: '库克海峡', a: ['惠灵顿', -41.35, 174.8], b: ['尼尔森', -40.85, 173.6] },
  { id: 'georgia', name: '乔治亚海峡', a: ['温哥华', 49.2, -123.4], b: ['维多利亚', 48.4, -123.35] },
  { id: 'aegean', name: '爱琴海', a: ['比雷埃夫斯', 37.9, 23.6], b: ['圣托里尼', 36.4, 25.4] },
  { id: 'ligurian', name: '利古里亚海', a: ['热那亚', 44.35, 8.9], b: ['卡尔维', 42.6, 8.7] },
  { id: 'tyrrhenian', name: '第勒尼安海', a: ['那不勒斯', 40.75, 14.2], b: ['巴勒莫', 38.2, 13.4] },
  { id: 'adriatic', name: '亚得里亚海', a: ['安科纳', 43.6, 13.6], b: ['斯普利特', 43.45, 16.4] },
  { id: 'gulf-finland', name: '芬兰湾', a: ['赫尔辛基', 60.1, 24.9], b: ['塔林', 59.5, 24.7] },
  { id: 'florida', name: '佛罗里达海峡', a: ['基韦斯特', 24.45, -81.8], b: ['哈瓦那', 23.2, -82.3] },
  { id: 'alenuihaha', name: '夏威夷海峡', a: ['毛伊岛', 20.9, -156.75], b: ['夏威夷岛', 19.8, -156.1] },
  { id: 'kattegat', name: '卡特加特海峡', a: ['哥德堡', 57.6, 11.7], b: ['日德兰', 56.7, 10.6] },
  { id: 'sicily', name: '西西里海峡', a: ['特拉帕尼', 37.9, 12.4], b: ['突尼斯', 36.9, 10.4] },
  { id: 'tsugaru', name: '对马海峡', a: ['福冈', 33.7, 129.8], b: ['釜山', 35.0, 129.1] },
  { id: 'oresund', name: '波罗的海', a: ['哥特兰', 57.6, 18.9], b: ['利耶帕亚', 56.5, 21.0] },
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
