import fs from 'node:fs';
const LANGS='de,nl,sv,da,fr,es,it,pt,ro,ru,pl,cs,el,hi,fa,ar,tr,fi,hu,sw,id,ja,zh,ko,he,vi'.split(',');
const concepts=[];
for (const f of fs.readdirSync('raw').filter(f=>f.startsWith('wd-'))) {
  const j=JSON.parse(fs.readFileSync('raw/'+f));
  for (const e of Object.values(j.entities||{})) {
    const L=e.labels||{}; const en=L.en?.value; if(!en) continue;
    if(/[(,]/.test(en)||en.split(' ').length>1||!/^[A-Za-z]+$/.test(en)) continue;
    const l={};
    for(const k of LANGS){ const v=L[k]?.value; if(v&&v.length<=16&&!/[(,]/.test(v)) l[k]=v.charAt(0).toLowerCase()+v.slice(1); }
    if(Object.keys(l).length<18) continue;
    concepts.push({q:e.id,en:en.toLowerCase(),wiki:e.sitelinks?.enwiki?.title||en,l});
  }
}
concepts.sort((a,b)=>a.en.localeCompare(b.en));
const dedup=concepts.filter((c,i)=>concepts.findIndex(d=>d.en===c.en)===i);
fs.writeFileSync('../data.json',JSON.stringify({concepts:dedup}));
console.log(dedup.length, fs.statSync('../data.json').size);
