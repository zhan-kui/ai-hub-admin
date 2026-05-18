<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import type {
  Connection,
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
import LlmInspector from './components/inspectors/LlmInspector.vue'
import IfElseInspector from './components/inspectors/IfElseInspector.vue'
import AnswerInspector from './components/inspectors/AnswerInspector.vue'
import { DEFAULT_ICON, DEFAULT_ICON_BG, MAX_NODES } from './constants'
import { buildCanvasFlowPayload } from './payload-builder'
import { useCanvasState } from './useCanvasState'
import { useDraftStorage } from './useDraftStorage'
import { useValidation } from './useValidation'
import type {
  AnswerNodeData,
  CanvasAppMeta,
  CanvasNodeType,
  IfElseNodeData,
  LlmNodeData
} from './types'
import { genEdgeId, isDuplicateEdge } from './utils'

const router = useRouter()
const flowStore = ref<VueFlowStore>()

const appMeta = ref<CanvasAppMeta>({
  name: '',
  description: '',
  icon: DEFAULT_ICON,
  iconBackground: DEFAULT_ICON_BG
})

const { nodes, edges, viewport, addNode, updateNodeData, setGraph, setViewport, resetGraph } =
  useCanvasState()
const { errors, validateNow } = useValidation(appMeta, nodes, edges)
const { loadDraft, saveDraft, clearDraft, createDebouncedSaver } = useDraftStorage()

const submitting = ref(false)
const inspectorVisible = ref(false)
const editingNodeId = ref('')

const editingNode = computed(() => nodes.value.find((node) => node.id === editingNodeId.value))
const editingLlmData = computed<LlmNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'llm') return editingNode.value.data as LlmNodeData
  return null
})
const editingIfData = computed<IfElseNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'if-else')
    return editingNode.value.data as IfElseNodeData
  return null
})
const editingAnswerData = computed<AnswerNodeData | null>(() => {
  if (editingNode.value?.data?.nodeType === 'answer')
    return editingNode.value.data as AnswerNodeData
  return null
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

function hasCycleWithConnection(source: string, target: string): boolean {
  const adjacency = new Map<string, string[]>()
  for (const node of nodes.value) adjacency.set(node.id, [])
  for (const edge of edges.value) {
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

  if (isDuplicateEdge(edges.value, sourceId, targetId, connection.sourceHandle)) return false

  const sourceType = sourceNode.data?.nodeType
  const targetType = targetNode.data?.nodeType
  if (!sourceType || !targetType) return false

  const sourceOutgoers = edges.value.filter((edge) => edge.source === sourceId)
  const targetIncomers = edges.value.filter((edge) => edge.target === targetId)

  if (targetType === 'start') return false
  if (sourceType === 'answer') return false

  if (sourceType === 'start') {
    if (sourceOutgoers.length >= 1) return false
    if (targetType !== 'llm' && targetType !== 'if-else') return false
  }

  if (sourceType === 'llm') {
    if (sourceOutgoers.length >= 1) return false
    if (targetType !== 'llm' && targetType !== 'if-else' && targetType !== 'answer') return false
  }

  if (sourceType === 'if-else') {
    if (targetType === 'answer') return false

    const caseId = connection.sourceHandle
    const ifData = sourceNode.data as IfElseNodeData
    if (!caseId || !ifData.cases.some((item) => item.id === caseId)) return false

    const caseOutCount = sourceOutgoers.filter((edge) => edge.sourceHandle === caseId).length
    if (caseOutCount >= 1) return false
  }

  if (sourceType !== 'if-else' && connection.sourceHandle && connection.sourceHandle !== 'source') {
    return false
  }

  if (targetType === 'llm' && targetIncomers.length >= 1) return false

  if (targetType === 'if-else') {
    if (targetIncomers.length >= 1) return false
    if (sourceType !== 'start' && sourceType !== 'llm') return false
  }

  if (targetType === 'answer') {
    if (targetIncomers.length >= 1) return false
    if (sourceType !== 'start' && sourceType !== 'llm') return false
  }

  if (hasCycleWithConnection(sourceId, targetId)) return false

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
}

function handleNodeClick(nodeId: string) {
  const node = getNodeById(nodeId)
  if (!node || !node.data || node.data.nodeType === 'start') return

  editingNodeId.value = nodeId
  inspectorVisible.value = true
}

function handlePaneClick() {
  editingNodeId.value = ''
  inspectorVisible.value = false
}

function applyEditedNodeData(nextData: LlmNodeData | IfElseNodeData | AnswerNodeData) {
  if (!editingNode.value) return

  updateNodeData(editingNode.value.id, nextData)

  if (nextData.nodeType === 'if-else') {
    const caseIdSet = new Set(nextData.cases.map((item) => item.id))

    // 找到需要保留的线
    const edgesToKeep = edges.value.filter(
      (edge) =>
        edge.source !== editingNode.value?.id ||
        !edge.sourceHandle ||
        caseIdSet.has(edge.sourceHandle)
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

async function handleClearDraft() {
  try {
    await ElMessageBox.confirm('确认清空画布和草稿吗？', '清空确认', { type: 'warning' })
    clearDraft()
    resetGraph()
    appMeta.value = {
      name: '',
      description: '',
      icon: DEFAULT_ICON,
      iconBackground: DEFAULT_ICON_BG
    }
    ElMessage.success('草稿已清空')
  } catch (error) {
    // error 为 'cancel' 表示用户点击了取消
    if (error === 'cancel') {
      console.log('用户取消了清空操作')
      return
    }
    // 其他情况说明代码可能出现了真正的错误
    console.error('清空草稿失败:', error)
    ElMessage.error('清空失败，请稍后重试')
  }
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

async function handleCreate() {
  const result = validateNow()
  if (!result.valid) {
    ElMessage.error(result.errors[0] || '流程校验未通过')
    return
  }

  const payload = buildCanvasFlowPayload({
    appMeta: {
      name: appMeta.value.name.trim(),
      description: appMeta.value.description?.trim() || '',
      icon: appMeta.value.icon.trim(),
      iconBackground: appMeta.value.iconBackground || DEFAULT_ICON_BG
    },
    nodes: nodes.value,
    edges: edges.value,
    viewport: viewport.value
  })

  submitting.value = true
  try {
    const response = await orchestrationApi.createFromCanvas(payload)
    clearDraft()
    ElMessage.success(`应用「${response.appName}」创建成功`)
    router.push('/apps')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建失败'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

const debouncedSaveDraft = createDebouncedSaver(() => {
  saveDraft({
    appMeta: appMeta.value,
    nodes: nodes.value,
    edges: edges.value,
    viewport: viewport.value,
    savedAt: Date.now()
  })
}, 500)

watch(
  [appMeta, nodes, edges, viewport],
  () => {
    debouncedSaveDraft()
  },
  { deep: true }
)

onMounted(async () => {
  const draft = loadDraft()
  if (!draft) return

  try {
    await ElMessageBox.confirm('检测到未完成的编排草稿，是否恢复？', '恢复草稿', {
      confirmButtonText: '恢复',
      cancelButtonText: '丢弃',
      type: 'info'
    })

    appMeta.value = {
      name: draft.appMeta.name || '',
      description: draft.appMeta.description || '',
      icon: draft.appMeta.icon || DEFAULT_ICON,
      iconBackground: draft.appMeta.iconBackground || DEFAULT_ICON_BG
    }
    setGraph(draft.nodes || [], draft.edges || [], draft.viewport || { x: 0, y: 0, zoom: 1 })
    pendingRestoreViewport = draft.viewport || { x: 0, y: 0, zoom: 1 }
  } catch {
    clearDraft()
  }
})
</script>

<template>
  <ContentWrap title="从空白编排创建应用" message="拖拽节点、连线配置后创建 Dify 应用">
    <div class="layout">
      <div class="left-panel">
        <NodePanel @add="handleAddNode" />
      </div>

      <div class="main-panel">
        <AppMetaBar v-model="appMeta" />

        <Toolbar
          :submitting="submitting"
          :selected-count="selectedCount"
          :error-count="errors.length"
          @fit="handleFitView"
          @delete-selected="handleDeleteSelected"
          @clear-draft="handleClearDraft"
          @cancel="handleCancel"
          @create="handleCreate"
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
      </div>
    </div>

    <el-drawer
      v-if="editingNode"
      v-model="inspectorVisible"
      :title="`节点配置 - ${editingNode.data?.title || ''}`"
      size="560px"
    >
      <LlmInspector v-if="editingLlmData" :node-data="editingLlmData" @save="applyEditedNodeData" />
      <IfElseInspector
        v-else-if="editingIfData"
        :node-data="editingIfData"
        @save="applyEditedNodeData"
      />
      <AnswerInspector
        v-else-if="editingAnswerData"
        :node-data="editingAnswerData"
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
