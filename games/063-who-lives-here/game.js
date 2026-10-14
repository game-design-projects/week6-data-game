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

export default {
  meta: {
    num: 63,
    slug: 'who-lives-here',
    title: 'Who Lives Here',
    tagline: '一位居民只用人口普查数据回答你的问题。问五个，再在美国地图上标出他住的街区。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '今天有一位住在美国某个普查区（约 4000 人的街区）的居民。从问题菜单里挑 5 个问他。',
      '他的每一句回答都直接来自这个街区的美国社区调查（ACS）统计，不会编。',
      '问完后在美国地图上标出他住的地方。收入、房租、通勤方式、族裔、房龄……组合起来能推断出城市甚至地区。',
      '问题怎么选是技巧：选信息量大、能区分地区的问题。',
    ],
    scoring: '100 × e^(−距离/700 km)。',
    sources: [
      { name: 'U.S. Census Bureau, ACS 5-year 2020–2024（表 B01002、B03002、B05002、B08301、B15003、B17001、B19013、B25003、B25024、B25035、B25044、B25064、B25077）', url: 'https://www.census.gov/programs-surveys/acs', note: '经 Census Reporter API 取得' },
      { name: 'Census Reporter API', url: 'https://censusreporter.org/' },
      { name: 'Census Gazetteer（普查区中心点）', url: 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html' },
    ],
    dataNote: '浏览器里没有运行时语言模型，居民的话由模板把统计数字翻译成口语，“问题菜单”代替自由提问；数字均为真实 ACS 估计值。池中有 200+ 个随机抽取、各州均衡的普查区。',
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

    await new Promise((resolve) => {
      const ask = (q, btn) => {
        if (asked.includes(q.id) || asked.length >= N) return;
        asked.push(q.id);
        log('ask', q.id);
        if (btn) btn.disabled = true;
        list.append(ui.h('div', {}, ui.h('div', { class: 'small muted' }, `你：${q.label}`), ui.quote(q.say(t))));
        left.textContent = asked.length >= N ? '问完了，去地图上标出位置' : `还可以问 ${N - asked.length} 个`;
        if (asked.length >= N) { asks.querySelectorAll('button').forEach((b) => (b.disabled = true)); setTimeout(resolve, ctx.autoplay ? 0 : 600); }
      };
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
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['街区', `${t.county} County, ${t.state}（普查区 ${t.tract}）`], ['人口', t.pop.toLocaleString('en-US')], ['你问了', asked.map((id) => QUESTIONS.find((q) => q.id === id).label.replace(/[？]/g, '')).join(' / ')]]),
      ui.callout('没问到的问题，他本来会这样回答：', 'warn'),
      ...unasked.map((q) => ui.h('div', {}, ui.h('div', { class: 'small muted' }, q.label), ui.quote(q.say(t)))));
    return res;
  },
};
