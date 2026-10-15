// #63 Who Lives Here — interview a "resident" of a Census tract (5 questions from a menu),
// then pin where in the USA that neighbourhood is. The resident only repeats ACS numbers.

const $ = (n) => '$' + Math.round(n).toLocaleString('en-US');
const p0 = (x) => `${Math.round(x)}%`;
/** Vague-but-honest phrasing of a percentage (resident talks like a person, numbers stay true). */
export function vague(x) {
  if (x < 1) return '几乎没有';
  if (x < 6) return `很少（约 ${p0(x)}）`;
  if (x < 20) return `不多（约 ${p0(x)}）`;
  if (x < 40) return `差不多三分之一不到（约 ${p0(x)}）`;
  if (x < 60) return `大概一半（约 ${p0(x)}）`;
  if (x < 80) return `大多数（约 ${p0(x)}）`;
  return `几乎都是（约 ${p0(x)}）`;
}

/** Keyword router (stands in for the LLM front-end of the original idea): free text -> question id. */
export const KEYWORDS = {
  money: /收入|挣|赚|工资|薪|income|earn|salary|穷|贫|富|钱多|poverty/i,
  housing: /房租|租金|房价|房子多少钱|住.*花|租|价格|rent|price|cost|housing/i,
  commute: /上班|通勤|交通|地铁|公交|开车|走路|步行|commute|transit|work|bus|subway/i,
  cars: /车|car|vehicle|drive/i,
  neighbors: /邻居|族裔|种族|人种|移民|外国|白人|黑人|亚裔|拉美|neighbo|race|immigra|ethnic/i,
  age: /年纪|年龄|多大|老人|年轻|age|old|young/i,
  school: /大学|学历|读书|教育|学位|school|college|degree|educat/i,
  homes: /什么房|独栋|公寓|房龄|自有|买房|建造|own|apartment|house|home/i,
};
/** Route a typed question to a menu question id, or null. Earlier entries win on ties. */
export function route(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  for (const id of Object.keys(KEYWORDS)) if (KEYWORDS[id].test(s)) return id;
  return null;
}

