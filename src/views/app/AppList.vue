<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Clock, MoreFilled, Plus, Search } from '@element-plus/icons-vue'
import { ContentWrap } from '@/components/ContentWrap'
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

function hashColor(text: string): string {
  const colors = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#22c55e', '#8b5cf6']
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

function onCreateCommand(command: 'template' | 'blank') {
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
  <ContentWrap>
    <div class="app-page">
      <div class="page-header">
        <div class="eyebrow">APPLICATIONS · {{ total }}</div>
        <div class="page-header-row">
          <div class="header-copy">
            <h1>应用管理</h1>
            <p>在此创建、配置和管理你的 AI 应用。</p>
          </div>

          <div class="page-actions">
            <el-dropdown trigger="click" @command="onCreateCommand">
              <el-button type="primary">
                <el-icon><Plus /></el-icon>
                新增应用
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="template">从模板创建</el-dropdown-item>
                  <el-dropdown-item command="blank">从空白编排</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-tabs">
          <button
            type="button"
            class="filter-tab"
            :class="{ active: statusFilter === '' }"
            @click="setStatusFilter('')"
          >
            全部
          </button>
          <button
            type="button"
            class="filter-tab"
            :class="{ active: statusFilter === 'PUBLISHED' }"
            @click="setStatusFilter('PUBLISHED')"
          >
            已发布
          </button>
          <button
            type="button"
            class="filter-tab"
            :class="{ active: statusFilter === 'UNPUBLISHED' }"
            @click="setStatusFilter('UNPUBLISHED')"
          >
            未发布
          </button>
        </div>

        <div class="filter-divider"></div>

        <el-input
          v-model="keyword"
          class="search-input"
          placeholder="按名称搜索"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #suffix>
            <el-icon class="search-suffix-icon" @click.stop="handleSearch">
              <Search />
            </el-icon>
          </template>
        </el-input>
      </div>

      <div v-loading="loading" class="card-grid">
        <el-dropdown class="create-dropdown" trigger="click" @command="onCreateCommand">
          <button type="button" class="app-card create-card">
            <span class="create-plus">
              <el-icon><Plus /></el-icon>
            </span>
            <span class="create-title">创建新应用</span>
            <span class="create-subtitle">从模板或空白编排开始</span>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="template">从模板创建</el-dropdown-item>
              <el-dropdown-item command="blank">从空白编排</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

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
            <el-button text circle @click.stop>
              <el-icon><MoreFilled /></el-icon>
            </el-button>
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

          <div class="card-head">
            <div
              v-if="!row.iconImage && !row.icon"
              class="avatar-fallback"
              :style="{ backgroundColor: avatarColor(row) }"
            >
              {{ avatarText(row) }}
            </div>
            <img v-else class="avatar" :src="row.iconImage || row.icon" alt="icon" />

            <div class="head-main">
              <div class="app-name">{{ row.appName || '-' }}</div>
              <div class="tag-row">
                <el-tag size="small" :type="getPublishStatusTagType(row.publishStatus)">
                  {{ getPublishStatusText(row.publishStatus) }}
                </el-tag>
                <el-tag size="small" type="info">{{ row.appType || 'UNKNOWN' }}</el-tag>
              </div>
            </div>
          </div>

          <div class="card-description">{{ row.description || '暂无描述' }}</div>

          <div class="card-footer">
            <div class="card-meta">
              <span>{{ row.appCode || 'APP' }}</span>
              <span>·</span>
              <span>v{{ row.version || 0 }}</span>
            </div>

            <div class="card-time">
              <el-icon><Clock /></el-icon>
              <span>{{ formatTimeAgo(row.lastEditedAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="footer-bar">
        <span>共 {{ total }} 条</span>
        <el-pagination
          layout="prev, pager, next, jumper"
          :current-page="pageNum"
          :page-size="20"
          :total="total"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </ContentWrap>

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
.app-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-header {
  padding-bottom: 4px;
}

.eyebrow {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--el-text-color-placeholder);
}

.page-header-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.header-copy {
  min-width: 0;
}

.header-copy h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--el-text-color-primary);
}

.header-copy p {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.page-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.filter-bar {
  display: flex;
  min-height: 48px;
  padding: 7px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  align-items: center;
  gap: 12px;
}

.filter-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-tab {
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.filter-tab:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.filter-tab.active {
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
}

.filter-divider {
  width: 1px;
  height: 24px;
  background: var(--el-border-color);
}

.search-input {
  width: min(320px, 100%);
  margin-left: auto;
}

.search-suffix-icon {
  padding: 4px;
  color: var(--el-text-color-placeholder);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.search-suffix-icon:hover {
  cursor: pointer;
  background: var(--el-fill-color-light);
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.app-card {
  position: relative;
  display: flex;
  height: 190px;
  min-width: 0;
  padding: 16px;
  overflow: hidden;
  font-family: inherit;
  cursor: pointer;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 5%);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease,
    opacity 0.2s ease;
  flex-direction: column;
}

.app-card:hover {
  border-color: var(--el-border-color);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgb(0 0 0 / 8%);
}

.app-card.is-unpublished {
  cursor: default;
  opacity: 0.82;
}

.create-dropdown {
  width: 100%;
  min-width: 0;
}

.create-card {
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  border-style: dashed;
}

.create-card:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}

.create-plus {
  display: inline-flex;
  width: 44px;
  height: 44px;
  font-size: 22px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  align-items: center;
  justify-content: center;
}

.create-title {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.create-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.more-menu {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.card-head {
  display: flex;
  min-width: 0;
  padding-right: 34px;
  align-items: flex-start;
  gap: 12px;
}

.avatar,
.avatar-fallback {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  flex-shrink: 0;
}

.avatar {
  object-fit: cover;
}

.avatar-fallback {
  display: flex;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  align-items: center;
  justify-content: center;
}

.head-main {
  min-width: 0;
  flex: 1;
}

.app-name {
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--el-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-row {
  display: flex;
  min-width: 0;
  margin-top: 8px;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.card-description {
  display: -webkit-box;
  margin-top: 18px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.65;
  color: var(--el-text-color-regular);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  flex: 1;
}

.card-footer {
  display: flex;
  min-width: 0;
  padding-top: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-meta {
  display: inline-flex;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  align-items: center;
  gap: 6px;
}

.card-time {
  display: inline-flex;
  min-width: max-content;
  align-items: center;
  gap: 4px;
}

.danger-text {
  color: var(--el-color-danger);
}

.footer-bar {
  display: flex;
  padding-top: 2px;
  align-items: center;
  justify-content: space-between;
}

.json-view {
  min-height: 320px;
  padding: 12px;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #dbeafe;
  word-break: break-all;
  white-space: pre-wrap;
  background: #0f172a;
  border-radius: 8px;
}

@media (width <= 960px) {
  .page-header-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-divider {
    display: none;
  }

  .search-input {
    width: 100%;
    margin-left: 0;
  }
}

@media (width <= 720px) {
  .page-actions {
    width: 100%;
  }

  .page-actions :deep(.el-dropdown),
  .page-actions :deep(.el-button) {
    width: 100%;
  }

  .filter-tabs {
    overflow-x: auto;
  }

  .filter-tab {
    flex-shrink: 0;
  }

  .card-grid {
    grid-template-columns: 1fr;
  }

  .footer-bar {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
</style>
