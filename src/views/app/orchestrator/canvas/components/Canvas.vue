<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  VueFlow,
  ConnectionMode,
  type EdgeMouseEvent,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseEvent,
  type ValidConnectionFunc,
  type ViewportTransform,
  type VueFlowStore
} from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import StartNode from './nodes/StartNode.vue'
import LlmNode from './nodes/LlmNode.vue'
import IfElseNode from './nodes/IfElseNode.vue'
import KnowledgeNode from './nodes/KnowledgeNode.vue'
import AnswerNode from './nodes/AnswerNode.vue'
import type { CanvasGraphEdge, CanvasGraphNode, CanvasNodeType } from '../types'

interface Props {
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
  isValidConnection: ValidConnectionFunc
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:nodes', value: CanvasGraphNode[]): void
  (e: 'update:edges', value: CanvasGraphEdge[]): void
  (e: 'connect', value: Connection): void
  (e: 'viewportChange', value: ViewportTransform): void
  (e: 'paneReady', value: VueFlowStore): void
  (e: 'nodeClick', nodeId: string): void
  (e: 'edgeClick', edgeId: string): void
  (e: 'paneClick'): void
  (
    e: 'dropNode',
    payload: {
      nodeType: Exclude<CanvasNodeType, 'start'>
      clientX: number
      clientY: number
      bounds: DOMRect
    }
  ): void
}>()

const flowWrapRef = ref<HTMLDivElement>()

const nodeTypes = {
  start: StartNode,
  llm: LlmNode,
  'if-else': IfElseNode,
  'knowledge-retrieval': KnowledgeNode,
  answer: AnswerNode
}

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: {
    strokeWidth: 2
  }
}

const flowNodes = computed({
  get: () => props.nodes,
  set: (value: Node[]) => emit('update:nodes', value as CanvasGraphNode[])
})

const flowEdges = computed({
  get: () => props.edges,
  set: (value: Edge[]) => emit('update:edges', value as CanvasGraphEdge[])
})

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const nodeType = event.dataTransfer?.getData('application/x-aihub-node-type') as
    | Exclude<CanvasNodeType, 'start'>
    | ''
  if (!nodeType || !flowWrapRef.value) return

  emit('dropNode', {
    nodeType,
    clientX: event.clientX,
    clientY: event.clientY,
    bounds: flowWrapRef.value.getBoundingClientRect()
  })
}

function handleNodeClick(event: NodeMouseEvent | any, maybeNode?: Node) {
  const node = maybeNode || event?.node || event
  if (!node?.id) return
  emit('nodeClick', node.id)
}

function handleEdgeClick(event: EdgeMouseEvent | any, maybeEdge?: Edge) {
  const edge = maybeEdge || event?.edge || event
  if (!edge?.id) return
  emit('edgeClick', edge.id)
}
</script>

<template>
  <div ref="flowWrapRef" class="canvas-wrap" @dragover.prevent @drop="handleDrop">
    <VueFlow
      v-model:nodes="flowNodes"
      v-model:edges="flowEdges"
      :node-types="nodeTypes"
      :is-valid-connection="isValidConnection"
      :default-edge-options="defaultEdgeOptions"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :elements-selectable="true"
      :edges-updatable="false"
      :delete-key-code="null"
      :connection-mode="ConnectionMode.Loose"
      :auto-connect="false"
      fit-view-on-init
      @connect="emit('connect', $event)"
      @viewport-change="emit('viewportChange', $event)"
      @pane-ready="emit('paneReady', $event)"
      @node-click="handleNodeClick"
      @edge-click="handleEdgeClick"
      @pane-click="emit('paneClick')"
    >
      <template #node-start="nodeProps">
        <StartNode v-bind="nodeProps" />
      </template>
      <template #node-llm="nodeProps">
        <LlmNode v-bind="nodeProps" />
      </template>
      <template #node-if-else="nodeProps">
        <IfElseNode v-bind="nodeProps" />
      </template>
      <template #node-knowledge-retrieval="nodeProps">
        <KnowledgeNode v-bind="nodeProps" />
      </template>
      <template #node-answer="nodeProps">
        <AnswerNode v-bind="nodeProps" />
      </template>

      <MiniMap pannable zoomable />
      <Controls />
      <Background :gap="20" :size="1" />
    </VueFlow>
  </div>
</template>

<style scoped lang="less">
.canvas-wrap {
  width: 100%;
  height: 640px;
  overflow: hidden;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}

:deep(.vue-flow__controls) {
  box-shadow: 0 2px 10px rgb(0 0 0 / 8%);
}
</style>
