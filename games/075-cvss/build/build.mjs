// raw NVD pages (build/raw/p-*.json, see fetch.mjs) -> ../data.json (balanced pool of redacted CVE descriptions)
// Run from anywhere: node games/075-cvss/build/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactDesc, cleanDesc } from './redact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// id: [English name, group, one-line tip, aliases]
export const CWES = {
  'CWE-79': ['Cross-site Scripting (XSS)', 'Cross-site Scripting', 'inj', 'The page outputs user input as HTML/JS. Common in web apps and plugins (parameters, forms). The victim usually has to open a link, so UI:R and a middling score.', ['XSS']],
  'CWE-89': ['SQL Injection', 'SQL Injection', 'inj', 'A parameter is spliced into a database query. Almost always reachable over the network: unauthenticated SQL injection often scores 9.8, one that needs a login drops to about 8.8.', ['SQLi']],
  'CWE-22': ['Path Traversal', 'Path Traversal', 'file', 'Uses ../ and friends to escape a directory and read or write arbitrary files. When it is mostly a read, confidentiality is high and integrity none, so scores sit around 7.5.', ['directory traversal']],
  'CWE-78': ['OS Command Injection', 'OS Command Injection', 'inj', 'Input is spliced into a system command. Common in router and IoT admin interfaces; confidentiality, integrity and availability are all high.', ['shell injection']],
  'CWE-352': ['Cross-Site Request Forgery (CSRF)', 'Cross-Site Request Forgery', 'web', 'Tricks a logged-in user\'s browser into sending a request. The victim has to act, so the vector almost always has UI:R.', ['CSRF']],
  'CWE-787': ['Out-of-bounds Write', 'Out-of-bounds Write', 'mem', 'Writes past the end of a buffer. Common in C/C++ parsers and drivers; usually local or needs a malicious file, with all three impacts high.', ['OOB write']],
  'CWE-125': ['Out-of-bounds Read', 'Out-of-bounds Read', 'mem', 'Reads past the end of a buffer. Mostly hurts confidentiality or causes a crash; integrity is usually none, so scores run lower.', ['OOB read']],
  'CWE-416': ['Use After Free', 'Use After Free', 'mem', 'Memory is used after being freed. Common in browsers, kernels and media parsers; usually local or needs user action, with all three impacts high.', ['UAF']],
  'CWE-476': ['NULL Pointer Dereference', 'NULL Pointer Dereference', 'mem', 'The program touches a null pointer and crashes. Impact is basically availability only (A:H), with confidentiality and integrity none, so scores are usually 5.5-7.5.', ['null pointer', 'NPD']],
  'CWE-862': ['Missing Authorization', 'Missing Authorization', 'acc', 'A classic WordPress plugin bug: a function never checks the caller\'s permissions. Usually PR:L or PR:N, with low to medium impact.', ['broken access control']],
  'CWE-918': ['Server-Side Request Forgery (SSRF)', 'Server-Side Request Forgery', 'web', 'Makes the server fetch internal or arbitrary addresses for the attacker. Often S:C (scope changed), with scores mostly 5-9.', ['SSRF']],
  'CWE-434': ['Unrestricted File Upload', 'Unrestricted File Upload', 'file', 'Uploading an executable file (such as a web shell) hands over the server: 8.8 if a login is needed, 9.8 if not.', ['file upload']],
  'CWE-502': ['Deserialization of Untrusted Data', 'Deserialization of Untrusted Data', 'file', 'Deserializing a malicious object triggers code execution. Common in Java, PHP and Python apps; usually 9.8, or 8.1 when complexity is high.', ['insecure deserialization']],
  'CWE-287': ['Improper Authentication', 'Improper Authentication', 'acc', 'The authentication logic can be bypassed, so attackers log in without credentials. PR:N plus three highs gives 9.8 or 9.1.', ['authentication bypass']],
  'CWE-94': ['Code Injection', 'Code Injection', 'inj', 'Input is executed as code (eval, templates, script engines). Mostly 8.8-9.8.', ['RCE']],
  'CWE-200': ['Exposure of Sensitive Information', 'Exposure of Sensitive Information', 'res', 'Data goes to people who should not see it, which only hurts confidentiality: C:H/I:N/A:N is 7.5, C:L is 5.3.', ['information disclosure', 'info leak']],
  'CWE-120': ['Classic Buffer Overflow', 'Classic Buffer Overflow', 'mem', 'Copies without checking length (strcpy/memcpy). Common in router firmware; 9.8 when reachable over the network, 7.8 when local.', ['buffer overflow']],
  'CWE-400': ['Uncontrolled Resource Consumption', 'Uncontrolled Resource Consumption', 'res', 'A request can exhaust CPU, memory or disk and only affects availability: A:H alone is 7.5.', ['resource exhaustion', 'DoS']],
  'CWE-611': ['XML External Entity (XXE)', 'XML External Entity', 'file', 'The XML parser loads external entities, reading local files or issuing SSRF. Confidentiality is mostly high.', ['XXE']],
  'CWE-601': ['Open Redirect', 'Open Redirect', 'web', 'A site sends users to an attacker-chosen address, used for phishing. Low impact and needs a click, so scores are mostly 4-6.', ['URL redirection']],
  'CWE-798': ['Hard-coded Credentials', 'Hard-coded Credentials', 'acc', 'A username and password baked into firmware or software that anyone can use. Network reachable with no privileges required, 9.8 is common.', ['hardcoded password']],
  'CWE-190': ['Integer Overflow', 'Integer Overflow', 'mem', 'Integer arithmetic wraps around and yields a wrong size, leading to memory corruption. Scores vary widely, depending on whether it is remote.', ['integer wraparound']],
  'CWE-77': ['Command Injection', 'Command Injection', 'inj', 'Input is spliced into a command. Very close to CWE-78; the difference is that it need not be an operating system command.', ['argument injection']],
  'CWE-639': ['IDOR (User-Controlled Key)', 'Authorization Bypass via User-Controlled Key', 'acc', 'Change one ID parameter and see someone else\'s data. Needs a login (PR:L), mostly 6.5 or 8.1.', ['IDOR', 'insecure direct object reference']],
};
const GROUPS = { inj: 'Injection', mem: 'Memory safety', acc: 'Access control', web: 'Web requests', file: 'Files & parsing', res: 'Leaks & DoS' };

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
const cwes = Object.fromEntries(Object.entries(CWES).map(([k, [label, en, grp, tip, alias]]) => [k, { label, en, grp, tip, alias }]));
fs.writeFileSync(path.join(here, '..', 'data.json'), JSON.stringify({ groups: GROUPS, cwes, puzzles: pool }));
console.log('pool', pool.length, fs.statSync(path.join(here, '..', 'data.json')).size, 'bytes');
