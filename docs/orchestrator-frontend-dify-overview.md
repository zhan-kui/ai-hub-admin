# AI Hub 前端流程编排（Dify）实现说明

> 目标：这份文档用于让新的 AI/开发者在最短时间内理解当前“基于 Dify 的前端流程编排”已经做了什么、接口怎么对接、核心逻辑如何运行。

## 1. 功能总览（已实现）

当前前端已实现两套“创建应用”路径，共用同一路由入口：

1. 模板模式（`mode != blank`）  
通过后端提供的模板清单，选择模板 -> 填应用元信息 -> 配置模板里可编辑节点参数 -> 创建 Dify 应用。
2. 自由画布模式（`mode=blank`）  
基于 Vue Flow 自由拖拽节点、连线、编辑节点配置，经过前端规则校验后提交完整 flow JSON 给后端创建 Dify 应用。

已支持节点类型：

1. `start`
2. `llm`
3. `if-else`
4. `answer`

并已实现：

1. 节点拖拽/点击新增
2. 连线规则限制（含 if 分支 handle 约束）
3. 画布校验（结构 + 业务规则 + 可达性 + 环检测）
4. 草稿自动保存 / 恢复
5. 提交前 payload 组装

## 2. 路由与页面入口

- 路由：`/apps/orchestrator/create`
- 文件：`src/router/index.ts`
- 页面入口：`src/views/app/orchestrator/index.vue`

`index.vue` 通过 query 参数切换模式：

```ts
const mode = computed(() => (route.query.mode as string | undefined) || 'template')
```

- `mode === 'blank'` => 渲染 `canvas/index.vue`（自由画布）
- 其他 => 渲染 `TemplateMode.vue`（模板模式）

## 3. 前端 API 对接（orchestrationApi）

位置：`src/api/frontend-api.ts`

### 3.1 接口列表

1. `GET /dify/app/templates`
- 方法：`orchestrationApi.listTemplates()`
- 用途：拉取模板列表（模板模式入口数据）

2. `GET /dify/app/templates/:code`
- 方法：`orchestrationApi.getTemplate(code)`
- 用途：获取单模板详情（当前代码保留接口，模板模式首版可不强依赖）

3. `POST /dify/app/create-from-template`
- 方法：`orchestrationApi.createFromTemplate(payload)`
- 用途：按模板配置创建应用

4. `POST /dify/app/create-from-canvas`
- 方法：`orchestrationApi.createFromCanvas(payload)`
- 用途：按自由画布 flow 创建应用

### 3.2 核心类型

- 模板模式类型：`src/views/app/orchestrator/types.ts`
  - `TemplateMeta`
  - `CreateFromTemplateRequest`
  - `CreateFromTemplateResponse`
- 画布模式类型：`src/views/app/orchestrator/canvas/types.ts`
  - `CanvasFlowPayload`
  - `CanvasFlowNode`
  - `CanvasFlowEdge`
  - `CanvasDraft`

## 4. 模板模式逻辑（TemplateMode.vue）

位置：`src/views/app/orchestrator/TemplateMode.vue`

## 4.1 页面流程

1. `onMounted` 调 `listTemplates` 加载模板
2. 选择模板后，按模板节点字段初始化 `nodeConfigs`
3. 点击模板节点（editable=true）打开 `NodeConfigDrawer` 编辑字段
4. 点击“创建并发布”时执行必填校验并组装 payload
5. 调 `createFromTemplate` 成功后返回应用列表

### 4.2 配置抽屉（NodeConfigDrawer）

位置：`src/views/app/orchestrator/components/NodeConfigDrawer.vue`

特点：

1. 动态渲染字段类型：`input | textarea | select | input-number | switch`
2. 对 `model.name` 自动使用 `MODEL_OPTIONS`
3. 必填字段校验后回写 `nodeConfigs[nodeId]`

### 4.3 模板创建 payload 结构

