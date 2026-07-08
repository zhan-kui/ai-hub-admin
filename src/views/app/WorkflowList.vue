<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { Connection, Delete, EditPen, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { workflowApi, type WorkflowBindingAppVO, type WorkflowVO } from '@/api/frontend-api'
import WorkflowEditConfirmDialog from './components/WorkflowEditConfirmDialog.vue'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const bindingLoading = ref(false)
const keyword = ref('')
const pageNum = ref(1)
const total = ref(0)
const workflows = ref<WorkflowVO[]>([])

const bindingDialogVisible = ref(false)
const bindingApps = ref<WorkflowBindingAppVO[]>([])
const editingWorkflow = ref<WorkflowVO | null>(null)
const selectedAppIds = ref<number[]>([])
const editConfirmVisible = ref(false)
const editConfirmApps = ref<WorkflowBindingAppVO[]>([])
const pendingEditWorkflow = ref<WorkflowVO | null>(null)

const activeCount = computed(() => workflows.value.filter((item) => item.bindingCount > 0).length)
const unboundCount = computed(() => workflows.value.length - activeCount.value)

function formatDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`
}

async function loadWorkflows() {
  loading.value = true
  try {
    const response = await workflowApi.list({
      pageNum: pageNum.value,
      pageSize: 20,
      keyword: keyword.value.trim() || undefined
    })
    workflows.value = response.records || []
    total.value = Number(response.total || 0)
    pageNum.value = Number(response.pageNum || pageNum.value)
  } catch (error: any) {
    ElMessage.error(error?.message || '工作流列表加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pageNum.value = 1
  void loadWorkflows()
}

function handlePageChange(nextPage: number) {
  pageNum.value = nextPage
  void loadWorkflows()
}

function goCreate() {
  router.push({
    path: '/workflows/editor',
    query: { from: route.fullPath }
  })
}

async function goEdit(row: WorkflowVO) {
  if (row.bindingCount > 0) {
    try {
      const bindings = await workflowApi.getBindings(Number(row.id))
      if (bindings.length) {
        pendingEditWorkflow.value = row
        editConfirmApps.value = bindings
        editConfirmVisible.value = true
        return
      }
    } catch (error: any) {
      ElMessage.error(error?.message || '工作流绑定信息加载失败')
      return
    }
  }
  openEditor(row)
}

function openEditor(row: WorkflowVO) {
  router.push({
    path: '/workflows/editor',
    query: { edit: String(row.id), from: route.fullPath }
  })
}

function confirmEditWorkflow() {
  if (!pendingEditWorkflow.value) return
  openEditor(pendingEditWorkflow.value)
}

async function openBindingDialog(row: WorkflowVO) {
  editingWorkflow.value = row
  bindingDialogVisible.value = true
  bindingLoading.value = true
  try {
    const apps = await workflowApi.listBindableApps()
    bindingApps.value = apps
    selectedAppIds.value = apps
      .filter((app) => Number(app.workflowId) === Number(row.id))
      .map((app) => Number(app.id))
  } catch (error: any) {
    ElMessage.error(error?.message || '可绑定应用加载失败')
  } finally {
    bindingLoading.value = false
  }
}

async function saveBindings() {
  if (!editingWorkflow.value) return
  bindingLoading.value = true
  try {
    await workflowApi.updateBindings(Number(editingWorkflow.value.id), {
      appIds: selectedAppIds.value
    })
    ElMessage.success('关联应用已更新')
    bindingDialogVisible.value = false
    await loadWorkflows()
  } catch (error: any) {
    ElMessage.error(error?.message || '关联应用更新失败')
  } finally {
    bindingLoading.value = false
  }
}

async function removeWorkflow(row: WorkflowVO) {
  try {
    await ElMessageBox.confirm(`确认删除工作流“${row.workflowName}”吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    })
    await workflowApi.delete(Number(row.id))
    ElMessage.success('工作流已删除')
    if (workflows.value.length === 1 && pageNum.value > 1) {
      pageNum.value -= 1
    }
    await loadWorkflows()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '删除失败')
    }
  }
}

onMounted(() => {
  void loadWorkflows()
})
</script>

