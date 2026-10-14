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

### Changed
- 地图底图：8 级及以下改用无文字的 Esri 地形晕渲，9 级及以上用灰色街道底图；Esri 灰色底图在 3–8 级会直接画出国家名和海名。
- 冒烟测试和自动游玩时关闭动画，保证截图是最终状态。

### Fixed
- `estimate` 在自定义 `format()` 已带单位时不再重复显示单位。
- #61 Funded 题库过滤掉成人内容的众筹项目。