```ts
interface CreateFromTemplateRequest {
  templateCode: string
  appMeta: {
    name: string
    description: string
    icon: string
    iconBackground: string
  }
  nodes: Array<{
    id: string
    type: string
    config: Record<string, any>
  }>
}
```

说明：

1. `nodes` 仅提交模板中 `editable=true` 的节点
2. 如果 `config['model.name']` 命中 `MODEL_OPTIONS`，前端会自动补 `config['model.provider']`

## 5. 自由画布模式逻辑（canvas/index.vue）

核心文件：

1. 页面总控：`src/views/app/orchestrator/canvas/index.vue`
2. 画布状态：`useCanvasState.ts`
3. 校验：`useValidation.ts`
4. 草稿：`useDraftStorage.ts`
5. payload 组装：`payload-builder.ts`
6. 节点工厂/工具：`utils.ts`

### 5.1 组件协作

1. `NodePanel.vue`：左侧节点面板（拖拽/点击新增）
2. `Canvas.vue`：Vue Flow 容器，透传 `nodes/edges` 与事件
3. `Toolbar.vue`：视图适配、删选中、清草稿、创建
4. `AppMetaBar.vue`：应用元信息编辑
5. `LlmInspector/IfElseInspector/AnswerInspector`：节点属性抽屉

### 5.2 默认图与状态初始化

`useCanvasState` 初始化时自动注入一个 `start` 节点：

```ts
const nodes = ref<CanvasGraphNode[]>([decorateNode(createStartNode())])
const edges = ref<CanvasGraphEdge[]>([])
const viewport = ref<CanvasViewport>({ x: 0, y: 0, zoom: 1 })
```

并提供：

1. `addNode`
2. `updateNodeData`
3. `setGraph`
4. `setViewport`
5. `resetGraph`

## 6. 节点模型与默认数据

位置：`src/views/app/orchestrator/canvas/types.ts` + `utils.ts`

### 6.1 节点数据结构

1. `start`: 仅标题
2. `llm`:
  - `systemPrompt`
  - `userPromptTemplate`
  - `model`（provider/name/temperature/enableThinking/reasoningEffort）
  - `memory`（enabled/windowSize）
3. `if-else`:
  - `cases[]`（每个 case: id/label/operator/value）
4. `answer`: 仅标题

### 6.2 默认值策略

1. LLM 默认模型来自 `DEFAULT_MODEL`
2. if-else 新建时自动带 1 条默认分支
3. `start` 节点固定 id：`node_start_001`

## 7. 连线规则（前端实时约束）

主要在 `canvas/index.vue` 的 `canConnect(connection)` 内实现。

### 7.1 通用限制

1. `source/target` 不能为空
2. 不允许自环（`source === target`）
3. 不允许重复边（同 source/target/sourceHandle）
4. 不允许产生环（会做 DFS 检测）

### 7.2 节点类型限制

1. `target` 不能是 `start`
2. `answer` 不能作为 `source`
3. `start`
  - 最多 1 条出线
  - 仅可连 `llm` / `if-else`
4. `llm`
  - 最多 1 条出线
  - 可连 `llm` / `if-else` / `answer`
5. `if-else`
  - 不能直连 `answer`
  - 必须从有效 `case handle` 拉线
  - 每个 case 最多 1 条出线
6. `llm / if-else / answer` 入线数量限制也会同步检查（如 `llm`、`if-else`、`answer` 默认最多 1 入线）

### 7.3 连接事件防御

`handleConnect` 里会再次做防御判断：

1. source/target 存在性
2. source/target 节点存在性
3. `canConnect` 二次校验
4. if 节点必须有 `sourceHandle`

然后创建新边并写入 flow store。

## 8. 提交前完整校验（useValidation）

位置：`src/views/app/orchestrator/canvas/useValidation.ts`

校验维度包括：

1. 基础信息
  - 应用名非空
  - 节点数量上限（`MAX_NODES`）
