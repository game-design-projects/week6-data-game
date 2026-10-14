import { AIRPORTS } from './airports.mjs';
const UA='daily-data-games/1.0 (class project; lishuyustevenli@gmail.com)';
for (const a of AIRPORTS){
  const t=`Category:Aircraft at ${a[1]} by operator`;
  const r=await (await fetch(`https://commons.wikimedia.org/w/api.php?format=json&action=query&list=categorymembers&cmtitle=${encodeURIComponent(t)}&cmtype=subcat&cmlimit=500`,{headers:{'User-Agent':UA}})).json();
  console.log(a[0], r.query.categorymembers.length);
  await new Promise(r=>setTimeout(r,200));
}
