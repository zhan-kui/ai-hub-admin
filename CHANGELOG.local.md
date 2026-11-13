# 前端变更记录

本文件由用户决定纳入本仓库，每批追加实际变更，由用户提交。

## 2026-11-13 · INIT-1

改动文件：

- `AGENTS.md`：精简为前端补充规则，引用根规则；消除强制统一 CRLF 的冲突，保留已有文件原换行。
- `src/api/frontend-api.ts`：恢复 1 处有依据的流式聊天注释；另 3 处按实际 API 默认地址/环境覆盖、Agent SSE 请求含义重写，属于「重写注释，非恢复原文」。
- `src/components/UserInfo/src/components/LockPage.vue`：恢复「解锁」「返回登录」两条注释。
- 以下 12 个文件仅移除头部 UTF-8 BOM，后续字节不变：`.env.base`、`.env.development`、`.env.production`、`src/App.vue`、`src/components/Chat/MarkdownRenderer.vue`、`src/layout/components/SidebarMenuItem.vue`、`src/views/Error/NotFound.vue`、`src/views/Redirect/index.vue`、`src/views/ai/agent/AgentChat.vue`、`src/views/common/ParentView.vue`、`src/views/common/RoutePlaceholder.vue`、`src/views/user/Profile.vue`。`.env.production` 原混合换行保持。
- `.git/info/exclude`（仅本机）：配置 AI 文档忽略及重装副本；本次补充移除 `/CHANGELOG.local.md`，允许本文件进入本仓库。
- `CHANGELOG.local.md`：新增本批详细记录；后续本仓库实际变更均追加到本文件，根总账只记批次与项目索引。

行为变化：上述原始 INIT-1 源码变动只涉及 BOM 和注释，无业务接口、运行逻辑或页面布局变化；文档规则调整不改变业务行为。本次明确本文件属于可入库项目记录，其余本机 AI 文档仍按原规则隔离。

SQL：无；未访问数据库。

部署影响：原始 INIT-1 无前端接口或依赖变更，无需为文档调整重启服务。原始验证中类型检查与生产构建通过；本次仅检查文档/编码与 Git 状态，不运行 pnpm、构建或提交钩子。

### INIT-1 补充：移除 commitlint 与分项目变更记录

用户已执行依赖移除，并删除 `.husky/commit-msg`。只读核对确认该钩子不存在，`package.json` 不再包含 commitlint 依赖、配置或脚本。提交 `34e0bb6` 已包含用户的移除：`package.json` 删除 2 行；`pnpm-lock.yaml` 新增 2,111 行、删除 5,191 行，共改动 7,302 行。两文件合计新增 2,111 行、删除 5,193 行。核对时工作区/暂存区中这两个文件无差异；未重写锁文件，不能把全部锁文件差异归为仅删去两个依赖条目。

本次删除的残留：前端根目录 `commitlint.config.cjs`。工作区根目录没有 `commitlint.config.*` 残留；没有需要删除的 package.json 配置/脚本。

行为变化：不再由 commitlint 限制提交信息格式；`.husky/pre-commit` 保留，仍运行 `npm run ts:check` 和 `npm run lint:lint-staged`。后者按 `.husky/lintstagedrc.cjs` 对暂存文件匹配规则执行 eslint/prettier，Vue/样式等还会运行 stylelint；不是所有文件都会运行全部工具。本次未执行这些命令，也未修改这些钩子。

SQL：无。部署影响：用户移除 commitlint 影响开发依赖与提交校验，不改变生产业务接口；本次只清理残留配置和记录规则，不安装依赖、不启停服务、不执行 Git 写操作。
