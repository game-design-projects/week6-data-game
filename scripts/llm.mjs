// Minimal LLM client for the hint pipeline and the hint experiment.
//   local:<model>  LM Studio on this machine (OpenAI-compatible, $LMSTUDIO_URL or http://localhost:1234/v1)
//   go:<model>     OpenCode Go; run the script under `go.sh exec --`, which injects
//                  OPENAI_BASE_URL / OPENAI_API_KEY / ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY / OPENCODE_GO_SESSION.
// Every raw response is written to disk before it is parsed, and a request that already
// succeeded is answered from that file, so re-running a script costs nothing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ANTHROPIC_FORMAT = new Set(['claude-haiku-5-5', 'minimax-m2.7']);
const RESPONSES_FORMAT = new Set(['gpt-6-luna', 'gpt-5.6-luna', 'grok-4.7', 'grok-4.6']);

function request(provider, model, { system, user, temperature, maxTokens }) {
  if (provider === 'local') {
    const base = process.env.LMSTUDIO_URL || 'http://localhost:1234/v1';
    return {
      url: `${base}/chat/completions`,
      headers: { 'content-type': 'application/json' },
      // Qwen 3.x in LM Studio thinks unless told not to; this is the switch it honours.
      body: { model, temperature, max_tokens: maxTokens, reasoning_effort: 'none', messages: [{ role: 'system', content: system }, { role: 'user', content: user }] },
      format: 'chat',
    };
  }
  if (provider !== 'go') throw new Error(`unknown provider ${provider}`);
  const session = process.env.OPENCODE_GO_SESSION;
  if (!session) throw new Error('go: run under `go.sh exec --` (OPENCODE_GO_SESSION missing)');
  const common = { 'content-type': 'application/json', 'x-opencode-session': session, 'user-agent': 'week6-data-game/1.0' };
  if (ANTHROPIC_FORMAT.has(model)) {
    return {
      url: `${process.env.ANTHROPIC_BASE_URL}/v1/messages`,
      headers: { ...common, 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: { model, system, max_tokens: maxTokens, messages: [{ role: 'user', content: user }] }, // Haiku 5.5 rejects `temperature`
      format: 'anthropic',
    };
  }
  const auth = { ...common, authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
  if (RESPONSES_FORMAT.has(model)) {
    return { url: `${process.env.OPENAI_BASE_URL}/responses`, headers: auth, body: { model, instructions: system, input: user, max_output_tokens: maxTokens }, format: 'responses' };
  }
  return { url: `${process.env.OPENAI_BASE_URL}/chat/completions`, headers: auth, body: { model, temperature, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }, format: 'chat' };
}

function text(format, json) {
  let out = '';
  if (format === 'chat') out = json.choices?.[0]?.message?.content ?? '';
  if (format === 'anthropic') out = (json.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (format === 'responses') out = json.output_text ?? (json.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
  return out.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export function makeClient({ cacheDir, log = msg => console.error(msg) }) {
  return async function ask(spec, { system, user, temperature = 0.7, maxTokens }) {
    const i = spec.indexOf(':');
    const provider = spec.slice(0, i), model = spec.slice(i + 1);
    // Cloud reasoning models spend tokens thinking before they answer; give them room.
    const req = request(provider, model, { system, user, temperature, maxTokens: maxTokens ?? (provider === 'local' ? 300 : 4096) });
    const key = createHash('sha256').update(JSON.stringify([spec, req.url, req.body])).digest('hex').slice(0, 24);
    const file = path.join(cacheDir, `${key}.json`);
    let raw = null;
    try { raw = JSON.parse(await readFile(file, 'utf8')); } catch { /* not cached yet */ }
    if (raw?.status !== 200) {
      const started = Date.now();
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
      raw = { spec, at: new Date().toISOString(), ms: Date.now() - started, status: res.status, request: req.body, response: await res.text() };
      await mkdir(cacheDir, { recursive: true });
      await writeFile(file, JSON.stringify(raw, null, 1));
      log(`[llm] ${spec} HTTP ${res.status} in ${raw.ms} ms -> ${path.basename(file)}`);
    }
    if (raw.status === 401 || raw.status === 403) throw new Error(`${spec}: HTTP ${raw.status}, key rejected; stop and get a new key`);
    if (raw.status !== 200) throw new Error(`${spec}: HTTP ${raw.status} ${raw.response.slice(0, 300)}`);
    return text(req.format, JSON.parse(raw.response));
  };
}

/** Run `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}
