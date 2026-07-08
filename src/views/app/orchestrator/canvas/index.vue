<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import type {
  Connection,
  Edge,
  ValidConnectionFunc,
  ViewportTransform,
  VueFlowStore
} from '@vue-flow/core'
import { ContentWrap } from '@/components/ContentWrap'
import { orchestrationApi, workflowApi } from '@/api/frontend-api'
import Canvas from './components/Canvas.vue'
import NodePanel from './components/NodePanel.vue'
import Toolbar from './components/Toolbar.vue'
import AppMetaBar from './components/AppMetaBar.vue'
import StartInspector from './components/inspectors/StartInspector.vue'
import LlmInspector from './components/inspectors/LlmInspector.vue'
import IfElseInspector from './components/inspectors/IfElseInspector.vue'
import AnswerInspector from './components/inspectors/AnswerInspector.vue'
import KnowledgeInspector from './components/inspectors/KnowledgeInspector.vue'
import { DEFAULT_ICON, DEFAULT_ICON_BG, DEFAULT_VIEWPORT, MAX_NODES } from './constants'
import { buildCanvasSnapshot, restoreCanvasSnapshot } from './snapshot-builder'
import { useCanvasState } from './useCanvasState'
import { useValidation } from './useValidation'
import type {
  AnswerNodeData,
  CanvasAppMeta,
  CanvasNodeType,
  IfElseNodeData,
  KnowledgeRetrievalNodeData,
  LlmNodeData,
  StartNodeData
} from './types'
import { genEdgeId, isDuplicateEdge } from './utils'

const router = useRouter()
const route = useRoute()
const props = defineProps<{
  editId?: number
  workflowMode?: boolean
}>()
const flowStore = ref<VueFlowStore>()

// 数据结构中保留 appMeta 默认值，以保证保存 Snapshot 时数据格式的完备性
const appMeta = ref<CanvasAppMeta>({
  name: '',
  description: '',
  icon: DEFAULT_ICON,
  iconBackground: DEFAULT_ICON_BG,
  iconImage: ''
})

const { nodes, edges, viewport, addNode, updateNodeData, setGraphFromFlow, setViewport } =
  useCanvasState()
const { errors, warnings, validateNow } = useValidation(appMeta, nodes, edges)

const isEditMode = computed(() => Number.isFinite(props.editId))
const isWorkflowMode = computed(() => props.workflowMode === true)
const saving = ref(false)
const version = ref<number | undefined>(undefined)
const bindingCount = ref(0)
const inspectorVisible = ref(false)
const editingNodeId = ref('')
const pageTitle = computed(() =>
  isWorkflowMode.value
    ? isEditMode.value
      ? `编辑工作流：${appMeta.value.name || ''}`
      : '创建工作流'
    : isEditMode.value
      ? `编辑智能体：${appMeta.value.name || ''}`
      : '从空白编排创建智能体'
)
const pageMessage = computed(() =>
  isWorkflowMode.value
    ? '工作流可被多个 Chatflow 应用绑定，保存后需要相关应用重新发布才会生效'
    : isEditMode.value
      ? '编辑已保存的画布流程，点击保存后仅更新前端快照'
      : '拖拽节点、连线配置后保存前端快照'
)

const editingNode = computed(() => nodes.value.find((node) => node.id === editingNodeId.value))
const editingStartData = computed<StartNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'start') return editingNode.value.data as StartNodeData
  return null
})
const editingLlmData = computed<LlmNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'llm') return editingNode.value.data as LlmNodeData
  return null
})
const editingIfData = computed<IfElseNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'if-else')
    return editingNode.value.data as IfElseNodeData
  return null
})
const editingKnowledgeData = computed<KnowledgeRetrievalNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'knowledge-retrieval')
    return editingNode.value.data as KnowledgeRetrievalNodeData
  return null
})
const editingAnswerData = computed<AnswerNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'answer')
    return editingNode.value.data as AnswerNodeData
  return null
})
const isEditingAnswerConnectedFromIfElse = computed(() => {
  if (!editingAnswerData.value || !editingNode.value) return false
  const incomer = edges.value.find((edge) => edge.target === editingNode.value?.id)
  if (!incomer) return false
  return getNodeById(incomer.source)?.data?.nodeType === 'if-else'
})
const selectedCount = computed(
  () =>
    nodes.value.filter((node) => node.selected === true).length +
    edges.value.filter((edge) => edge.selected === true).length
)

