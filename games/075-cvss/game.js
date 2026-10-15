// #75 CVSS — a CVE description with vendor and weakness names blacked out: guess the CVSS base score, then the CWE.
const V = {
  AV: ['攻击途径', { N: '网络（远程）', A: '相邻网络', L: '本地', P: '物理接触' }],
  AC: ['攻击复杂度', { L: '低', H: '高' }],
  PR: ['所需权限', { N: '无需', L: '低权限', H: '高权限' }],
  UI: ['需要用户操作', { N: '不需要', R: '需要点击/打开' }],
  S: ['影响范围', { U: '不变', C: '扩散到其他组件' }],
  C: ['机密性影响', { N: '无', L: '低', H: '高' }],
  I: ['完整性影响', { N: '无', L: '低', H: '高' }],
  A: ['可用性影响', { N: '无', L: '低', H: '高' }],
};

/** "AV:N/AC:L/…" → [[中文名, 中文值], …] */
export function parseVector(vec) {
  return vec.split('/').map((kv) => { const [k, v] = kv.split(':'); return [V[k][0], V[k][1][v]]; });
}
/** "AV:N/AC:L/…" → { AV: 'N', … } */
export const vecMap = (vec) => Object.fromEntries(vec.split('/').map((kv) => kv.split(':')));
export const sevOf = (s) => (s >= 9 ? '严重' : s >= 7 ? '高危' : s >= 4 ? '中危' : s > 0 ? '低危' : '无');

/** One sentence on what in the vector produced the score. */
export function vectorStory(vec, score) {
  const m = vecMap(vec);
  const up = []; const down = [];
  (m.AV === 'N' ? up : down).push(m.AV === 'N' ? '网络可达' : m.AV === 'L' ? '只能本地利用' : m.AV === 'A' ? '限相邻网络' : '需物理接触');
  (m.PR === 'N' ? up : down).push(m.PR === 'N' ? '无需权限' : m.PR === 'L' ? '需要低权限账号' : '需要高权限');
  (m.UI === 'N' ? up : down).push(m.UI === 'N' ? '无需用户操作' : '需要用户点击/打开');
  if (m.AC === 'H') down.push('攻击复杂度高');
  const imp = ['C', 'I', 'A'].map((k) => m[k]);
  const nHigh = imp.filter((x) => x === 'H').length; const nNone = imp.filter((x) => x === 'N').length;
  const impTxt = nHigh === 3 ? '机密/完整/可用性三项全高' : nNone === 3 ? '三项影响全无' : nNone === 2 && nHigh === 1 ? `只有${['机密性', '完整性', '可用性'][imp.indexOf('H')]}一项为高` : `机密/完整/可用性影响为 ${imp.map((x) => ({ H: '高', L: '低', N: '无' })[x]).join('/')}`;
  (nHigh === 3 ? up : down).push(impTxt);
  if (m.S === 'C') up.push('影响范围扩散');
  return `${score.toFixed(1)} 分（${sevOf(score)}）：${up.length ? '拉高：' + up.join('、') : ''}${up.length && down.length ? '；' : ''}${down.length ? '压低：' + down.join('、') : ''}。`;
}

