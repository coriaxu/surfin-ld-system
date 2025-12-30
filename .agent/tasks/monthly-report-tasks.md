# 📋 月度数据结构化总结功能 - 任务清单

> **项目**：Surfin L&D 月度数据结构化总结 (Monthly Insight Report)
> **方案**：B「智能报告」双导出版
> **核心目标**：实现 PDF (咨询风格) + Excel (数据源) 双格式导出
> **创建时间**：2025-12-30

---

## 🚀 任务分解

### 阶段 1：基础组件与逻辑 ✅

- [ ] **Task 1.1** 依赖库引入

  - 检查 `jsPDF` 和 `html2canvas` 引入状态
  - 引入 `xlsx` (SheetJS) 库用于 Excel 导出

- [ ] **Task 1.2** 入口按钮开发

  - 在 Dashboard 顶部工具栏添加「📊 月度总结」按钮
  - 样式复用现有 secondary button 风格

- [ ] **Task 1.3** 导出弹窗开发 (UI)
  - 创建 Modal 结构：`id="modal-monthly-report"`
  - 月份选择器（自动生成最近 12 个月选项）
  - 导出格式复选框（PDF & Excel 默认全选）
  - 内容模块勾选列表

### 阶段 2：数据处理层 ✅

- [ ] **Task 2.1** 数据聚合函数

  - `getMonthlyData(year, month)`
  - 聚合培训场次、预算开销、AI 知识库数据
  - 计算环比变化率

- [ ] **Task 2.2** Excel 生成逻辑
  - 构建 Workbook 对象
  - Sheet 1: 概览 (Overview)
  - Sheet 2: 培训明细 (Training)
  - Sheet 3: 预算表 (Budget)
  - Sheet 4: AI 数据 (AI Knowledge)
  - 导出文件命名：`Surfin_L&D_Monthly_Report_2025-12.xlsx`

### 阶段 3：顶级 PDF 渲染层 (核心) ✅

- [ ] **Task 3.1** PDF 隐藏渲染容器

  - 创建 `#pdf-render-container` (off-screen)
  - 设置 A4 比例固定尺寸 (595px \* 842px 放大倍数)

- [ ] **Task 3.2** PDF 样式开发 (CSS)

  - **Consulting Theme**: 深蓝配色 (`--pdf-primary: #0f172a`, `--pdf-accent: #0ea5e9`)
  - **Header**: 玻璃质感刊头，右侧 Logo
  - **KPI Cards**: HUD 风格数据卡片，微发光边框
  - **Tables**: 极简线条，隔行变色 (AliceBlue)

- [ ] **Task 3.3** PDF 内容填充逻辑

  - 动态注入所选月份数据到渲染容器
  - 处理空数据状态

- [ ] **Task 3.4** PDF 生成与下载
  - `html2canvas` 截图渲染容器 -> Canvas
  - `jsPDF` 将 Canvas 转为 PDF
  - 文件命名：`Surfin_Monthly_Insight_2025-12.pdf`

### 阶段 4：交互串联与测试 ✅

- [ ] **Task 4.1** 弹窗交互逻辑

  - 按钮点击 -> 打开弹窗 -> 选择参数 -> 点击生成
  - 生成过程 Loading 状态 (Toast: "正在渲染咨询级报告...")

- [ ] **Task 4.2** 功能测试
  - 测试 Excel 数据准确性
  - 测试 PDF 视觉还原度
  - 测试跨月数据切换

---

## 📝 执行日志

| 时间       | 任务         | 状态      | 备注 |
| ---------- | ------------ | --------- | ---- |
| 2025-12-30 | 任务清单生成 | ⏳ 待开始 |      |
