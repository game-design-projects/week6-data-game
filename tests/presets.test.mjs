// Browser tests for engine presets: serves the repo, loads tests/presets.html in
// headless Chrome and checks the JSON it writes. Skipped when Chrome is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../scripts/serve.mjs';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function dumpDom(url) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'ddg-test-'));
  const p = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
    '--window-size=1000,1000', '--virtual-time-budget=10000', '--dump-dom', url], { stdio: ['ignore', 'pipe', 'ignore'] });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  await new Promise((r) => p.on('close', r));
  await rm(profile, { recursive: true, force: true });
  return out;
}

test('presets behave in a real browser', { skip: !existsSync(CHROME) && 'Chrome not installed' }, async () => {
  const server = await startServer(0);
  try {
    const html = await dumpDom(`http://127.0.0.1:${server.address().port}/tests/presets.html`);
    const m = html.match(/<pre id="out">([^<]*)<\/pre>/);
    assert.ok(m && m[1], 'presets.html produced no output');
    const out = JSON.parse(m[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    assert.equal(out.groupsLeftAfterRepeat, 'Mistakes left ●●●○', 'a repeated wrong guess must not cost a second mistake');
    assert.equal(out.groupsScore, 4 * 25 - 5);
    assert.equal(out.estimateReadout.split('$').length - 1, 1, `unit printed twice: ${out.estimateReadout}`);
    assert.equal(out.canvasEvents, 'down,move,up');
    assert.equal(out.canvasRedrawnAfterResize, true);
    assert.equal(out.dateShort, 'Thu, Oct 15, 2026');
    assert.equal(out.dateLong, 'Thursday, October 15, 2026');
  } finally {
    server.close();
  }
});
