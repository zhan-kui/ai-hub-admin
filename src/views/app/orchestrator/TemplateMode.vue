<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { Collection, Cpu, DocumentAdd, Refresh, ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { ContentWrap } from '@/components/ContentWrap'
import { orchestrationApi } from '@/api/frontend-api'
import { knowledgeApi, knowledgeModelApi } from '@/api/knowledge'
import type { DatasetVO, ModelOption as KnowledgeModelOption } from '@/api/knowledge/types'
import type { PromptTemplate } from '@/api/promptTemplate'
import ImportPromptDialog from '@/views/PromptTemplate/components/ImportPromptDialog.vue'
import AppMetaForm from './components/AppMetaForm.vue'
import FlowCanvas from './components/FlowCanvas.vue'
import NodeConfigDrawer from './components/NodeConfigDrawer.vue'
import TemplatePicker from './components/TemplatePicker.vue'
import { DEFAULT_ICON, DEFAULT_ICON_BG, MODEL_OPTIONS } from './constants'
import type { AppMeta, TemplateMeta, TemplateNodeConfig, TemplatePayloadWithVersion } from './types'

const router = useRouter()
const route = useRoute()
const props = defineProps<{
  editId?: number
}>()

const templates = ref<TemplateMeta[]>([])
const selectedTemplateCode = ref('')
const nodeConfigs = ref<Record<string, Record<string, any>>>({})
const pageLoading = ref(false)

const drawerVisible = ref(false)
const drawerNodeId = ref('')

const saving = ref(false)
const version = ref<number | undefined>(undefined)
const readonlyTemplateText = ref('')
const syncingTemplateConfig = ref(false)
const templateSelectionLocked = ref(false)
const importPromptVisible = ref(false)
const datasetLoading = ref(false)
const modelLoading = ref(false)
const datasets = ref<DatasetVO[]>([])
const llmModels = ref<KnowledgeModelOption[]>([])

const selectedTemplate = computed<TemplateMeta | undefined>(() =>
  templates.value.find((item) => item.code === selectedTemplateCode.value)
)
const isEditMode = computed(() => Number.isFinite(props.editId))
const isSimpleChatTemplate = computed(() => selectedTemplateCode.value === 'simple_chat')
const showTemplatePicker = computed(
  () => (!isEditMode.value || !templateSelectionLocked.value) && !isSimpleChatTemplate.value
)
const metaStepTitle = computed(() => (showTemplatePicker.value ? '智能体信息' : '智能体信息'))
const flowStepTitle = computed(() => (showTemplatePicker.value ? '流程参数' : '流程参数'))
const pageTitle = computed(() =>
  isSimpleChatTemplate.value
    ? isEditMode.value
      ? '编辑聊天助手'
      : '创建聊天助手'
    : isEditMode.value
      ? '编辑模板编排'
      : '从模板创建智能体'
)
const pageMessage = computed(() =>
  isSimpleChatTemplate.value
    ? '配置提示词、知识库与模型，保存后即可在智能体管理中发布。'
    : isEditMode.value
      ? '编辑已保存的模板流程，首次无草稿时可先选择模板再保存。'
      : '选择模板，填写参数后保存前端草稿。'
)
const llmOptions = computed(() => {
  const options = llmModels.value.map((item) => ({
    label: item.name || item.model,
    value: toModelKey(item.provider, item.model),
    provider: item.provider,
    model: item.model
  }))
  const selectedValue = selectedModelKey.value
  if (selectedValue && !options.some((item) => item.value === selectedValue)) {
    const config = getLlmConfig()
    options.unshift({
      label: String(config['model.name'] || '当前模型'),
      value: selectedValue,
      provider: String(config['model.provider'] || ''),
      model: String(config['model.name'] || '')
    })
  }
  return options
})
const selectedModelKey = computed({
  get: () => {
    const config = getLlmConfig()
    const provider = String(config['model.provider'] || '')
    const model = String(config['model.name'] || '')
    if (!model) return ''
    if (provider) return toModelKey(provider, model)
    const matched = llmModels.value.find((item) => item.model === model || item.name === model)
    return matched ? toModelKey(matched.provider, matched.model) : toModelKey('', model)
  },
  set: (value: string) => {
    const matched = llmOptions.value.find((item) => item.value === value)
    if (!matched) return
    patchLlmConfig({
      'model.provider': matched.provider,
      'model.name': matched.model
    })
  }
})
const systemPrompt = computed({
  get: () => String(getLlmConfig().systemPrompt || ''),
  set: (value: string) => patchLlmConfig({ systemPrompt: value })
})
const selectedDatasetIds = computed({
  get: () => normalizeStringArray(getLlmConfig()['knowledge.datasetIds']),
  set: (value: string[]) => patchLlmConfig({ 'knowledge.datasetIds': normalizeStringArray(value) })
})
const selectedDatasets = computed(() => {
  const datasetMap = new Map(datasets.value.map((item) => [String(item.id), item]))
  return selectedDatasetIds.value
    .map((id) => datasetMap.get(String(id)))
    .filter((item): item is DatasetVO => Boolean(item))
})
const selectedDatasetText = computed(() => {
  const count = selectedDatasetIds.value.length
  return count ? `已选择 ${count} 个知识库` : '未选择知识库'
})
const modelText = computed(() => {
  const matched = llmOptions.value.find((item) => item.value === selectedModelKey.value)
  return matched?.label || String(getLlmConfig()['model.name'] || '未选择模型')
})

const drawerNode = computed(() =>
  selectedTemplate.value?.nodes.find((node) => node.id === drawerNodeId.value)
)

const appMeta = ref<AppMeta>({
  name: '',
  description: '',
  icon: DEFAULT_ICON,
  iconBackground: DEFAULT_ICON_BG,
  iconImage: ''
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function isEmptyRequiredValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  return false
}

async function loadTemplates() {
  try {
    templates.value = await orchestrationApi.listTemplates()
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '模板列表加载失败'))
  }
}

