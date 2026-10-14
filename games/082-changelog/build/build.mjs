import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const DISPLAY = { 'vuejs/core': 'Vue', 'home-assistant/core': 'Home Assistant', 'docker/cli': 'Docker CLI', 'moby/moby': 'Moby', 'laravel/framework': 'Laravel', 'rails/rails': 'Rails', 'facebook/react': 'React', 'microsoft/vscode': 'VS Code', 'microsoft/TypeScript': 'TypeScript', 'torvalds/linux': 'Linux', 'nodejs/node': 'Node.js', 'python/cpython': 'Python', 'golang/go': 'Go', 'rust-lang/rust': 'Rust', 'git/git': 'Git', 'vim/vim': 'Vim', 'neovim/neovim': 'Neovim', 'postgres/postgres': 'PostgreSQL', 'mongodb/mongo': 'MongoDB', 'elastic/elasticsearch': 'Elasticsearch', 'obsproject/obs-studio': 'OBS Studio', 'godotengine/godot': 'Godot', 'tensorflow/tensorflow': 'TensorFlow', 'pytorch/pytorch': 'PyTorch', 'scikit-learn/scikit-learn': 'scikit-learn', 'pandas-dev/pandas': 'pandas', 'huggingface/transformers': 'Transformers', 'tiangolo/fastapi': 'FastAPI', 'pallets/flask': 'Flask', 'spring-projects/spring-boot': 'Spring Boot', 'BurntSushi/ripgrep': 'ripgrep', 'ggerganov/llama.cpp': 'llama.cpp', 'keepassxreboot/keepassxc': 'KeePassXC', 'tailwindlabs/tailwindcss': 'Tailwind CSS', 'ohmyzsh/ohmyzsh': 'Oh My Zsh', 'oven-sh/bun': 'Bun', 'denoland/deno': 'Deno', 'obsidianmd/obsidian-releases': 'Obsidian', 'zed-industries/zed': 'Zed', 'ghostty-org/ghostty': 'Ghostty', 'astral-sh/ruff': 'Ruff', 'astral-sh/uv': 'uv', 'hashicorp/terraform': 'Terraform', 'ffmpeg/ffmpeg': 'FFmpeg', 'jestjs/jest': 'Jest' };
const disp = (r) => DISPLAY[r] || r.split('/')[1].replace(/^./, (c) => c.toUpperCase());
const LANG = { JavaScript: 'JavaScript', TypeScript: 'TypeScript', Python: 'Python', Rust: 'Rust', Go: 'Go', C: 'C', 'C++': 'C++', Java: 'Java', PHP: 'PHP', Ruby: 'Ruby', Zig: 'Zig', Svelte: 'Svelte', 'Vim Script': 'Vim script', Shell: 'Shell', 'C#': 'C#', Dart: 'Dart', Scala:'Scala', Kotlin:'Kotlin' };
function clean(body) {
  let t = (body || '').replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '').replace(/\s*\(?#\d+\)?/g, '').replace(/\s+by @[\w-]+( in)?/g, '').replace(/@[\w-]+/g, '')
    .replace(/\*\*Full Changelog\*\*.*/gi, '').replace(/\b[0-9a-f]{7,40}\b/g, '').replace(/\[[,\s]*\]/g, '').replace(/```[\s\S]*?```/g, '');
  const lines = t.split('\n').map((l) => l.trim().replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/`/g, '')).filter((l) => l && !/^[-=_*\s]+$/.test(l) && !/^(what's changed|new contributors|contributors|thanks)/i.test(l) && l.length > 8 && !/^[\[{}(\/]|[{};]$|^\/\//.test(l) && !/sha256|checksum|\.(zip|tar|dmg|exe|msi)\b/i.test(l));
  return lines;
}
const pool = [];
const repos = [];
for (const f of readdirSync('raw').filter((f) => !f.startsWith('_') && f.endsWith('.json'))) {
  const repo = f.replace('.json', '').replace('__', '/');
  let rel; try { rel = JSON.parse(readFileSync('raw/' + f, 'utf8')); } catch { continue; }
  const meta = JSON.parse(readFileSync('raw/_meta_' + f, 'utf8'));
  const cands = [];
  for (const r of rel) {
    if (r.draft || r.prerelease || !r.published_at) continue;
    const lines = clean(r.body).map((l) => (l.length > 160 ? l.slice(0, 157) + '…' : l));
    const text = lines.slice(0, 7);
    const len = text.join('').length;
    if (text.length < 3 || len < 120 || len > 700) continue;
    cands.push({ repo, tag: r.tag_name, year: +r.published_at.slice(0, 4), date: r.published_at.slice(0, 10), lines: text, url: r.html_url });
  }
  if (!cands.length) continue;
  repos.push({ id: repo, name: disp(repo), lang: LANG[meta.language] || meta.language || null, stars: meta.stargazers_count, since: +meta.created_at.slice(0, 4) });
  // pick up to 3 per repo spread over distinct years
  const byYear = new Map(); for (const c of cands) if (!byYear.has(c.year)) byYear.set(c.year, c);
  const ys = [...byYear.values()].sort((a, b) => a.year - b.year);
  const n = Math.min(3, ys.length);
  for (let i = 0; i < n; i++) pool.push(ys[Math.round((i * (ys.length - 1)) / Math.max(1, n - 1))] ?? ys[0]);
}
const seen = new Set(); const puzzles = pool.filter((p) => !seen.has(p.repo + p.tag) && seen.add(p.repo + p.tag));
writeFileSync('../data.json', JSON.stringify({ repos, puzzles, built: new Date().toISOString().slice(0, 10) }));
console.log(repos.length, 'repos', puzzles.length, 'puzzles');