let pendingRestoreViewport: ViewportTransform | null = null
const initialViewport = ref<ViewportTransform>({ ...DEFAULT_VIEWPORT })

function cloneViewport(nextViewport: ViewportTransform): ViewportTransform {
  return {
    x: nextViewport.x,
    y: nextViewport.y,
    zoom: nextViewport.zoom
  }
}

async function applyFlowViewport(
  nextViewport: ViewportTransform,
  options?: { rememberAsInitial?: boolean }
) {
  const normalizedViewport = cloneViewport(nextViewport)
  setViewport(normalizedViewport)

  if (options?.rememberAsInitial) {
    initialViewport.value = cloneViewport(normalizedViewport)
  }

  if (flowStore.value) {
    pendingRestoreViewport = null
    await flowStore.value.setViewport(normalizedViewport)
    return
  }

  pendingRestoreViewport = normalizedViewport
}

function getNodeById(nodeId: string) {
  return nodes.value.find((node) => node.id === nodeId)
}

function hasCycleWithConnection(
  source: string,
  target: string,
  existingEdges: Array<{ source: string; target: string }>
): boolean {
  const adjacency = new Map<string, string[]>()
  for (const node of nodes.value) adjacency.set(node.id, [])
  for (const edge of existingEdges) {
    adjacency.get(edge.source)?.push(edge.target)
  }
  adjacency.get(source)?.push(target)

  const visiting = new Set<string>()
  const visited = new Set<string>()

  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)

    const list = adjacency.get(nodeId) || []
    for (const next of list) {
      if (dfs(next)) return true
    }

    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  for (const node of nodes.value) {
    if (dfs(node.id)) return true
  }
  return false
}

function canConnect(connection: Connection): boolean {
  const sourceId = connection.source
  const targetId = connection.target
  if (!sourceId || !targetId) return false
  if (sourceId === targetId) return false

  const sourceNode = getNodeById(sourceId)
  const targetNode = getNodeById(targetId)
  if (!sourceNode || !targetNode) return false

  const currentEdgeId = String((connection as Partial<Edge>).id || '')
  const comparableEdges = currentEdgeId
    ? edges.value.filter((edge) => String(edge.id || '') !== currentEdgeId)
    : edges.value

  if (isDuplicateEdge(comparableEdges, sourceId, targetId, connection.sourceHandle)) return false

  const sourceType = sourceNode.data?.nodeType
  const targetType = targetNode.data?.nodeType
  if (!sourceType || !targetType) return false

  const sourceOutgoers = comparableEdges.filter((edge) => edge.source === sourceId)
  const targetIncomers = comparableEdges.filter((edge) => edge.target === targetId)

  if (targetType === 'start') return false
  if (sourceType === 'answer') return false

  if (sourceType === 'start') {
    if (sourceOutgoers.length >= 1) return false
    if (
      targetType !== 'llm' &&
      targetType !== 'if-else' &&
      targetType !== 'knowledge-retrieval' &&
      targetType !== 'answer'
    ) {
      return false
    }
  }

  if (sourceType === 'llm') {
    if (sourceOutgoers.length >= 1) return false
    if (
      targetType !== 'llm' &&
      targetType !== 'if-else' &&
      targetType !== 'knowledge-retrieval' &&
      targetType !== 'answer'
    ) {
      return false
    }
  }

  if (sourceType === 'if-else') {
    const caseId = connection.sourceHandle
    const ifData = sourceNode.data as IfElseNodeData
    const caseIdSet = new Set(ifData.cases.map((item) => item.id))
    const elseEnabled = ifData.elseEnabled !== false
    const isElseHandle = caseId === 'false'
    const isCaseHandle = !!caseId && caseIdSet.has(caseId)
    if (!caseId || (!isCaseHandle && !(elseEnabled && isElseHandle))) return false

    const caseOutCount = sourceOutgoers.filter((edge) => edge.sourceHandle === caseId).length
    if (caseOutCount >= 1) return false

    if (targetType !== 'llm' && targetType !== 'knowledge-retrieval' && targetType !== 'answer') {
      return false
    }
  }

  if (sourceType === 'knowledge-retrieval') {
    if (sourceOutgoers.length >= 1) return false
    if (targetType !== 'llm') return false
  }

  if (sourceType !== 'if-else' && connection.sourceHandle && connection.sourceHandle !== 'source') {
    return false
  }

  if (targetType === 'llm' && targetIncomers.length >= 1) return false

  if (targetType === 'if-else') {
    if (targetIncomers.length >= 1) return false
    if (sourceType !== 'start' && sourceType !== 'llm') return false
  }

  if (targetType === 'knowledge-retrieval') {
    if (targetIncomers.length >= 1) return false
    if (sourceType !== 'start' && sourceType !== 'llm' && sourceType !== 'if-else') return false
  }

  if (targetType === 'answer') {
    if (targetIncomers.length >= 1) return false
    if (sourceType !== 'start' && sourceType !== 'llm' && sourceType !== 'if-else') return false
  }

  if (hasCycleWithConnection(sourceId, targetId, comparableEdges)) return false

  return true
}

