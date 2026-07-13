<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { Clock, MoreFilled, Plus, Search, QuestionFilled } from '@element-plus/icons-vue'
import IconUploader from './components/IconUploader.vue'
import WorkflowEditConfirmDialog from './components/WorkflowEditConfirmDialog.vue'
import {
  appApi,
  orchestrationApi,
  workflowApi,
  type AppStarterPrompt,
  type AppConfigVO,
  type CreateAppBasicRequest,
  type PageResult,
  type UpdateAppBasicRequest,
  type WorkflowBindingAppVO,
  type WorkflowVO
} from '@/api/frontend-api'
import {
  PROMPT_ICON_OPTIONS,
  createDefaultStarterPrompts,
  normalizeStarterPrompts
} from './starter-prompts'

type AppRow = AppConfigVO & Record<string, any>
type AppTypeFilter = '' | 'chat' | 'agent' | 'workflow'
type PublishStatusFilter = '' | 'PUBLISHED' | 'UNPUBLISHED'
type BasicDialogMode = 'create' | 'edit'
type CreateFlowMode = 'template' | 'blank'
type AppBasicForm = Omit<UpdateAppBasicRequest, 'appName' | 'iconImage'> & {
  id?: number
  appName: string
  appCode: string
  iconImage: string
  starterPrompts: AppStarterPrompt[]
}

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const submitting = ref(false)
const publishingId = ref<number | null>(null)
const parameterLoading = ref(false)

const keyword = ref('')
const appTypeFilter = ref<AppTypeFilter>('')
const publishStatusFilter = ref<PublishStatusFilter>('')
const pageNum = ref(1)
const total = ref(0)
const appList = ref<AppRow[]>([])

const dialogVisible = ref(false)
const createDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const basicDialogMode = ref<BasicDialogMode>('edit')
const pendingCreateMode = ref<CreateFlowMode | null>(null)
const formData = reactive<AppBasicForm>({
  appName: '',
  appCode: '',
  description: '',
  icon: '',
  iconImage: '',
  sort: 1,
  enabled: true,
  id: undefined,
  starterPrompts: []
})

// 控制当前正在编辑哪一张提示词卡片 (0 ~ 3)
const activePromptIndex = ref(0)

const editingRow = ref<AppRow | null>(null)
const promptIconOptions = PROMPT_ICON_OPTIONS

const enabledCount = computed(
  () => appList.value.filter((item) => normalizeEnabled(item.enabled)).length
)
const disabledCount = computed(() => appList.value.length - enabledCount.value)

interface AppTypeMeta {
  value: AppTypeFilter
  label: string
  description: string
  badge: string
  icon: string
  createMode: 'template' | 'blank' | 'placeholder'
  aliases: string[]
}

const appTypeMetaList: AppTypeMeta[] = [
  {
    value: 'chat',
    label: '聊天助手',
    description: '快速构建基于 LLM 的智能对话助手',
    badge: '模板创建',
    icon: 'chat',
    createMode: 'template',
    aliases: ['chat', 'advanced-chat', 'advanced_chat', '聊天助手']
  },
  {
    value: 'agent',
    label: 'Agent 智能体',
    description: '支持推理规划与自主工具调用的智能助手',
    badge: '占位开发中',
    icon: 'agent',
    createMode: 'placeholder',
    aliases: ['agent', 'agent 智能体']
  },
  {
    value: 'workflow',
    label: 'Chatflow 对话流',
    description: '支持记忆与流程编排的复杂多轮对话能力',
    badge: '空白创建',
    icon: 'workflow',
    createMode: 'blank',
    aliases: ['workflow', 'chatflow', 'chatflow 对话流', 'workflow 工作流']
  }
]

const formRules: FormRules = {
  appName: [{ required: true, message: '请输入智能体名称', trigger: 'blur' }]
}

const isCreateDialogMode = computed(() => basicDialogMode.value === 'create')
const basicDialogTitle = computed(() =>
  isCreateDialogMode.value ? '创建智能体基础信息' : '修改智能体基本信息'
)
const basicDialogSubmitText = computed(() => (isCreateDialogMode.value ? '下一步' : '确认修改'))

const parameterDrawerVisible = ref(false)
const parameterTitle = ref('智能体参数')
const parameterText = ref('')
const workflowBindVisible = ref(false)
const workflowBindLoading = ref(false)
const workflowBindingRow = ref<AppRow | null>(null)
const workflowOptions = ref<WorkflowVO[]>([])
const selectedWorkflowId = ref<number | ''>('')
const workflowEditConfirmVisible = ref(false)
const workflowEditConfirmApps = ref<WorkflowBindingAppVO[]>([])
const pendingEditWorkflowId = ref<number | null>(null)
const pendingEditWorkflowName = ref('')

