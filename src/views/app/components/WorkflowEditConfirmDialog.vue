<script setup lang="ts">
import { computed } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import type { WorkflowBindingAppVO } from '@/api/frontend-api'

const visible = defineModel<boolean>({ required: true })
const props = defineProps<{
  workflowName?: string
  apps: WorkflowBindingAppVO[]
}>()
const emit = defineEmits<{
  confirm: []
}>()

const title = computed(() => props.workflowName || '当前工作流')

function handleConfirm() {
  visible.value = false
  emit('confirm')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="workflow-edit-confirm-dialog"
    width="640px"
    destroy-on-close
    align-center
  >
    <template #header>
      <div class="confirm-header">
        <span class="confirm-icon">
          <el-icon><WarningFilled /></el-icon>
        </span>
        <div>
          <h3>修改工作流确认</h3>
          <p>{{ title }} 已绑定 {{ apps.length }} 个智能体，保存修改后这些智能体需要重新发布。</p>
        </div>
      </div>
    </template>

    <div class="confirm-body">
      <div class="impact-summary">
        <span>受影响智能体</span>
        <strong>{{ apps.length }}</strong>
      </div>
      <div class="app-list">
        <div v-for="app in apps" :key="app.id" class="app-row">
          <div>
            <strong>{{ app.appName }}</strong>
            <p>{{ app.description || '暂无描述' }}</p>
          </div>
          <el-tag :type="app.publishStatus === 'PUBLISHED' ? 'success' : 'warning'" effect="light">
            {{ app.publishStatus === 'PUBLISHED' ? '已发布' : '未发布' }}
          </el-tag>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="warning" @click="handleConfirm">继续修改</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="less">
.confirm-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding-right: 28px;
}

.confirm-icon {
  display: inline-flex;
  width: 42px;
  height: 42px;
  font-size: 22px;
  color: #b45309;
  background: #fff7ed;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.confirm-header h3 {
  margin: 0;
  font-size: 20px;
  color: #172033;
}

.confirm-header p {
  margin: 6px 0 0;
  line-height: 1.7;
  color: #64748b;
}

.confirm-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.impact-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
}

.impact-summary strong {
  font-size: 22px;
}

.app-list {
  max-height: 320px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.app-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #eef2f7;
}

.app-row:last-child {
  border-bottom: 0;
}

.app-row strong {
  color: #172033;
}

.app-row p {
  margin: 4px 0 0;
  color: #64748b;
}
</style>
