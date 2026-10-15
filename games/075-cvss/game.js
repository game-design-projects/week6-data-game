// #75 CVSS — a CVE description with vendor and weakness names blacked out: guess the CVSS base score, then the CWE.
const V = {
  AV: ['Attack vector', { N: 'Network (remote)', A: 'Adjacent network', L: 'Local', P: 'Physical' }],
  AC: ['Attack complexity', { L: 'Low', H: 'High' }],
  PR: ['Privileges required', { N: 'None', L: 'Low', H: 'High' }],
  UI: ['User interaction', { N: 'Not required', R: 'Required (click/open)' }],
  S: ['Scope', { U: 'Unchanged', C: 'Changed (spreads to other components)' }],
  C: ['Confidentiality impact', { N: 'None', L: 'Low', H: 'High' }],
  I: ['Integrity impact', { N: 'None', L: 'Low', H: 'High' }],
  A: ['Availability impact', { N: 'None', L: 'Low', H: 'High' }],
};

/** "AV:N/AC:L/..." -> [[metric name, value name], ...] */
export function parseVector(vec) {
  return vec.split('/').map((kv) => { const [k, v] = kv.split(':'); return [V[k][0], V[k][1][v]]; });
}
/** "AV:N/AC:L/..." -> { AV: 'N', ... } */
export const vecMap = (vec) => Object.fromEntries(vec.split('/').map((kv) => kv.split(':')));
export const sevOf = (s) => (s >= 9 ? 'Critical' : s >= 7 ? 'High' : s >= 4 ? 'Medium' : s > 0 ? 'Low' : 'None');

/** One sentence on what in the vector produced the score. */
export function vectorStory(vec, score) {
  const m = vecMap(vec);
  const up = []; const down = [];
  (m.AV === 'N' ? up : down).push(m.AV === 'N' ? 'reachable over the network' : m.AV === 'L' ? 'local only' : m.AV === 'A' ? 'adjacent network only' : 'needs physical access');
  (m.PR === 'N' ? up : down).push(m.PR === 'N' ? 'no privileges needed' : m.PR === 'L' ? 'needs a low-privilege account' : 'needs high privileges');
  (m.UI === 'N' ? up : down).push(m.UI === 'N' ? 'no user interaction' : 'needs the user to click or open something');
  if (m.AC === 'H') down.push('high attack complexity');
  const imp = ['C', 'I', 'A'].map((k) => m[k]);
  const nHigh = imp.filter((x) => x === 'H').length; const nNone = imp.filter((x) => x === 'N').length;
  const impTxt = nHigh === 3 ? 'confidentiality, integrity and availability all high' : nNone === 3 ? 'no impact at all' : nNone === 2 && nHigh === 1 ? `only ${['confidentiality', 'integrity', 'availability'][imp.indexOf('H')]} is high` : `confidentiality/integrity/availability impact is ${imp.map((x) => ({ H: 'high', L: 'low', N: 'none' })[x]).join('/')}`;
  (nHigh === 3 ? up : down).push(impTxt);
  if (m.S === 'C') up.push('scope changed');
  return `${score.toFixed(1)} (${sevOf(score)}): ${up.length ? 'pushes up: ' + up.join(', ') : ''}${up.length && down.length ? '; ' : ''}${down.length ? 'holds down: ' + down.join(', ') : ''}.`;
}

// Wording in a description that points to a vector metric. test(m) tells whether the real vector agrees.
const CUES = [
  [/\bremote(ly)?\b|over the network|\bnetwork\b/i, '\u201cremote/network\u201d', 'AV:N', (m) => m.AV === 'N'],
  [/\blocal(ly)? (attacker|user)|\blocally\b|physical(ly)? (access|present)|local access/i, '\u201clocal/physical\u201d', 'AV:L or P', (m) => m.AV === 'L' || m.AV === 'P'],
  [/authenticated|low[- ]privilege|logged[- ]in|administrator|admin(istrative)? (privilege|access|user)|subscriber|contributor|author[- ]level|editor[- ]level/i, '\u201cauthenticated/admin\u201d', 'PR is not N', (m) => m.PR !== 'N'],
  [/unauthenticated|without (any )?(authentication|credentials|privileges)|any user|anonymous/i, '\u201cunauthenticated\u201d', 'PR:N', (m) => m.PR === 'N'],
  [/user interaction|\bclick|visit|tricked|opens? (a |the )?(malicious|crafted|specially)|crafted (file|document)|convinc/i, '\u201cuser interaction\u201d', 'UI:R', (m) => m.UI === 'R'],
  [/denial[- ]of[- ]service|\bcrash|\bhang\b|exhaust|infinite loop/i, '\u201ccrash/denial of service\u201d', 'A is not N', (m) => m.A !== 'N'],
  [/arbitrary (code|command)|execute (arbitrary )?(code|commands?)|code execution|remote code/i, '\u201cexecute code/commands\u201d', 'mostly C/I/A:H', (m) => ['C', 'I', 'A'].filter((k) => m[k] === 'H').length >= 2],
  [/disclos|read (arbitrary|sensitive)|obtain sensitive|leak|information exposure|view/i, '\u201cread/disclose\u201d', 'C is not N', (m) => m.C !== 'N'],
  [/modif|overwrite|delete|tamper|inject|write/i, '\u201cmodify/delete/write\u201d', 'I is not N', (m) => m.I !== 'N'],
];
/** Which phrases of the (redacted) description pointed at the vector, and did the vector agree? */
export function descCues(desc, vec) {
  const m = vecMap(vec); const out = [];
  for (const [re, label, metric, test] of CUES) { const hit = desc.match(re); if (hit) out.push({ label, text: hit[0], metric, ok: test(m) }); }
  return out;
}

