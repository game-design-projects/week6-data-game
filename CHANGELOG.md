# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [Unreleased]

### Added
- 共用引擎：设计系统 `engine/ds.css`（纸张/墨色风格，按类别配主色，深浅色主题）、纯函数核心 `core.js`、组件 `dom.js`、游戏外壳 `shell.js`、首页 `gallery.js`。
- 八种玩法预设：猜实体（guess）、估数（estimate）、地图标点（pin）、选择题（rounds）、排序（order）、配对（match）、分组（groups）、画布（canvas）。
- 按需加载的图表（Observable Plot）和地图（Leaflet + Esri 无标注底图）。
- 每日种子出题、本地存档、连续天数统计、分享文字、练习模式、往期日期切换。
- 工具脚本：`scripts/serve.mjs`、`scripts/check.mjs`（校验 + 无头 Chrome 冒烟 + 截图）、`scripts/registry.mjs`。
- 参考游戏：#1 Daylight、#70 Holiday，以及隐藏的预设演示 #0。
- 其余 97 个游戏（#2–#102，不含已被做过的 #4、#8、#44），每个游戏一个目录，含真实数据快照、数据构建脚本和单元测试；首页共 99 个游戏。
- `scripts/mobile.html`：用 390px iframe 截手机宽度的图（无头 Chrome 窗口不能窄于约 500px）。
- 13 个游戏改为在浏览器里实时取数，锚定到昨天（或数据定稿所需的更早一天），取不到时退回快照：#11 Aftershock、#12 Forecast Match、#18 Bridge Count、#37 AQI Rank、#38 Tide、#42 Ground Track、#47 Spike、#79 Front Page、#80 Subdomain、#88 Sail、#91 Quake Defense、#92 Storm Run、#96 Missing Number。
- #41 Gravity Assist 用 JPL 近似轨道根数在浏览器里算出当天的真实行星位置。
- 每个游戏的 `game.test.mjs` 会校验 120 天内出的每一道题（答案可选、干扰项不重复、无空值、数值合理），并在整个题库里扫描答案泄露。
- `check.mjs --date=YYYY-MM-DD`（检查往期）和 `--dark`（深色主题截图）；新增手机宽度的结果页截图；页面支持 `?theme=dark|light`。
- `tests/presets.test.mjs`：在无头 Chrome 里测分组、估数、画布预设的行为。
- 发布到 Cloudflare Workers 静态资源：`scripts/dist.sh` 从已提交的文件生成 `dist/`（去掉构建脚本、原始数据、测试和文档），`wrangler.jsonc` 配置 workers.dev 域名。线上地址 https://daily-data.lishuyustevenli.workers.dev/ 。

### Changed
- 地图底图：8 级及以下改用无文字的 Esri 地形晕渲，9 级及以上用灰色街道底图；Esri 灰色底图在 3–8 级会直接画出国家名和海名。
- 冒烟测试和自动游玩时关闭动画，保证截图是最终状态。
- 99 个游戏逐个对照原点子复查并修改（一个游戏一个提交，正文写改了什么、还剩哪些偏差及原因）：补回被简化掉的玩法（如 #2 画整条线、#25 输入指标名、#63/#95 自由提问、#68 三个滑块同屏），扩充偏小的题库，结果卡片改为针对当天题目讲解。
- 地图支持小数缩放级别，`fitBounds` 在窄屏上也能铺满；冒烟模式下关闭地图动画。
- 分组预设的格子保留原始大小写，不再全部转成大写。
- 结果评语按得分档次给出，1/100 不再显示"差一点"。

### Fixed
- `estimate` 在自定义 `format()` 已带单位时不再重复显示单位（包括 `$` 这样的前缀单位）。
- 地图在挂到页面之前创建时，拿到真实尺寸后才缩放到指定范围。
- 分组预设重复提交同一组错误组合时不再扣第二次失误。
- 画布预设：拖动时捕获指针、`pointercancel` 视为松开，停止后改变尺寸会重绘一次而不是留白。
- `hidden` 属性不再被 `ds-row` 等布局类覆盖。
- 答案泄露：#39 猜测时不再显示地名，#70 各语言的国名一并打码，#53/#82 打码改为整词匹配并覆盖别名，#98 手机上能看到整个世界地图。
- #61 Funded 题库过滤掉成人内容的众筹项目。
