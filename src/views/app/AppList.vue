<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { Clock, MoreFilled, Plus, Search } from '@element-plus/icons-vue'
import IconUploader from './components/IconUploader.vue'
import {
  appApi,
  orchestrationApi,
  type AppConfigVO,
  type AppListParams,
  type PageResult,
  type UpdateAppBasicRequest
} from '@/api/frontend-api'

type AppRow = AppConfigVO & Record<string, any>
type PublishStatus = AppListParams['publishStatus']
type AppBasicForm = Omit<UpdateAppBasicRequest, 'appName' | 'iconImage'> & {
  id?: number
  appName: string
  iconImage: string
}

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const submitting = ref(false)
const publishingId = ref<number | null>(null)
const parameterLoading = ref(false)

const keyword = ref('')
const statusFilter = ref<PublishStatus>('')
const pageNum = ref(1)
const total = ref(0)
const appList = ref<AppRow[]>([])

const dialogVisible = ref(false)
const createDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const formData = reactive<AppBasicForm>({
  appName: '',
  description: '',
  icon: '',
  iconImage: '',
  sort: 1,
  enabled: true,
  id: undefined
})

const editingRow = ref<AppRow | null>(null)

const publishedCount = computed(
  () => appList.value.filter((item) => item.publishStatus === 'PUBLISHED').length
)
const unpublishedCount = computed(
  () => appList.value.filter((item) => item.publishStatus !== 'PUBLISHED').length
)
const enabledCount = computed(
  () => appList.value.filter((item) => normalizeEnabled(item.enabled)).length
)

const formRules: FormRules = {
  appName: [{ required: true, message: '请输入应用名称', trigger: 'blur' }]
}

const parameterDrawerVisible = ref(false)
const parameterTitle = ref('应用参数')
const parameterText = ref('')

const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  SAVED: '未发布',
  PUBLISHED: '已发布',
  PUBLISH_FAILED: '发布失败'
}

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['list', 'items', 'rows', 'records', 'data']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  if (payload.data && typeof payload.data === 'object') {
    for (const key of ['list', 'items', 'rows', 'records']) {
      if (Array.isArray(payload.data[key])) return payload.data[key]
    }
  }
  return []
}

function resolveSourceType(row: AppRow): 'canvas' | 'template' | undefined {
  if (row.sourceType === 'canvas' || row.sourceType === 'template') return row.sourceType
  if (row.templateCode === '__canvas__') return 'canvas'
  if (row.templateCode) return 'template'
  return undefined
}

function getPublishStatusText(status?: string): string {
  if (!status) return '-'
  return statusMap[status] || status
}

function getPublishStatusTagType(status?: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'SAVED' || status === 'DRAFT') return 'warning'
  if (status === 'PUBLISH_FAILED') return 'danger'
  return 'info'
}

function normalizeEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  return Boolean(value)
}

function isPublished(row: AppRow): boolean {
  return row.publishStatus === 'PUBLISHED'
}

