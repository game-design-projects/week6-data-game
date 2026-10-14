// Downloads WMO/GRDC basin polygons (generalised server-side) and attributes into raw/.
import fs from 'node:fs';
const B = 'https://services1.arcgis.com/RTK5Unh1Z71JKIiR/arcgis/rest/services/WMO_Basins_and_Sub_Basins_3rd_ed_GRDC_2020/FeatureServer/0/query';
fs.mkdirSync('raw', { recursive: true });
const out = 'raw/geom.json';
if (fs.existsSync(out)) { console.log('cached', out); process.exit(0); }
const feats = [];
for (let off = 0; off < 600; off += 100) {
  const u = `${B}?where=1%3D1&outFields=FID,WMOBB,WMOBB_NAME,WMOBB_BASI,WMOBB_SUBB,REGNAME,SUM_SUB_AR&orderByFields=FID&resultOffset=${off}&resultRecordCount=100&maxAllowableOffset=0.06&geometryPrecision=2&outSR=4326&f=geojson`;
  const r = await fetch(u, { headers: { 'User-Agent': 'daily-data-class/1.0' } });
  const j = await r.json();
  if (!j.features) { console.error(JSON.stringify(j).slice(0, 300)); process.exit(1); }
  feats.push(...j.features);
  console.log(off, j.features.length);
  await new Promise((r) => setTimeout(r, 1500));
}
fs.writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features: feats }));