const statusMap: Record<string, string> = {
  DRAFT: '未发布',
  SAVED: '未发布',
  PUBLISHED: '已发布',
  PUBLISH_FAILED: '未发布'
}

function normalizeAppTypeKey(value?: string): AppTypeFilter | string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')

  for (const item of appTypeMetaList) {
    const aliasMatches = item.aliases.some(
      (alias) =>
        String(alias)
          .trim()
          .toLowerCase()
          .replace(/[_\s]+/g, '-') === normalized
    )
    if (item.value === normalized || aliasMatches) {
      return item.value
    }
  }

  return normalized || ''
}

function getAppTypeMeta(value?: string): AppTypeMeta | undefined {
  const key = normalizeAppTypeKey(value)
  if (!key) return undefined
  return appTypeMetaList.find((item) => item.value === key)
}

function getAppTypeLabel(value?: string): string {
  return getAppTypeMeta(value)?.label || (value ? String(value) : 'UNKNOWN')
}

function isWorkflowRow(row: AppRow): boolean {
  return normalizeAppTypeKey(row.appType) === 'workflow'
}

function getAppTypeChipClass(value?: string): string {
  const key = normalizeAppTypeKey(value)
  return key ? `type-${key}` : 'type-unknown'
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
  return 'warning'
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
  return hashColor(String(getAppTypeLabel(row.appType) || row.appCode || row.appName || 'app'))
}

function openCreateDialog() {
  createDialogVisible.value = true
}

function onCreateCommand(command: AppTypeMeta['createMode']) {
  createDialogVisible.value = false
  if (command === 'placeholder') {
    router.push({
      path: '/agents/placeholder',
      query: { from: route.fullPath }
    })
    return
  }
  openCreateBasicDialog(command)
}