export default {
  meta: {
    num: 75, slug: 'cvss', title: 'CVSS', category: 'tech', data: 'snapshot',
    tagline: 'A real vulnerability description with the vendor and weakness names blacked out. Guess its CVSS base score, then its weakness type (CWE).',
    howTo: [
      'Read a real CVE description from the NVD (vendor and product names are blacked out with ▇▇▇, the weakness name hidden with ◆◆◆) and use the slider to estimate its CVSS 3.1 base score (0-10).',
      'After you submit, the CVSS vector is revealed. Then guess the weakness type from 24 common CWEs, up to 5 tries. Each miss unlocks a clue, and options in the same broad family turn yellow.',
      'Rule of thumb: remote + no privileges + no interaction + all three impacts high is about 9.8. Needing a login or a click, or only one impact, pulls the score down noticeably.',
    ],
    scoring: 'Score part: 0 error = 100 points, 1.5 off is about 37, 5 or more off is nearly 0. CWE part: 100 for a correct 1st guess, then 80/60/40/20, and 0 if you miss. The two parts add up, 200 max.',
    sources: [{ name: 'NVD CVE API 2.0 (NIST)', url: 'https://nvd.nist.gov/developers/vulnerabilities', note: 'Vulnerabilities published in 2024 that have a CVSS 3.1 score and exactly one CWE' }],
    dataNote: 'The pool is an offline snapshot of all NVD 2024 data (the NVD API allows CORS, but without a key it is limited to 5 requests per 30 seconds, and the masking has to be precomputed, so nothing is fetched live in the browser). Vendor and product names come from the NVD CPE configurations and are blacked out with ▇▇▇; where a description spells out the weakness name or its common variants, those parts are hidden with ◆◆◆, and entries that still leak the answer were dropped. At most 6 entries per CWE, sampled evenly across the score range.',
  },

  puzzle({ data, pick }) { return { id: pick(data.puzzles).id }; },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const c = data.puzzles.find((x) => x.id === p.id);
    const w = data.cwes[c.cwe];
    ctx.log('puzzle', c.id, c.score, c.cwe);
    ctx.stage.append(ui.panel({ kicker: 'Vulnerability description', title: 'Vendor and weakness names blacked out' }, ui.quote(c.desc)));

    const r1 = await ctx.estimate({
      title: 'What is the CVSS 3.1 base score?', answer: c.score, min: 0, max: 10, step: 0.1, initial: 5,
      scoring: 'abs', scale: 1.5, format: (v) => v.toFixed(1), tolerance: 0.3,
    });

    const groupOf = (id) => data.groups[data.cwes[id].grp];
    const options = Object.entries(data.cwes).map(([id, x]) => ({ id, label: `${id} ${x.label}`, grp: x.grp, aliases: [x.en, id.replace('CWE-', ''), ...x.alias] }));
    const vecNode = ui.h('div', ui.kv(parseVector(c.vec)), ui.h('div', { class: 'small muted' }, `Base score ${c.score.toFixed(1)} (${sevOf(c.score)})`));
    const r2 = await ctx.guess({
      title: 'Which weakness type (CWE) is it?', placeholder: 'Type a weakness name or CWE number…', options, answer: c.cwe, maxGuesses: 5,
      cluesTitle: 'Clues',
      clues: [vecNode, `Weakness family: ${groupOf(c.cwe)}.`, `The English name starts with \u201c${w.en.split(' ')[0]}\u201d.`, `The ID starts with ${c.cwe.slice(0, 5)} (more digits follow).`],
      columns: ['Family'],
      feedback: (g) => [{ text: groupOf(g.id), state: g.id === c.cwe ? 'hit' : g.grp === w.grp ? 'near' : 'miss' }],
      near: (g) => g.grp === w.grp,
    });

    const res = ctx.combine([r1, r2]);
    const cues = descCues(c.desc, c.vec);
    const shown = r1.guess?.toFixed ? r1.guess.toFixed(1) : String(r1.guess ?? '—');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['CVE', c.id], ['Published', c.pub], ['Base score', `${c.score.toFixed(1)} (${sevOf(c.score)}). You guessed ${shown}`], ['CWE', `${c.cwe} ${w.en}`], ['Vector', c.vec]]),
      ui.callout(`Where the score comes from: ${vectorStory(c.vec, c.score)}`, 'good'),
      ui.callout(`What this weakness looks like: ${w.tip}`, 'good'),
      cues.length
        ? ui.callout('Clues in this description: ' + cues.map((x) => `${x.label} (${x.text}) \u2192 ${x.metric}${x.ok ? ' \u2713' : ' \u2717, the actual vector says otherwise'}`).join('; ') + '.', 'good')
        : ui.callout('This description has almost no wording that points at the vector, so you had to lean on the weakness type\'s typical score.', 'warn'),
      ui.h('div', { class: 'small muted' }, 'Original, unredacted text:'), ui.quote(c.orig));
    return res;
  },
};