const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const FIELDS = [
  ['inc', '家庭收入中位数', (v) => $(v)], ['rent', '租金中位数', (v) => $(v)], ['val', '房屋中位价值', (v) => $(v)],
  ['transit', '公共交通通勤', p0], ['walk', '步行通勤', p0], ['home', '在家办公', p0], ['drive', '开车通勤', p0], ['noCar', '无车家庭', p0],
  ['bach', '大学学历', p0], ['owner', '自有住房', p0], ['white', '白人占比', p0], ['black', '黑人占比', p0], ['asian', '亚裔占比', p0],
  ['hisp', '拉美裔占比', p0], ['fb', '外国出生', p0], ['pov', '贫困率', p0], ['detached', '独栋住宅', p0], ['big', '20 套以上大楼', p0],
  ['age', '年龄中位数', (v) => `${v} 岁`], ['yr', '房屋建造年份中位数', (v) => String(v)],
];
/** The 3 most unusual numbers of this tract vs. the pool (by rank distance from the median), as teaching bullets. */
export function standouts(t, tracts) {
  const out = [];
  for (const [k, label, f] of FIELDS) {
    const vals = tracts.map((x) => x[k]).filter((v) => Number.isFinite(v));
    const m = med(vals), lo = vals.filter((v) => v < t[k]).length / vals.length;
    const dev = Math.abs(lo - 0.5);
    out.push({ k, dev, text: `${label} ${f(t[k])}（样本中位 ${f(m)}，${lo >= 0.5 ? '高于' : '低于'} ${Math.round((lo >= 0.5 ? lo : 1 - lo) * 100)}% 的街区）` });
  }
  return out.sort((a, b) => b.dev - a.dev).slice(0, 3).map((x) => x.text);
}
/** Region/urbanity reading of a tract, specific to its numbers. */
export function reading(t) {
  const bits = [];
  if (t.transit >= 15 || t.noCar >= 30) bits.push(`公共交通 ${p0(t.transit)}、无车家庭 ${p0(t.noCar)}：这是少数几座大城市（纽约、芝加哥、波士顿、旧金山、华盛顿……）核心区才有的通勤结构`);
  else if (t.drive >= 85 && t.noCar < 4) bits.push(`开车通勤 ${p0(t.drive)}、几乎家家有车：典型的郊区或小城镇，大城市核心区基本排除`);
  if (t.hisp >= 40) bits.push(`拉美裔 ${p0(t.hisp)}：多见于加州、德州、佛罗里达、亚利桑那、新墨西哥和东北部几座城市`);
  if (t.black >= 40) bits.push(`黑人 ${p0(t.black)}：多见于南方腹地（密西西比、佐治亚、路易斯安那、卡罗来纳）和北方老工业城市`);
  if (t.asian >= 25) bits.push(`亚裔 ${p0(t.asian)}：集中在加州、纽约、西雅图、新泽西、休斯敦等地`);
  if (t.white >= 85 && t.fb < 5) bits.push(`白人 ${p0(t.white)}、外国出生仅 ${p0(t.fb)}：偏向北部、山地和中西部的乡村与小城`);
  if (t.val >= 800000) bits.push(`房价中位 ${$(t.val)}：这样的价格只出现在加州沿海、纽约都会区、西雅图、波士顿、夏威夷等高房价地区`);
  else if (t.val < 150000) bits.push(`房价中位仅 ${$(t.val)}：多见于南方、中西部和铁锈带的小城与乡村`);
  if (t.yr >= 2000) bits.push(`房屋中位建于 ${t.yr} 年：新开发区，多在阳光地带（德州、佛州、亚利桑那、内华达、南北卡）`);
  else if (t.yr <= 1955) bits.push(`房屋中位建于 ${t.yr} 年：老城区，东北部和中西部老工业城市最常见`);
  if (t.home >= 18) bits.push(`在家办公 ${p0(t.home)}：高学历、高收入的科技/白领社区`);
  if (!bits.length) bits.push('各项数字都接近全国平均，没有强烈的地区特征；这种街区只能靠收入与房价的组合大致猜出区域');
  return bits.slice(0, 3);
}

export const QUESTIONS = [
  { id: 'money', label: '你们家一年挣多少？', say: (t) => `我们这片的家庭收入中位数是 ${$(t.inc)}，大约 ${p0(t.pov)} 的人生活在贫困线以下。` },
  { id: 'housing', label: '住这儿花多少钱？', say: (t) => `租房中位数每月 ${$(t.rent)}；房子的中位价值大约 ${$(t.val)}。` },
  { id: 'commute', label: '怎么去上班？', say: (t) => `开车上班的 ${p0(t.drive)}，坐公共交通的 ${p0(t.transit)}，走路的 ${p0(t.walk)}，在家办公的 ${p0(t.home)}。` },
  { id: 'cars', label: '家里有车吗？', say: (t) => `没有车的家庭${vague(t.noCar)}。` },
  { id: 'neighbors', label: '邻居是什么人？', say: (t) => `白人（非拉美裔）${p0(t.white)}，黑人 ${p0(t.black)}，亚裔 ${p0(t.asian)}，拉美裔 ${p0(t.hisp)}；外国出生的居民${vague(t.fb)}。` },
  { id: 'age', label: '大家多大年纪？', say: (t) => `这里居民的年龄中位数是 ${t.age} 岁。` },
  { id: 'school', label: '大家读过大学吗？', say: (t) => `25 岁以上的人里有学士及以上学位的占 ${p0(t.bach)}。` },
  { id: 'homes', label: '住的是什么房子？', say: (t) => `自己拥有住房的家庭占 ${p0(t.owner)}；独栋房屋占 ${p0(t.detached)}，20 套以上的大楼占 ${p0(t.big)}；房子中位建造年份是 ${t.yr}。` },
];