const isValidConnection: ValidConnectionFunc = (connection) => {
  return canConnect(connection as Connection)
}

function calcCanvasPositionFromViewport(clientX: number, clientY: number, bounds: DOMRect) {
  const nextX = (clientX - bounds.left - viewport.value.x) / viewport.value.zoom
  const nextY = (clientY - bounds.top - viewport.value.y) / viewport.value.zoom
  return { x: nextX, y: nextY }
}

function addNodeAt(nodeType: Exclude<CanvasNodeType, 'start'>, position: { x: number; y: number }) {
  if (nodes.value.length >= MAX_NODES) {
    ElMessage.warning(`节点数量不能超过 ${MAX_NODES}`)
    return
  }
  addNode(nodeType, position)
}

function handleAddNode(nodeType: Exclude<CanvasNodeType, 'start'>) {
  addNodeAt(nodeType, {
    x: (260 - viewport.value.x) / viewport.value.zoom,
    y: (220 - viewport.value.y) / viewport.value.zoom
  })
}

function handleDropNode(payload: {
  nodeType: Exclude<CanvasNodeType, 'start'>
  clientX: number
  clientY: number
  bounds: DOMRect
}) {
  addNodeAt(
    payload.nodeType,
    calcCanvasPositionFromViewport(payload.clientX, payload.clientY, payload.bounds)
  )
}

function handleConnect(connection: Connection) {
  const source = typeof connection.source === 'string' ? connection.source : ''
  const target = typeof connection.target === 'string' ? connection.target : ''
  if (!source || !target) {
    ElMessage.warning('连线缺少起点或终点')
    return
  }

  const sourceNode = getNodeById(source)
  const targetNode = getNodeById(target)
  if (!sourceNode || !targetNode) {
    ElMessage.warning('连线节点不存在')
    return
  }

  if (!canConnect({ ...connection, source, target })) {
    ElMessage.warning('当前连线不符合规则')
    return
  }

  if (sourceNode.data?.nodeType === 'if-else' && !connection.sourceHandle) {
    ElMessage.warning('条件分支连线必须从某个分支连接点拖出')
    return
  }

  const newEdge = {
    id: genEdgeId(),
    source,
    target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    type: 'smoothstep',
    animated: true
  }

  if (flowStore.value) {
    flowStore.value.addEdges([newEdge])
  } else {
    edges.value.push(newEdge)
  }

  if (sourceNode.data?.nodeType === 'if-else' && targetNode.data?.nodeType === 'answer') {
    const nextData = {
      ...(targetNode.data as AnswerNodeData),
      answerMode: 'static' as const,
      answerText: (targetNode.data as AnswerNodeData).answerText || ''
    }
    updateNodeData(targetNode.id, nextData)
  }
}

function isAnswerConnectedFromIfElse(nodeId: string): boolean {
  const incomer = edges.value.find((edge) => edge.target === nodeId)
  if (!incomer) return false
  return getNodeById(incomer.source)?.data?.nodeType === 'if-else'
}

function handleNodeClick(nodeId: string) {
  const node = getNodeById(nodeId)
  if (!node || !node.data) return

  if (node.data.nodeType === 'answer' && isAnswerConnectedFromIfElse(nodeId)) {
    const nextData = { ...(node.data as AnswerNodeData), answerMode: 'static' as const }
    updateNodeData(nodeId, nextData)
  }

  editingNodeId.value = nodeId
  inspectorVisible.value = true
}

function handlePaneClick() {
  editingNodeId.value = ''
  inspectorVisible.value = false
}

