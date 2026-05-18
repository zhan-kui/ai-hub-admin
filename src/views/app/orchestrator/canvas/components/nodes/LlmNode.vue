<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { LlmNodeData } from '../../types'

const props = defineProps<NodeProps<LlmNodeData>>()

const modelLabel = computed(() => props.data.model?.name || '未选择模型')
const promptPreview = computed(() =>
  props.data.systemPrompt ? props.data.systemPrompt.slice(0, 40) : '未填写系统提示词'
)
</script>

<template>
  <div class="canvas-node llm-node" :class="{ selected: props.selected }">
    <Handle id="target" type="target" :position="Position.Left" class="big-handle handle-target" />

    <div class="node-header">
      <span class="node-badge">LLM</span>
      <span class="node-title">{{ props.data.title || 'LLM' }}</span>
    </div>

    <div class="node-body">
      <div class="node-line">模型：{{ modelLabel }}</div>
      <div class="node-line muted">{{ promptPreview }}</div>
    </div>

    <Handle id="source" type="source" :position="Position.Right" class="big-handle handle-source" />
  </div>
</template>

<style scoped lang="less">
.canvas-node {
  position: relative;
  width: 220px;
  min-height: 88px;
  padding: 12px;
  color: var(--el-text-color-primary);
  cursor: pointer;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
  user-select: none;
}

.canvas-node.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.canvas-node:hover {
  border-color: var(--el-color-primary);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.node-title {
  font-size: 13px;
  font-weight: 600;
}

.node-badge {
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 999px;
}

.node-body {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.node-line {
  line-height: 18px;
}

.muted {
  color: var(--el-text-color-placeholder);
}

:deep(.big-handle) {
  z-index: 10;
  width: 16px !important;
  height: 16px !important;
  background: var(--el-color-primary) !important;
  border: 2px solid var(--el-bg-color) !important;
  border-radius: 50% !important;
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
}

:deep(.big-handle:hover) {
  width: 20px !important;
  height: 20px !important;
  box-shadow: 0 0 0 4px var(--el-color-primary-light-8);
}

:deep(.handle-target) {
  left: -8px !important;
}

:deep(.handle-source) {
  right: -8px !important;
}
</style>