2. 图结构合法性
  - 节点 id 唯一
  - 边的 source/target 必须存在
  - 边不可重复
  - 不可自环
3. 节点规则
  - 必须且仅 1 个 `start`
  - 至少 1 个 `answer`
  - 各类型入/出线数量、可连接目标类型检查
  - LLM 必填字段（systemPrompt/model provider/model name）
  - if-else 分支数量与字段完整性检查
  - if case 出线必须一一对应
4. 全局规则
  - 不允许环
  - 每个 `answer` 必须从 `start` 可达

提交时：

```ts
const result = validateNow()
if (!result.valid) {
  ElMessage.error(result.errors[0] || '流程校验未通过')
  return
}
```

## 9. 草稿保存/恢复机制

位置：`src/views/app/orchestrator/canvas/useDraftStorage.ts`

策略：

1. key：`aihub:orchestrator:canvas-draft:v2`
2. 监听 `appMeta/nodes/edges/viewport` 深度变化
3. `500ms` 防抖后写入 `localStorage`
4. 页面进入时若有草稿，弹窗询问恢复
5. 清空草稿时同时清画布并重置 appMeta

## 10. 提交 payload 组装（create-from-canvas）

位置：`src/views/app/orchestrator/canvas/payload-builder.ts`

构造入口：

```ts
buildCanvasFlowPayload({
  appMeta,
  nodes,
  edges,
  viewport
})
```

输出结构：

```ts
interface CanvasFlowPayload {
  appMeta: CanvasAppMeta
  flow: {
    nodes: CanvasFlowNode[]
    edges: CanvasFlowEdge[]
    viewport: CanvasViewport
  }
}
```

边映射规则：

1. 普通边：`source` / `target`
2. if-else 边：额外携带 `sourceCaseId = edge.sourceHandle`

## 11. 与 Dify 对接的关键约定

1. 模型字段约定：前端维护 `MODEL_OPTIONS`（`name + provider`），选择模型后要保证 provider 正确。
2. if 分支约定：前端通过 `sourceHandle` 标识分支，提交时映射为 `sourceCaseId`。
3. Answer 节点：当前前端只维护结构与标题，具体回复内容由后端/编排引擎基于上游节点生成。
4. 连线/拓扑：前端会尽可能提前阻断非法图，降低后端拒绝率。

## 12. 关键文件索引（给 AI 快速定位）

1. `src/api/frontend-api.ts`  
编排 API 定义（templates / create-from-template / create-from-canvas）

2. `src/views/app/orchestrator/index.vue`  
路由模式分发入口

3. `src/views/app/orchestrator/TemplateMode.vue`  
模板模式主流程

4. `src/views/app/orchestrator/components/NodeConfigDrawer.vue`  
模板节点参数抽屉

5. `src/views/app/orchestrator/canvas/index.vue`  
自由画布主流程（连线、编辑、提交）

6. `src/views/app/orchestrator/canvas/useValidation.ts`  
完整流程校验规则

7. `src/views/app/orchestrator/canvas/payload-builder.ts`  
画布 payload 组装

8. `src/views/app/orchestrator/canvas/useDraftStorage.ts`  
草稿保存/恢复

9. `src/views/app/orchestrator/canvas/components/nodes/*.vue`  
自定义节点渲染 + Handle 定义

10. `src/views/app/orchestrator/canvas/components/inspectors/*.vue`  
LLM / IF / Answer 节点编辑面板

## 13. 当前可继续迭代方向（建议）

1. 模型列表改为后端动态拉取（替代部分硬编码 `MODEL_OPTIONS`）
2. 统一模板模式与自由画布模式的字段 schema 机制（减少双份配置）
3. 增加流程导入/导出（JSON）
4. 增加节点运行预览与逐节点调试能力
5. 把前端校验错误码结构化，便于后端与 UI 一致化提示