function applyEditedNodeData(
  nextData:
    | StartNodeData
    | LlmNodeData
    | IfElseNodeData
    | KnowledgeRetrievalNodeData
    | AnswerNodeData
) {
  if (!editingNode.value) return

  if (nextData.nodeType === 'answer' && isAnswerConnectedFromIfElse(editingNode.value.id)) {
    nextData.answerMode = 'static'
  }

  updateNodeData(editingNode.value.id, nextData)

  if (nextData.nodeType === 'if-else') {
    const caseIdSet = new Set(nextData.cases.map((item) => item.id))
    const elseEnabled = nextData.elseEnabled !== false

    const edgesToKeep = edges.value.filter(
      (edge) =>
        edge.source !== editingNode.value?.id ||
        !edge.sourceHandle ||
        caseIdSet.has(edge.sourceHandle) ||
        (elseEnabled && edge.sourceHandle === 'false')
    )

    edges.value.splice(0, edges.value.length, ...edgesToKeep)
  }

  inspectorVisible.value = false
}

function handleDeleteSelected() {
  const selectedNodeIds = new Set(
    nodes.value
      .filter((node) => node.selected === true && node.data?.nodeType !== 'start')
      .map((node) => node.id)
  )
  const hasSelectedStart = nodes.value.some(
    (node) => node.selected === true && node.data?.nodeType === 'start'
  )
  if (hasSelectedStart) {
    ElMessage.warning('start 节点不允许删除')
  }

  const selectedEdgeIds = new Set(
    edges.value.filter((edge) => edge.selected === true).map((edge) => edge.id)
  )

  nodes.value = nodes.value.filter((node) => !selectedNodeIds.has(node.id))
  edges.value = edges.value.filter(
    (edge) =>
      !selectedEdgeIds.has(edge.id) &&
      !selectedNodeIds.has(edge.source) &&
      !selectedNodeIds.has(edge.target)
  )
}

function handleFitView() {
  void applyFlowViewport(initialViewport.value)
}

function handleCancel() {
  navigateBack()
}

function resolveReturnPath(): string | null {
  const rawFrom = route.query.from
  const from = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom
  if (typeof from !== 'string') return null
  const trimmed = from.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('/agents/orchestrator/create')) return null
  if (trimmed.startsWith('/workflows/editor')) return null
  return trimmed
}

function navigateBack() {
  const returnPath = resolveReturnPath()
  if (returnPath) {
    void router.push(returnPath)
    return
  }
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/dashboard/home')
}

function handlePaneReady(store: VueFlowStore) {
  flowStore.value = store
  if (pendingRestoreViewport) {
    const nextViewport = cloneViewport(pendingRestoreViewport)
    pendingRestoreViewport = null
    initialViewport.value = cloneViewport(nextViewport)
    void flowStore.value.setViewport(nextViewport)
    return
  }
  initialViewport.value = cloneViewport(viewport.value)
}

function handleViewportChange(nextViewport: ViewportTransform) {
  setViewport({
    x: nextViewport.x,
    y: nextViewport.y,
    zoom: nextViewport.zoom
  })
}

function buildSubmitPayload() {
  return buildCanvasSnapshot({
    appMeta: {
      name: appMeta.value.name.trim(),
      description: appMeta.value.description?.trim() || '',
      icon: appMeta.value.icon.trim(),
      iconBackground: appMeta.value.iconBackground || DEFAULT_ICON_BG,
      iconImage: appMeta.value.iconImage || ''
    },
    nodes: nodes.value,
    edges: edges.value,
    viewport: viewport.value
  })
}

function getRequestStatus(error: unknown): number | undefined {
  return (error as any)?.response?.status
}

function getRequestMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as any)?.response?.data?.message
  if (responseMessage) return String(responseMessage)
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function updateVersionFromResponse(response: any) {
  const nextVersion = Number(response?.version)
  if (Number.isFinite(nextVersion)) {
    version.value = nextVersion
  }
}

