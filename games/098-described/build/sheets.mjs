import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(path.dirname(new URL(import.meta.url).pathname), 'raw');
const c = JSON.parse(fs.readFileSync(raw + '/cands.json'));
const per = 12;
for (let s = 0; s * per < c.length; s++) {
  const cells = c.slice(s * per, (s + 1) * per).map((x, k) => {
    const i = s * per + k;
    return `<div style="width:316px;float:left;margin:2px"><img src="img/${i}.jpg" style="width:316px;height:210px;object-fit:cover;display:block"><b style="font:bold 15px sans-serif">${i} ${x.city}</b></div>`;
  }).join('');
  fs.writeFileSync(`${raw}/sheet${s}.html`, `<body style="margin:0;width:980px">${cells}</body>`);
}