<template>
  <div class="workflow-page">
    <section class="workflow-shell">
      <div class="workflow-header">
        <div>
          <div class="eyebrow">WORKFLOWS · {{ total }}</div>
          <h1>工作流</h1>
          <p>集中维护可复用 Chatflow 流程，绑定应用后由应用发布时生成 Dify 配置。</p>
        </div>
        <div class="metric-strip">
          <div class="metric-item">
            <span>当前页</span>
            <strong>{{ workflows.length }}</strong>
          </div>
          <div class="metric-item">
            <span>已关联</span>
            <strong>{{ activeCount }}</strong>
          </div>
          <div class="metric-item">
            <span>未关联</span>
            <strong>{{ unboundCount }}</strong>
          </div>
        </div>
      </div>

      <div class="workflow-panel">
        <div class="toolbar-row">
          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索工作流名称 / 描述"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <div class="toolbar-actions">
            <el-button :icon="Refresh" @click="loadWorkflows">刷新</el-button>
            <el-button type="primary" :icon="Plus" @click="goCreate">新建工作流</el-button>
          </div>
        </div>

        <el-table v-loading="loading" :data="workflows" class="workflow-table" row-key="id">
          <el-table-column label="工作流" min-width="260">
            <template #default="{ row }">
              <div class="workflow-name-cell">
                <span class="workflow-mark">{{ row.icon || 'W' }}</span>
                <div>
                  <strong>{{ row.workflowName }}</strong>
                  <p>{{ row.description || '暂无描述' }}</p>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="版本" width="100">
            <template #default="{ row }">
              <el-tag effect="plain">v{{ row.version || 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="关联应用" width="120">
            <template #default="{ row }">
              <el-tag :type="row.bindingCount > 0 ? 'success' : 'info'" effect="light">
                {{ row.bindingCount || 0 }} 个
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" min-width="160">
            <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" :icon="EditPen" @click="goEdit(row)">编辑</el-button>
              <el-button link type="primary" :icon="Connection" @click="openBindingDialog(row)">
                关联应用
              </el-button>
              <el-button link type="danger" :icon="Delete" @click="removeWorkflow(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="footer-bar">
          <span>共 {{ total }} 个工作流</span>
          <el-pagination
            layout="prev, pager, next, jumper"
            :current-page="pageNum"
            :page-size="20"
            :total="total"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </section>

    <el-dialog
      v-model="bindingDialogVisible"
      title="关联 Chatflow 应用"
      width="720px"
      destroy-on-close
      align-center
    >
      <div v-loading="bindingLoading" class="binding-dialog-body">
        <p class="binding-hint">
          一个 Chatflow 应用只能绑定一个工作流；已绑定其他工作流的应用被选中后会改绑到当前工作流。
        </p>
        <el-checkbox-group v-model="selectedAppIds" class="binding-list">
          <label v-for="app in bindingApps" :key="app.id" class="binding-row">
            <el-checkbox :label="Number(app.id)">
              <span class="binding-name">{{ app.appName }}</span>
            </el-checkbox>
            <span
              v-if="app.workflowId && app.workflowId !== editingWorkflow?.id"
              class="binding-current"
            >
              当前：{{ app.workflowName || '其他工作流' }}
            </span>
          </label>
        </el-checkbox-group>
      </div>
      <template #footer>
        <el-button @click="bindingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bindingLoading" @click="saveBindings"
          >保存关联</el-button
        >
      </template>
    </el-dialog>

    <WorkflowEditConfirmDialog
      v-model="editConfirmVisible"
      :workflow-name="pendingEditWorkflow?.workflowName"
      :apps="editConfirmApps"
      @confirm="confirmEditWorkflow"
    />
  </div>
</template>

<style scoped lang="less">
.workflow-page {
  min-height: 100%;
  padding: 24px;
  background: #f5f7fb;
}

.workflow-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.workflow-header {
  display: flex;
  min-height: 148px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 28px;
  color: #f8fafc;
  background: linear-gradient(135deg, #182033 0%, #245c73 54%, #2f7d63 100%);
  border-radius: 8px;
}

.eyebrow {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.78;
}

.workflow-header h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
}

.workflow-header p {
  max-width: 620px;
  margin: 10px 0 0;
  line-height: 1.7;
  color: rgb(248 250 252 / 78%);
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(92px, 1fr));
  gap: 10px;
}

.metric-item {
  min-width: 92px;
  padding: 12px 14px;
  background: rgb(255 255 255 / 12%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 8px;
}

.metric-item span {
  display: block;
  font-size: 12px;
  color: rgb(248 250 252 / 70%);
}

.metric-item strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.workflow-panel {
  padding: 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.search-input {
  max-width: 360px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}

.workflow-table {
  width: 100%;
}

.workflow-name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workflow-mark {
  display: inline-flex;
  width: 38px;
  height: 38px;
  font-weight: 800;
  color: #134e4a;
  background: #d9f3ec;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.workflow-name-cell strong {
  display: block;
  color: #172033;
}

.workflow-name-cell p {
  margin: 4px 0 0;
  color: #64748b;
}

.footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  color: #64748b;
}

.binding-dialog-body {
  min-height: 260px;
}

.binding-hint {
  margin: 0 0 14px;
  color: #64748b;
}

.binding-list {
  display: flex;
  max-height: 360px;
  flex-direction: column;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.binding-row {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #eef2f7;
}

.binding-row:last-child {
  border-bottom: 0;
}

.binding-name {
  font-weight: 600;
  color: #172033;
}

.binding-current {
  font-size: 12px;
  color: #d97706;
}

@media (width <= 900px) {
  .workflow-page {
    padding: 16px;
  }

  .workflow-header,
  .toolbar-row,
  .footer-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .metric-strip {
    grid-template-columns: repeat(3, 1fr);
  }

  .search-input {
    max-width: none;
  }
}
</style>
