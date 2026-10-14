import fs from 'node:fs'; import companies from './companies.mjs';
const UA='daily-data-games/0.1 (NYU class project)';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
for (const [d] of [...companies].reverse()) {
  const f=`raw/${d}.json`; if (fs.existsSync(f)) continue;
  for (let i=0;i<2;i++){
    try{
      const r=await fetch(`https://crt.sh/?q=${encodeURIComponent('%.'+d)}&output=json&exclude=expired`,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(60000)});
      if(r.ok){const t=await r.text(); JSON.parse(t); fs.writeFileSync(f,t); console.log(d,t.length); break;}
      console.log(d,'HTTP',r.status);
    }catch(e){console.log(d,'err',e.message)}
    await sleep(4000);
  }
  await sleep(3000);
}
