# 💡 Findings: surfin-ld-system

## [2026-05-22] 设计变体探索的多轮链路：5 选 1 + 5 档微调 = 最少返工

**场景**：徐老师说"极简标签纸太单调，能加颜色吗？"

**经验路径**：
1. 先做 **5 个加色策略** mood board（左上小圆点 / 数字下色带 / 卡背景淡染 / 数字本身染色 / 标签胶囊），让用户从"色彩面积"维度选大方向 → 选 C（卡背景淡染）
2. 在 C 之上再做 **5 档透明度梯度** mood board（4% / 8% / 12% / 16% / 22%），让用户从"饱和度"维度选具体参数 → 选 C3（12%）
3. C3 落地实施时，针对 gold/rose 这种色相本身偏淡的色单独微调（16% / 18%），保证 8 张卡视觉等强

**核心 insight**：
- **"看到比说到更有效"在参数微调时尤其成立**。如果第一轮我自己拍板做 C3 12%，可能选错（用户实际可能想要 C2 8% 或 C4 16%）
- **二阶选择比一阶选择更精确**。一次让用户在 25 种 (5×5) 组合里选，他会瘫痪；分两次每次 5 选 1，每次 30 秒就有决策
- 这个流程总共花了约 15 分钟（写 mood board + 用户决策 + 实施），如果一次性闷头做实施大概率要返工 1-2 次，反而要 30-45 分钟
- huashu-design skill 的 "Junior Designer 先 show 再做" 哲学在 dashboard 微调场景被验证有效

**适用范围**：UI 参数调优（alpha / 字号 / spacing / 圆角等）、配色方案选择、版式微调。**不适用**：明确的功能 bug 修复、已有清晰参考的复刻、已经反复用过的常规组件实现。

## [2026-05-22] 用户报"按钮不见了"的诊断顺序：先验证服务端，再排查客户端缓存

**场景**：删除 + 重新加回主题方案按钮后，徐老师反馈"我都没有主题方案这个按钮了"。

**诊断步骤**（按时间成本递增）：
1. **服务端验证（最便宜）**：`grep "主题方案" 主项目 index.html` → 文件里有按钮代码
2. **CSS 检查**：`.theme-switcher` display: inline-flex 正常，无媒体查询隐藏
3. **DOM 实际渲染验证**：用 preview tool `getBoundingClientRect()` 查实际位置 → 按钮在 (697, 18) 完全可见、宽 94px
4. **结论**：服务端 OK + DOM 渲染 OK = 必定是客户端缓存

**Chrome disk cache 强刷三档方法**（推荐顺序）：
1. `Cmd + Shift + R`（最快）
2. DevTools → Network → Disable cache 勾上 + Cmd+R
3. DevTools 打开时右键刷新按钮 → "Empty Cache and Hard Reload"

**反 pattern**：用户报问题时**不要立刻动 HTML/CSS**，先用 preview eval / inspect 验证服务端状态。徐老师那次如果我直接动代码改"按钮不见了"，会引入新 bug 还解决不了真问题。

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