/** Score helper kept pure for tests: closer pin = more points. */
export const pinScore = (km, scale = 700) => Math.round(100 * Math.exp(-km / scale));

export const STATE_NAMES = { AL: '阿拉巴马', AZ: '亚利桑那', AR: '阿肯色', CA: '加利福尼亚', CO: '科罗拉多', CT: '康涅狄格', DE: '特拉华', DC: '华盛顿特区', FL: '佛罗里达', GA: '佐治亚', ID: '爱达荷', IL: '伊利诺伊', IN: '印第安纳', IA: '艾奥瓦', KS: '堪萨斯', KY: '肯塔基', LA: '路易斯安那', ME: '缅因', MD: '马里兰', MA: '马萨诸塞', MI: '密歇根', MN: '明尼苏达', MS: '密西西比', MO: '密苏里', MT: '蒙大拿', NE: '内布拉斯加', NV: '内华达', NH: '新罕布什尔', NJ: '新泽西', NM: '新墨西哥', NY: '纽约', NC: '北卡罗来纳', ND: '北达科他', OH: '俄亥俄', OK: '俄克拉何马', OR: '俄勒冈', PA: '宾夕法尼亚', RI: '罗得岛', SC: '南卡罗来纳', SD: '南达科他', TN: '田纳西', TX: '得克萨斯', UT: '犹他', VT: '佛蒙特', VA: '弗吉尼亚', WA: '华盛顿州', WV: '西弗吉尼亚', WI: '威斯康星', WY: '怀俄明' };

