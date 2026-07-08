<script setup lang="ts">
import { ArrowLeft, CircleCheck, Delete, FullScreen, Warning } from '@element-plus/icons-vue'

interface Props {
  saving: boolean
  selectedCount: number
  errorCount: number
  workflowMode?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'fit'): void
  (e: 'validate'): void
  (e: 'deleteSelected'): void
  (e: 'cancel'): void
  (e: 'save'): void
}>()
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <el-button v-if="workflowMode" :icon="ArrowLeft" class="back-button" @click="emit('cancel')">
        返回
      </el-button>

      <span v-if="workflowMode" class="toolbar-divider"></span>

      <div class="action-group">
        <el-button :icon="FullScreen" @click="emit('fit')">视图适配</el-button>
        <el-button :icon="CircleCheck" @click="emit('validate')">校验</el-button>
        <el-button
          :icon="Delete"
          :disabled="selectedCount < 1"
          type="danger"
          plain
          @click="emit('deleteSelected')"
        >
          删除选中
        </el-button>
      </div>
    </div>

    <div class="toolbar-right">
      <span v-if="errorCount > 0" class="status-tip error-tip">
        <el-icon><Warning /></el-icon>
        校验问题 {{ errorCount }} 项
      </span>
      <span v-else class="status-tip ok-tip">
        <el-icon><CircleCheck /></el-icon>
        校验通过
      </span>
      <el-button v-if="!workflowMode" @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">保存</el-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.toolbar {
  display: flex;
  min-height: 56px;
  padding: 10px 14px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(15 23 42 / 4%);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-left {
  min-width: 0;
}

.action-group {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.back-button {
  flex: 0 0 auto;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  margin: 0 2px;
  background: var(--el-border-color-light);
}

.status-tip {
  display: inline-flex;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 999px;
  align-items: center;
  gap: 5px;
}

.error-tip {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.ok-tip {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

@media (width <= 900px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-left,
  .toolbar-right {
    justify-content: space-between;
  }
}
</style>
