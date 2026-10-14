// #75 CVSS — a CVE description with vendor names blacked out: guess the CVSS base score, then the CWE.
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
export const sevOf = (s) => (s >= 9 ? '严重' : s >= 7 ? '高危' : s >= 4 ? '中危' : s > 0 ? '低危' : '无');

export default {
  meta: {
    num: 75, slug: 'cvss', title: 'CVSS', category: 'tech', data: 'snapshot',
    tagline: '一条被涂掉厂商名的漏洞描述。猜它的 CVSS 基础分，再猜它属于哪类弱点（CWE）。',
    howTo: [
      '先读 NVD 里的真实 CVE 描述（厂商、产品名已涂黑，弱点名称也被遮住），用滑块估算 CVSS 3.1 基础分（0–10）。',
      '然后揭晓 CVSS 向量，再从 24 种常见 CWE 里猜出弱点类型，最多 5 次，每猜错一次多解锁一条线索。',
      '提示：远程 + 无需权限 + 无需交互 + 机密/完整/可用性全高 ≈ 9.8；需要登录或点击会明显拉低分数。',
    ],
    scoring: '分数部分：误差 1.5 分 ≈ 37 分；CWE 部分：第 1 次猜中 100 分，之后递减。两部分取平均。',
    sources: [{ name: 'NVD CVE API 2.0（NIST）', url: 'https://nvd.nist.gov/developers/vulnerabilities', note: '2024 年发布、仅含单一 CWE 的 CVSS 3.1 漏洞' }],
    dataNote: '厂商/产品名取自 NVD 的 CPE 配置，用 ▇▇▇ 遮盖；描述中直接写出弱点名称的部分用 ◆◆◆ 遮盖。题库为离线抓取的 142 条快照。',
  },

  puzzle({ data, pick }) { return { id: pick(data.puzzles).id }; },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const c = data.puzzles.find((x) => x.id === p.id);
    ctx.log('puzzle', c.id, c.score, c.cwe);
    ctx.stage.append(ui.panel({ kicker: '漏洞描述', title: '厂商名已涂黑' }, ui.quote(c.desc)));

    const r1 = await ctx.estimate({
      title: 'CVSS 3.1 基础分是多少？', answer: c.score, min: 0, max: 10, step: 0.1, initial: 5,
      scoring: 'abs', scale: 1.5, format: (v) => v.toFixed(1), tolerance: 0.3,
    });

    const vec = parseVector(c.vec);
    const options = Object.entries(data.cwes).map(([id, w]) => ({ id, label: `${id} ${w.zh}`, hint: w.en, aliases: [w.en, id.replace('CWE-', '')] }));
    const vecNode = ui.h('div', ui.kv(vec), ui.h('div', { class: 'small muted' }, `基础分 ${c.score.toFixed(1)}（${sevOf(c.score)}）`));
    const r2 = await ctx.guess({
      title: '它属于哪类弱点（CWE）？', placeholder: '输入弱点名称或 CWE 编号…', options, answer: c.cwe, maxGuesses: 5,
      cluesTitle: '线索',
      clues: [vecNode, `发布日期：${c.pub}。`, `英文名里含有 “${data.cwes[c.cwe].en.split(' ')[0]}”。`, `编号 ${c.cwe.slice(0, 5)}…（前缀）`],
    });

    const res = ctx.combine([r1, r2]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['CVE', c.id], ['基础分', `${c.score.toFixed(1)}（${sevOf(c.score)}）`], ['你的估计', r1.guess?.toFixed ? r1.guess.toFixed(1) : String(r1.guess ?? '')], ['CWE', `${c.cwe} ${data.cwes[c.cwe].zh}（${data.cwes[c.cwe].en}）`], ['向量', c.vec]]),
      ui.callout('规律：描述里的动词（“execute commands”“read arbitrary files”）直接对应 C/I/A 影响；“authenticated”意味着 PR 不为无，“user interaction”会把 UI 设为 R，两者都会拉低分数。', 'good'));
    return res;
  },
};
