<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { IfElseNodeData } from '../../types'

const props = defineProps<NodeProps<IfElseNodeData>>()
</script>

<template>
  <div class="canvas-node if-node" :class="{ selected: props.selected }">
    <Handle id="target" type="target" :position="Position.Left" class="big-handle handle-target" />

    <div class="node-header">
      <span class="node-badge">IF</span>
      <span class="node-title">{{ props.data.title || '条件分支' }}</span>
    </div>

    <div class="case-list">
      <div v-for="(item, index) in props.data.cases" :key="item.id" class="case-row">
        <div class="case-text">
          <span class="case-label">{{ item.label || `分支 ${index + 1}` }}</span>
          <span class="case-condition">
            {{ item.conditions?.[0]?.operator || 'contains' }}
            {{ item.conditions?.[0]?.value || '' }}
          </span>
        </div>
        <Handle
          :id="item.id"
          type="source"
          :position="Position.Right"
          class="big-handle case-handle"
        />
      </div>

      <div v-if="props.data.elseEnabled" class="case-row else-row">
        <div class="case-text">
          <span class="case-label">{{ props.data.elseLabel || '否则' }}</span>
          <span class="case-condition">以上条件都不满足</span>
        </div>
        <Handle
          id="false"
          type="source"
          :position="Position.Right"
          class="big-handle case-handle"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.canvas-node {
  position: relative;
  width: 220px;
  min-height: 120px;
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

.case-list {
  display: flex;
  margin-top: 8px;
  flex-direction: column;
  gap: 6px;
}

.case-row {
  position: relative;
  min-height: 34px;
  padding: 6px 26px 6px 8px;
  margin-top: 6px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.case-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.case-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.case-condition {
  font-size: 11px;
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

:deep(.handle-target) {
  left: -8px !important;
}

:deep(.case-handle) {
  right: -8px !important;
}
</style>