export default {
  meta: {
    num: 63,
    slug: 'who-lives-here',
    title: 'Who Lives Here',
    tagline: '一位居民只用人口普查数据回答你的问题。问五个，再在美国地图上标出他住的街区。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '今天有一位住在美国某个普查区（约 4000 人的街区）的居民。点菜单或直接打字，问他 5 个问题（打字会按关键词匹配到下面 8 类话题）。',
      '他的每一句回答都直接来自这个街区的美国社区调查（ACS）统计，不会编。',
      '问完后在美国本土地图上标出他住的地方（池中只含本土 48 州和华盛顿特区）。收入、房租、通勤方式、族裔、房龄……组合起来能推断出城市甚至地区。',
      '问题怎么选是技巧：选信息量大、能区分地区的问题。',
    ],
    scoring: '100 × e^(−距离/700 km)：离答案 0 km 满分，约 700 km 得 37 分，约 2000 km 得 6 分。',
    sources: [
      { name: 'U.S. Census Bureau, ACS 5-year 2020–2024（表 B01002、B03002、B05002、B08301、B15003、B17001、B19013、B25003、B25024、B25035、B25044、B25064、B25077）', url: 'https://www.census.gov/programs-surveys/acs', note: '经 Census Reporter API 取得' },
      { name: 'Census Reporter API', url: 'https://censusreporter.org/' },
      { name: 'Census Gazetteer（普查区中心点）', url: 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html' },
    ],
    dataNote: '浏览器里没有运行时语言模型，居民的话由模板把统计数字翻译成口语，打字提问由关键词规则路由到 8 类固定话题（对应原创意里“路由到统计字段、模型只负责措辞”的做法）；数字均为真实 ACS 估计值。池中是约 227 个随机抽取、各州均衡的本土普查区（阿拉斯加、夏威夷不在地图范围内，已剔除）。Census 官方 API 需要密钥，故改用提供同一份 ACS 数据的 Census Reporter。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.tracts).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const t = ctx.data.tracts.find((x) => x.id === p.id);
    const N = 5;
    const asked = [];
    const log = ctx.log.scope('who');
    log('tract', t.id, t.county, t.state);

    const list = ui.h('div', { class: 'ds-stack' });
    const left = ui.h('span', { class: 'mono small' }, `还可以问 ${N} 个`);
    const asks = ui.h('div', { class: 'ds-grid', style: { '--min': '160px' } });
    const panel = ui.panel({ kicker: '居民访谈', title: '你想问什么？', aside: left }, asks, ui.h('div', { style: { marginTop: '12px' } }, list));
    ctx.stage.append(panel);

    const typed = ui.h('input', { class: 'ds-input', placeholder: '或打字提问，如“房租贵吗”', autocomplete: 'off', 'aria-label': '输入你的问题', maxlength: 60 });
    const note = ui.h('div', { class: 'small muted', style: { minHeight: '1.4em' } });
    const sendBtn = ui.button('问', { variant: 'accent', small: true });
    const typedRow = ui.h('div', { class: 'ds-row', style: { marginTop: '10px', flexWrap: 'nowrap' } }, typed, sendBtn);
    asks.after(typedRow, note);

    await new Promise((resolve) => {
      const ask = (q, btn, said) => {
        if (asked.includes(q.id)) { note.textContent = '这个你已经问过了，换一个吧。'; return; }
        if (asked.length >= N) return;
        asked.push(q.id);
        log('ask', q.id, said ? 'typed' : 'menu');
        const b2 = btn || asks.querySelector(`[data-q="${q.id}"]`);
        if (b2) b2.disabled = true;
        note.textContent = '';
        list.append(ui.h('div', {}, ui.h('div', { class: 'small muted' }, `你：${said || q.label}`), ui.quote(q.say(t))));
        left.textContent = asked.length >= N ? '问完了，去地图上标出位置' : `还可以问 ${N - asked.length} 个`;
        if (asked.length >= N) {
          asks.querySelectorAll('button').forEach((b) => (b.disabled = true));
          typed.disabled = true; sendBtn.disabled = true; typedRow.style.display = 'none';
          setTimeout(resolve, ctx.autoplay ? 0 : 600);
        }
      };
      const send = () => {
        const text = typed.value.trim();
        if (!text) return;
        const id = route(text);
        log('typed', text, '->', id);
        if (!id) { note.textContent = '他听不懂这个问题。他只谈得出：收入、房租房价、通勤、有没有车、邻居、年龄、学历、住房。'; return; }
        typed.value = '';
        ask(QUESTIONS.find((q) => q.id === id), null, text);
      };
      sendBtn.addEventListener('click', send);
      typed.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      QUESTIONS.forEach((q) => {
        const b = ui.button(q.label, { variant: 'ghost', small: true, onClick: () => ask(q, b) });
        b.dataset.q = q.id;
        asks.append(b);
      });
      if (ctx.autoplay) QUESTIONS.slice(0, N).forEach((q) => ask(q, null));
    });

    const res = await ctx.pin({
      answer: { lat: t.lat, lng: t.lng, label: `${t.county}, ${t.state}` },
      view: { bounds: [[24, -125], [50, -66]] },
      scale: 700,
      title: '他住在哪里？',
      prompt: '点击地图标出这个街区的位置。',
    });
    const unasked = QUESTIONS.filter((q) => !asked.includes(q.id));
    const askedLabels = asked.map((id) => QUESTIONS.find((q) => q.id === id).label.replace(/[？]/g, ''));
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['答案', `${t.county} County, ${STATE_NAMES[t.state] || t.state}（${t.state}），普查区 ${t.tract}`], ['人口', t.pop.toLocaleString('en-US')], ['你问了', askedLabels.join(' / ')]]),
      ui.callout('这个街区最“出格”的三个数字（相对样本中位数）：', 'good'),
      ui.h('ul', { class: 'small', style: { margin: '0', paddingLeft: '1.2em' } }, ...standouts(t, ctx.data.tracts).map((x) => ui.h('li', {}, x))),
      ui.callout('线索怎么指向这里：', 'good'),
      ui.h('ul', { class: 'small', style: { margin: '0', paddingLeft: '1.2em' } }, ...reading(t).map((x) => ui.h('li', {}, x))),
      ...(unasked.length ? [ui.callout('没问到的问题，他本来会这样回答：', 'warn'), ...unasked.map((q) => ui.h('div', {}, ui.h('div', { class: 'small muted' }, q.label), ui.quote(q.say(t))))] : []));
    return res;
  },
};
