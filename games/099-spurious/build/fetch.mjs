// Download World Bank indicators for all countries, 2000-2022, into raw/.
import fs from 'node:fs';
export const IND = {
  'SP.POP.TOTL': '总人口', 'SP.DYN.LE00.IN': '预期寿命', 'NY.GDP.PCAP.CD': '人均 GDP (美元)', 'EN.GHG.CO2.PC.CE.AR5': '人均 CO2 排放',
  'IT.NET.USER.ZS': '互联网使用率', 'IT.CEL.SETS.P2': '每百人手机订阅', 'SP.URB.TOTL.IN.ZS': '城镇人口占比', 'SP.DYN.IMRT.IN': '婴儿死亡率',
  'SE.PRM.ENRR': '小学入学率', 'AG.YLD.CREL.KG': '谷物单产', 'FP.CPI.TOTL.ZG': '通胀率', 'SL.UEM.TOTL.ZS': '失业率',
  'NE.EXP.GNFS.ZS': '出口占 GDP 比', 'NE.IMP.GNFS.ZS': '进口占 GDP 比', 'NY.GDP.MKTP.KD.ZG': 'GDP 增长率', 'SP.DYN.TFRT.IN': '总和生育率',
  'SH.XPD.CHEX.GD.ZS': '卫生支出占 GDP 比', 'EG.USE.ELEC.KH.PC': '人均用电量', 'AG.LND.FRST.ZS': '森林面积占比', 'SP.POP.65UP.TO.ZS': '65 岁以上人口占比',
  'SL.TLF.CACT.ZS': '劳动参与率', 'BX.KLT.DINV.WD.GD.ZS': '外商直接投资占 GDP 比', 'NE.GDI.TOTL.ZS': '资本形成占 GDP 比', 'FS.AST.PRVT.GD.ZS': '私人信贷占 GDP 比',
  'SP.DYN.CDRT.IN': '粗死亡率', 'SH.STA.MMRT': '孕产妇死亡率', 'NY.GNS.ICTR.ZS': '总储蓄率', 'GC.DOD.TOTL.GD.ZS': '政府债务占 GDP 比',
  'AG.PRD.FOOD.XD': '粮食生产指数', 'EG.FEC.RNEW.ZS': '可再生能源占比',
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