function applyAppMeta(nextMeta: any) {
  appMeta.value = {
    name: String(nextMeta?.name || ''),
    description: String(nextMeta?.description || ''),
    icon: String(nextMeta?.icon || DEFAULT_ICON),
    iconBackground: String(nextMeta?.iconBackground || DEFAULT_ICON_BG),
    iconImage: String(nextMeta?.iconImage || '')
  }
}

function resolveReturnPath(): string | null {
  const rawFrom = route.query.from
  const from = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom
  if (typeof from !== 'string') return null
  const trimmed = from.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('/agents/orchestrator/create')) return null
  return trimmed
}

function navigateBack() {
  const returnPath = resolveReturnPath()
  if (returnPath) {
    void router.push(returnPath)
    return
  }
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/dashboard/home')
}

function handleBack() {
  navigateBack()
}

function handleNodeClick(nodeId: string) {
  drawerNodeId.value = nodeId
  drawerVisible.value = true
}

function handleDrawerVisibleChange(value: boolean) {
  drawerVisible.value = value
  if (!value) {
    drawerNodeId.value = ''
  }
}

function handleConfigUpdate(nextConfig: Record<string, any>) {
  if (!drawerNodeId.value) return
  nodeConfigs.value = {
    ...nodeConfigs.value,
    [drawerNodeId.value]: nextConfig
  }
}

function buildNodeConfigs(
  template: TemplateMeta,
  currentNodes: Array<{ id: string; config?: Record<string, any> }> = []
) {
  const existingConfigMap = new Map<string, Record<string, any>>()
  for (const item of currentNodes) {
    if (!item?.id) continue
    existingConfigMap.set(item.id, item.config || {})
  }

  const nextConfigMap: Record<string, Record<string, any>> = {}
  for (const node of template.nodes) {
    if (!node.editable || !node.fields) continue

    const nodeConfig: Record<string, any> = {}
    for (const field of node.fields) {
      if (field.default !== undefined) {
        nodeConfig[field.key] = field.default
      }
    }
    Object.assign(nodeConfig, existingConfigMap.get(node.id) || {})
    nextConfigMap[node.id] = nodeConfig
  }
  nodeConfigs.value = nextConfigMap
  if (template.code === 'simple_chat') {
    ensureSimpleChatConfig()
    void Promise.all([loadDatasets(), loadLlmModels()])
  }
}

function toModelKey(provider: string, model: string) {
  if (!model) return ''
  return `${provider || ''}::${model}`
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item) => item !== undefined && item !== null)
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  )
}

function getLlmConfig(): Record<string, any> {
  if (!nodeConfigs.value.llm) {
    nodeConfigs.value = {
      ...nodeConfigs.value,
      llm: {}
    }
  }
  return nodeConfigs.value.llm
}

function patchLlmConfig(partial: Record<string, any>) {
  nodeConfigs.value = {
    ...nodeConfigs.value,
    llm: {
      ...getLlmConfig(),
      ...partial
    }
  }
}

