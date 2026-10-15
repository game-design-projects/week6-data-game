// raw NVD pages (build/raw/p-*.json, see fetch.mjs) -> ../data.json (balanced pool of redacted CVE descriptions)
// Run from anywhere: node games/075-cvss/build/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactDesc, cleanDesc } from './redact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// id: [中文名, English name, group, 一句话特征]
export const CWES = {
  'CWE-79': ['跨站脚本 XSS', 'Cross-site Scripting', 'inj', '页面把用户输入当成 HTML/JS 输出，常见于 Web 应用、插件的参数与表单；多需要受害者点开链接，所以 UI:R、分数偏中等。'],
  'CWE-89': ['SQL 注入', 'SQL Injection', 'inj', '参数被拼进数据库查询，几乎总是网络可达；未认证的 SQL 注入常拿到 9.8，要登录的则降到 8.8 左右。'],
  'CWE-22': ['路径遍历', 'Path Traversal', 'file', '用 ../ 之类跳出目录读写任意文件；以“读取”为主时机密性高、完整性无，分数多在 7.5 上下。'],
  'CWE-78': ['OS 命令注入', 'OS Command Injection', 'inj', '输入被拼进系统命令，常见于路由器、IoT 设备的管理接口；机密/完整/可用性三项全高。'],
  'CWE-352': ['跨站请求伪造 CSRF', 'Cross-Site Request Forgery', 'web', '诱使已登录用户的浏览器发出请求；因为要受害者操作，向量里几乎一定有 UI:R。'],
  'CWE-787': ['越界写入', 'Out-of-bounds Write', 'mem', '写到缓冲区之外，常见于 C/C++ 解析器与驱动；多为本地或需要打开恶意文件，影响三项全高。'],
  'CWE-125': ['越界读取', 'Out-of-bounds Read', 'mem', '读到缓冲区之外，主要伤机密性，或导致崩溃；完整性通常为无，分数偏低。'],
  'CWE-416': ['释放后使用', 'Use After Free', 'mem', '内存释放后仍被使用，浏览器、内核、媒体解析器里常见；多为本地/需用户操作，三项影响高。'],
  'CWE-476': ['空指针解引用', 'NULL Pointer Dereference', 'mem', '程序访问空指针而崩溃，影响基本只有可用性（A:H），机密/完整为无，分数通常 5.5–7.5。'],
  'CWE-862': ['缺少授权', 'Missing Authorization', 'acc', 'WordPress 插件的典型问题：功能没检查调用者权限；常见 PR:L 或 PR:N，影响多为低/中。'],
  'CWE-918': ['服务端请求伪造 SSRF', 'Server-Side Request Forgery', 'web', '让服务器替攻击者去访问内网或任意地址；常见 S:C（影响范围扩散），分数多在 5–9。'],
  'CWE-434': ['危险文件上传', 'Unrestricted File Upload', 'file', '上传可执行文件（如 WebShell）就能控制服务器；需要登录时 8.8，不需要时 9.8。'],
  'CWE-502': ['不可信数据反序列化', 'Deserialization of Untrusted Data', 'file', '反序列化恶意对象触发代码执行，Java/PHP/Python 应用里常见；多为 9.8 或 8.1（复杂度高）。'],
  'CWE-287': ['身份认证不当', 'Improper Authentication', 'acc', '认证逻辑可被绕过，攻击者无需凭据就能登录；PR:N + 三项高 = 9.8 或 9.1。'],
  'CWE-94': ['代码注入', 'Code Injection', 'inj', '输入被当成代码执行（eval、模板、脚本引擎）；多为 8.8–9.8。'],
  'CWE-200': ['敏感信息泄露', 'Exposure of Sensitive Information', 'res', '把不该给的数据给了不该看的人，只伤机密性：C:H/I:N/A:N 就是 7.5，C:L 就是 5.3。'],
  'CWE-120': ['经典缓冲区溢出', 'Classic Buffer Overflow', 'mem', '不检查长度直接拷贝（strcpy/memcpy），常见于路由器固件；网络可达时是 9.8，本地则降到 7.8。'],
  'CWE-400': ['资源消耗失控', 'Uncontrolled Resource Consumption', 'res', '请求能耗尽 CPU/内存/磁盘，只影响可用性：A:H 单项就是 7.5。'],
  'CWE-611': ['XXE 外部实体', 'XML External Entity', 'file', 'XML 解析器加载外部实体，读本地文件或发 SSRF；机密性高居多。'],
  'CWE-601': ['开放重定向', 'Open Redirect', 'web', '站点把用户跳转到攻击者指定的地址，用于钓鱼；影响小，需用户点击，分数多在 4–6。'],
  'CWE-798': ['硬编码凭据', 'Hard-coded Credentials', 'acc', '固件/软件里写死账号密码，任何人都能用；网络可达、无需权限，9.8 常见。'],
  'CWE-190': ['整数溢出', 'Integer Overflow', 'mem', '整数运算回绕后得出错误的大小，进而引发内存破坏；分数跨度大，取决于是否可远程。'],
  'CWE-77': ['命令注入', 'Command Injection', 'inj', '输入被拼进命令；与 CWE-78 很像，区别在于不一定是操作系统命令。'],
  'CWE-639': ['越权访问对象 IDOR', 'Authorization Bypass via User-Controlled Key', 'acc', '改一个 ID 参数就能看到别人的数据；需要登录（PR:L），多为 6.5 或 8.1。'],
};
const GROUPS = { inj: '注入类', mem: '内存安全类', acc: '访问控制与认证类', web: 'Web 请求与跳转类', file: '文件与数据解析类', res: '信息泄露与资源耗尽类' };

