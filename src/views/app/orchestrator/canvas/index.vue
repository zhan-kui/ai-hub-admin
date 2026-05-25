<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import type {
  Connection,
  Edge,
  ValidConnectionFunc,
  ViewportTransform,
  VueFlowStore
} from '@vue-flow/core'
import { ContentWrap } from '@/components/ContentWrap'
import { orchestrationApi } from '@/api/frontend-api'
import AppMetaBar from './components/AppMetaBar.vue'
import Canvas from './components/Canvas.vue'
import NodePanel from './components/NodePanel.vue'
import Toolbar from './components/Toolbar.vue'
import StartInspector from './components/inspectors/StartInspector.vue'
import LlmInspector from './components/inspectors/LlmInspector.vue'
import IfElseInspector from './components/inspectors/IfElseInspector.vue'
import AnswerInspector from './components/inspectors/AnswerInspector.vue'
import KnowledgeInspector from './components/inspectors/KnowledgeInspector.vue'
import { DEFAULT_ICON, DEFAULT_ICON_BG, MAX_NODES } from './constants'
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
const props = defineProps<{
  editId?: number
}>()
const flowStore = ref<VueFlowStore>()

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
const saving = ref(false)
const version = ref<number | undefined>(undefined)
const inspectorVisible = ref(false)
const editingNodeId = ref('')
const pageTitle = computed(() =>
  isEditMode.value ? `编辑应用：${appMeta.value.name || ''}` : '从空白编排创建应用'
)
const pageMessage = computed(() =>
  isEditMode.value
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

  // 重点：让 Vue Flow 的 Store 去添加，它会自动同步给你的 edges.value
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

    // 找到需要保留的线
    const edgesToKeep = edges.value.filter(
      (edge) =>
        edge.source !== editingNode.value?.id ||
        !edge.sourceHandle ||
        caseIdSet.has(edge.sourceHandle) ||
        (elseEnabled && edge.sourceHandle === 'false')
    )

    // 清空原数组并塞入新数据，保持 edges 数组代理绝对不变！
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
  void flowStore.value?.fitView()
}

function handleCancel() {
  router.push('/apps')
}

function handlePaneReady(store: VueFlowStore) {
  flowStore.value = store
  if (pendingRestoreViewport) {
    void flowStore.value.setViewport(pendingRestoreViewport)
    pendingRestoreViewport = null
  }
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
  const response = (await orchestrationApi.getCanvasDraft(editId)) as any
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
  pendingRestoreViewport = restored.viewport || { x: 0, y: 0, zoom: 1 }
  version.value = Number.isFinite(Number(response?.version)) ? Number(response.version) : undefined
}

async function handleConflict(editId: number) {
  try {
    await ElMessageBox.confirm('应用已被他人修改，是否重新加载远端版本？', '版本冲突', {
      type: 'warning',
      confirmButtonText: '重新加载远端版本',
      cancelButtonText: '保留当前草稿'
    })
    await loadEditCanvas(editId)
    ElMessage.success('已加载远端最新版本')
  } catch {
    // 用户选择保留当前草稿，不做覆盖
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
    const response =
      isEditMode.value && props.editId
        ? await orchestrationApi.updateCanvasDraft(props.editId, {
            ...payload,
            version: version.value
          })
        : await orchestrationApi.saveCanvasDraft(payload)
    updateVersionFromResponse(response)
    const savedId = Number(response?.id)
    if (!isEditMode.value && Number.isFinite(savedId) && savedId > 0) {
      await router.replace(`/apps/orchestrator/create?mode=blank&edit=${savedId}`)
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
      router.push('/apps')
      return
    }
  }
})
</script>

<template>
  <ContentWrap :title="pageTitle" :message="pageMessage">
    <div class="layout">
      <div class="left-panel">
        <NodePanel @add="handleAddNode" />
      </div>

      <div class="main-panel">
        <AppMetaBar v-model="appMeta" />

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

        <el-alert
          v-if="errors.length"
          title="流程校验提示"
          type="warning"
          :closable="false"
          show-icon
          class="error-panel"
        >
          <ul class="error-list">
            <li v-for="(item, idx) in errors" :key="`${idx}-${item}`">{{ item }}</li>
          </ul>
        </el-alert>

        <el-alert
          v-if="warnings.length"
          title="流程警告"
          type="info"
          :closable="false"
          show-icon
          class="error-panel"
        >
          <ul class="error-list">
            <li v-for="(item, idx) in warnings" :key="`${idx}-${item}`">{{ item }}</li>
          </ul>
        </el-alert>
      </div>
    </div>

    <el-drawer
      v-if="editingNode"
      v-model="inspectorVisible"
      :title="`节点配置 - ${editingNode.data?.title || ''}`"
      size="560px"
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
.layout {
  display: flex;
  gap: 12px;
}

.left-panel {
  width: 260px;
  flex: 0 0 260px;
}

.main-panel {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 10px;
}

.error-panel {
  margin-top: 6px;
}

.error-list {
  padding-left: 18px;
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
}

@media (width <= 1280px) {
  .layout {
    flex-direction: column;
  }

  .left-panel {
    width: 100%;
    flex: none;
  }
}
</style>