async function loadEditCanvas(editId: number) {
  const response = isWorkflowMode.value
    ? ((await workflowApi.getCanvas(editId)) as any)
    : ((await orchestrationApi.getCanvasDraft(editId)) as any)
  const snapshot = (response?.snapshot || response) as any
  if (
    !snapshot?.flow ||
    !Array.isArray(snapshot.flow.nodes) ||
    !Array.isArray(snapshot.flow.edges)
  ) {
    throw new Error('画布配置数据不完整')
  }
  const restored = restoreCanvasSnapshot(snapshot)
  appMeta.value = {
    name: String(snapshot?.appMeta?.name || ''),
    description: String(snapshot?.appMeta?.description || ''),
    icon: String(snapshot?.appMeta?.icon || DEFAULT_ICON),
    iconBackground: String(snapshot?.appMeta?.iconBackground || DEFAULT_ICON_BG),
    iconImage: String(snapshot?.appMeta?.iconImage || '')
  }
  setGraphFromFlow({
    nodes: restored.nodes as any[],
    edges: restored.edges as any[],
    viewport: restored.viewport
  })
  await applyFlowViewport(restored.viewport || { ...DEFAULT_VIEWPORT }, {
    rememberAsInitial: true
  })
  version.value = Number.isFinite(Number(response?.version)) ? Number(response.version) : undefined
  bindingCount.value = Number.isFinite(Number(response?.bindingCount))
    ? Number(response.bindingCount)
    : 0
  if (isWorkflowMode.value && bindingCount.value > 1) {
    ElMessage.warning(
      `该工作流已关联 ${bindingCount.value} 个应用，修改后相关应用需要重新发布才会生效`
    )
  }
}

async function handleConflict(editId: number) {
  try {
    await ElMessageBox.confirm(
      `${isWorkflowMode.value ? '工作流' : '智能体'}已被他人修改，是否重新加载远端版本？`,
      '版本冲突',
      {
        type: 'warning',
        confirmButtonText: '重新加载远端版本',
        cancelButtonText: '保留当前草稿'
      }
    )
    await loadEditCanvas(editId)
    ElMessage.success('已加载远端最新版本')
  } catch {
    // 保留草稿，不做覆盖
  }
}

function handleValidate() {
  const result = validateNow()
  if (!result.valid) {
    ElMessage.error(result.errors[0] || '流程校验未通过')
    return
  }
  if (result.warnings.length) {
    ElMessage.warning(`存在 ${result.warnings.length} 条流程警告，请检查后保存`)
    return
  }
  ElMessage.success('流程校验通过')
}