const files = fs.readdirSync(path.join(here, 'raw')).filter((f) => f.startsWith('p-')).sort();
if (!files.length) throw new Error('no raw pages; run fetch.mjs first');
const byCwe = {}; const seen = new Set(); let total = 0;
const stats = { noV31: 0, cwe: 0, desc: 0, redact: 0 };
for (const f of files) for (const v of JSON.parse(fs.readFileSync(path.join(here, 'raw', f))).vulnerabilities) {
  const c = v.cve; if (seen.has(c.id)) continue; seen.add(c.id); total++;
  const ms = c.metrics?.cvssMetricV31 || [];
  const m = ms.find((x) => x.type === 'Primary') || ms[0]; if (!m) { stats.noV31++; continue; }
  const all = [...new Set((c.weaknesses || []).flatMap((w) => w.description).map((d) => d.value).filter((x) => x.startsWith('CWE-')))];
  if (all.length !== 1 || !CWES[all[0]]) { stats.cwe++; continue; }
  const cwe = all[0];
  const d = c.descriptions.find((x) => x.lang === 'en')?.value;
  if (!d || d.length < 70 || d.length > 460 || /\*\*\s*(DISPUTED|REJECT)/.test(d)) { stats.desc++; continue; }
  const names = new Set();
  for (const cfg of c.configurations || []) for (const n of cfg.nodes) for (const cm of n.cpeMatch || []) {
    const p = cm.criteria.split(':');
    for (const k of [p[3], p[4]]) if (k && k.length > 2 && k !== '*' && k !== '-') { names.add(k.replace(/_/g, ' ')); names.add(k.replace(/_/g, '-')); names.add(k); }
  }
  for (const a of c.affected || []) for (const ad of a.affectedData || []) for (const k of [ad.vendor, ad.product]) if (k && k.length > 2 && !/^n\/a$/i.test(k)) names.add(k);
  if (!names.size && !/^(A|An|In|The|Improper|Missing)\b/.test(d)) { stats.redact++; continue; }
  const red = redactDesc(d, names, cwe);
  if (!red) { stats.redact++; continue; }
  const cd = m.cvssData;
  (byCwe[cwe] ||= []).push({ id: c.id, cwe, desc: red, orig: cleanDesc(d), score: cd.baseScore, vec: cd.vectorString.replace('CVSS:3.1/', ''), pub: c.published.slice(0, 10) });
}
console.log('read', total, 'unique CVEs; dropped', stats);

// up to PER_CWE per weakness: prefer descriptions that literally named the weakness (now masked), at most 2 formulaic VulDB texts,
// then spread over the score range (sorted by score, evenly spaced) so every CWE shows easy and hard cases.
const PER_CWE = 6; const MAX_VULDB = 2; const pool = [];
for (const [k, all] of Object.entries(byCwe)) {
  console.log(k, all.length);
  if (all.length < 4) continue;
  let v = all.filter((x) => x.desc.includes('◆◆◆'));
  if (v.length < 4) v = all;
  v.sort((a, b) => (a.id < b.id ? -1 : 1));
  let nv = 0; v = v.filter((x) => !/VDB-/.test(x.desc) || nv++ < MAX_VULDB);
  v.sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1));
  const n = Math.min(PER_CWE, v.length);
  const idx = new Set(); for (let i = 0; i < n; i++) idx.add(Math.round((i * (v.length - 1)) / Math.max(1, n - 1)));
  pool.push(...[...idx].map((i) => v[i]));
}
pool.sort((a, b) => (a.id < b.id ? -1 : 1));
const cwes = Object.fromEntries(Object.entries(CWES).map(([k, [zh, en, grp, tip]]) => [k, { zh, en, grp, tip }]));
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify({ groups: GROUPS, cwes, puzzles: pool }));
console.log('pool', pool.length, fs.statSync(path.join(here, '..', 'data.json')).size, 'bytes');