function ensureSimpleChatConfig() {
  const config = getLlmConfig()
  const next: Record<string, any> = {
    systemPrompt:
      config.systemPrompt ||
      '你是一位聊天助手，根据用户问题和知识库内容回答。回答要准确、友好，无法从已知内容判断时请坦诚说明。',
    'model.name': config['model.name'] || 'qwen3.7-max',
    'model.provider': config['model.provider'] || 'langgenius/tongyi/tongyi',
    'model.temperature': config['model.temperature'] ?? 0.7,
    'model.enableThinking': config['model.enableThinking'] ?? false,
    'model.reasoningEffort': config['model.reasoningEffort'] || 'medium',
    'knowledge.datasetIds': normalizeStringArray(config['knowledge.datasetIds']),
    'knowledge.topK': config['knowledge.topK'] ?? 4,
    'knowledge.rerankingEnable': config['knowledge.rerankingEnable'] ?? true,
    'knowledge.rerankingMode': config['knowledge.rerankingMode'] || 'reranking_model',
    'knowledge.rerankingModelName': config['knowledge.rerankingModelName'] || 'qwen3-rerank',
    'knowledge.rerankingProviderName':
      config['knowledge.rerankingProviderName'] || 'langgenius/tongyi/tongyi'
  }
  patchLlmConfig(next)
}

function buildDatasetRefs(datasetIds: string[]) {
  return datasetIds.map((id) => ({
    dataset: {
      enabled: true,
      id
    }
  }))
}

function applySimpleChatConfig(config: Record<string, any>) {
  const datasetIds = normalizeStringArray(config['knowledge.datasetIds'])
  return {
    ...config,
    'knowledge.datasetIds': datasetIds,
    'knowledge.datasets': buildDatasetRefs(datasetIds),
    'knowledge.topK': config['knowledge.topK'] ?? 4,
    'knowledge.rerankingEnable': config['knowledge.rerankingEnable'] ?? true,
    'knowledge.rerankingMode': config['knowledge.rerankingMode'] || 'reranking_model',
    'knowledge.rerankingModelName': config['knowledge.rerankingModelName'] || 'qwen3-rerank',
    'knowledge.rerankingProviderName':
      config['knowledge.rerankingProviderName'] || 'langgenius/tongyi/tongyi',
    'model.provider': config['model.provider'] || 'langgenius/tongyi/tongyi',
    'model.name': config['model.name'] || 'qwen3.7-max',
    'model.temperature': config['model.temperature'] ?? 0.7,
    'model.enableThinking': config['model.enableThinking'] ?? false,
    'model.reasoningEffort': config['model.reasoningEffort'] || 'medium'
  }
}

function datasetMeta(dataset: DatasetVO): string {
  const documents = Number(dataset.documentCount || dataset.totalDocuments || 0)
  const visibility = dataset.visibilityName || visibilityText(dataset.visibility)
  return `${documents} 个文档 · ${visibility}`
}

function visibilityText(value?: string): string {
  if (value === 'private') return '私有'
  if (value === 'team') return '团队'
  if (value === 'dept') return '部门'
  if (value === 'public') return '公开'
  if (value === 'custom') return '自定义'
  return '默认'
}

function removeDataset(id: string) {
  selectedDatasetIds.value = selectedDatasetIds.value.filter((item) => item !== String(id))
}

async function loadDatasets() {
  if (datasetLoading.value || datasets.value.length) return
  datasetLoading.value = true
  try {
    const all: DatasetVO[] = []
    let page = 1
    const limit = 100
    let hasMore = true
    while (hasMore && page <= 20) {
      const response = await knowledgeApi.list({
        page,
        limit,
        status: 'active'
      })
      const records = response.records || []
      all.push(...records)
      hasMore = all.length < Number(response.total || 0) && records.length > 0
      page += 1
    }
    datasets.value = all
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库列表加载失败')
  } finally {
    datasetLoading.value = false
  }
}

async function loadLlmModels() {
  if (modelLoading.value || llmModels.value.length) return
  modelLoading.value = true
  try {
    const models = await knowledgeModelApi.getAvailableModels('llm')
    llmModels.value = models || []
    const config = getLlmConfig()
    const currentModel = String(config['model.name'] || '')
    const currentProvider = String(config['model.provider'] || '')
    const matched =
      llmModels.value.find(
        (item) =>
          item.model === currentModel && (!currentProvider || item.provider === currentProvider)
      ) || llmModels.value[0]
    if (matched && (!currentModel || !currentProvider)) {
      patchLlmConfig({
        'model.provider': matched.provider,
        'model.name': matched.model
      })
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '模型列表加载失败')
  } finally {
    modelLoading.value = false
  }
}

