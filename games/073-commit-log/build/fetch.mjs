// Fetch the most recent 100 commits + repo metadata for a set of well-known repos via authenticated `gh api`.
// Raw responses are cached in build/raw/ (git-ignored). Run: node fetch.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
export const RAW = join(HERE, 'raw');
export const REPOS = ['torvalds/linux','microsoft/vscode','facebook/react','python/cpython','golang/go','rust-lang/rust','nodejs/node','kubernetes/kubernetes','tensorflow/tensorflow','pytorch/pytorch','vuejs/core','angular/angular','sveltejs/svelte','denoland/deno','django/django','pallets/flask','rails/rails','laravel/framework','home-assistant/core','ansible/ansible','godotengine/godot','neovim/neovim','git/git','redis/redis','nginx/nginx','ffmpeg/FFmpeg','curl/curl','huggingface/transformers','vercel/next.js','tailwindlabs/tailwindcss','prettier/prettier','eslint/eslint','webpack/webpack','vitejs/vite','electron/electron','flutter/flutter','apple/swift','JuliaLang/julia','numpy/numpy','pandas-dev/pandas','scikit-learn/scikit-learn','matplotlib/matplotlib','ohmyzsh/ohmyzsh','Homebrew/brew','docker/compose','hashicorp/terraform','grafana/grafana','elastic/elasticsearch','mozilla/gecko-dev','bitcoin/bitcoin','ethereum/go-ethereum','obsidianmd/obsidian-releases','astral-sh/ruff','BurntSushi/ripgrep','sharkdp/bat','junegunn/fzf','jqlang/jq','ggerganov/llama.cpp','openai/whisper',
  // added in round 2
  'tokio-rs/tokio','gin-gonic/gin','spring-projects/spring-boot','postgres/postgres','llvm/llvm-project','php/php-src','ruby/ruby','microsoft/TypeScript','facebook/react-native','axios/axios','expressjs/express','psf/requests','tiangolo/fastapi','pydantic/pydantic','yt-dlp/yt-dlp','mpv-player/mpv','obsproject/obs-studio','blender/blender','bevyengine/bevy','tauri-apps/tauri','helix-editor/helix','alacritty/alacritty','rust-lang/cargo','oven-sh/bun','JetBrains/kotlin','dotnet/runtime','apache/spark','apache/kafka','ClickHouse/ClickHouse','duckdb/duckdb','etcd-io/etcd','prometheus/prometheus','ollama/ollama','langchain-ai/langchain','vllm-project/vllm','openssl/openssl','wireshark/wireshark','systemd/systemd','vim/vim','tmux/tmux','mastodon/mastodon','discourse/discourse','jellyfin/jellyfin','WordPress/WordPress','matrix-org/synapse','nextcloud/server','qemu/qemu','gcc-mirror/gcc'];
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const key = (r) => r.replace('/', '__');
export const commitsFile = (r) => join(RAW, `${key(r)}.json`);
export const metaFile = (r) => join(RAW, `meta_${key(r)}.json`);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(RAW, { recursive: true });
  for (const r of REPOS) {
    try {
      if (!existsSync(commitsFile(r))) {
        writeFileSync(commitsFile(r), execFileSync('gh', ['api', `repos/${r}/commits?per_page=100`, '--jq', '[.[]|{m:.commit.message,d:.commit.author.date}]'], { maxBuffer: 20e6 }).toString());
        console.log('commits', r); await sleep(300);
      }
      if (!existsSync(metaFile(r))) {
        writeFileSync(metaFile(r), execFileSync('gh', ['api', `repos/${r}`, '--jq', '{name:.name,full:.full_name,lang:.language,stars:.stargazers_count,created:.created_at,desc:.description}']).toString());
        await sleep(300);
      }
    } catch (e) { console.log('FAIL', r, String(e.message).slice(0, 80)); }
  }
}
