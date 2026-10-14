// Fetch recent commit messages for a set of well-known repos via authenticated `gh api`.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
export const REPOS = ['torvalds/linux','microsoft/vscode','facebook/react','python/cpython','golang/go','rust-lang/rust','nodejs/node','kubernetes/kubernetes','tensorflow/tensorflow','pytorch/pytorch','vuejs/core','angular/angular','sveltejs/svelte','denoland/deno','django/django','pallets/flask','rails/rails','laravel/framework','home-assistant/core','ansible/ansible','godotengine/godot','neovim/neovim','git/git','redis/redis','nginx/nginx','ffmpeg/FFmpeg','curl/curl','huggingface/transformers','vercel/next.js','tailwindlabs/tailwindcss','prettier/prettier','eslint/eslint','webpack/webpack','vitejs/vite','electron/electron','flutter/flutter','apple/swift','JuliaLang/julia','numpy/numpy','pandas-dev/pandas','scikit-learn/scikit-learn','matplotlib/matplotlib','ohmyzsh/ohmyzsh','Homebrew/brew','docker/compose','hashicorp/terraform','grafana/grafana','elastic/elasticsearch','mozilla/gecko-dev','bitcoin/bitcoin','ethereum/go-ethereum','obsidianmd/obsidian-releases','astral-sh/ruff','BurntSushi/ripgrep','sharkdp/bat','junegunn/fzf','jqlang/jq','ggerganov/llama.cpp','openai/whisper'];
for (const r of REPOS) {
  const f = `raw/${r.replace('/', '__')}.json`;
  if (existsSync(f)) continue;
  try {
    const out = execFileSync('gh', ['api', `repos/${r}/commits?per_page=100`, '--jq', '[.[]|{m:.commit.message,d:.commit.author.date}]'], { maxBuffer: 20e6 }).toString();
    writeFileSync(f, out); console.log('ok', r);
  } catch (e) { console.log('FAIL', r); }
  await new Promise((s) => setTimeout(s, 300));
}