async function handleImportPrompt(template: PromptTemplate) {
  const currentPrompt = systemPrompt.value.trim()
  if (!currentPrompt) {
    systemPrompt.value = template.content
  } else {
    try {
      await ElMessageBox.confirm('系统提示词已有内容，请选择替换或追加。', '引入提示词', {
        confirmButtonText: '替换',
        cancelButtonText: '追加',
        distinguishCancelAndClose: true,
        type: 'warning'
      })
      systemPrompt.value = template.content
    } catch (action) {
      if (action !== 'cancel') return
      systemPrompt.value = `${systemPrompt.value}\n\n${template.content}`
    }
  }
  ElMessage.success('已引入系统提示词')
}

watch(selectedTemplateCode, (code) => {
  if (syncingTemplateConfig.value) return
  if (isEditMode.value && templateSelectionLocked.value) return
  const template = templates.value.find((item) => item.code === code)
  if (!template) return
  buildNodeConfigs(template)
  drawerVisible.value = false
  drawerNodeId.value = ''
})

function buildPayload(): TemplatePayloadWithVersion | null {
  if (!selectedTemplate.value) {
    ElMessage.warning('请先选择模板')
    return null
  }

  if (isEmptyRequiredValue(appMeta.value.name)) {
    ElMessage.warning('请填写智能体名称')
    return null
  }

  if (!isSimpleChatTemplate.value && isEmptyRequiredValue(appMeta.value.description)) {
    ElMessage.warning('请填写描述')
    return null
  }

  if (!isSimpleChatTemplate.value && isEmptyRequiredValue(appMeta.value.icon)) {
    ElMessage.warning('请填写图标')
    return null
  }

  for (const node of selectedTemplate.value.nodes) {
    if (!node.editable || !node.fields?.length) continue

    const nodeConfig = nodeConfigs.value[node.id] || {}
    for (const field of node.fields) {
      if (!field.required) continue
      if (isEmptyRequiredValue(nodeConfig[field.key])) {
        ElMessage.warning(`“${node.title}” 节点的 “${field.label}” 未填写`)
        return null
      }
    }
  }

  const nodes: TemplateNodeConfig[] = selectedTemplate.value.nodes
    .filter((node) => node.editable)
    .map((node) => {
      let config = { ...(nodeConfigs.value[node.id] || {}) }
      if (isSimpleChatTemplate.value && node.id === 'llm') {
        config = applySimpleChatConfig(config)
      }
      if (!isSimpleChatTemplate.value && config['model.name']) {
        const matchedModel = MODEL_OPTIONS.find((item) => item.value === config['model.name'])
        if (matchedModel) {
          config['model.provider'] = matchedModel.provider
        }
      }
      return {
        id: node.id,
        type: node.type,
        config
      }
    })

  return {
    templateCode: selectedTemplate.value.code,
    appMeta: {
      name: String(appMeta.value.name || '').trim(),
      description: String(appMeta.value.description || '').trim(),
      icon: isSimpleChatTemplate.value ? '' : String(appMeta.value.icon || DEFAULT_ICON).trim(),
      iconBackground: appMeta.value.iconBackground || DEFAULT_ICON_BG,
      iconImage: appMeta.value.iconImage || ''
    },
    nodes,
    version: version.value
  }
}

function updateVersionFromResponse(response: any) {
  const nextVersion = Number(response?.version)
  if (Number.isFinite(nextVersion)) {
    version.value = nextVersion
  }
}