function formatTimeAgo(value?: string): string {
  if (!value) return '暂无编辑时间'
  const date = new Date(value)
  const timestamp = date.getTime()
  if (Number.isNaN(timestamp)) return value

  const now = Date.now()
  const diff = Math.max(0, now - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < hour) {
    const minutes = Math.max(1, Math.floor(diff / minute))
    return `${minutes} 分钟前编辑`
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours} 小时前编辑`
  }
  if (diff < 7 * day) {
    const days = Math.floor(diff / day)
    return `${days} 天前编辑`
  }
  return date.toISOString().slice(0, 10)
}

// 收敛后的单色方块配色（对齐 design token）
function hashColor(text: string): string {
  const colors = [
    '#0a0a0a',
    '#2563eb',
    '#16a34a',
    '#d97706',
    '#7c3aed',
    '#db2777',
    '#0891b2',
    '#525252'
  ]
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

function avatarText(row: AppRow): string {
  const first = String(row.appName || '')
    .trim()
    .charAt(0)
  return first ? first.toUpperCase() : 'A'
}

function avatarColor(row: AppRow): string {
  return hashColor(String(row.appType || row.appCode || row.appName || 'app'))
}

function openCreateDialog() {
  createDialogVisible.value = true
}

function onCreateCommand(command: 'template' | 'blank') {
  createDialogVisible.value = false
  if (command === 'template') {
    router.push({
      path: '/apps/orchestrator/create',
      query: { mode: 'template', from: route.fullPath }
    })
    return
  }
  router.push({
    path: '/apps/orchestrator/create',
    query: { mode: 'blank', from: route.fullPath }
  })
}

async function loadApps() {
  loading.value = true
  try {
    const response = await appApi.list({
      pageNum: pageNum.value,
      pageSize: 20,
      keyword: keyword.value.trim() || undefined,
      publishStatus: statusFilter.value || undefined
    })

    const list = pickArray(response) as AppRow[]
    appList.value = list

    if (Array.isArray(response)) {
      total.value = list.length
      return
    }

    const pageData = response as PageResult<AppRow>
    total.value = Number(pageData.total || list.length)
    if (Number.isFinite(Number(pageData.pageNum)) && Number(pageData.pageNum) > 0) {
      pageNum.value = Number(pageData.pageNum)
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '应用列表加载失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formData.id = undefined
  formData.appName = ''
  formData.description = ''
  formData.icon = ''
  formData.iconImage = ''
  formData.sort = 1
  formData.enabled = true
  editingRow.value = null
}

async function openBasicEdit(row: AppRow) {
  dialogVisible.value = true
  resetForm()
  editingRow.value = row
  formData.id = Number(row.id)
  formData.appName = row.appName || ''
  formData.description = row.description || ''
  formData.icon = row.icon || ''
  formData.iconImage = row.iconImage || ''
  formData.sort = Number(row.sort || 1)
  formData.enabled = normalizeEnabled(row.enabled)

  try {
    const detail = (await appApi.detail(Number(row.id))) as Record<string, any>
    formData.appName = detail.appName || row.appName || ''
    formData.description = detail.description || row.description || ''
    formData.icon = detail.icon || row.icon || ''
    formData.iconImage = detail.iconImage || row.iconImage || ''
    formData.sort = Number(detail.sort || row.sort || 1)
    formData.enabled = normalizeEnabled(detail.enabled ?? row.enabled)
  } catch (error: any) {
    ElMessage.warning(error?.message || '详情加载失败，已使用列表数据回填')
  }
}

function toBasicPayload(): UpdateAppBasicRequest {
  return {
    appName: String(formData.appName || '').trim(),
    description: formData.description?.trim() || undefined,
    icon: formData.icon?.trim() || editingRow.value?.icon || undefined,
    iconImage: formData.iconImage || '',
    sort: Number(formData.sort || 1),
    enabled: normalizeEnabled(formData.enabled)
  }
}

async function submitBasicEdit() {
  if (!formRef.value) return
  await formRef.value.validate()

  submitting.value = true
  try {
    await appApi.updateBasic(Number(formData.id), toBasicPayload())
    ElMessage.success('基本信息更新成功')
    dialogVisible.value = false
    await loadApps()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

function handleEditFlow(row: AppRow) {
  const sourceType = resolveSourceType(row)
  if (sourceType === 'canvas') {
    router.push({
      path: '/apps/orchestrator/create',
      query: { mode: 'blank', edit: String(row.id), from: route.fullPath }
    })
    return
  }
  if (sourceType === 'template') {
    router.push({
      path: '/apps/orchestrator/create',
      query: { mode: 'template', edit: String(row.id), from: route.fullPath }
    })
    return
  }
  ElMessage.warning('该应用缺少编排来源，无法进入流程编辑')
}

async function removeApp(row: AppRow) {
  try {
    await ElMessageBox.confirm(`确认删除应用“${row.appName}”吗？`, '删除确认', { type: 'warning' })
    await appApi.delete(Number(row.id))
    ElMessage.success('应用删除成功')
    if (appList.value.length === 1 && pageNum.value > 1) {
      pageNum.value -= 1
    }
    await loadApps()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '删除失败')
    }
  }
}

async function showParameters(row: AppRow) {
  parameterLoading.value = true
  parameterDrawerVisible.value = true
  parameterTitle.value = `${row.appName} 参数`
  parameterText.value = ''
  try {
    const response = await appApi.getParameters(Number(row.id))
    parameterText.value = JSON.stringify(response ?? {}, null, 2)
  } catch (error: any) {
    parameterText.value = error?.message || '参数加载失败'
  } finally {
    parameterLoading.value = false
  }
}

async function publishApp(row: AppRow) {
  try {
    await ElMessageBox.confirm(
      `确认发布应用【${row.appName}】吗？\n发布后会将当前保存流程转换为 Dify 应用并生效。`,
      row.publishStatus === 'PUBLISHED' ? '重新发布确认' : '发布确认',
      {
        type: 'warning',
        confirmButtonText: row.publishStatus === 'PUBLISHED' ? '确认重新发布' : '确认发布',
        cancelButtonText: '取消'
      }
    )
    publishingId.value = Number(row.id)
    await orchestrationApi.publishApp(Number(row.id), {
      version: Number(row.version || 0) || undefined
    })
    ElMessage.success('发布成功')
    await loadApps()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    const status = error?.response?.status
    const backendMessage = error?.response?.data?.message || error?.message || '发布失败'
    if (status === 409) {
      ElMessage.error('应用已被他人修改，请刷新后重试')
    } else if (status === 400) {
      ElMessage.error(String(backendMessage))
    } else if (status === 500) {
      ElMessage.error('发布失败')
    } else {
      ElMessage.error(String(backendMessage))
    }
  } finally {
    publishingId.value = null
  }
}

function handleMoreCommand(command: string, row: AppRow) {
  if (command === 'flow') {
    handleEditFlow(row)
    return
  }
  if (command === 'publish') {
    void publishApp(row)
    return
  }
  if (command === 'basic') {
    void openBasicEdit(row)
    return
  }
  if (command === 'params') {
    void showParameters(row)
    return
  }
  if (command === 'delete') {
    void removeApp(row)
  }
}

function handleCardClick(row: AppRow) {
  if (!isPublished(row)) return
  router.push(`/apps/${row.id}/chat`)
}

function handleSearch() {
  pageNum.value = 1
  void loadApps()
}

function handleStatusChange() {
  pageNum.value = 1
  void loadApps()
}

function setStatusFilter(status: PublishStatus) {
  if (statusFilter.value === status) return
  statusFilter.value = status
  handleStatusChange()
}

function handlePageChange(nextPage: number) {
  pageNum.value = nextPage
  void loadApps()
}

onMounted(() => {
  void loadApps()
})
</script>

<template>
  <div class="app-page">
    <section class="workspace-shell">
      <div class="hero-panel">
        <div class="hero-copy">
          <div class="eyebrow">APPLICATIONS · {{ total }}</div>
          <h1>应用管理</h1>
          <p>创建、配置、发布和维护企业 AI 应用，让应用资产保持清晰可控。</p>
        </div>

        <div class="hero-metrics">
          <div class="metric-card">
            <span class="metric-label">当前页应用</span>
            <strong>{{ appList.length }}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">已发布</span>
            <strong>{{ publishedCount }}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">已启用</span>
            <strong>{{ enabledCount }}</strong>
          </div>
        </div>
      </div>

      <div class="content-panel">
        <div class="toolbar-row">
          <div class="filter-tabs" aria-label="应用发布状态筛选">
            <button
              type="button"
              class="filter-tab"
              :class="{ active: statusFilter === '' }"
              @click="setStatusFilter('')"
            >
              <span>全部</span>
              <em>{{ total }}</em>
            </button>
            <button
              type="button"
              class="filter-tab"
              :class="{ active: statusFilter === 'PUBLISHED' }"
              @click="setStatusFilter('PUBLISHED')"
            >
              <span>已发布</span>
              <em>{{ publishedCount }}</em>
            </button>
            <button
              type="button"
              class="filter-tab"
              :class="{ active: statusFilter === 'UNPUBLISHED' }"
              @click="setStatusFilter('UNPUBLISHED')"
            >
              <span>未发布</span>
              <em>{{ unpublishedCount }}</em>
            </button>
          </div>

          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索应用名称 / 编码"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon class="search-prefix-icon"><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <div v-loading="loading" class="app-grid">
          <button type="button" class="app-card create-card" @click="openCreateDialog">
            <span class="create-plus">
              <el-icon><Plus /></el-icon>
            </span>
            <span class="create-title">创建新应用</span>
            <span class="create-subtitle">选择创建方式，快速搭建企业 AI 应用</span>
          </button>

          <div
            v-for="row in appList"
            :key="row.id"
            class="app-card"
            :class="{ 'is-unpublished': !isPublished(row) }"
            @click="handleCardClick(row)"
          >
            <el-dropdown
              class="more-menu"
              trigger="click"
              @command="(command) => handleMoreCommand(command, row)"
            >
              <button type="button" class="menu-trigger" @click.stop>
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="flow">编辑流程</el-dropdown-item>
                  <el-dropdown-item :disabled="publishingId === Number(row.id)" command="publish">
                    {{ row.publishStatus === 'PUBLISHED' ? '重新发布' : '发布' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="basic">改基本信息</el-dropdown-item>
                  <el-dropdown-item command="params">参数</el-dropdown-item>
                  <el-dropdown-item command="delete">
                    <span class="danger-text">删除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <div class="card-top">
              <div
                v-if="!row.iconImage && !row.icon"
                class="app-icon"
                :style="{ backgroundColor: avatarColor(row) }"
              >
                {{ avatarText(row) }}
              </div>
              <img v-else class="app-icon img" :src="row.iconImage || row.icon" alt="icon" />

              <div class="title-area">
                <div class="app-name">{{ row.appName || '-' }}</div>
                <div class="app-code">{{ row.appCode || 'APP' }}</div>
              </div>
            </div>

            <div class="card-desc">{{
              row.description || '暂无描述，可在基本信息中补充应用用途。'
            }}</div>

            <div class="tag-row">
              <span class="status-tag" :class="`st-${getPublishStatusTagType(row.publishStatus)}`">
                {{ getPublishStatusText(row.publishStatus) }}
              </span>
              <span class="type-tag">{{ row.appType || 'UNKNOWN' }}</span>
              <span class="version-tag">v{{ row.version || 0 }}</span>
            </div>

            <div class="card-footer">
              <div class="meta-time">
                <el-icon><Clock /></el-icon>
                <span>{{ formatTimeAgo(row.lastEditedAt) }}</span>
              </div>
              <span class="entry-hint">{{ isPublished(row) ? '进入对话' : '待发布' }}</span>
            </div>
          </div>
        </div>

        <div class="footer-bar">
          <span class="footer-count">共 {{ total }} 条 · 当前页 {{ appList.length }} 条</span>
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
  </div>

  <el-dialog
    v-model="createDialogVisible"
    class="create-mode-dialog"
    width="720px"
    destroy-on-close
    align-center
    :show-close="true"
  >
    <template #header>
      <div class="create-dialog-header">
        <span class="dialog-eyebrow">CREATE APPLICATION</span>
        <h3>选择创建方式</h3>
        <p>根据当前需求选择合适的起点，后续都可以继续编辑应用配置和编排流程。</p>
      </div>
    </template>

    <div class="create-mode-grid">
      <button type="button" class="create-mode-card blank-mode" @click="onCreateCommand('blank')">
        <span class="mode-icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 5.5C5 4.67 5.67 4 6.5 4h11c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-11C5.67 20 5 19.33 5 18.5v-13Z"
            />
            <path d="M8 8h8M8 12h5M8 16h3" />
          </svg>
        </span>
        <span class="mode-content">
          <strong>从空白创建</strong>
          <small>适合自定义流程，从零配置节点、参数和发布信息。</small>
        </span>
        <span class="mode-badge">推荐自定义</span>
      </button>

      <button
        type="button"
        class="create-mode-card template-mode"
        @click="onCreateCommand('template')"
      >
        <span class="mode-icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.5-2.5v-11Z"
            />
            <path d="M8 8h3v3H8V8Zm5 0h3v3h-3V8ZM8 13h3v3H8v-3Zm5 0h3v3h-3v-3Z" />
          </svg>
        </span>
        <span class="mode-content">
          <strong>从模板创建</strong>
          <small>适合快速复用成熟场景，基于模板微调后直接发布。</small>
        </span>
        <span class="mode-badge">快速启动</span>
      </button>
    </div>
  </el-dialog>

  <el-dialog v-model="dialogVisible" title="改基本信息" width="640px" destroy-on-close>
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
      <el-form-item label="应用头像">
        <IconUploader v-model="formData.iconImage" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="16">
          <el-form-item label="应用名称" prop="appName">
            <el-input v-model="formData.appName" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="排序">
            <el-input-number v-model="formData.sort" class="w-full" :min="1" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="启用">
            <el-switch v-model="formData.enabled" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="描述">
        <el-input v-model="formData.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitBasicEdit">保存</el-button>
    </template>
  </el-dialog>

  <el-drawer v-model="parameterDrawerVisible" :title="parameterTitle" size="540px">
    <el-skeleton v-if="parameterLoading" :rows="8" animated />
    <pre v-else class="json-view">{{ parameterText }}</pre>
  </el-drawer>
</template>

<style scoped lang="less">
@media (width <= 1180px) {
  .hero-panel {
    grid-template-columns: 1fr;
  }

  .hero-metrics {
    max-width: 520px;
  }
}

@media (width <= 960px) {
  .workspace-shell {
    padding: 18px;
  }

  .toolbar-row {
    align-items: stretch;
    flex-direction: column;
  }

  .search-input {
    width: 100%;
    margin-left: 0;
  }
}

@media (width <= 720px) {
  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .filter-tabs {
    width: 100%;
    overflow-x: auto;
  }

  .filter-tab {
    flex: 1 0 auto;
  }

  .app-grid {
    grid-template-columns: 1fr;
  }

  .footer-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .create-mode-grid {
    grid-template-columns: 1fr;
  }
}

:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.app-page {
  --app-bg: #f5f7fb;
  --app-bg-soft: #f8faff;
  --surface: #fff;
  --surface-soft: #f9fbff;
  --surface-tint: #eef4ff;
  --border: #e2e8f0;
  --border-soft: #e8eef7;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-soft: #eaf1ff;
  --primary-softer: #f2f6ff;
  --text-primary: #1f2937;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
  --text-inverse: #fff;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --shadow-card: 0 10px 26px rgb(15 23 42 / 6%);
  --shadow-hover: 0 16px 34px rgb(37 99 235 / 10%);
  --font-sans: 'Inter', -apple-system, blinkmacsystemfont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', menlo, monospace;

  min-height: 100%;
  font-family: var(--font-sans);
  color: var(--text-primary);
  background: radial-gradient(circle at 0 0, rgb(37 99 235 / 5%), transparent 280px),
    linear-gradient(180deg, #f8faff 0%, var(--app-bg) 42%, var(--app-bg) 100%);
}

.workspace-shell {
  display: flex;
  min-height: 100%;
  padding: 22px 26px 20px;
  flex-direction: column;
  gap: 18px;
}

/* 顶部不再做白色隔离条，而是做与背景融合的工作台头部 */
.hero-panel {
  position: relative;
  display: grid;
  padding: 22px 24px;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    rgb(234 241 255 / 96%) 0%,
    rgb(248 250 255 / 92%) 56%,
    rgb(245 247 251 / 88%) 100%
  );
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgb(37 99 235 / 5%);
  align-items: center;
  grid-template-columns: minmax(0, 1.2fr) auto;
  gap: 22px;
}

.hero-panel::before {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 0;
  width: 4px;
  background: var(--primary);
  border-radius: 0 999px 999px 0;
  content: '';
}

.hero-copy {
  position: relative;
  min-width: 0;
}

.eyebrow {
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--primary);
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: -0.02em;
  color: #172033;
}

.hero-copy p {
  max-width: 520px;
  margin: 7px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 1fr));
  gap: 10px;
}

.metric-card {
  min-width: 94px;
  padding: 12px 14px;
  background: rgb(255 255 255 / 54%);
  border: 1px solid rgb(226 232 240 / 76%);
  border-radius: 14px;
}

.metric-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-card strong {
  font-family: var(--font-mono);
  font-size: 22px;
  line-height: 1;
  color: #172033;
}

/* 内容区是一个融合式浅色面板，不做独立白条 */
.content-panel {
  display: flex;
  min-height: 0;
  padding: 18px;
  background: rgb(248 250 255 / 70%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  flex: 1;
  flex-direction: column;
  gap: 16px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.filter-tabs {
  display: inline-flex;
  padding: 4px;
  background: #edf3ff;
  border: 1px solid #dfe8f6;
  border-radius: 12px;
  gap: 4px;
}

.filter-tab {
  display: inline-flex;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #516174;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9px;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
  align-items: center;
  gap: 8px;
}

.filter-tab em {
  min-width: 20px;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-style: normal;
  color: #64748b;
  background: rgb(255 255 255 / 72%);
  border-radius: 999px;
}

.filter-tab:hover {
  color: var(--primary);
  background: rgb(255 255 255 / 50%);
}

.filter-tab.active {
  color: var(--primary);
  background: #fff;
  box-shadow: 0 6px 16px rgb(37 99 235 / 10%);
}

.filter-tab.active em {
  color: var(--primary);
  background: var(--primary-soft);
}

.search-input {
  width: min(320px, 100%);
  margin-left: auto;
}

.search-input :deep(.el-input__wrapper) {
  height: 40px;
  padding: 0 13px;
  background: #fff !important;
  border-radius: 12px !important;
  box-shadow: 0 0 0 1px var(--border) inset !important;
  transition:
    box-shadow 0.16s ease,
    background-color 0.16s ease;
}

.search-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd8ea inset !important;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--primary) inset,
    0 0 0 4px rgb(37 99 235 / 10%) !important;
}

.search-prefix-icon {
  color: var(--text-tertiary);
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(286px, 1fr));
  gap: 16px;
}

.app-card {
  position: relative;
  display: flex;
  min-height: 184px;
  padding: 18px;
  overflow: hidden;
  font-family: inherit;
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  flex-direction: column;
}

.app-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  background: transparent;
  content: '';
}

.app-card:hover {
  border-color: #c7d5ea;
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

.app-card:hover::before {
  background: var(--primary);
}

.app-card.is-unpublished {
  cursor: default;
}

.app-card.is-unpublished::before {
  background: #cbd5e1;
}

.app-card.is-unpublished:hover {
  box-shadow: var(--shadow-card);
}

.create-card {
  width: 100%;
  color: var(--text-secondary);
  text-align: center;
  background: linear-gradient(180deg, #f8fbff 0%, #f2f6ff 100%);
  border: 1px dashed #b9c8df;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.create-card::before {
  display: none;
}

.create-card:hover {
  color: var(--primary);
  background: var(--primary-softer);
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgb(37 99 235 / 9%);
}

.create-plus {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 8px;
  font-size: 18px;
  color: var(--primary);
  background: #fff;
  border: 1px solid #d8e3f5;
  border-radius: 14px;
  box-shadow: 0 8px 18px rgb(37 99 235 / 8%);
  place-items: center;
}

.create-title {
  font-size: 15px;
  font-weight: 700;
  color: #172033;
}

.create-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.more-menu {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 1;
}

.menu-trigger {
  display: grid;
  width: 30px;
  height: 30px;
  color: var(--text-tertiary);
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid transparent;
  border-radius: 10px;
  opacity: 0;
  transition: all 0.16s ease;
  place-items: center;
}

.app-card:hover .menu-trigger {
  opacity: 1;
}

.menu-trigger:hover {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: #d8e3f5;
}

.card-top {
  display: flex;
  min-width: 0;
  padding-right: 34px;
  margin-bottom: 14px;
  align-items: flex-start;
  gap: 12px;
}

.app-icon {
  display: grid;
  width: 44px;
  height: 44px;
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-inverse);
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 16%);
  place-items: center;
  flex-shrink: 0;
}

.app-icon.img {
  object-fit: cover;
  background: #eef2f7;
}

.title-area {
  min-width: 0;
  flex: 1;
}

.app-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.38;
  color: #172033;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-code {
  margin-top: 3px;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  display: -webkit-box;
  min-height: 40px;
  margin-bottom: 14px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  flex: 1;
}

.tag-row {
  display: flex;
  margin-bottom: 14px;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.status-tag,
.type-tag,
.version-tag {
  display: inline-flex;
  height: 24px;
  padding: 0 8px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 999px;
  align-items: center;
}

.st-success {
  color: #15803d;
  background: #eaf7ef;
}

.st-warning {
  color: #b45309;
  background: #fff4df;
}

.st-danger {
  color: #b91c1c;
  background: #fff1f2;
}

.st-info {
  color: var(--primary);
  background: var(--primary-soft);
}

.type-tag {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: #475569;
  text-transform: uppercase;
  background: #f1f5f9;
}

.version-tag {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: #f8fafc;
  border: 1px solid var(--border-soft);
}

.card-footer {
  display: flex;
  min-width: 0;
  padding-top: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-soft);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meta-time {
  display: inline-flex;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  align-items: center;
  gap: 5px;
}

.entry-hint {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.app-card.is-unpublished .entry-hint {
  color: var(--text-tertiary);
}

.danger-text {
  color: var(--danger);
}

.footer-bar {
  display: flex;
  min-height: 44px;
  padding: 0 2px;
  background: transparent;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.footer-bar :deep(.el-pagination) {
  --el-pagination-bg-color: transparent;
  --el-pagination-button-disabled-bg-color: transparent;
  --el-pagination-hover-color: var(--primary);
}

.footer-bar :deep(.el-pager li) {
  border-radius: 8px;
}

.footer-bar :deep(.el-pager li.is-active) {
  color: var(--primary);
  background: var(--primary-soft);
}

.create-mode-dialog {
  --primary: #2563eb;
  --primary-soft: #eaf1ff;
  --text-secondary: #64748b;
  --border-soft: #e8eef7;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', menlo, monospace;
}

.create-dialog-header {
  padding-right: 28px;
}

.dialog-eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--primary);
}

.create-dialog-header h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  color: #172033;
}

.create-dialog-header p {
  max-width: 560px;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.create-mode-dialog :deep(.el-dialog) {
  overflow: hidden;
  background: linear-gradient(180deg, #f8faff 0%, #fff 48%, #f8faff 100%);
  border: 1px solid var(--border-soft);
  border-radius: 22px;
  box-shadow: 0 24px 70px rgb(15 23 42 / 18%);
}

.create-mode-dialog :deep(.el-dialog__header) {
  padding: 26px 28px 8px;
  margin-right: 0;
}

.create-mode-dialog :deep(.el-dialog__body) {
  padding: 18px 28px 30px;
}

.create-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.create-mode-card {
  position: relative;
  display: flex;
  min-height: 190px;
  padding: 20px;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dfe8f6;
  border-radius: 18px;
  box-shadow: 0 8px 22px rgb(15 23 42 / 5%);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    background-color 0.18s ease;
  flex-direction: column;
  gap: 16px;
}

.create-mode-card::after {
  position: absolute;
  right: -36px;
  bottom: -36px;
  width: 120px;
  height: 120px;
  background: rgb(37 99 235 / 7%);
  border-radius: 999px;
  content: '';
}

.create-mode-card:hover {
  background: #fbfdff;
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 18px 42px rgb(37 99 235 / 13%);
}

.mode-icon {
  position: relative;
  z-index: 1;
  display: grid;
  width: 48px;
  height: 48px;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid #d8e3f5;
  border-radius: 16px;
  place-items: center;
}

.template-mode .mode-icon {
  color: #0f766e;
  background: #ecfdf5;
  border-color: #cdeee1;
}

.mode-icon svg {
  width: 25px;
  height: 25px;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mode-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-content strong {
  font-size: 17px;
  font-weight: 700;
  color: #172033;
}

.mode-content small {
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
}

.mode-badge {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  padding: 4px 9px;
  margin-top: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 999px;
}

.template-mode .mode-badge {
  color: #0f766e;
  background: #ecfdf5;
}

.json-view {
  min-height: 320px;
  padding: 14px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-all;
  white-space: pre-wrap;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 12px;
}
</style>
