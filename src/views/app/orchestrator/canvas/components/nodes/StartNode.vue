<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { StartNodeData } from '../../types'

const props = defineProps<NodeProps<StartNodeData>>()
</script>

<template>
  <div class="canvas-node start-node" :class="{ selected: props.selected }">
    <div class="node-header">
      <span class="node-badge">START</span>
      <span class="node-title">{{ props.data.title || '用户输入' }}</span>
    </div>
    <div class="node-body">
      <div class="node-line">用户输入</div>
      <div class="node-line muted"
        >系统变量 + 自定义 {{ props.data.variables?.length || 0 }} 个</div
      >
    </div>
    <Handle id="source" type="source" :position="Position.Right" class="big-handle handle-source" />
  </div>
</template>

<style scoped lang="less">
.canvas-node {
  position: relative;
  width: 220px;
  min-height: 80px;
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
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-line {
  font-size: 12px;
}

.node-line.muted {
  color: var(--el-text-color-secondary);
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

:deep(.handle-source) {
  right: -8px !important;
}
</style>