async function loadApps() {
  loading.value = true
  try {
    const response = await appApi.list({
      pageNum: pageNum.value,
      pageSize: 20,
      keyword: keyword.value.trim() || undefined,
      appType: appTypeFilter.value || undefined,
      publishStatus: publishStatusFilter.value || undefined
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
    ElMessage.error(error?.message || '智能体列表加载失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formData.id = undefined
  formData.appName = ''
  formData.appCode = ''
  formData.description = ''
  formData.icon = ''
  formData.iconImage = ''
  formData.sort = 1
  formData.enabled = true
  formData.starterPrompts = createDefaultStarterPrompts()
  editingRow.value = null
  activePromptIndex.value = 0
}

function openCreateBasicDialog(mode: CreateFlowMode) {
  resetForm()
  basicDialogMode.value = 'create'
  pendingCreateMode.value = mode
  dialogVisible.value = true
}

async function openBasicEdit(row: AppRow) {
  resetForm()
  basicDialogMode.value = 'edit'
  pendingCreateMode.value = null
  dialogVisible.value = true
  editingRow.value = row
  formData.id = Number(row.id)
  formData.appName = row.appName || ''
  formData.appCode = row.appCode || ''
  formData.description = row.description || ''
  formData.icon = row.icon || ''
  formData.iconImage = row.iconImage || ''
  formData.sort = Number(row.sort || 1)
  formData.enabled = normalizeEnabled(row.enabled)
  formData.starterPrompts = normalizeStarterPrompts(row.starterPrompts)
  activePromptIndex.value = 0

  try {
    const detail = (await appApi.detail(Number(row.id))) as Record<string, any>
    formData.appName = detail.appName || row.appName || ''
    formData.appCode = detail.appCode || row.appCode || ''
    formData.description = detail.description || row.description || ''
    formData.icon = detail.icon || row.icon || ''
    formData.iconImage = detail.iconImage || row.iconImage || ''
    formData.sort = Number(detail.sort || row.sort || 1)
    formData.enabled = normalizeEnabled(detail.enabled ?? row.enabled)
    formData.starterPrompts = normalizeStarterPrompts(detail.starterPrompts)
  } catch (error: any) {
    ElMessage.warning(error?.message || '详情加载失败，已使用列表数据回填')
  }
}

function sanitizeStarterPrompts(): AppStarterPrompt[] {
  return formData.starterPrompts.slice(0, 4).map((item, index) => ({
    title: String(item.title || '').trim(),
    description: String(item.description || '').trim(),
    prompt: String(item.prompt || '').trim(),
    iconKey: item.iconKey || promptIconOptions[index % promptIconOptions.length].value
  }))
}

function validateStarterPrompts(): boolean {
  const prompts = sanitizeStarterPrompts()
  if (prompts.length < 1) {
    ElMessage.warning('至少配置 1 条提示词卡片')
    return false
  }
  if (prompts.length > 4) {
    ElMessage.warning('提示词卡片最多配置 4 条')
    return false
  }
  const invalidIndex = prompts.findIndex(
    (item) => !item.title || !item.description || !item.prompt || !item.iconKey
  )
  if (invalidIndex >= 0) {
    ElMessage.warning(`请完善第 ${invalidIndex + 1} 条提示词配置`)
    // 智能联动：直接将 tab 切换至不合法的那一项
    activePromptIndex.value = invalidIndex
    return false
  }
  return true
}

function toBasicPayload(): UpdateAppBasicRequest {
  return {
    appName: String(formData.appName || '').trim(),
    description: formData.description?.trim() || undefined,
    icon: formData.icon?.trim() || editingRow.value?.icon || undefined,
    iconImage: formData.iconImage || '',
    sort: Number(formData.sort || 1),
    enabled: normalizeEnabled(formData.enabled),
    starterPrompts: sanitizeStarterPrompts()
  }
}

function toCreateBasicPayload(): CreateAppBasicRequest {
  return {
    appName: String(formData.appName || '').trim(),
    appType: pendingCreateMode.value === 'blank' ? 'workflow' : 'chat',
    description: formData.description?.trim() || undefined,
    icon: formData.icon?.trim() || undefined,
    iconImage: formData.iconImage || '',
    sort: Number(formData.sort || 1),
    enabled: normalizeEnabled(formData.enabled),
    starterPrompts: sanitizeStarterPrompts()
  }
}

function addStarterPrompt() {
  if (formData.starterPrompts.length >= 4) return
  const defaults = createDefaultStarterPrompts()
  const fallback = defaults[formData.starterPrompts.length] || defaults[0]
  formData.starterPrompts.push({ ...fallback })
  activePromptIndex.value = formData.starterPrompts.length - 1
}

function removeStarterPrompt(index: number) {
  if (formData.starterPrompts.length <= 1) {
    ElMessage.warning('至少保留 1 条提示词卡片')
    return
  }
  formData.starterPrompts.splice(index, 1)
  if (activePromptIndex.value >= formData.starterPrompts.length) {
    activePromptIndex.value = formData.starterPrompts.length - 1
  }
}

async function submitBasicForm() {
  if (!formRef.value) return
  await formRef.value.validate()
  if (!validateStarterPrompts()) return

  submitting.value = true
  try {
    if (isCreateDialogMode.value) {
      const result = await appApi.createBasic(toCreateBasicPayload())
      dialogVisible.value = false
      if (pendingCreateMode.value === 'blank') {
        ElMessage.success('基础信息保存成功，请绑定工作流')
        await loadApps()
        const createdRow =
          appList.value.find((item) => Number(item.id) === Number(result.id)) ||
          ({
            id: result.id,
            appName: formData.appName,
            appType: 'workflow',
            workflowId: undefined
          } as AppRow)
        void openWorkflowBind(createdRow)
        return
      }

      ElMessage.success('基础信息保存成功')
      await router.push({
        path: '/agents/orchestrator/create',
        query: {
          mode: 'template',
          edit: String(result.id),
          from: route.fullPath
        }
      })
      return
    }

    await appApi.updateBasic(Number(formData.id), toBasicPayload())
    ElMessage.success('基础信息更新成功')
    dialogVisible.value = false
    await loadApps()
  } catch (error: any) {
    ElMessage.error(error?.message || '智能体保存失败')
  } finally {
    submitting.value = false
  }
}

function handleEditFlow(row: AppRow) {
  const sourceType = resolveSourceType(row)
  if (sourceType === 'canvas') {
    router.push({
      path: '/agents/orchestrator/create',
      query: { mode: 'blank', edit: String(row.id), from: route.fullPath }
    })
    return
  }
  if (sourceType === 'template') {
    router.push({
      path: '/agents/orchestrator/create',
      query: { mode: 'template', edit: String(row.id), from: route.fullPath }
    })
    return
  }
  ElMessage.warning('该智能体缺少编排来源，无法进入流程编辑')
}

async function removeApp(row: AppRow) {
  try {
    await ElMessageBox.confirm(`确认删除智能体“${row.appName}”吗？`, '删除确认', {
      type: 'warning'
    })
    await appApi.delete(Number(row.id))
    ElMessage.success('智能体删除成功')
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
  parameterTitle.value = `${row.appName} 智能体参数`
  parameterText.value = ''
  try {
    const response = await appApi.getParameters(Number(row.id))
    parameterText.value = JSON.stringify(response ?? {}, null, 2)
  } catch (error: any) {
    parameterText.value = error?.message || '智能体参数加载失败'
  } finally {
    parameterLoading.value = false
  }
}

async function openWorkflowBind(row: AppRow) {
  workflowBindingRow.value = row
  selectedWorkflowId.value = row.workflowId ? Number(row.workflowId) : ''
  workflowBindVisible.value = true
  workflowBindLoading.value = true
  try {
    const response = await workflowApi.list({ pageNum: 1, pageSize: 200 })
    workflowOptions.value = response.records || []
  } catch (error: any) {
    ElMessage.error(error?.message || '工作流列表加载失败')
  } finally {
    workflowBindLoading.value = false
  }
}

async function removeAppFromWorkflow(workflowId: number, appId: number) {
  const bindings = await workflowApi.getBindings(workflowId)
  await workflowApi.updateBindings(workflowId, {
    appIds: bindings.map((item) => Number(item.id)).filter((id) => id !== appId)
  })
}

async function bindAppToWorkflow(workflowId: number, appId: number) {
  const bindings = await workflowApi.getBindings(workflowId)
  const appIds = new Set<number>(bindings.map((item: WorkflowBindingAppVO) => Number(item.id)))
  appIds.add(appId)
  await workflowApi.updateBindings(workflowId, { appIds: Array.from(appIds) })
}

async function submitWorkflowBind() {
  const row = workflowBindingRow.value
  if (!row) return

  const appId = Number(row.id)
  const prevWorkflowId = row.workflowId ? Number(row.workflowId) : null
  const nextWorkflowId = selectedWorkflowId.value ? Number(selectedWorkflowId.value) : null

  if (prevWorkflowId === nextWorkflowId) {
    workflowBindVisible.value = false
    return
  }

  workflowBindLoading.value = true
  try {
    if (!nextWorkflowId && prevWorkflowId) {
      await removeAppFromWorkflow(prevWorkflowId, appId)
    } else if (nextWorkflowId) {
      await bindAppToWorkflow(nextWorkflowId, appId)
    }
    ElMessage.success(nextWorkflowId ? '工作流已绑定' : '工作流已解绑')
    workflowBindVisible.value = false
    await loadApps()
  } catch (error: any) {
    ElMessage.error(error?.message || '工作流绑定失败')
  } finally {
    workflowBindLoading.value = false
  }
}

async function editBoundWorkflow(row: AppRow) {
  if (!row.workflowId) {
    ElMessage.warning('请先绑定工作流')
    return
  }
  try {
    const bindings = await workflowApi.getBindings(Number(row.workflowId))
    if (bindings.length) {
      pendingEditWorkflowId.value = Number(row.workflowId)
      pendingEditWorkflowName.value = row.workflowName || ''
      workflowEditConfirmApps.value = bindings
      workflowEditConfirmVisible.value = true
      return
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '工作流绑定信息加载失败')
    return
  }
  openWorkflowEditor(Number(row.workflowId))
}

function openWorkflowEditor(workflowId: number) {
  router.push({
    path: '/workflows/editor',
    query: { edit: String(workflowId), from: route.fullPath }
  })
}

function confirmEditBoundWorkflow() {
  if (!pendingEditWorkflowId.value) return
  openWorkflowEditor(pendingEditWorkflowId.value)
}

async function publishApp(row: AppRow) {
  if (isWorkflowRow(row) && !row.workflowId) {
    ElMessage.warning('请先绑定工作流')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认发布智能体【${row.appName}】吗？\n发布后会将当前保存流程部署为可用智能体并生效。`,
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
      ElMessage.error('智能体已被他人修改，请刷新后重试')
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
  if (command === 'chat') {
    handleCardClick(row)
    return
  }
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
  if (command === 'bindWorkflow') {
    void openWorkflowBind(row)
    return
  }
  if (command === 'editWorkflow') {
    void editBoundWorkflow(row)
    return
  }
  if (command === 'delete') {
    void removeApp(row)
  }
}

function handleCardClick(row: AppRow) {
  if (!isPublished(row)) return
  router.push(`/agents/${row.id}/chat`)
}

function handleSearch() {
  pageNum.value = 1
  void loadApps()
}

function handleAppTypeChange() {
  pageNum.value = 1
  void loadApps()
}

function handlePublishStatusChange() {
  pageNum.value = 1
  void loadApps()
}

function setAppTypeFilter(type: AppTypeFilter) {
  if (appTypeFilter.value === type) return
  appTypeFilter.value = type
  handleAppTypeChange()
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
          <div class="eyebrow">AGENTS · {{ total }}</div>
          <h1>智能体管理</h1>
          <p>创建、配置、发布和维护企业智能体，让智能体资产保持清晰可控。</p>
        </div>

        <div class="hero-metrics">
          <div class="metric-card">
            <span class="metric-label">当前页智能体</span>
            <strong>{{ appList.length }}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">已启用</span>
            <strong>{{ enabledCount }}</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">未启用</span>
            <strong>{{ disabledCount }}</strong>
          </div>
        </div>
      </div>

      <div class="content-panel">
        <div class="toolbar-row">
          <div class="filter-tabs" aria-label="智能体类型筛选">
            <button
              type="button"
              class="filter-tab"
              :class="{ active: appTypeFilter === '' }"
              @click="setAppTypeFilter('')"
            >
              <span>全部</span>
              <em>{{ total }}</em>
            </button>
            <button
              type="button"
              class="filter-tab"
              :class="{ active: appTypeFilter === 'chat' }"
              @click="setAppTypeFilter('chat')"
            >
              <span>聊天助手</span>
            </button>
            <button
              type="button"
              class="filter-tab"
              :class="{ active: appTypeFilter === 'agent' }"
              @click="setAppTypeFilter('agent')"
            >
              <span>Agent 智能体</span>
            </button>
            <button
              type="button"
              class="filter-tab"
              :class="{ active: appTypeFilter === 'workflow' }"
              @click="setAppTypeFilter('workflow')"
            >
              <span>Chatflow 对话流</span>
            </button>
          </div>

          <div class="toolbar-actions">
            <el-select
              v-model="publishStatusFilter"
              class="status-select"
              placeholder="发布状态"
              clearable
              @change="handlePublishStatusChange"
            >
              <el-option label="全部状态" value="" />
              <el-option label="已发布" value="PUBLISHED" />
              <el-option label="未发布" value="UNPUBLISHED" />
            </el-select>

            <el-input
              v-model="keyword"
              class="search-input"
              placeholder="搜索智能体名称 / 编码"
              clearable
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <el-icon class="search-prefix-icon"><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </div>

        <div v-loading="loading" class="app-grid">
          <button type="button" class="app-card create-card" @click="openCreateDialog">
            <span class="create-plus">
              <el-icon><Plus /></el-icon>
            </span>
            <span class="create-title">创建新智能体</span>
            <span class="create-subtitle">选择创建方式，快速搭建企业智能体</span>
          </button>

          <div
            v-for="row in appList"
            :key="row.id"
            class="app-card"
            :class="{
              'is-unpublished': !isPublished(row),
              'is-disabled': !normalizeEnabled(row.enabled)
            }"
          >
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
              </div>
            </div>

            <div class="card-desc">{{
              row.description || '暂无描述，可在基本信息中补充智能体用途。'
            }}</div>

            <div class="tag-row">
              <span class="status-tag" :class="`st-${getPublishStatusTagType(row.publishStatus)}`">
                {{ getPublishStatusText(row.publishStatus) }}
              </span>
              <span class="enabled-tag" :class="normalizeEnabled(row.enabled) ? 'en-on' : 'en-off'">
                {{ normalizeEnabled(row.enabled) ? '已启用' : '未启用' }}
              </span>
              <span class="type-tag" :class="getAppTypeChipClass(row.appType)">
                {{ getAppTypeLabel(row.appType) }}
              </span>
              <span
                v-if="isWorkflowRow(row)"
                class="workflow-tag"
                :class="{ empty: !row.workflowId }"
              >
                <template v-if="!row.workflowId">未绑定工作流</template>
                <template v-else>已绑定工作流</template>
              </span>
              <span class="version-tag">v{{ row.version || 0 }}</span>
            </div>

            <div class="card-footer">
              <div class="meta-time">
                <el-icon><Clock /></el-icon>
                <span>{{ formatTimeAgo(row.lastEditedAt) }}</span>
              </div>
              <el-dropdown
                class="card-action-bubble"
                trigger="click"
                @command="(command) => handleMoreCommand(command, row)"
              >
                <button type="button" class="action-bubble-btn" @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                  <span>更多</span>
                </button>

                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :disabled="!isPublished(row)" command="chat">
                      进入对话
                    </el-dropdown-item>
                    <el-dropdown-item command="flow">编辑流程</el-dropdown-item>
                    <el-dropdown-item :disabled="publishingId === Number(row.id)" command="publish">
                      {{ row.publishStatus === 'PUBLISHED' ? '重新发布' : '发布' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="basic">改基本信息</el-dropdown-item>
                    <el-dropdown-item v-if="isWorkflowRow(row)" command="bindWorkflow">
                      绑定/更换工作流
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="isWorkflowRow(row)"
                      :disabled="!row.workflowId"
                      command="editWorkflow"
                    >
                      编辑绑定工作流
                    </el-dropdown-item>
                    <el-dropdown-item command="params">参数</el-dropdown-item>
                    <el-dropdown-item command="delete">
                      <span class="danger-text">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>

        <div class="footer-bar">
          <span class="footer-count">共 {{ total }} 个智能体 · 当前页 {{ appList.length }} 个</span>
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
        <h3>选择智能体创建方式</h3>
        <p>根据当前需求选择合适的起点，后续都可以继续编辑智能体配置和编排流程。</p>
      </div>
    </template>

    <div class="create-mode-grid">
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
          <strong>聊天助手</strong>
          <small>快速构建基于 LLM 的智能对话助手。</small>
        </span>
        <span class="mode-badge">模板创建</span>
      </button>

      <button
        type="button"
        class="create-mode-card agent-mode"
        @click="onCreateCommand('placeholder')"
      >
        <span class="mode-icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 4.5l2.12 4.3 4.76.69-3.44 3.35.81 4.74L12 15.2l-4.25 2.38.81-4.74L5.12 9.49l4.76-.69L12 4.5Z"
            />
            <path d="M12 8.5v7" />
          </svg>
        </span>
        <span class="mode-content">
          <strong>Agent 智能体</strong>
          <small>支持推理规划与自主工具调用的智能助手。</small>
        </span>
        <span class="mode-badge">开发中</span>
      </button>

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
          <strong>Chatflow 对话流</strong>
          <small>支持记忆与流程编排的复杂多轮对话能力。</small>
        </span>
        <span class="mode-badge">流程编排</span>
      </button>
    </div>
  </el-dialog>

  <el-dialog
    v-model="workflowBindVisible"
    title="绑定工作流"
    width="520px"
    destroy-on-close
    align-center
  >
    <div v-loading="workflowBindLoading" class="workflow-bind-body">
      <p class="workflow-bind-hint">
        对话流智能体发布时会读取绑定工作流生成运行配置；工作流变更后需要重新发布智能体。
      </p>
      <el-select
        v-model="selectedWorkflowId"
        class="w-full"
        placeholder="请选择工作流"
        clearable
        filterable
      >
        <el-option
          v-for="workflow in workflowOptions"
          :key="workflow.id"
          :label="`${workflow.workflowName} · v${workflow.version || 0}`"
          :value="Number(workflow.id)"
        />
      </el-select>
    </div>
    <template #footer>
      <el-button @click="workflowBindVisible = false">取消</el-button>
      <el-button type="primary" :loading="workflowBindLoading" @click="submitWorkflowBind">
        保存绑定
      </el-button>
    </template>
  </el-dialog>

  <WorkflowEditConfirmDialog
    v-model="workflowEditConfirmVisible"
    :workflow-name="pendingEditWorkflowName"
    :apps="workflowEditConfirmApps"
    @confirm="confirmEditBoundWorkflow"
  />

  <!-- 优化后的“创建/修改智能体基础信息”弹框 -->
  <el-dialog
    v-model="dialogVisible"
    class="basic-info-dialog"
    :title="basicDialogTitle"
    width="780px"
    destroy-on-close
    align-center
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top">
      <!-- 第一部分：基本信息左右网格排版 -->
      <div class="basic-info-grid">
        <div class="avatar-col">
          <el-form-item label-width="0">
            <IconUploader v-model="formData.iconImage" />
          </el-form-item>
        </div>
        <div class="fields-col">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="智能体名称" prop="appName">
                <el-input v-model="formData.appName" placeholder="请输入智能体名称" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="智能体编码">
                <el-input
                  v-model="formData.appCode"
                  disabled
                  :placeholder="isCreateDialogMode ? '系统生成' : '保存后自动生成'"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="启用状态">
                <el-switch
                  v-model="formData.enabled"
                  active-text="启用"
                  inactive-text="禁用"
                  inline-prompt
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="排序权重">
                <el-input-number
                  v-model="formData.sort"
                  class="w-full"
                  :min="1"
                  controls-position="right"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </div>
      </div>

      <!-- 第二部分：描述说明 -->
      <el-form-item label="描述说明">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="2"
          placeholder="请简要描述智能体的核心用途与工作场景"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>

      <!-- 第三部分：提示词卡片（全新标签页式交互设计） -->
      <el-form-item label="提示词引导卡片" class="prompt-form-item">
        <!-- 自定义 label，在文字右侧增加问号图标- 帮助手册 -->
        <template #label>
          <div style="display: inline-flex; align-items: center; gap: 4px">
            <span>提示词引导卡片</span>
            <el-tooltip
              content="引导卡片会在用户初次进入对话欢迎页时展示，点击可直接发送配置好的提示词，帮助用户快速上手。"
              placement="top"
              effect="dark"
            >
              <el-icon style="font-size: 14px; color: var(--text-tertiary); cursor: help">
                <QuestionFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <div class="starter-prompts-container">
          <!-- 标签栏导航 -->
          <div class="prompts-tab-nav">
            <div class="tab-list">
              <button
                v-for="(_, index) in formData.starterPrompts"
                :key="`tab-${index}`"
                type="button"
                class="tab-item-btn"
                :class="{ active: activePromptIndex === index }"
                @click="activePromptIndex = index"
              >
                <span>卡片 {{ index + 1 }}</span>
                <span
                  v-if="formData.starterPrompts.length > 1"
                  class="tab-close-icon"
                  @click.stop="removeStarterPrompt(index)"
                  title="删除此卡片"
                >
                  &times;
                </span>
              </button>

              <button
                v-if="formData.starterPrompts.length < 4"
                type="button"
                class="tab-add-btn"
                @click="addStarterPrompt"
              >
                <el-icon><Plus /></el-icon>
                <span>添加</span>
              </button>
            </div>
            <div class="prompts-count-tip">最多支持 4 条引导卡片</div>
          </div>

          <!-- 当前选中卡片的内容区域 -->
          <div v-if="formData.starterPrompts[activePromptIndex]" class="prompts-tab-body">
            <el-row :gutter="16">
              <el-col :span="12">
                <div class="sub-form-item">
                  <span class="sub-label">卡片标题</span>
                  <el-input
                    v-model="formData.starterPrompts[activePromptIndex].title"
                    placeholder="如：分析财务报表"
                    maxlength="20"
                    show-word-limit
                  />
                </div>
              </el-col>
              <el-col :span="12">
                <div class="sub-form-item">
                  <span class="sub-label">展示图标</span>
                  <el-select
                    v-model="formData.starterPrompts[activePromptIndex].iconKey"
                    placeholder="选择代表性图标"
                    class="w-full"
                  >
                    <el-option
                      v-for="option in promptIconOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </div>
              </el-col>
            </el-row>

            <div class="sub-form-item mt-12">
              <span class="sub-label">功能简述</span>
              <el-input
                v-model="formData.starterPrompts[activePromptIndex].description"
                placeholder="简短描述该功能（显示于卡片第二行）"
                maxlength="40"
                show-word-limit
              />
            </div>

            <div class="sub-form-item mt-12">
              <span class="sub-label">触发提示词（点击卡片后系统代发送的真实指令）</span>
              <el-input
                v-model="formData.starterPrompts[activePromptIndex].prompt"
                type="textarea"
                :rows="3"
                placeholder="引导智能体进入该场景的 Prompt。例如：'请作为资深审计，帮我审查以下财务数据是否存在指标异常...'"
                maxlength="300"
                show-word-limit
              />
            </div>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitBasicForm">
          {{ basicDialogSubmitText }}
        </el-button>
      </div>
    </template>
  </el-dialog>

  <el-drawer v-model="parameterDrawerVisible" :title="parameterTitle" size="540px">
    <el-skeleton v-if="parameterLoading" :rows="8" animated />
    <pre v-else class="json-view">{{ parameterText }}</pre>
  </el-drawer>
</template>

<style scoped lang="less">
@keyframes fadeInPrompt {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

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
    gap: 12px;
  }

  .toolbar-actions {
    width: 100%;
    margin-left: 0 !important;
    flex-direction: row;
  }

  .status-select {
    flex: 1;
    width: auto !important;
  }

  .search-input {
    flex: 2;
    width: auto !important;
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

/* 顶部与背景融合的工作台头部 */
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

/* 内容融合式浅色面板 */
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

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.status-select {
  width: 130px;
}

.status-select :deep(.el-input__wrapper) {
  height: 40px;
  padding: 0 12px;
  background: #fff !important;
  border-radius: 12px !important;
  box-shadow: 0 0 0 1px var(--border) inset !important;
  transition: box-shadow 0.16s ease;
}

.status-select :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd8ea inset !important;
}

.status-select :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--primary) inset,
    0 0 0 4px rgb(37 99 235 / 10%) !important;
}

.search-input {
  width: min(320px, 100%);
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
  padding: 18px 18px 16px;
  overflow: hidden;
  font-family: inherit;
  cursor: default;
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

.card-footer {
  position: relative;
  display: flex;
  min-width: 0;
  padding-top: 12px;
  padding-right: 80px;
  margin-top: auto;
  font-size: 12px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-soft);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.app-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 1px;
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

.app-card.is-disabled {
  opacity: 0.95;
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

.card-top {
  display: flex;
  min-width: 0;
  padding-right: 12px;
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
  line-clamp: 2;
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
.enabled-tag,
.type-tag,
.workflow-tag,
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

.enabled-tag {
  color: #166534;
  background: #ecfdf3;
}

.enabled-tag.en-off {
  color: #b45309;
  background: #fff7ed;
}

.type-tag {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: #475569;
  background: #f1f5f9;
}

.type-chat {
  color: #0f766e;
  background: #ecfdf5;
}

.type-agent {
  color: #b45309;
  background: #fff7ed;
}

.type-workflow {
  color: #2563eb;
  background: #eff6ff;
}

.type-unknown {
  color: #475569;
  background: #f1f5f9;
}

.workflow-tag {
  max-width: 138px;
  color: #0f766e;
  background: #ecfdf5;
}

.workflow-tag.empty {
  color: #b91c1c;
  background: #fff1f2;
}

.version-tag {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  background: #f8fafc;
  border: 1px solid var(--border-soft);
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

.card-action-bubble {
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 3;
  opacity: 0;
  transform: translateY(-50%) translateY(0);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.app-card:hover .card-action-bubble {
  opacity: 1;
  transform: translateY(-30%) translateY(0);
}

.action-bubble-btn {
  display: inline-flex;
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 2%);
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.action-bubble-btn:hover {
  color: var(--text-primary);
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: none;
}

.action-bubble-btn:active {
  transform: translateY(0);
}

.action-bubble-btn :deep(.el-icon) {
  font-size: 13px;
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

.workflow-bind-body {
  min-height: 120px;
}

.workflow-bind-hint {
  margin: 0 0 14px;
  line-height: 1.7;
  color: #64748b;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.create-mode-card {
  position: relative;
  display: flex;
  min-height: 200px;
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

.agent-mode .mode-icon {
  color: #b45309;
  background: #fff7ed;
  border-color: #fde3bf;
}

.agent-mode .mode-badge {
  color: #b45309;
  background: #fff7ed;
}

.blank-mode .mode-icon {
  color: #2563eb;
  background: var(--primary-soft);
  border-color: #d8e3f5;
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

.blank-mode .mode-badge {
  color: #2563eb;
  background: var(--primary-soft);
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

/* ==========================================
   🎯 【新增 & 重构】创建智能体基础信息弹窗样式
   ========================================== */

/* 1. 精细化控制弹窗高度，确保不撑开最外层视口产生滚动条 */
:deep(.basic-info-dialog) {
  display: flex !important;
  max-height: 85vh; /* 保证在所有高度的屏幕下都不超出视口 */
  overflow: hidden;
  background: linear-gradient(180deg, #fcfdff 0%, #fff 100%);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgb(15 23 42 / 12%);
  flex-direction: column;

  .el-dialog__header {
    padding: 20px 24px;
    margin-right: 0;
    border-bottom: 1px solid var(--border-soft);
  }

  /* 表单主体成为独立的局部滚动区 */
  .el-dialog__body {
    padding: 24px;
    overflow-y: auto;
    background: #fafbfe;
    flex: 1;
  }

  .el-dialog__footer {
    padding: 16px 24px;
    background: #fff;
    border-top: 1px solid var(--border-soft);
  }
}

/* 2. 基本信息的两栏栅格排版 */
.basic-info-grid {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  align-items: flex-start;

  .avatar-col {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;

    .el-form-item {
      margin-bottom: 0;
    }

    .avatar-tip {
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-tertiary);
      text-align: center;
    }
  }

  .fields-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;

    .el-form-item {
      margin-bottom: 0;
    }
  }
}

/* Element Plus 表单项的现代扁平化微调 */
:deep(.el-form-item__label) {
  padding-bottom: 6px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
}

/* 3. 提示词卡片 (Tabs式优雅容器) */
.starter-prompts-container {
  overflow: hidden;
  background: #fff;
  border: 1px solid #dbe3f1;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgb(37 99 235 / 2%);
}

/* 标签导航栏 */
.prompts-tab-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f1f5fa;
  border-bottom: 1px solid #dbe3f1;

  .tab-list {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .prompts-count-tip {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-tertiary);
  }
}

/* 标签页按钮样式 */
.tab-item-btn {
  display: inline-flex;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  background: rgb(255 255 255 / 60%);
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  transition: all 0.15s ease;
  align-items: center;
  gap: 6px;

  &:hover {
    color: var(--primary);
    background: #fff;
    border-color: #cbd5e1;
  }

  &.active {
    color: var(--primary);
    background: #fff;
    border-color: var(--primary);
    box-shadow: 0 2px 6px rgb(37 99 235 / 8%);
  }

  .tab-close-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 13px;
    line-height: 1;
    color: var(--text-tertiary);
    border-radius: 999px;
    transition: all 0.12s ease;

    &:hover {
      color: #fff;
      background: var(--danger);
    }
  }
}

/* 添加卡片按钮 */
.tab-add-btn {
  display: inline-flex;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  background: transparent;
  border: 1px dashed var(--primary);
  border-radius: 6px;
  transition: all 0.15s ease;
  align-items: center;
  gap: 4px;

  &:hover {
    background: var(--primary-soft);
    border-style: solid;
  }
}

/* 标签内容展示区 */
.prompts-tab-body {
  padding: 16px;
  background: #fff;
  animation: fadeInPrompt 0.22s ease-out;

  .sub-form-item {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .sub-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }
  }
}

.mt-12 {
  margin-top: 12px;
}
</style>