async function handleSave() {
  const payload = buildPayload()
  if (!payload) return

  saving.value = true
  try {
    const result =
      isEditMode.value && props.editId
        ? await orchestrationApi.updateTemplateDraft(props.editId, payload)
        : await orchestrationApi.saveTemplateDraft(payload)
    updateVersionFromResponse(result)
    if (selectedTemplate.value) {
      templateSelectionLocked.value = true
      readonlyTemplateText.value = `基于模板：${selectedTemplate.value.name || selectedTemplate.value.code}（编辑模式下不可更换模板）`
    }
    const savedId = Number(result?.id)
    if (!isEditMode.value && Number.isFinite(savedId) && savedId > 0) {
      const returnPath = resolveReturnPath()
      await router.replace({
        path: '/agents/orchestrator/create',
        query: {
          mode: 'template',
          edit: String(savedId),
          ...(returnPath ? { from: returnPath } : {})
        }
      })
    }
    ElMessage.success('保存成功')
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

async function ensureTemplateExists(templateCode: string): Promise<TemplateMeta | undefined> {
  const existing = templates.value.find((item) => item.code === templateCode)
  if (existing) return existing
  try {
    const detail = await orchestrationApi.getTemplate(templateCode)
    templates.value = [...templates.value, detail]
    return detail
  } catch {
    return undefined
  }
}

async function loadEditConfig(id: number) {
  try {
    const config = (await orchestrationApi.getTemplateDraft(id)) as any
    const templateCode = String(config?.templateCode || '')

    applyAppMeta(config?.appMeta)
    version.value = Number.isFinite(Number(config?.version)) ? Number(config.version) : undefined

    if (!templateCode) {
      syncingTemplateConfig.value = true
      selectedTemplateCode.value = 'simple_chat'
      const template = await ensureTemplateExists('simple_chat')
      if (template) {
        buildNodeConfigs(template)
      } else {
        nodeConfigs.value = {}
      }
      syncingTemplateConfig.value = false
      templateSelectionLocked.value = false
      readonlyTemplateText.value = '基于模板：聊天助手'
      return
    }

    const template = await ensureTemplateExists(templateCode)
    if (!template) {
      ElMessage.error('模板不存在或已下线，无法进入编辑')
      navigateBack()
      return
    }

    syncingTemplateConfig.value = true
    selectedTemplateCode.value = templateCode
    buildNodeConfigs(template, Array.isArray(config?.nodes) ? config.nodes : [])
    syncingTemplateConfig.value = false
    templateSelectionLocked.value = true
    readonlyTemplateText.value = `基于模板：${template.name || template.code}（编辑模式下不可更换模板）`
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '模板编排加载失败'))
    navigateBack()
  }
}

