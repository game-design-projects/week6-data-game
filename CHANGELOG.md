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
