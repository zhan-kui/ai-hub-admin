# 前端变更记录

本文件由用户决定纳入本仓库，每批追加实际变更，由用户提交。

## 2026-11-16 · UI-BRANDING-1

改动文件：新增src/utils/display-text.ts；接入主API、model/knowledge/segment API、AppList、两个实际聊天页、ToolCallChain、CredentialFormDialog、provider-icon、NodeConfigDrawer和CallTrace。

行为变化：平台界面/系统错误统一不区分大小写显示“AI 平台”；REST失败、非2xx、模型校验反馈、SSE系统错误与实时/历史工具错误均覆盖。错误清理内部URL/标识/已识别凭据；参数和工具只读JSON以副本隐藏内部平台/敏感字段，不修改请求、错误码或原始业务对象。动态模板字段与供应商展示名同步处理，图标URL仍保留原协议值。

范围：不修改用户正文、知识库内容、模型正常回答、接口路径、类型/枚举或模型provider运行标识。既有上传与统计批次改动保留。无SQL、配置或依赖变更，不访问Dify或数据库、不启停服务。

验证：13项离线模拟检查通过，覆盖大小写、HTTP失败/状态码、只读JSON不变性、SSE和正常业务正文保留；类型检查与生产构建结果见本机交付记录，产物在TEMP。部署需更新前端；后端模板/业务文案配套修改需用户重启生效。

## 2026-11-16 · STATS-CLEAN-1

改动文件：src/views/Dashboard/Home.vue、src/views/operation/AuditLog.vue。

行为变化：首页注明业务智能体数量不含系统应用，实际请求量包含系统应用；移除没有真实分母的百分比条与知识库静态状态指标。审计页移除4条虚构操作及规划指标，显示未接入空态，不伪造审计数据。

验证：pnpm ts:check、生产构建通过，产物在TEMP；未发送聊天/模型请求，未启停服务，浏览器视觉由用户验收。既有CHAT-UPLOAD-1修改保留。

SQL与部署：清理仅本机开发库，详见后端同批记录；前端更新后生效。无前端配置、依赖或权限变更。

## 2026-11-16 · CHAT-UPLOAD-1

改动文件：src/views/app/AppChat.vue、src/views/app/ChatPageClaudeStyle.vue。

行为变化：两个实际聊天页单文件上传限制从20 MB改为50 MB（50×1024×1024字节）。超限在前端提示文件名、50 MB上限和压缩/选择较小文件的建议，不发起上传请求；其他文件类型校验、整批预校验和逐文件上传行为不变。

SQL/配置变更：无。部署影响：需更新前端；后端配套50 MB限制需用户重启后生效，未修改Dify或启动服务。实际上传仍受下游文件类型及大小限制。

验证：两页实际校验函数的4 MiB、50 MiB、50 MiB+1字节边界检查通过；类型检查、生产构建和编码结果见本机本批交付记录。用户重启后验收真实上传，本批未调用上传接口。

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