// Wording in a description that points to a vector metric. test(m) tells whether the real vector agrees.
const CUES = [
  [/\bremote(ly)?\b|over the network|\bnetwork\b/i, '“远程/网络”', 'AV:N', (m) => m.AV === 'N'],
  [/\blocal(ly)? (attacker|user)|\blocally\b|physical(ly)? (access|present)|local access/i, '“本地/物理”', 'AV:L 或 P', (m) => m.AV === 'L' || m.AV === 'P'],
  [/authenticated|low[- ]privilege|logged[- ]in|administrator|admin(istrative)? (privilege|access|user)|subscriber|contributor|author[- ]level|editor[- ]level/i, '“需认证/管理员”', 'PR 不是 N', (m) => m.PR !== 'N'],
  [/unauthenticated|without (any )?(authentication|credentials|privileges)|any user|anonymous/i, '“未认证”', 'PR:N', (m) => m.PR === 'N'],
  [/user interaction|\bclick|visit|tricked|opens? (a |the )?(malicious|crafted|specially)|crafted (file|document)|convinc/i, '“需用户点击/打开”', 'UI:R', (m) => m.UI === 'R'],
  [/denial[- ]of[- ]service|\bcrash|\bhang\b|exhaust|infinite loop/i, '“崩溃/拒绝服务”', 'A 不是 N', (m) => m.A !== 'N'],
  [/arbitrary (code|command)|execute (arbitrary )?(code|commands?)|code execution|remote code/i, '“执行代码/命令”', 'C/I/A 多为 H', (m) => ['C', 'I', 'A'].filter((k) => m[k] === 'H').length >= 2],
  [/disclos|read (arbitrary|sensitive)|obtain sensitive|leak|information exposure|view/i, '“读取/泄露”', 'C 不是 N', (m) => m.C !== 'N'],
  [/modif|overwrite|delete|tamper|inject|write/i, '“修改/删除/写入”', 'I 不是 N', (m) => m.I !== 'N'],
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
    tagline: '一条被涂掉厂商名和弱点名的真实漏洞描述：猜它的 CVSS 基础分，再猜它属于哪类弱点（CWE）。',
    howTo: [
      '先读 NVD 里的真实 CVE 描述（厂商、产品名用 ▇▇▇ 涂黑，弱点名称用 ◆◆◆ 遮住），用滑块估算 CVSS 3.1 基础分（0–10）。',
      '提交后揭晓 CVSS 向量，再从 24 种常见 CWE 里猜出弱点类型，最多 5 次；每猜错一次多解锁一条线索，猜到同一大类的选项会标黄。',
      '读法：远程 + 无需权限 + 无需交互 + 机密/完整/可用性全高 ≈ 9.8；需要登录或点击、只有一项影响，都会明显拉低分数。',
    ],
    scoring: '分数部分：误差 0 = 100 分，差 1.5 分 ≈ 37 分，差 5 分以上几乎为 0；CWE 部分：第 1 次猜中 100 分，之后 80/60/40/20，猜不中 0 分。两部分相加，满分 200。',
    sources: [{ name: 'NVD CVE API 2.0（NIST）', url: 'https://nvd.nist.gov/developers/vulnerabilities', note: '2024 年发布、有 CVSS 3.1 评分且只标注单一 CWE 的漏洞' }],
    dataNote: '题库为离线抓取的 NVD 2024 全年数据快照（NVD API 虽带 CORS，但无 Key 限速 5 次/30 秒，且遮盖处理需要预先计算，因此不在浏览器里实时取）。厂商/产品名取自 NVD 的 CPE 配置并用 ▇▇▇ 遮盖；描述中直接写出弱点名称及其常见写法的部分用 ◆◆◆ 遮盖，仍含泄题词的条目已剔除；每种 CWE 最多取 6 条，并按分数均匀抽样。',
  },

  puzzle({ data, pick }) { return { id: pick(data.puzzles).id }; },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const c = data.puzzles.find((x) => x.id === p.id);
    const w = data.cwes[c.cwe];
    ctx.log('puzzle', c.id, c.score, c.cwe);
    ctx.stage.append(ui.panel({ kicker: '漏洞描述', title: '厂商名与弱点名已涂黑' }, ui.quote(c.desc)));

    const r1 = await ctx.estimate({
      title: 'CVSS 3.1 基础分是多少？', answer: c.score, min: 0, max: 10, step: 0.1, initial: 5,
      scoring: 'abs', scale: 1.5, format: (v) => v.toFixed(1), tolerance: 0.3,
    });

    const groupOf = (id) => data.groups[data.cwes[id].grp];
    const options = Object.entries(data.cwes).map(([id, x]) => ({ id, label: `${id} ${x.zh}`, hint: x.en, grp: x.grp, aliases: [x.en, id.replace('CWE-', '')] }));
    const vecNode = ui.h('div', ui.kv(parseVector(c.vec)), ui.h('div', { class: 'small muted' }, `基础分 ${c.score.toFixed(1)}（${sevOf(c.score)}）`));
    const r2 = await ctx.guess({
      title: '它属于哪类弱点（CWE）？', placeholder: '输入弱点名称或 CWE 编号…', options, answer: c.cwe, maxGuesses: 5,
      cluesTitle: '线索',
      clues: [vecNode, `弱点大类：${groupOf(c.cwe)}。`, `英文名以 “${w.en.split(' ')[0]}” 开头。`, `编号以 ${c.cwe.slice(0, 5)} 开头（后面还有数字）。`],
      columns: ['大类'],
      feedback: (g) => [{ text: groupOf(g.id), state: g.id === c.cwe ? 'hit' : g.grp === w.grp ? 'near' : 'miss' }],
      near: (g) => g.grp === w.grp,
    });

    const res = ctx.combine([r1, r2]);
    const cues = descCues(c.desc, c.vec);
    const shown = r1.guess?.toFixed ? r1.guess.toFixed(1) : String(r1.guess ?? '—');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['CVE', c.id], ['发布日期', c.pub], ['基础分', `${c.score.toFixed(1)}（${sevOf(c.score)}）　你估 ${shown}`], ['CWE', `${c.cwe} ${w.zh}（${w.en}）`], ['向量', c.vec]]),
      ui.callout(`分数从哪来：${vectorStory(c.vec, c.score)}`, 'good'),
      ui.callout(`这类弱点的特征：${w.tip}`, 'good'),
      cues.length
        ? ui.callout('这条描述里的线索：' + cues.map((x) => `${x.label}（${x.text}）→ ${x.metric}${x.ok ? ' ✓' : ' ✗，实际向量并非如此'}`).join('；') + '。', 'good')
        : ui.callout('这条描述里几乎没有指向向量的措辞，只能靠弱点类型的“典型分数”来估。', 'warn'),
      ui.h('div', { class: 'small muted' }, '未涂黑的原文：'), ui.quote(c.orig));
    return res;
  },
};
