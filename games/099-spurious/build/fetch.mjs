// Download World Bank indicators for all countries, 2000-2022, into raw/.
import fs from 'node:fs';
export const IND = {
  'SP.POP.TOTL': 'Population', 'SP.DYN.LE00.IN': 'Life expectancy', 'NY.GDP.PCAP.CD': 'GDP per capita (US$)', 'EN.GHG.CO2.PC.CE.AR5': 'CO2 emissions per capita',
  'IT.NET.USER.ZS': 'Internet users (%)', 'IT.CEL.SETS.P2': 'Mobile subscriptions per 100 people', 'SP.URB.TOTL.IN.ZS': 'Urban population (%)', 'SP.DYN.IMRT.IN': 'Infant mortality rate',
  'SE.PRM.ENRR': 'Primary school enrollment', 'AG.YLD.CREL.KG': 'Cereal yield', 'FP.CPI.TOTL.ZG': 'Inflation rate', 'SL.UEM.TOTL.ZS': 'Unemployment rate',
  'NE.EXP.GNFS.ZS': 'Exports (% of GDP)', 'NE.IMP.GNFS.ZS': 'Imports (% of GDP)', 'NY.GDP.MKTP.KD.ZG': 'GDP growth rate', 'SP.DYN.TFRT.IN': 'Fertility rate',
  'SH.XPD.CHEX.GD.ZS': 'Health spending (% of GDP)', 'EG.USE.ELEC.KH.PC': 'Electricity use per capita', 'AG.LND.FRST.ZS': 'Forest area (%)', 'SP.POP.65UP.TO.ZS': 'Population aged 65+ (%)',
  'SL.TLF.CACT.ZS': 'Labor force participation', 'BX.KLT.DINV.WD.GD.ZS': 'Foreign direct investment (% of GDP)', 'NE.GDI.TOTL.ZS': 'Capital formation (% of GDP)', 'FS.AST.PRVT.GD.ZS': 'Private credit (% of GDP)',
  'SP.DYN.CDRT.IN': 'Crude death rate', 'SH.STA.MMRT': 'Maternal mortality ratio', 'NY.GNS.ICTR.ZS': 'Gross savings rate', 'GC.DOD.TOTL.GD.ZS': 'Government debt (% of GDP)',
  'AG.PRD.FOOD.XD': 'Food production index', 'EG.FEC.RNEW.ZS': 'Renewable energy share',
};
if (process.argv[1].endsWith('fetch.mjs')) {
  for (const id of Object.keys(IND)) {
    const f = `raw/${id}.json`;
    if (fs.existsSync(f)) continue;
    const r = await fetch(`https://api.worldbank.org/v2/country/all/indicator/${id}?format=json&per_page=20000&date=2000:2022`, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
    fs.writeFileSync(f, await r.text());
    console.log(id, r.status);
    await new Promise((r) => setTimeout(r, 800));
  }
}
