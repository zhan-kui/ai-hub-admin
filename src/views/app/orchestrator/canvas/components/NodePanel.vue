<script setup lang="ts">
import type { CanvasNodeType } from '../types'

const emit = defineEmits<{
  (e: 'add', nodeType: Exclude<CanvasNodeType, 'start'>): void
}>()

const dragTypeMime = 'application/x-aihub-node-type'

function handleDragStart(event: DragEvent, nodeType: Exclude<CanvasNodeType, 'start'>) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(dragTypeMime, nodeType)
  event.dataTransfer.effectAllowed = 'move'
}

function handleClickAdd(nodeType: Exclude<CanvasNodeType, 'start'>) {
  emit('add', nodeType)
}
</script>

<template>
  <div class="node-panel">
    <div class="panel-title">节点面板</div>

    <div class="node-item" draggable="true" @dragstart="handleDragStart($event, 'llm')">
      <div class="node-meta">
        <div class="node-name">LLM 节点</div>
        <div class="node-desc">大模型推理与生成</div>
      </div>
      <el-button size="small" @click="handleClickAdd('llm')">添加</el-button>
    </div>

    <div class="node-item" draggable="true" @dragstart="handleDragStart($event, 'if-else')">
      <div class="node-meta">
        <div class="node-name">if-else 节点</div>
        <div class="node-desc">条件分支路由</div>
      </div>
      <el-button size="small" @click="handleClickAdd('if-else')">添加</el-button>
    </div>

    <div class="node-item" draggable="true" @dragstart="handleDragStart($event, 'answer')">
      <div class="node-meta">
        <div class="node-name">answer 节点</div>
        <div class="node-desc">直接回复出口</div>
      </div>
      <el-button size="small" @click="handleClickAdd('answer')">添加</el-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.node-panel {
  padding: 12px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}

.panel-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.node-item {
  display: flex;
  padding: 10px;
  cursor: grab;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.node-item + .node-item {
  margin-top: 8px;
}

.node-item:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}

.node-meta {
  min-width: 0;
}

.node-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.node-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
