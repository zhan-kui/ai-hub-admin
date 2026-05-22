<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { ContentWrap } from '@/components/ContentWrap'
import { orchestrationApi } from '@/api/frontend-api'
import AppMetaForm from './components/AppMetaForm.vue'
import FlowCanvas from './components/FlowCanvas.vue'
import NodeConfigDrawer from './components/NodeConfigDrawer.vue'
import TemplatePicker from './components/TemplatePicker.vue'
import { DEFAULT_ICON, DEFAULT_ICON_BG, MODEL_OPTIONS } from './constants'
import type { AppMeta, TemplateMeta, TemplateNodeConfig, TemplatePayloadWithVersion } from './types'

const router = useRouter()
const props = defineProps<{
  editId?: number
}>()

const templates = ref<TemplateMeta[]>([])
const selectedTemplateCode = ref('')
const nodeConfigs = ref<Record<string, Record<string, any>>>({})

const drawerVisible = ref(false)
const drawerNodeId = ref('')

const submittingAction = ref<'' | 'save' | 'publish'>('')
const version = ref<number | undefined>(undefined)
const readonlyTemplateText = ref('')
const syncingTemplateConfig = ref(false)

const selectedTemplate = computed<TemplateMeta | undefined>(() =>
  templates.value.find((item) => item.code === selectedTemplateCode.value)
)
const isEditMode = computed(() => Number.isFinite(props.editId))
const pageTitle = computed(() => (isEditMode.value ? '编辑模板编排' : '从模板创建应用'))
const pageMessage = computed(() =>
  isEditMode.value
    ? '编辑已保存的模板流程，支持保存草稿与发布更新'
    : '选择模板 → 填写参数 → 保存或发布到 Dify'
)

const drawerNode = computed(() =>
  selectedTemplate.value?.nodes.find((node) => node.id === drawerNodeId.value)
)

