// raw GitHub issue search results -> data.json (stack traces + detected language/library)
import fs from 'node:fs'; import path from 'node:path';
const raw = path.join(import.meta.dirname, 'raw');
const LANGS = {
  python: { name: 'Python', re: /Traceback \(most recent call last\):[\s\S]*?\n\s+File "[^"]+", line \d+/ },
  java: { name: 'Java', re: /\n\s+at [\w$.]+\([\w$]+\.java:\d+\)/ },
  kotlin: { name: 'Kotlin', re: /\n\s+at [\w$.]+\([\w$]+\.kt:\d+\)/ },
  go: { name: 'Go', re: /goroutine \d+ \[[\w ,]+\]:[\s\S]*?\.go:\d+/ },
  rust: { name: 'Rust', re: /panicked at [^\n]*\.rs:\d+|\n\s+\d+: [\w:<>{}]+\n\s+at [^\n]*\.rs:\d+/ },
  csharp: { name: 'C#', re: /\n\s+at [\w.`<>+]+\([^)]*\) in [^\n]*\.cs:line \d+/ },
  ruby: { name: 'Ruby', re: /\n[^\n]*\.rb:\d+:in [`'][^\n]+/ },
  php: { name: 'PHP', re: /\n#0 [^\n]*\.php\(\d+\)/ },
  js: { name: 'JavaScript / TypeScript', re: /\n\s+at (?:[\w$.<>\[\] ]+ )?\(?(?:file:\/\/|\/|[A-Za-z]:\\|node:)[^\n]*:\d+:\d+\)?/ },
};
// library/framework signatures: [label, language, regex tested on the trace]
const LIBS = [
  ['Django', 'python', /django[\/.]/i], ['Flask', 'python', /flask[\/.]/i], ['NumPy', 'python', /numpy[\/.]/i], ['pandas', 'python', /pandas[\/.]/i],
  ['PyTorch', 'python', /torch[\/.]/], ['TensorFlow', 'python', /tensorflow[\/.]/], ['requests', 'python', /site-packages\/requests\//], ['FastAPI', 'python', /fastapi[\/.]/i],
  ['SQLAlchemy', 'python', /sqlalchemy[\/.]/i], ['asyncio', 'python', /asyncio\//], ['pytest', 'python', /_pytest\/|pytest\//], ['Transformers', 'python', /transformers\//],
  ['Spring', 'java', /org\.springframework\./], ['Hibernate', 'java', /org\.hibernate\./], ['Netty', 'java', /io\.netty\./], ['Apache Tomcat', 'java', /org\.apache\.(tomcat|catalina|coyote)\./],
  ['Jackson', 'java', /com\.fasterxml\.jackson\./], ['JUnit', 'java', /org\.junit\./], ['Apache Spark', 'java', /org\.apache\.spark\./], ['Apache Kafka', 'java', /org\.apache\.kafka\./], ['Android', 'java', /(android\.|androidx\.)/], ['Elasticsearch', 'java', /org\.elasticsearch\./],
  ['kotlinx.coroutines', 'kotlin', /kotlinx\.coroutines/], ['Android', 'kotlin', /(android\.|androidx\.)/], ['Ktor', 'kotlin', /io\.ktor\./], ['Compose', 'kotlin', /androidx\.compose/],
  ['Express', 'js', /node_modules\/express\//], ['webpack', 'js', /node_modules\/webpack/], ['Jest', 'js', /node_modules\/(jest|@jest)/], ['React', 'js', /node_modules\/react(-dom)?\//],
  ['Next.js', 'js', /node_modules\/next\//], ['Vite', 'js', /node_modules\/vite\//], ['Electron', 'js', /electron|app\.asar/i], ['Mongoose / MongoDB', 'js', /node_modules\/(mongoose|mongodb)\//],
  ['Babel', 'js', /node_modules\/@?babel/], ['Vue', 'js', /node_modules\/(vue|@vue)\//], ['TypeScript', 'js', /node_modules\/typescript\//], ['Angular', 'js', /node_modules\/@angular\//], ['ESLint', 'js', /node_modules\/eslint/],
  ['gRPC', 'go', /google\.golang\.org\/grpc/], ['Gin', 'go', /gin-gonic\/gin/], ['Kubernetes', 'go', /k8s\.io\//], ['net/http', 'go', /net\/http\//], ['Docker / containerd', 'go', /(moby|containerd)\//],
  ['Tokio', 'rust', /\btokio\b/], ['Rayon', 'rust', /\brayon\b/], ['Bevy', 'rust', /\bbevy\b/], ['Serde', 'rust', /\bserde\b/], ['wgpu', 'rust', /\bwgpu\b/], ['Tauri', 'rust', /\btauri\b/],
  ['ASP.NET Core', 'csharp', /Microsoft\.AspNetCore/], ['Entity Framework', 'csharp', /Microsoft\.EntityFrameworkCore/], ['Unity', 'csharp', /UnityEngine|UnityEditor/], ['Xamarin / MAUI', 'csharp', /Xamarin|Microsoft\.Maui/], ['Avalonia', 'csharp', /Avalonia/], 
  ['Rails', 'ruby', /(actionpack|activerecord|railties|actionview|activesupport)/], ['Rack', 'ruby', /rack-[\d.]+/], ['Puma', 'ruby', /puma-/], ['RSpec', 'ruby', /rspec/], ['Sidekiq', 'ruby', /sidekiq/], 
  ['Laravel', 'php', /Illuminate\\|laravel\/(framework|lumen)/i], ['Yii', 'php', /yiisoft\/|yii\\/i], ['Craft CMS', 'php', /craftcms\//i], ['Symfony', 'php', /Symfony\\|symfony\//], ['WordPress', 'php', /wp-includes|wp-content/], ['Doctrine', 'php', /Doctrine/], ['PHPUnit', 'php', /PHPUnit/],
];

// Issues written in Chinese: show an English title / log line instead (keyed by GitHub issue id).
const EN_FIX = {
  3326812440: { title: '[Bug] Ubuntu crash on launch' },
  5843342323: { title: 'Update check failed: Error: tunneling socket could not be established, cause=connect ECONNREFUSED 127.0.0.1:31181', trace: [['\u68c0\u67e5\u66f4\u65b0\u5931\u8d25', 'Update check failed'] /* "check update failed" in Chinese */] },
};
const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
const seen = new Set(); const seenTrace = new Set(); const out = [];
const fences = (b) => [...b.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
const clip = (l, n) => (l.trim().length > n ? l.trim().slice(0, n) + '…' : l.trim());
const detectLang = (txt) => Object.entries(LANGS).filter(([, l]) => l.re.test('\n' + txt)).map(([k]) => k);
// shorten long traces to <= 18 lines: head 11 + "…" + tail 6
const shorten = (lines) => (lines.length <= 18 ? lines : [...lines.slice(0, 11), '    ...', ...lines.slice(-6)]);
for (const f of fs.readdirSync(raw).filter((x) => x.endsWith('.json')).sort()) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8')); } catch { continue; }
  for (const it of j.items ?? []) {
    if (seen.has(it.id) || it.pull_request) continue; seen.add(it.id);
    const repo = it.repository_url.split('/repos/')[1];
    for (const blk of fences(it.body || '')) {
      const lines = blk.replace(/\r/g, '').split('\n');
      if (lines.length < 6 || lines.length > 200) continue;
      const hits = detectLang(blk);
      if (!hits.length) continue;
      let lang = hits[0];
      if (hits.includes('java') && hits.includes('kotlin')) lang = 'kotlin';
      if (hits.length > 2 || (hits.length === 2 && !(hits.includes('java') && hits.includes('kotlin')))) continue; // ambiguous
      let trace = shorten(lines.map((l) => l.slice(0, 200).trimEnd())).join('\n').trim();
      for (const [a, b] of EN_FIX[it.id]?.trace || []) trace = trace.split(a).join(b);
      // re-detect on the shortened text so that the clue is still visible to the player
      const h2 = detectLang(trace);
      if (!h2.includes(lang) || (h2.length > 1 && !(h2.includes('java') && h2.includes('kotlin')))) continue;
      if (lang === 'java' && h2.includes('kotlin')) continue;
      const libs = [...new Set(LIBS.filter(([, l, r]) => (l === lang || (lang === 'kotlin' && l === 'java')) && r.test(trace)).map(([n]) => n))];
      if (!libs.length || seenTrace.has(trace)) continue;
      seenTrace.add(trace);
      const tl = trace.split('\n');
      const lm = ('\n' + trace).match(LANGS[lang].re);
      const langHint = clip(lm[0].split('\n').filter((x) => x.trim()).pop(), 110);
      const libRe = LIBS.find(([n, l]) => n === libs[0] && (l === lang || (lang === 'kotlin' && l === 'java')))[2];
      const libHint = clip(tl.find((l) => libRe.test(l)) || '', 110);
      if (!libHint) continue;
      out.push({ id: it.id, repo, n: it.number, title: (EN_FIX[it.id]?.title ?? it.title).slice(0, 100), lang, libs, langHint, libHint, trace });
      break;
    }
  }
}
// cap per language + library, and per repo, to keep variety
const cnt = {}; const rc = {}; const keep = [];
for (const t of out.sort((a, b) => a.id - b.id)) {
  const k = t.lang + ':' + t.libs[0]; cnt[k] = (cnt[k] || 0) + 1; rc[t.repo] = (rc[t.repo] || 0) + 1;
  if (cnt[k] <= 6 && rc[t.repo] <= 3) keep.push(t);
}
for (const t of keep) if (CJK.test(JSON.stringify(t))) throw new Error('Chinese text left in trace ' + t.id + ' (add it to EN_FIX)');
const langNames = Object.fromEntries(Object.entries(LANGS).map(([k, v]) => [k, v.name]));
const libsByLang = {};
for (const [n, l] of LIBS) (libsByLang[l] ||= []).push(n);
libsByLang.kotlin = [...new Set([...libsByLang.kotlin, ...libsByLang.java])];
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ fetched: '2026-10-14', langNames, libsByLang, traces: keep }));
const byLang = {}; keep.forEach((t) => (byLang[t.lang] = (byLang[t.lang] || 0) + 1));
console.log(keep.length, byLang, fs.statSync(path.join(import.meta.dirname, '..', 'data.json')).size);
