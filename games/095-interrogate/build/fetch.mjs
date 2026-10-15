import fs from 'node:fs';
const UA = { 'User-Agent': 'daily-data-games/1.0 (class project)' };
const IND = ['NY.GDP.PCAP.CD','SP.POP.TOTL','SP.DYN.LE00.IN','SP.URB.TOTL.IN.ZS','AG.LND.TOTL.K2','SP.DYN.TFRT.IN','IT.NET.USER.ZS','AG.LND.FRST.ZS','EN.GHG.CO2.PC.CE.AR5','SH.XPD.CHEX.GD.ZS'];
fs.mkdirSync('raw', { recursive: true });
const get = async (name, url) => {
  const f = `raw/${name}.json`;
  if (fs.existsSync(f)) return;
  const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(url + r.status);
  fs.writeFileSync(f, await r.text()); await new Promise(r => setTimeout(r, 800));
};
await get('countries', 'https://api.worldbank.org/v2/country?format=json&per_page=400');
for (const i of IND) await get(i, `https://api.worldbank.org/v2/country/all/indicator/${i}?format=json&per_page=20000&mrnev=1`);