const appMeta = ref<AppMeta>({
  name: '',
  description: '',
  icon: DEFAULT_ICON,
  iconBackground: DEFAULT_ICON_BG
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

function handleBack() {
  router.push('/apps')
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
}

watch(selectedTemplateCode, (code) => {
  if (syncingTemplateConfig.value) return
  if (isEditMode.value) return
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
    ElMessage.warning('请填写应用名')
    return null
  }

  if (isEmptyRequiredValue(appMeta.value.description)) {
    ElMessage.warning('请填写描述')
    return null
  }

  if (isEmptyRequiredValue(appMeta.value.icon)) {
    ElMessage.warning('请填写图标')
    return null
  }

  for (const node of selectedTemplate.value.nodes) {
    if (!node.editable || !node.fields?.length) continue

    const nodeConfig = nodeConfigs.value[node.id] || {}
    for (const field of node.fields) {
      if (!field.required) continue
      if (isEmptyRequiredValue(nodeConfig[field.key])) {
        ElMessage.warning(`「${node.title}」节点的「${field.label}」未填写`)
        return null
      }
    }
  }

  const nodes: TemplateNodeConfig[] = selectedTemplate.value.nodes
    .filter((node) => node.editable)
    .map((node) => {
      const config = { ...(nodeConfigs.value[node.id] || {}) }
      if (config['model.name']) {
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
      icon: String(appMeta.value.icon || '').trim(),
      iconBackground: appMeta.value.iconBackground || DEFAULT_ICON_BG
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

async function handleSubmit(action: 'save' | 'publish') {
  const payload = buildPayload()
  if (!payload) return

  submittingAction.value = action
  try {
    let result: any
    if (isEditMode.value && props.editId) {
      result =
        action === 'save'
          ? await orchestrationApi.saveTemplateConfig(props.editId, payload)
          : await orchestrationApi.publishTemplateConfig(props.editId, payload)
    } else {
      result =
        action === 'save'
          ? await orchestrationApi.saveTemplate(payload)
          : await orchestrationApi.publishTemplate(payload)
    }
    updateVersionFromResponse(result)
    ElMessage.success(action === 'save' ? '保存成功' : '发布成功')
    router.push('/apps')
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, action === 'save' ? '保存失败' : '发布失败'))
  } finally {
    submittingAction.value = ''
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
    const config = (await orchestrationApi.getTemplateConfig(id)) as any
    const templateCode = String(config?.templateCode || '')
    if (!templateCode) {
      ElMessage.error('模板配置缺少 templateCode，无法进入编辑')
      router.push('/apps')
      return
    }

    const template = await ensureTemplateExists(templateCode)
    if (!template) {
      ElMessage.error('模板不存在或已下线，无法进入编辑')
      router.push('/apps')
      return
    }

    syncingTemplateConfig.value = true
    selectedTemplateCode.value = templateCode
    buildNodeConfigs(template, Array.isArray(config?.nodes) ? config.nodes : [])
    syncingTemplateConfig.value = false

    appMeta.value = {
      name: String(config?.appMeta?.name || ''),
      description: String(config?.appMeta?.description || ''),
      icon: String(config?.appMeta?.icon || DEFAULT_ICON),
      iconBackground: String(config?.appMeta?.iconBackground || DEFAULT_ICON_BG)
    }
    version.value = Number.isFinite(Number(config?.version)) ? Number(config.version) : undefined
    readonlyTemplateText.value = `基于模板：${template.name || template.code}（编辑模式下不可更换模板）`
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '模板编排加载失败'))
    router.push('/apps')
  }
}

onMounted(async () => {
  await loadTemplates()
  if (isEditMode.value && props.editId) {
    await loadEditConfig(props.editId)
  }
})
</script>

<template>
  <ContentWrap :title="pageTitle" :message="pageMessage">
    <div class="page-top">
      <el-button link type="primary" @click="handleBack">返回应用管理</el-button>
      <span v-if="isEditMode && readonlyTemplateText" class="readonly-tip">{{
        readonlyTemplateText
      }}</span>
    </div>

    <div v-if="!isEditMode" class="step-block">
      <div class="step-title">1. 选择模板</div>
      <TemplatePicker v-model="selectedTemplateCode" :templates="templates" />
    </div>

    <template v-if="selectedTemplate">
      <div class="step-block">
        <div class="step-title">{{ isEditMode ? '1. 应用信息' : '2. 应用信息' }}</div>
        <AppMetaForm v-model="appMeta" />
      </div>

      <div class="step-block">
        <div class="step-title">
          {{ isEditMode ? '2. 流程参数' : '3. 流程参数' }}
          <span class="step-hint">点击可编辑节点填写参数</span>
        </div>
        <FlowCanvas
          :nodes="selectedTemplate.nodes"
          :edges="selectedTemplate.edges"
          :selected-node-id="drawerVisible ? drawerNodeId : ''"
          @node-click="handleNodeClick"
        />
      </div>
    </template>

    <div class="action-bar">
      <el-button @click="handleBack">取消</el-button>
      <el-button
        :loading="submittingAction === 'save'"
        :disabled="!selectedTemplate"
        @click="handleSubmit('save')"
      >
        保存
      </el-button>
      <el-button
        type="primary"
        :loading="submittingAction === 'publish'"
        :disabled="!selectedTemplate"
        @click="handleSubmit('publish')"
      >
        {{ isEditMode ? '发布更新' : '发布' }}
      </el-button>
    </div>

    <NodeConfigDrawer
      v-if="drawerNode"
      :model-value="drawerVisible"
      :node-title="drawerNode.title"
      :fields="drawerNode.fields || []"
      :config="nodeConfigs[drawerNodeId] || {}"
      @update:model-value="handleDrawerVisibleChange"
      @update:config="handleConfigUpdate"
    />
  </ContentWrap>
</template>

<style scoped lang="less">
.page-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.readonly-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.step-block {
  margin-bottom: 18px;
}

.step-title {
  display: flex;
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  align-items: center;
  gap: 10px;
}

.step-hint {
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.action-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 2px;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 0%) 0%,
    rgb(255 255 255 / 95%) 35%,
    rgb(255 255 255 / 100%) 100%
  );
}
</style>
