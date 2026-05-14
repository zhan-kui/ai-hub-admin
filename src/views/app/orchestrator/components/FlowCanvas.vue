<script setup lang="ts">
import { computed } from 'vue'
import { VueFlow, type Edge, type Node, type NodeMouseEvent } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import type { TemplateEdge, TemplateNode } from '../types'

interface Props {
  nodes: TemplateNode[]
  edges: TemplateEdge[]
  selectedNodeId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'nodeClick', nodeId: string): void
}>()

const flowNodes = computed<Node[]>(() =>
  props.nodes.map((node, idx) => ({
    id: node.id,
    type: 'default',
    position: { x: idx * 240, y: 120 },
    data: { label: node.title },
    class: [
      'flow-node',
      `flow-node--${node.type}`,
      node.editable ? 'flow-node--editable' : 'flow-node--readonly',
      props.selectedNodeId === node.id ? 'flow-node--selected' : ''
    ]
      .filter(Boolean)
      .join(' ')
  }))
)

const flowEdges = computed<Edge[]>(() =>
  props.edges.map((edge, idx) => ({
    id: `edge-${idx}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: true
  }))
)

function handleNodeClick(nodeMouseEvent: NodeMouseEvent) {
  const matchedNode = props.nodes.find((item) => item.id === nodeMouseEvent.node.id)
  if (matchedNode?.editable) {
    emit('nodeClick', nodeMouseEvent.node.id)
  }
}
</script>

<template>
  <div class="flow-canvas-wrapper">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :edges-updatable="false"
      :elements-selectable="true"
      :pan-on-drag="true"
      :zoom-on-scroll="true"
      fit-view-on-init
      @node-click="handleNodeClick"
    />
  </div>
</template>

<style scoped lang="less">
.flow-canvas-wrapper {
  width: 100%;
  height: 480px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

:deep(.flow-node--editable) {
  cursor: pointer;
}

:deep(.flow-node--readonly) {
  cursor: default;
  opacity: 0.85;
}

:deep(.flow-node--selected) {
  box-shadow: 0 0 0 2px var(--el-color-primary);
}
</style>
