// raw NVD pages -> ../data.json (balanced pool of redacted CVE descriptions)
import fs from 'node:fs';
const CWES = {
 'CWE-79':['跨站脚本 XSS','Cross-site Scripting'],'CWE-89':['SQL 注入','SQL Injection'],'CWE-22':['路径遍历','Path Traversal'],
 'CWE-78':['OS 命令注入','OS Command Injection'],'CWE-352':['跨站请求伪造 CSRF','Cross-Site Request Forgery'],
 'CWE-787':['越界写入','Out-of-bounds Write'],'CWE-125':['越界读取','Out-of-bounds Read'],'CWE-416':['释放后使用','Use After Free'],
 'CWE-476':['空指针解引用','NULL Pointer Dereference'],'CWE-862':['缺少授权','Missing Authorization'],'CWE-918':['服务端请求伪造 SSRF','Server-Side Request Forgery'],
 'CWE-434':['危险文件上传','Unrestricted File Upload'],'CWE-502':['不可信数据反序列化','Deserialization of Untrusted Data'],
 'CWE-287':['身份认证不当','Improper Authentication'],'CWE-94':['代码注入','Code Injection'],'CWE-200':['敏感信息泄露','Exposure of Sensitive Information'],
 'CWE-120':['经典缓冲区溢出','Classic Buffer Overflow'],'CWE-400':['资源消耗失控','Uncontrolled Resource Consumption'],
 'CWE-611':['XXE 外部实体','XML External Entity'],'CWE-601':['开放重定向','Open Redirect'],'CWE-798':['硬编码凭据','Hard-coded Credentials'],
 'CWE-190':['整数溢出','Integer Overflow'],'CWE-77':['命令注入','Command Injection'],'CWE-639':['越权访问对象 IDOR','Authorization Bypass via User-Controlled Key'],
};
const ALIAS = {'CWE-79':['cross[- ]site scripting','XSS'],'CWE-89':['SQL injection','SQLi'],'CWE-22':['path traversal','directory traversal'],'CWE-78':['OS command injection','command injection'],'CWE-352':['cross[- ]site request forgery','CSRF'],'CWE-787':['out[- ]of[- ]bounds write'],'CWE-125':['out[- ]of[- ]bounds read'],'CWE-416':['use[- ]after[- ]free'],'CWE-476':['NULL pointer dereference','null pointer dereference'],'CWE-862':['missing authorization'],'CWE-918':['server[- ]side request forgery','SSRF'],'CWE-434':['unrestricted upload','file upload'],'CWE-502':['deserialization of untrusted data'],'CWE-287':['improper authentication'],'CWE-94':['code injection','improper control of generation of code'],'CWE-120':['buffer overflow','buffer copy without checking size of input'],'CWE-400':['uncontrolled resource consumption'],'CWE-611':['XXE'],'CWE-601':['open redirect'],'CWE-798':['hard-?coded credentials'],'CWE-190':['integer overflow'],'CWE-77':['command injection'],'CWE-639':['insecure direct object reference','IDOR']};
const files = fs.readdirSync('raw').filter(f=>f.startsWith('nvd-'));
const byCwe = {}; const seen = new Set();
for (const f of files) for (const v of JSON.parse(fs.readFileSync('raw/'+f))) {
  const c = v.cve; if (seen.has(c.id)) continue; seen.add(c.id);
  const m = (c.metrics?.cvssMetricV31||[]).find(x=>x.type==='Primary') || c.metrics?.cvssMetricV31?.[0]; if(!m) continue;
  const cw = (c.weaknesses||[]).flatMap(w=>w.description).map(d=>d.value).filter(x=>CWES[x]);
  const all = (c.weaknesses||[]).flatMap(w=>w.description).map(d=>d.value);
  if (cw.length!==1 || new Set(all.filter(x=>x.startsWith('CWE-'))).size!==1) continue;
  let d = c.descriptions.find(x=>x.lang==='en')?.value?.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'); if(!d||d.length<70||d.length>420||/\*\*\s*(DISPUTED|REJECT)/.test(d)) continue;
  const names = new Set();
  for (const cfg of c.configurations||[]) for (const n of cfg.nodes) for (const cm of n.cpeMatch||[]) { const p = cm.criteria.split(':'); for (const k of [p[3],p[4]]) if (k&&k.length>2&&k!=='*') { names.add(k.replace(/_/g,' ')); names.add(k.replace(/_/g,'-')); names.add(k); } }
  for (const a of c.affected||[]) for (const ad of a.affectedData||[]) for (const k of [ad.vendor,ad.product]) if(k&&k.length>2&&!/^n\/a$/i.test(k)) names.add(k);
  let red = d, hit = 0;
  for (const n of [...names].sort((a,b)=>b.length-a.length)) { const re = new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'); if (re.test(red)) { hit++; red = red.replace(re,'▇▇▇'); } }
  red = red.replace(/CVE-\d+-\d+/g,'▇▇▇').replace(/CWE-\d+/g,'▇▇▇');
  if (!names.size && !/^(A|An|In|The|Improper|Missing)\b/.test(red)) continue;
  const en = CWES[cw[0]][1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const extra = (ALIAS[cw[0]]||[]).join('|');
  red = red.replace(new RegExp('\\b('+en+(extra?'|'+extra:'')+')\\b','gi'),'◆◆◆').replace(/VDB-\d+/g,'VDB-▇▇▇');
  if ((red.match(/▇▇▇/g)||[]).length>4) continue;
  const cd = m.cvssData;
  (byCwe[cw[0]] ||= []).push({ id:c.id, cwe:cw[0], desc:red, score:cd.baseScore, sev:cd.baseSeverity, vec:cd.vectorString.replace('CVSS:3.1/',''), pub:c.published.slice(0,10) });
}
const pool = [];
for (const [k,v] of Object.entries(byCwe)) { console.log(k, v.length); }
for (const [k,v] of Object.entries(byCwe)) { if (v.length<4) continue; v.sort((a,b)=>a.id<b.id?-1:1); const step=Math.max(1,Math.floor(v.length/6)); pool.push(...v.filter((_,i)=>i%step===0).slice(0,6)); }
pool.sort((a,b)=>a.id<b.id?-1:1);
const cwes = Object.fromEntries(Object.entries(CWES).map(([k,[zh,en]])=>[k,{zh,en}]));
fs.writeFileSync('../data.json', JSON.stringify({ cwes, puzzles: pool }));
console.log('pool', pool.length, fs.statSync('../data.json').size);
