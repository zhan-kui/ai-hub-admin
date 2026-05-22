<script setup lang="ts">
interface Props {
  saving: boolean
  selectedCount: number
  errorCount: number
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
      <el-button @click="emit('fit')">视图适配</el-button>
      <el-button @click="emit('validate')">校验</el-button>
      <el-button :disabled="selectedCount < 1" type="danger" plain @click="emit('deleteSelected')">
        删除选中
      </el-button>
      <span v-if="errorCount > 0" class="error-tip">校验问题 {{ errorCount }} 项</span>
      <span v-else class="ok-tip">校验通过</span>
    </div>

    <div class="toolbar-right">
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="emit('save')">保存</el-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.toolbar {
  display: flex;
  padding: 10px 12px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
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

.error-tip {
  font-size: 12px;
  color: var(--el-color-danger);
}

.ok-tip {
  font-size: 12px;
  color: var(--el-color-success);
}
</style>
