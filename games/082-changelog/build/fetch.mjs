import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
export const REPOS = `nodejs/node denoland/deno oven-sh/bun python/cpython rust-lang/rust golang/go microsoft/vscode microsoft/TypeScript facebook/react vuejs/core sveltejs/svelte angular/angular vitejs/vite webpack/webpack babel/babel eslint/eslint prettier/prettier jestjs/jest git/git neovim/neovim vim/vim tmux/tmux torvalds/linux docker/cli moby/moby kubernetes/kubernetes hashicorp/terraform prometheus/prometheus grafana/grafana redis/redis postgres/postgres mongodb/mongo elastic/elasticsearch home-assistant/core ffmpeg/ffmpeg obsproject/obs-studio blender/blender godotengine/godot electron/electron tauri-apps/tauri flutter/flutter pytorch/pytorch tensorflow/tensorflow numpy/numpy pandas-dev/pandas scikit-learn/scikit-learn huggingface/transformers django/django pallets/flask tiangolo/fastapi rails/rails laravel/framework spring-projects/spring-boot expressjs/express tailwindlabs/tailwindcss ohmyzsh/ohmyzsh BurntSushi/ripgrep sharkdp/bat junegunn/fzf astral-sh/ruff astral-sh/uv ollama/ollama ggerganov/llama.cpp curl/curl nginx/nginx caddyserver/caddy traefik/traefik syncthing/syncthing keepassxreboot/keepassxc obsidianmd/obsidian-releases zed-industries/zed helix-editor/helix alacritty/alacritty ghostty-org/ghostty`.split(/\s+/);
if (process.argv[1].endsWith('fetch.mjs')) {
  for (const r of REPOS) {
    const f = `raw/${r.replace('/', '__')}.json`;
    if (existsSync(f)) continue;
    try {
      const out = execFileSync('gh', ['api', `repos/${r}/releases?per_page=100`], { encoding: 'utf8', maxBuffer: 64e6 });
      writeFileSync(f, out); console.log('ok', r);
    } catch (e) { console.log('FAIL', r); }
    await new Promise((s) => setTimeout(s, 300));
  }
}