onMounted(async () => {
  pageLoading.value = true
  try {
    await loadTemplates()
    if (isEditMode.value && props.editId) {
      await loadEditConfig(props.editId)
    } else {
      const queryTemplate = Array.isArray(route.query.template)
        ? route.query.template[0]
        : route.query.template
      const preferredCode =
        typeof queryTemplate === 'string' && queryTemplate.trim()
          ? queryTemplate.trim()
          : templates.value.some((item) => item.code === 'simple_chat')
            ? 'simple_chat'
            : templates.value[0]?.code || ''
      if (preferredCode) {
        selectedTemplateCode.value = preferredCode
        const template = templates.value.find((item) => item.code === preferredCode)
        if (template) {
          buildNodeConfigs(template)
          if (template.code === 'simple_chat') {
            applyAppMeta({
              name: '聊天助手',
              description: template.description || '基于知识库和大模型的聊天助手',
              icon: template.icon || DEFAULT_ICON,
              iconBackground: template.iconBackground || DEFAULT_ICON_BG
            })
          }
        }
      }
    }
  } finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <ContentWrap v-loading="pageLoading">
    <!-- 统一重构后的顶部控制栏 -->
    <div class="orchestrator-header">
      <div class="header-left">
        <el-button class="back-circle-btn" @click="handleBack">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <div class="header-title-wrapper">
          <h1 class="page-title">{{ pageTitle }}</h1>
          <p class="page-subtitle">{{ pageMessage }}</p>
        </div>
      </div>
      <div class="header-right">
        <span v-if="isEditMode && readonlyTemplateText" class="readonly-badge">
          {{ readonlyTemplateText }}
        </span>
        <div class="header-actions">
          <el-button plain @click="handleBack">取消</el-button>
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!selectedTemplate"
            @click="handleSave"
          >
            保存草稿
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主工作区容器 -->
    <div class="orchestrator-container">
      <!-- 1. 模板选择区 -->
      <div v-if="showTemplatePicker" class="form-section-card">
        <div class="step-badge-title">
          <span class="step-num">01</span>
          <div class="step-info">
            <h3>选择基础模板</h3>
            <p>选择一个预置流程模板作为构建起点</p>
          </div>
        </div>
        <div class="section-content">
          <TemplatePicker v-model="selectedTemplateCode" :templates="templates" />
        </div>
      </div>

      <!-- 2. 简易聊天助手模式 -->
      <template v-if="selectedTemplate && isSimpleChatTemplate">
        <div class="assistant-workspace">
          <!-- 左栏：核心配置 -->
          <div class="assistant-core">
            <!-- 系统提示词配置 -->
            <section class="config-section-card">
              <div class="card-header-mix">
                <div class="header-main">
                  <span class="icon-box"><DocumentAdd /></span>
                  <div>
                    <h3>系统提示词（System Prompt）</h3>
                    <p>设定智能体的角色定位、回复风格与边界约束</p>
                  </div>
                </div>
                <button type="button" class="import-prompt-btn" @click="importPromptVisible = true">
                  <span class="import-icon"><Icon icon="tabler:sparkles" /></span>
                  <span>
                    <strong>引入提示词</strong>
                    <em>模板库</em>
                  </span>
                </button>
              </div>
              <div class="card-content-area">
                <el-input
                  v-model="systemPrompt"
                  type="textarea"
                  :rows="12"
                  maxlength="4000"
                  show-word-limit
                  placeholder="例如：你是一位专业且耐心的客服助手，请优先结合给定的知识库内容，准确解答用户问题。若知识库未提及，请礼貌说明..."
                />
              </div>
            </section>

            <!-- 关联知识库配置 -->
            <section class="config-section-card">
              <div class="card-header-mix">
                <div class="header-main">
                  <span class="icon-box info-theme"><Collection /></span>
                  <div>
                    <h3>关联知识库</h3>
                    <p>{{ selectedDatasetText }}</p>
                  </div>
                </div>
                <el-button
                  class="refresh-plain-btn"
                  plain
                  :loading="datasetLoading"
                  @click="loadDatasets"
                >
                  <el-icon><Refresh /></el-icon>
                  刷新列表
                </el-button>
              </div>
              <div class="card-content-area">
                <el-select
                  v-model="selectedDatasetIds"
                  class="full-width-select"
                  multiple
                  filterable
                  clearable
                  collapse-tags
                  collapse-tags-tooltip
                  :max-collapse-tags="3"
                  :loading="datasetLoading"
                  placeholder="可多选关联知识库，为智能体提供本地专业知识支持"
                >
                  <el-option
                    v-for="dataset in datasets"
                    :key="dataset.id"
                    :label="dataset.name"
                    :value="dataset.id"
                  >
                    <div class="dataset-dropdown-row">
                      <strong class="ds-name">{{ dataset.name }}</strong>
                      <span class="ds-meta">{{ datasetMeta(dataset) }}</span>
                    </div>
                  </el-option>
                </el-select>

                <div v-if="selectedDatasets.length" class="selected-datasets-grid">
                  <div
                    v-for="dataset in selectedDatasets"
                    :key="dataset.id"
                    class="dataset-glass-chip"
                  >
                    <div class="chip-info">
                      <span class="chip-title">{{ dataset.name }}</span>
                      <small class="chip-desc">{{ datasetMeta(dataset) }}</small>
                    </div>
                    <el-button
                      class="chip-remove"
                      link
                      type="danger"
                      @click="removeDataset(dataset.id)"
                      >移除</el-button
                    >
                  </div>
                </div>
                <div v-else class="empty-dataset-placeholder">
                  <el-empty
                    :image-size="64"
                    description="尚未关联任何知识库，助手将仅依靠大模型自身知识回答"
                  />
                </div>
              </div>
            </section>
          </div>

          <!-- 右栏：侧边参数设置与静态面板 -->
          <aside class="assistant-side-panel">
            <!-- 模型选择 -->
            <section class="side-config-card">
              <div class="side-card-title">
                <span class="side-icon"><Cpu /></span>
                <div>
                  <h4>大语言模型</h4>
                  <p>{{ modelText }}</p>
                </div>
              </div>
              <div class="side-card-content">
                <el-select
                  v-model="selectedModelKey"
                  class="full-width-select"
                  filterable
                  :loading="modelLoading"
                  placeholder="选择推理模型"
                >
                  <el-option
                    v-for="item in llmOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
            </section>

            <!-- 配置快照概览 -->
            <section class="side-config-card summary-card">
              <div class="summary-head">配置概览</div>
              <div class="summary-body">
                <div class="summary-row-item">
                  <span class="row-label">提示词状态</span>
                  <span class="row-val" :class="{ 'val-active': systemPrompt.trim() }">
                    {{ systemPrompt.trim() ? '已配置' : '未配置' }}
                  </span>
                </div>
                <div class="summary-row-item">
                  <span class="row-label">关联知识库</span>
                  <span class="row-val">{{ selectedDatasetIds.length }} 个</span>
                </div>
                <div class="summary-row-item">
                  <span class="row-label">推理模型</span>
                  <span class="row-val text-ellipsis">{{ modelText }}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </template>

      <!-- 3. 高级工作流模板模式 -->
      <template v-else-if="selectedTemplate">
        <!-- 填写智能体元数据 -->
        <div class="form-section-card">
          <div class="step-badge-title">
            <span class="step-num">02</span>
            <div class="step-info">
              <h3>{{ metaStepTitle }}</h3>
              <p>定义智能体的名字、图标以及简要描述</p>
            </div>
          </div>
          <div class="section-content">
            <AppMetaForm v-model="appMeta" />
          </div>
        </div>

        <!-- 流程参数画布 -->
        <div class="form-section-card">
          <div class="step-badge-title">
            <span class="step-num">03</span>
            <div class="step-info">
              <h3
                >{{ flowStepTitle }}
                <small class="title-tip">（点击各节点可编辑参数属性）</small></h3
              >
              <p>可视化编排底层调用逻辑和节点交互关系</p>
            </div>
          </div>
          <div class="section-content canvas-section">
            <FlowCanvas
              :nodes="selectedTemplate.nodes"
              :edges="selectedTemplate.edges"
              :selected-node-id="drawerVisible ? drawerNodeId : ''"
              @node-click="handleNodeClick"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- 高级模式底部粘性操作栏 -->
    <div v-if="!isSimpleChatTemplate" class="bottom-action-sticky">
      <el-button plain size="large" @click="handleBack">取消</el-button>
      <el-button
        type="primary"
        size="large"
        :loading="saving"
        :disabled="!selectedTemplate"
        @click="handleSave"
      >
        保存智能体流程
      </el-button>
    </div>

    <!-- 侧边弹窗 & Dialog 保持不变 -->
    <NodeConfigDrawer
      v-if="drawerNode"
      :model-value="drawerVisible"
      :node-title="drawerNode.title"
      :fields="drawerNode.fields || []"
      :config="nodeConfigs[drawerNodeId] || {}"
      @update:model-value="handleDrawerVisibleChange"
      @update:config="handleConfigUpdate"
    />
    <ImportPromptDialog v-model="importPromptVisible" @selected="handleImportPrompt" />
  </ContentWrap>
</template>

<style scoped lang="less">


/* 响应式适配 */
@media (width <= 1120px) {
  .assistant-workspace {
    grid-template-columns: 1fr;
  }

  .assistant-side-panel {
    position: static;
  }
}

@media (width <= 768px) {
  .orchestrator-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .header-right {
      width: 100%;
      justify-content: space-between;
    }
  }

  .card-header-mix {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

:deep(.content-wrap) {
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* 统一顶部控制栏样式 */
.orchestrator-header {
  display: flex;
  padding: 16px 24px;
  margin-bottom: 20px;
  background: #fff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 2%);
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .back-circle-btn {
      display: flex;
      width: 40px;
      height: 40px;
      color: #64748b;
      cursor: pointer;
      border: 1px solid #e2e8f0;
      border-radius: 50%;
      transition: all 0.2s ease;
      align-items: center;
      justify-content: center;

      &:hover {
        color: #0f172a;
        background-color: #f8fafc;
        border-color: #cbd5e1;
        transform: translateX(-2px);
      }
    }

    .header-title-wrapper {
      .page-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        line-height: 1.4;
        color: #1e293b;
      }

      .page-subtitle {
        margin: 4px 0 0;
        font-size: 13px;
        color: #64748b;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .readonly-badge {
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 500;
      color: #d97706;
      background-color: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 6px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
    }
  }
}

/* 主工作区外容器 */
.orchestrator-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: calc(100vh - 240px); /* 保持合理的垂直拉伸，避免底部尴尬留白 */
}

/* 模块化卡片定义 */
.form-section-card {
  padding: 24px;
  background: #fff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  box-shadow: 0 4px 18px rgb(0 0 0 / 1.5%);

  .section-content {
    margin-top: 18px;

    &.canvas-section {
      overflow: hidden;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
    }
  }
}

/* 编号步骤标题 */
.step-badge-title {
  display: flex;
  align-items: flex-start;
  gap: 14px;

  .step-num {
    display: flex;
    width: 28px;
    height: 28px;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    border-radius: 8px;
    box-shadow: 0 4px 10px rgb(37 99 235 / 20%);
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-info {
    h3 {
      display: flex;
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      align-items: center;
      gap: 8px;

      .title-tip {
        font-size: 12px;
        font-weight: 400;
        color: #94a3b8;
      }
    }

    p {
      margin: 3px 0 0;
      font-size: 12px;
      color: #64748b;
    }
  }
}

/* 聊天助手：双栏布局 */
.assistant-workspace {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
  align-items: start;
}

.assistant-core {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 配置卡片混合头 */
.config-section-card {
  overflow: hidden;
  background: #fff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 2%);

  .card-header-mix {
    display: flex;
    padding: 18px 24px;
    background: linear-gradient(180deg, #fdfdfd, #fcfcfc);
    border-bottom: 1px solid #f1f5f9;
    justify-content: space-between;
    align-items: center;

    .header-main {
      display: flex;
      align-items: center;
      gap: 14px;

      .icon-box {
        display: flex;
        width: 42px;
        height: 42px;
        color: #166534;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 10px;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.info-theme {
          color: #0369a1;
          background: #f0f9ff;
          border-color: #bae6fd;
        }

        svg {
          width: 20px;
          height: 20px;
        }
      }

      h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #0f172a;
      }

      p {
        margin: 3px 0 0;
        font-size: 12px;
        color: #64748b;
      }
    }
  }

  .card-content-area {
    padding: 20px 24px;

    :deep(.el-textarea__inner) {
      padding: 12px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.6;
      background-color: #fafafa;
      border-color: #e2e8f0;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:focus {
        background-color: #fff;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgb(59 130 246 / 10%);
      }
    }
  }
}

/* 引入提示词按钮：与 Chatflow LLM 节点保持一致 */
.import-prompt-btn {
  display: inline-flex;
  height: 30px;
  padding: 3px 10px 3px 5px;
  color: #1d4ed8;
  cursor: pointer;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 95%), rgb(239 246 255 / 92%)) padding-box,
    linear-gradient(135deg, #93c5fd, #c4b5fd) border-box;
  border: 1px solid transparent;
  border-radius: 999px;
  box-shadow:
    0 8px 18px rgb(37 99 235 / 12%),
    inset 0 1px 0 rgb(255 255 255 / 80%);
  align-items: center;
  gap: 6px;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 12px 24px rgb(37 99 235 / 18%),
      inset 0 1px 0 rgb(255 255 255 / 90%);
  }

  strong {
    display: block;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  em {
    display: block;
    margin-top: 1px;
    font-size: 10px;
    font-style: normal;
    line-height: 1;
    color: #64748b;
    transform: scale(0.9);
    transform-origin: left center;
  }
}

.import-icon {
  display: grid;
  width: 22px;
  height: 22px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  border-radius: 50%;
  place-items: center;
}

/* 刷新与下拉 */
.refresh-plain-btn {
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 6px;
}

.full-width-select {
  width: 100%;
}

.dataset-dropdown-row {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  line-height: 1.3;

  .ds-name {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
  }

  .ds-meta {
    margin-top: 2px;
    font-size: 11px;
    color: #64748b;
  }
}

/* 已选知识库卡片格子 */
.selected-datasets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.dataset-glass-chip {
  display: flex;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s ease;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgb(0 0 0 / 3%);
  }

  .chip-info {
    display: flex;
    flex-direction: column;
    min-width: 0;

    .chip-title {
      overflow: hidden;
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-desc {
      margin-top: 2px;
      font-size: 11px;
      color: #64748b;
    }
  }

  .chip-remove {
    margin-left: 8px;
    font-size: 12px;
    flex-shrink: 0;
  }
}

.empty-dataset-placeholder {
  padding: 16px 0;
  margin-top: 16px;
  background-color: #fcfcfc;
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
}

/* 右栏侧边配置样式 */
.assistant-side-panel {
  position: sticky;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.side-config-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #eef2f6;
  border-radius: 12px;
  box-shadow: 0 4px 18px rgb(0 0 0 / 1.5%);

  .side-card-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .side-icon {
      display: flex;
      width: 36px;
      height: 36px;
      color: #5b21b6;
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 8px;
      align-items: center;
      justify-content: center;

      svg {
        width: 18px;
        height: 18px;
      }
    }

    h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }

    p {
      max-width: 220px;
      margin: 2px 0 0;
      overflow: hidden;
      font-size: 11px;
      color: #64748b;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

/* 右侧配置快照概览 */
.summary-card {
  background: linear-gradient(180deg, #fff 0%, #fafcff 100%);
  border-color: #e0f2fe;

  .summary-head {
    padding-bottom: 8px;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 600;
    color: #0284c7;
    border-bottom: 1px solid #e0f2fe;
  }

  .summary-body {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .summary-row-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;

      .row-label {
        color: #64748b;
      }

      .row-val {
        font-weight: 500;
        color: #1e293b;

        &.val-active {
          color: #10b981;
        }
      }
    }
  }
}

/* 高级模式底部的操作栏 */
.bottom-action-sticky {
  position: sticky;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  display: flex;
  padding: 14px 24px;
  margin-top: 30px;
  background: rgb(255 255 255 / 95%);
  border-top: 1px solid #eef2f6;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 -4px 12px rgb(0 0 0 / 3%);
  backdrop-filter: blur(8px);
  justify-content: flex-end;
  gap: 12px;
}

.text-ellipsis {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 全局变量和基础样式体系 */
</style>
