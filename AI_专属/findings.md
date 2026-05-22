# 💡 Findings: surfin-ld-system

## [2026-05-22] HTML inline `<style>` → 多 CSS 模块迁移的关键陷阱

- **症状**：AI 分享月 Timeline 点开后所有图标变成填满整个屏幕的巨型五角星。
- **根因**：原 `index.html` 的 `<style>` 块里有 `.step-icon svg { width: 18px; height: 18px; }` 这条尺寸约束规则。OS 6.x 重写时把整个 `<style>` 替换成 8 个 CSS 模块，但 `.timeline-step` / `.step-icon` / `.step-card` 这套 timeline 样式整套漏迁了。SVG 在 flex 容器里没有显式尺寸约束时会撑满父容器。
- **教训**：一次性 HTML `<style>` 块切到多模块 CSS 是高风险操作。验收点不是"模块化代码看起来是否完整"，而是"原 inline CSS 里的每一条规则是否都有对应迁移"。下次做类似迁移要：
  - 先把原 `<style>` 块完整提取成临时文件
  - 按模块切分时用 `diff` 校验每一条 selector 都进了某个模块
  - 重点检查所有 `svg`、`img`、`canvas` 这类有内禀尺寸的元素的尺寸约束规则
- **附带教训**：徐老师反馈"图标变巨"时，第一直觉是去查 SVG 本身或 viewBox 配置，但真正根因往往在更上层的 CSS 规则缺失上。诊断时先 grep 该 selector 在所有 CSS 模块里是否有定义，再看具体规则。

## [2026-05-22] 侧边栏伸缩的二态律：不留半收态

- **症状**：原 `.sidebar.collapsed` 收缩后留一条 64px 的图标条，徐老师看到后明确拒绝："要么完全展开，要么彻底消失"。
- **原理**：半收态在设计上看似"省空间又保留导航"，但实际上是两种期望的妥协——既不像桌面工作台（要求全宽内容）也不像移动端 drawer（要求干净视野）。徐老师的判断是：用户在桌面端按收缩按钮时，意图就是"我要全宽内容做事"，留图标条反而干扰。
- **实现**：`.sidebar.collapsed { transform: translateX(-100%); pointer-events: none; }` + `.sidebar.collapsed ~ .main-wrapper { margin-left: 0; }` + topbar 同步贴左。复原靠 topbar 左上角的开关按钮（`.main-wrapper.expanded .topbar-open-btn { display: inline-flex; }`）。

## [2026-01-17] 金融小百科自动计算逻辑

- **逻辑实现**：通过 `addEventListener('input', ...)` 监听已读、下载和总人数的变化。
- **计算逻辑**：
  - 查看率 = 已读人数 / 公司总人数 \* 100
  - 下载率 = 下载人数 / 公司总人数 \* 100
- **UI 优化**：使用 `readonly` 属性配合 CSS `cursor: not-allowed` 和背景色置灰，明确告诉用户该字段是自动生成的，增强系统感。
- **数据反馈**：徐老师提到不同期的样本量（总人数）可能不同，系统应追求灵活性而非僵硬的默认值。
