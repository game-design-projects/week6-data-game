# Daily Data

![](./docs/gallery.png)

一组用公开数据每天自动出题的小游戏（NYU Lecture 6 · daily data game 作业）。点子清单见 Claude Docs 文档《数据日更游戏：100 个点子》。

- 首页 `index.html` 列出全部游戏；每个游戏是 `play.html?g=<目录名>`。
- 不需要构建步骤，纯 ES module。本地运行：

```bash
node scripts/serve.mjs 8787      # → http://localhost:8787/
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
tests/            引擎单元测试
```

## 测试

```bash
node --test tests/*.test.mjs            # 引擎
node scripts/check.mjs --all            # 每个游戏：meta、数据、puzzle() 确定性、自带测试、浏览器冒烟
node scripts/check.mjs 001-daylight --shot   # 单个游戏并截图到 .shots/
node scripts/registry.mjs               # 更新首页列表
```

每天的题由 `puzzle()` 根据日期确定性地生成：同一天所有人拿到同一道题，题库按种子排列循环，用完一轮才会重复。2026-10-01 是第 1 期。
