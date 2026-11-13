# 前端补充规则

Codex 必须从 `D:/probject/ai-hub` 根目录启动并读取 [根 AGENTS.md](../AGENTS.md)。根目录不是 Git 仓库，前后端是两个独立仓库；本文件仅补充前端规则。

- 只改任务相关文件，优先局部补丁；不做无关重构、格式化或样式调整，前后检查本仓库 status 与目标 diff。
- UTF-8 无 BOM；已有文件保留原换行，新文件遵循本项目 .editorconfig 的 CRLF。不得将 LF/混合换行文件顺手统一。
- 中文读写、Git 只读、依赖/服务、敏感信息、本机 AI 文档规则遵守根文件，不在这里另设冲突规则。当前已跟踪的本文件不会因 exclude 自动解除跟踪。
- Vue SFC、Composition API、TypeScript、Pinia、Element Plus 沿现有实现；样式参考 [STYLE_GUIDE.md](STYLE_GUIDE.md)。浏览器检查仅电脑宽度 1280/1920，不做手机适配。
- 修改接口前追踪页面实际 import；主业务 apiClient 与旧 @/axios 不混用。动态菜单核对组件路径、menu-transform.ts 与后端菜单。
- 聊天修改同步核对 SSE parser、流式草稿、ToolCallChain、历史 toolCalls 和后端事件。接口/类型修改优先 pnpm ts:check；lint 脚本带 fix，未经授权不运行。
- 不编辑 node_modules/dist，不安装依赖、不启停服务、不运行 Git 写命令；临时产物放 TEMP，AI 文档放根 .codex-docs。
