# 🎯 Task Plan: surfin-ld-system

## 📍 Current Focus

线上版本 `dcbc760`（2026-10-13）。第 4–18、20 项及年度累计／统一导出均已上线验收。唯一未收尾：第 19 项私有服务。

**在第 19 项启用前，公开站点不算有权限保护**：共享口令挡不住公开仓库中的数据和报告。

## 📝 Todo

- [ ] 第 19 项：确认正式账号与查看范围、HTTPS 部署位置、旧公开报告入口迁移范围，再启用私有服务（代码与隔离测试已完成，启用步骤见 `README.md`）。
- [ ] 结项报告（付玲姐 2026-10-14 提出）：样板「AI 赋能第三期」2026-10-14 已上线（不含学员姓名）。后续：挂原文链接、加其它项目、具名案例等第 19 项后再加。数据在 `assets/closeout-reports.js`（手写摘要 + 按项目名与起止日期自动汇总培训记录），页面在 `workflow.js` 的 `renderCloseout`。公开站点只放不含学员姓名的汇总结论；原文链接 `links` 暂空。
- [ ] 按需：另外四个主题在各模块下的视觉检查（暖灰主主题已完成）。
- [ ] 按需：其它模块新功能。

## ✅ Completed（摘要；细节见 git 历史与 `ProjectDocs/`）

- [2026-10-14] **项目状态标签 + 9 月台账更正**：项目进展加状态（AI 赋能第三期／海外 HR／金融小百科＝已结项，新员工入职＝阶段性已结项，AI 赋能第四期＝筹备中无数据）。金融小百科第 1–6 期总人数 260→343（三种推算一致），第 12 期补勾已发布。按 9 月 OKR 核对清单更正 sessions（9 月＝10 场／78 人次／10.5 小时／80 人时，测试锁定）；广播站新增 10-08 特别篇（`special: true`，期号 123.5 仅用于排序，各处显示“特别篇”，新建期号跳过）。待补：9-08 新员工北京场人数；9 月 OKR 内容（`okr.js`）。
- [2026-10-14] **菜单重组 + 月度 OKR 上线**：一级菜单改为 工作总览／培训记录／培训项目（项目进展、结项报告）／工作汇报（月度 OKR、年度总结）／管理者发展（案例与手册、测评报告），去掉「成果与报告」。月度页上半部分为 OKR（`assets/okr.js`，O→KR 状态＋一句结果，不写人名），下半部分为系统自动汇总数据。已收录 1、3、4、5、6、7、8 月；6 月据半年报整理、数字以系统为准（13 场／23 人次，含 6-29 两场）。2、9 月待补；新月份每月在 `okr.js` 加一段。

- [2026-10-14] **`.git` 迁出云盘**：仓库数据移至本机 `/Users/surfin/.git-repos/surfin-ld-system.git`，项目目录只留一行 `.git` 指针文件（`gitdir: ...`）。工作区仍在 Drive 同步；git 锁文件、对象、引用不再经过 Drive。注意：该指针只对这台 MacBook 有效，其它电脑需单独 clone。
- [2026-10-14] **git 仓库修复与清理**（提交 `2f8ea91`）：9 月 12 日中断的 merge 在 Google Drive 中留下锁文件，导致本地 `main` 丢失。已删锁、恢复分支并对齐 `origin/main`（`dcbc760`），工作区与线上一致；删除已合并的临时分支和过期 `.agent/` 计划、未被引用的 `assets/module-icons.png`。`_explorations/` 核实不存在。
- [2026-10-13] **年度累计与统一导出上线**（`dcbc760`）：见 `ProjectDocs/产品设计存档/2026-10-13-年度累计与导出上线验收.md`。
- [2026-09-12] **第 4–18、20 项功能迭代上线**（`44476cd`）：见 `ProjectDocs/功能迭代验收.md`。
- [2026-09-11] **暖灰工作台视觉迭代上线**（`ad23911`）：见 `ProjectDocs/产品设计存档/2026-09-11-工作台视觉迭代与上线验收.md`。
- [2026-06-03] Product Design 审查与两张概念图存档：`ProjectDocs/产品设计存档/2026-06-03-锤子OS迭代方向.md`。
- [2026-05-29] 云同步 Token 重建，范围 `coriaxu/surfin-ld-system` / `user-data.json`。
- [2026-05-22] OS 6.x 全站重设计与 5 主题切换。
- [2026-01-17] 金融小百科查看率／下载率自动计算，移除总人数默认值。

## ⚠️ 工作约定

- `.git` 已在 Drive 之外（见上）。若 `git` 报“not a git repository”，先确认 `.git` 指针文件存在且 `/Users/surfin/.git-repos/surfin-ld-system.git` 仍在；换电脑需重新 clone。
- 测试命令：`node --test tests/domain.test.cjs tests/report.test.cjs tests/sync.test.cjs tests/server.test.mjs tests/closeout.test.cjs tests/okr.test.cjs`（36 项）。
- 本机 `git fetch/push` 若卡住，多半是钥匙串弹窗；可用 `GIT_TERMINAL_PROMPT=0 git -c credential.helper= fetch origin main` 只读拉取。
