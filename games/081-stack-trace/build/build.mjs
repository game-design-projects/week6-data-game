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
  ['Jackson', 'java', /com\.fasterxml\.jackson\./], ['JUnit', 'java', /org\.junit\./], ['Apache Spark', 'java', /org\.apache\.spark\./], ['Apache Kafka', 'java', /org\.apache\.kafka\./], ['Android', 'java', /(android\.|androidx\.)/], ['Gradle', 'java', /org\.gradle\./], ['Elasticsearch', 'java', /org\.elasticsearch\./],
  ['Kotlin 协程', 'kotlin', /kotlinx\.coroutines/], ['Android', 'kotlin', /(android\.|androidx\.)/], ['Ktor', 'kotlin', /io\.ktor\./], ['Compose', 'kotlin', /androidx\.compose/],
  ['Express', 'js', /node_modules\/express\//], ['webpack', 'js', /node_modules\/webpack/], ['Jest', 'js', /node_modules\/(jest|@jest)/], ['React', 'js', /node_modules\/react(-dom)?\//],
  ['Next.js', 'js', /node_modules\/next\//], ['Vite', 'js', /node_modules\/vite\//], ['Electron', 'js', /electron|app\.asar/i], ['Mongoose / MongoDB', 'js', /node_modules\/(mongoose|mongodb)\//],
  ['Babel', 'js', /node_modules\/@?babel/], ['Vue', 'js', /node_modules\/(vue|@vue)\//], ['TypeScript', 'js', /node_modules\/typescript\//], ['Angular', 'js', /node_modules\/@angular\//], ['ESLint', 'js', /node_modules\/eslint/],
  ['gRPC', 'go', /google\.golang\.org\/grpc/], ['Gin', 'go', /gin-gonic\/gin/], ['Kubernetes', 'go', /k8s\.io\//], ['net/http', 'go', /net\/http\//], ['testing', 'go', /\/testing\/testing\.go/], ['Docker / containerd', 'go', /(moby|containerd)\//],
  ['Tokio', 'rust', /tokio/], ['Rayon', 'rust', /rayon/], ['Bevy', 'rust', /bevy/], ['Serde', 'rust', /serde/], ['wgpu', 'rust', /wgpu/], ['Tauri', 'rust', /tauri/],
  ['ASP.NET Core', 'csharp', /Microsoft\.AspNetCore/], ['Entity Framework', 'csharp', /Microsoft\.EntityFrameworkCore/], ['Unity', 'csharp', /UnityEngine|UnityEditor/], ['Xamarin / MAUI', 'csharp', /Xamarin|Microsoft\.Maui/], ['Avalonia', 'csharp', /Avalonia/], ['NuGet / MSBuild', 'csharp', /NuGet|MSBuild/],
  ['Rails', 'ruby', /(actionpack|activerecord|railties|actionview|activesupport)/], ['Rack', 'ruby', /rack-[\d.]+/], ['Puma', 'ruby', /puma-/], ['RSpec', 'ruby', /rspec/], ['Sidekiq', 'ruby', /sidekiq/], ['Bundler', 'ruby', /bundler/],
  ['Laravel', 'php', /Illuminate\\|laravel\//i], ['Symfony', 'php', /Symfony\\|symfony\//], ['WordPress', 'php', /wp-includes|wp-content/], ['Composer', 'php', /composer/i], ['Doctrine', 'php', /Doctrine/], ['PHPUnit', 'php', /PHPUnit/],
];
const seen = new Set(); const out = [];
const fences = (b) => [...b.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
for (const f of fs.readdirSync(raw).filter((x) => x.endsWith('.json'))) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8')); } catch { continue; }
  for (const it of j.items ?? []) {
    if (seen.has(it.id) || it.pull_request) continue; seen.add(it.id);
    const repo = it.repository_url.split('/repos/')[1];
    for (const blk of fences(it.body || '')) {
      const lines = blk.replace(/\r/g, '').split('\n');
      if (lines.length < 6 || lines.length > 60) continue;
      const hits = Object.entries(LANGS).filter(([, l]) => l.re.test('\n' + blk)).map(([k]) => k);
      if (!hits.length) continue;
      let lang = hits[0];
      if (hits.includes('java') && hits.includes('kotlin')) lang = 'kotlin';
      if (hits.length > 2 || (hits.length === 2 && !(hits.includes('java') && hits.includes('kotlin')))) continue; // ambiguous
      const libs = [...new Set(LIBS.filter(([, l, r]) => (l === lang || (lang === 'kotlin' && l === 'java')) && r.test(blk)).map(([n]) => n))];
      if (!libs.length) continue;
      const trace = lines.map((l) => l.slice(0, 160).trimEnd()).join('\n').trim();
      if (/[一-鿿]/.test(trace.slice(0, 400)) && false) continue;
      out.push({ id: it.id, repo, n: it.number, title: it.title.slice(0, 100), lang, libs, trace });
      break;
    }
  }
}
// cap per language + library to keep variety
const cnt = {}; const keep = [];
for (const t of out.sort((a, b) => a.id - b.id)) {
  const k = t.lang + ':' + t.libs[0]; cnt[k] = (cnt[k] || 0) + 1;
  if (cnt[k] <= 5) keep.push(t);
}
const langNames = Object.fromEntries(Object.entries(LANGS).map(([k, v]) => [k, v.name]));
const libsByLang = {};
for (const [n, l] of LIBS) (libsByLang[l] ||= []).push(n);
libsByLang.kotlin = [...new Set([...libsByLang.kotlin, ...libsByLang.java])];
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ fetched: '2026-10-14', langNames, libsByLang, traces: keep }));
const byLang = {}; keep.forEach((t) => (byLang[t.lang] = (byLang[t.lang] || 0) + 1));
console.log(keep.length, byLang, fs.statSync(path.join(import.meta.dirname, '..', 'data.json')).size);
