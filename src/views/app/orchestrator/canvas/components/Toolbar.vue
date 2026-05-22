<script setup lang="ts">
interface Props {
  submittingAction: '' | 'save' | 'publish'
  selectedCount: number
  errorCount: number
  isEditMode: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'fit'): void
  (e: 'deleteSelected'): void
  (e: 'clearDraft'): void
  (e: 'cancel'): void
  (e: 'save'): void
  (e: 'publish'): void
}>()
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <el-button @click="emit('fit')">视图适配</el-button>
      <el-button :disabled="selectedCount < 1" type="danger" plain @click="emit('deleteSelected')">
        删除选中
      </el-button>
      <el-button @click="emit('clearDraft')">清空草稿</el-button>
      <span v-if="errorCount > 0" class="error-tip">校验问题 {{ errorCount }} 项</span>
      <span v-else class="ok-tip">校验通过</span>
    </div>

    <div class="toolbar-right">
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button :loading="submittingAction === 'save'" @click="emit('save')"> 保存 </el-button>
      <el-button type="primary" :loading="submittingAction === 'publish'" @click="emit('publish')">
        {{ isEditMode ? '发布更新' : '发布' }}
      </el-button>
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
