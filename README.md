# Daily Data

![](./docs/gallery.png)

一组用公开数据每天自动出题的小游戏（NYU Lecture 6 · daily data game 作业）。点子清单见 Claude Docs 文档《数据日更游戏：100 个点子》。

- 首页 `index.html` 列出全部游戏；每个游戏是 `play.html?g=<目录名>`。
- 不需要构建步骤，纯 ES module。本地运行：

```bash
node scripts/serve.mjs 8787      # → http://localhost:8787/
```

线上地址：<https://daily-data.lishuyustevenli.workers.dev/>（Cloudflare Workers 静态资源）。发布：

```bash
scripts/dist.sh && npx wrangler deploy   # dist/ 由已提交的文件生成，不含 build/、测试和文档
```

## 结构

```
engine/           共用引擎与设计系统（作者文档见 engine/README.md）
  ds.css          设计 token 与组件样式
  core.js         纯函数：日期、种子随机、计分、格式化（Node 可用）
  dom.js          hyperscript 与组件
  presets.js      八种玩法预设：guess / estimate / pin / rounds / order / match / groups / canvas
  libs.js         按需加载的 Observable Plot、Leaflet、d3、地图边界
  shell.js        游戏页外壳：加载、每日种子、存档、分享、统计
  gallery.js      首页
games/NNN-slug/   每个游戏一个目录：game.js、data.json、build/ 数据脚本、可选 game.test.mjs
scripts/          serve.mjs、check.mjs（校验 + 无头浏览器冒烟 + 截图）、registry.mjs（生成 games/index.json）
tests/            引擎测试（core 单元测试 + 无头 Chrome 里的预设测试）
```

## 测试

```bash
node --test tests/*.test.mjs            # 引擎
node scripts/check.mjs --all            # 每个游戏：meta、数据、puzzle() 确定性、自带测试、浏览器冒烟
node scripts/check.mjs 001-daylight --shot   # 单个游戏并截图到 .shots/（开始页、结果页，桌面和手机各一张）
node scripts/check.mjs 001-daylight --shot --dark --date=2026-10-04   # 深色主题、往期某一天
node scripts/registry.mjs               # 更新首页列表
```

每天的题由 `puzzle()` 根据日期确定性地生成：同一天所有人拿到同一道题，题库按种子排列循环，用完一轮才会重复。2026-10-01 是第 1 期。

13 个游戏在浏览器里实时取数（地震、天气、空气质量、潮汐、卫星轨道、维基百科浏览量、Hacker News、证书日志、雷达回波等），数据锚定在昨天或数据定稿所需的更早一天，保证同一天所有人看到同一份数据；接口取不到时自动退回 `data.json` 快照。其余游戏用构建时抓取的真实数据快照，抓取和处理脚本在各自的 `build/` 目录。
