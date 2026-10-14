import fs from 'node:fs';
export function parse(dir='raw'){
  const states={};
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.txt'))){
    const st=f.slice(0,-4); const qs={}; let cur=null;
    for(const line of fs.readFileSync(`${dir}/${f}`,'utf8').split(/\r?\n/)){
      let m;
      if((m=line.match(/^(\d+)\.\s+(.*)$/))){cur={n:+m[1],q:m[2].trim(),opts:[]};qs[cur.n]=cur;}
      else if(cur&&(m=line.match(/^([a-z])\.\s+(.*?)\s*\((\d+(?:\.\d+)?)%\)\s*$/))){cur.opts.push({k:m[1],t:m[2].trim(),p:+m[3]/100});}
    }
    states[st]=qs;
  }
  return states;
}
if(process.argv[1].endsWith('parse.mjs')){const s=parse();const ca=s.CA;console.log(Object.keys(ca).length);
for(const n in ca){const q=ca[n];const lex=q.opts.every(o=>!/\[|\/|"[^"]*" \(|as in/.test(o.t));if(lex)console.log(n,q.q,'|',q.opts.map(o=>o.k+':'+o.t.slice(0,40)).join(' ; '));}}