async function handleSave() {
  const result = validateNow()
  if (!result.valid) {
    ElMessage.error(result.errors[0] || '流程校验未通过')
    return
  }

  if (result.warnings.length) {
    const warningMessage = `检测到以下问题：\n- ${result.warnings.join('\n- ')}\n\n是否仍要继续提交？`
    try {
      await ElMessageBox.confirm(warningMessage, '流程警告', {
        type: 'warning',
        confirmButtonText: '继续提交',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
  }

  const payload = buildSubmitPayload()

  saving.value = true
  try {
    if (isWorkflowMode.value && bindingCount.value > 1) {
      await ElMessageBox.confirm(
        `该工作流已关联 ${bindingCount.value} 个应用，保存后相关应用需要重新发布才会生效。确认继续保存？`,
        '保存工作流确认',
        {
          type: 'warning',
          confirmButtonText: '继续保存',
          cancelButtonText: '取消'
        }
      )
    }

    const response = isWorkflowMode.value
      ? isEditMode.value && props.editId
        ? await workflowApi.updateCanvas(props.editId, {
            ...payload,
            version: version.value
          })
        : await workflowApi.createCanvas(payload)
      : isEditMode.value && props.editId
        ? await orchestrationApi.updateCanvasDraft(props.editId, {
            ...payload,
            version: version.value
          })
        : await orchestrationApi.saveCanvasDraft(payload)
    updateVersionFromResponse(response)
    bindingCount.value = Number.isFinite(Number((response as any)?.bindingCount))
      ? Number((response as any).bindingCount)
      : bindingCount.value
    const savedId = Number(response?.id)
    if (!isEditMode.value && Number.isFinite(savedId) && savedId > 0) {
      const returnPath = resolveReturnPath()
      if (isWorkflowMode.value) {
        await router.replace({
          path: '/workflows/editor',
          query: {
            edit: String(savedId),
            ...(returnPath ? { from: returnPath } : {})
          }
        })
      } else {
        await router.replace({
          path: '/agents/orchestrator/create',
          query: {
            mode: 'blank',
            edit: String(savedId),
            ...(returnPath ? { from: returnPath } : {})
          }
        })
      }
    }
    ElMessage.success('保存成功')
  } catch (error: unknown) {
    const status = getRequestStatus(error)
    if (status === 409 && props.editId) {
      await handleConflict(props.editId)
      return
    }
    ElMessage.error(getRequestMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (isEditMode.value && props.editId) {
    try {
      await loadEditCanvas(props.editId)
    } catch (error: unknown) {
      ElMessage.error(getRequestMessage(error, '画布配置加载失败'))
      navigateBack()
      return
    }
  }
})
</script>

<template>
  <!-- 恢复使用 ContentWrap，确保与管理后台的 Page Layout 完美咬合，保障高度计算不坍塌 -->
  <ContentWrap :title="pageTitle" :message="pageMessage" class="workflow-content-wrap">
    <div class="layout">
      <!-- 左侧节点选择面板 -->
      <aside class="left-panel">
        <NodePanel @add="handleAddNode" />
      </aside>

      <!-- 右侧编排主面板 -->
      <main class="main-panel">
        <AppMetaBar v-model="appMeta" :name-label="isWorkflowMode ? '工作流名称' : '应用名称'" />

        <!-- 核心操作工具栏 -->
        <Toolbar
          :saving="saving"
          :selected-count="selectedCount"
          :error-count="errors.length"
          @fit="handleFitView"
          @validate="handleValidate"
          @delete-selected="handleDeleteSelected"
          @cancel="handleCancel"
          @save="handleSave"
        />

        <!-- 画布包围盒 (增加了防高度坍塌与独立悬浮框样式) -->
        <div class="canvas-container">
          <Canvas
            v-model:nodes="nodes"
            v-model:edges="edges"
            :is-valid-connection="isValidConnection"
            @connect="handleConnect"
            @viewport-change="handleViewportChange"
            @pane-ready="handlePaneReady"
            @node-click="handleNodeClick"
            @pane-click="handlePaneClick"
            @drop-node="handleDropNode"
          />

          <!-- 悬浮式流程体检提示 (完美悬浮于画布右下角，不再占用页面布局高度) -->
          <div class="floating-alert" v-if="errors.length || warnings.length">
            <el-collapse class="alert-collapse">
              <el-collapse-item name="alerts">
                <template #title>
                  <div class="alert-title-bar">
                    <span
                      class="status-dot"
                      :class="{ 'has-errors': errors.length, 'has-warnings': warnings.length }"
                    ></span>
                    <span class="status-text">
                      流程体检 ({{ errors.length }} 错误 · {{ warnings.length }} 警告)
                    </span>
                  </div>
                </template>
                <div class="alert-details">
                  <div v-if="errors.length" class="alert-group error-group">
                    <div class="group-label">无法保存项 (需修复):</div>
                    <ul>
                      <li v-for="(item, idx) in errors" :key="`err-${idx}`">
                        <span class="bullet">✕</span>{{ item }}
                      </li>
                    </ul>
                  </div>
                  <div v-if="warnings.length" class="alert-group warning-group">
                    <div class="group-label">流程缺陷 (建议优化):</div>
                    <ul>
                      <li v-for="(item, idx) in warnings" :key="`warn-${idx}`">
                        <span class="bullet">⚠</span>{{ item }}
                      </li>
                    </ul>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>
      </main>
    </div>

    <!-- 侧边节点配置抽屉 -->
    <el-drawer
      v-if="editingNode"
      v-model="inspectorVisible"
      :title="`节点配置 - ${editingNode.data?.title || ''}`"
      size="560px"
      class="editor-drawer"
    >
      <StartInspector
        v-if="editingStartData"
        :node-data="editingStartData"
        @save="applyEditedNodeData"
      />
      <LlmInspector
        v-else-if="editingLlmData"
        :node-id="editingNodeId"
        :node-data="editingLlmData"
        :nodes="nodes"
        :edges="edges"
        @save="applyEditedNodeData"
      />
      <IfElseInspector
        v-else-if="editingIfData"
        :node-id="editingNodeId"
        :node-data="editingIfData"
        :nodes="nodes"
        :edges="edges"
        @save="applyEditedNodeData"
      />
      <KnowledgeInspector
        v-else-if="editingKnowledgeData"
        :node-data="editingKnowledgeData"
        @save="applyEditedNodeData"
      />
      <AnswerInspector
        v-else-if="editingAnswerData"
        :node-data="editingAnswerData"
        :force-static="isEditingAnswerConnectedFromIfElse"
        @save="applyEditedNodeData"
      />
    </el-drawer>
  </ContentWrap>
</template>

<style scoped lang="less">
@keyframes pulseError {
  from {
    opacity: 0.8;
    transform: scale(1);
  }

  to {
    opacity: 1;
    transform: scale(1.15);
  }
}

/* 适配中大屏幕响应式布局 */
@media (width <= 1280px) {
  .layout {
    height: auto;
    min-height: auto;
    flex-direction: column;
  }

  .left-panel {
    width: 100%;
    flex: none;
  }

  .canvas-container {
    height: 500px; /* 小屏幕状态画布降级为固定高度 */
  }

  .floating-alert {
    left: 68px;
    width: min(320px, calc(100% - 84px));
    max-width: calc(100% - 84px);
  }
}

:global(.workflow-content-wrap .el-card__body) {
  padding: 16px !important;
}

/* 1. 主框架弹性排版 (防高度坍塌) */
.layout {
  display: flex;
  gap: 16px;
  width: 100%;
  height: calc(100vh - 180px); /* 动态占满屏幕，减去头部面包屑及导航条高 */
  min-height: 580px; /* 强制设置底线高度，绝不允许发生灰色塌陷 */
}

/* 左侧节点栏：精致白卡片 */
.left-panel {
  width: 250px;
  padding: 12px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(15 23 42 / 2%);
  flex: 0 0 250px;
}

/* 右侧核心面板 */
.main-panel {
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

/* 2. 画布容器 (双重保险，弹性自适应，绝不丢失任何一像素高度) */
.canvas-container {
  position: relative;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(15 23 42 / 2%);
  flex: 1;

  /* 强力透传控制，强迫 VueFlow 内部 100% 撑开 */
  :deep(.vue-flow) {
    width: 100% !important;
    height: 100% !important;
  }
}

/* 3. 悬浮流程体检控制台 (放置于画布中，不占物理流高度) */
.floating-alert {
  position: absolute;
  bottom: 16px;
  left: 72px;
  z-index: 100;
  width: min(350px, calc(100% - 88px));
  max-width: calc(100% - 88px);
  overflow: hidden;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  box-shadow:
    0 10px 25px -5px rgb(15 23 42 / 10%),
    0 8px 10px -6px rgb(15 23 42 / 5%);
}

.alert-collapse {
  border: none !important;

  :deep(.el-collapse-item__header) {
    height: 42px !important;
    padding: 0 14px;
    line-height: 42px !important;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0 !important;
  }

  :deep(.el-collapse-item__wrap) {
    background: #fff;
    border: none !important;
  }

  :deep(.el-collapse-item__content) {
    padding: 12px 14px !important;
  }
}

.alert-title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;

  .status-dot {
    width: 8px;
    height: 8px;
    background: #94a3b8;
    border-radius: 99px;

    &.has-errors {
      background: #dc2626;
      box-shadow: 0 0 0 3px rgb(220 38 38 / 15%);
      animation: pulseError 1.5s infinite alternate;
    }

    &.has-warnings:not(.has-errors) {
      background: #d97706;
      box-shadow: 0 0 0 3px rgb(217 119 6 / 15%);
    }
  }

  .status-text {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
  }
}

.alert-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.alert-group {
  .group-label {
    margin-bottom: 5px;
    font-size: 11px;
    font-weight: 700;
  }

  ul {
    display: flex;
    padding: 0;
    margin: 0;
    list-style: none;
    flex-direction: column;
    gap: 4px;

    li {
      display: flex;
      font-size: 11.5px;
      line-height: 1.5;
      align-items: flex-start;
      gap: 6px;
    }

    .bullet {
      font-weight: bold;
      flex-shrink: 0;
    }
  }

  &.error-group {
    .group-label {
      color: #dc2626;
    }

    li {
      color: #991b1b;
    }

    .bullet {
      color: #dc2626;
    }
  }

  &.warning-group {
    .group-label {
      color: #d97706;
    }

    li {
      color: #92400e;
    }

    .bullet {
      color: #d97706;
    }
  }
}

/* 4. 配置 Drawer 美化微调 */
:deep(.editor-drawer) {
  .el-drawer__header {
    padding: 16px 20px;
    margin-bottom: 0;
    font-weight: 700;
    border-bottom: 1px solid #e2e8f0;

    span {
      font-size: 14.5px;
      color: #0f172a;
    }
  }

  .el-drawer__body {
    background: #f8fafc;
  }
}

/* 全局覆盖配置，调整 ContentWrap 的内部空间比例，使页面更饱满 */
</style>
