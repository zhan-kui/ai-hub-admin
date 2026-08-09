<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight, Cpu, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { ContentWrap } from '@/components/ContentWrap'
import { modelApi } from '@/api/model'
import type {
  CustomModel,
  DefaultModelSetting,
  LocalCredentialMetadata,
  ModelCredentialRequest,
  ModelProvider,
  ModelType,
  ProviderCredential,
  ProviderCredentialRequest
} from '@/api/model'
import CredentialFormDialog from './components/CredentialFormDialog.vue'
import CustomModelDialog from './components/CustomModelDialog.vue'
import DefaultModelDialog from './components/DefaultModelDialog.vue'
import ProviderAvatar from './components/ProviderAvatar.vue'
import ProviderDetail from './components/ProviderDetail.vue'
import { providerName } from './provider-icon'

defineOptions({ name: 'ModelList' })

const MODEL_TYPE_OPTIONS: Array<{ label: string; value: ModelType }> = [
  { label: '全部类型', value: '' as ModelType },
  { label: '对话 LLM', value: 'llm' },
  { label: '向量 Embedding', value: 'text-embedding' },
  { label: '重排 Rerank', value: 'rerank' },
  { label: '语音识别', value: 'speech2text' },
  { label: '语音合成', value: 'tts' },
  { label: '内容审核', value: 'moderation' }
]

const MODEL_TYPE_LABELS: Partial<Record<ModelType, string>> = Object.fromEntries(
  MODEL_TYPE_OPTIONS.filter((item) => item.value).map((item) => [item.value, item.label])
)

const loading = ref(false)
const providers = ref<ModelProvider[]>([])
const localRecords = ref<LocalCredentialMetadata[]>([])
const modelType = ref<ModelType>('llm')
const keyword = ref('')
const statusFilter = ref<'all' | 'configured' | 'unconfigured'>('all')
const expandedKeys = ref<string[]>([])

const providerDialog = reactive({
  visible: false,
  provider: undefined as ModelProvider | undefined,
  credential: undefined as ProviderCredential | undefined,
  submitting: false,
  validating: false,
  error: '',
  validateResult: null as { ok: boolean; message: string } | null
})

const customDialog = reactive({
  visible: false,
  provider: undefined as ModelProvider | undefined,
  model: undefined as CustomModel | undefined,
  submitting: false,
  validating: false,
  error: '',
  validateResult: null as { ok: boolean; message: string } | null
})

const defaultDialog = reactive({ visible: false, submitting: false, error: '' })

/* ── 数据 ─────────────────────────────────────────────── */

function credentialsOf(provider: ModelProvider): ProviderCredential[] {
  const seen = new Set<string>()
  return (provider.custom_configuration?.available_credentials || []).filter((credential) => {
    const key = credential.credential_id || credential.credential_name
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function modelsOf(provider: ModelProvider): CustomModel[] {
  return provider.custom_configuration?.custom_models || []
}

function isConfigured(provider: ModelProvider): boolean {
  return (
    provider.custom_configuration?.status === 'active' ||
    credentialsOf(provider).length > 0 ||
    modelsOf(provider).length > 0
  )
}

function errorOf(provider: ModelProvider): string {
  const fromModel = modelsOf(provider).find((item) => item.local_metadata?.lastError)
  if (fromModel) return fromModel.local_metadata!.lastError!
  const fromCredential = credentialsOf(provider).find((item) => item.local_metadata?.lastError)
  return fromCredential?.local_metadata?.lastError || ''
}

function modelTypeLabel(type: ModelType): string {
  return MODEL_TYPE_LABELS[type] || type
}

const filteredProviders = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return providers.value.filter((provider) => {
    if (statusFilter.value === 'configured' && !isConfigured(provider)) return false
    if (statusFilter.value === 'unconfigured' && isConfigured(provider)) return false
    if (!text) return true
    return (
      provider.provider.toLowerCase().includes(text) ||
      providerName(provider).toLowerCase().includes(text) ||
      modelsOf(provider).some((model) => model.model.toLowerCase().includes(text))
    )
  })
})

const stats = computed(() => {
  const configured = providers.value.filter(isConfigured)
  return {
    total: providers.value.length,
    configured: configured.length,
    models: providers.value.reduce((sum, provider) => sum + modelsOf(provider).length, 0),
    failed: providers.value.filter((provider) => errorOf(provider)).length
  }
})

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [response, local] = await Promise.all([
      modelApi.providers(modelType.value || undefined),
      modelApi.local()
    ])
    const seenProviders = new Set<string>()
    providers.value = (response.data || []).filter((provider) => {
      if (!provider.provider || seenProviders.has(provider.provider)) return false
      seenProviders.add(provider.provider)
      return true
    })
    localRecords.value = local || []
  } catch (error: any) {
    ElMessage.error(error?.message || '供应商列表加载失败，请检查 Dify 连接')
  } finally {
    loading.value = false
  }
}

/* ── 供应商凭据 ───────────────────────────────────────── */

function openCreateCredential(provider: ModelProvider): void {
  Object.assign(providerDialog, {
    visible: true,
    provider,
    credential: undefined,
    submitting: false,
    validating: false,
    error: '',
    validateResult: null
  })
}

function openEditCredential(provider: ModelProvider, credential: ProviderCredential): void {
  Object.assign(providerDialog, {
    visible: true,
    provider,
    credential,
    submitting: false,
    validating: false,
    error: '',
    validateResult: null
  })
}

function buildProviderRequest(payload: {
  name: string
  credentials: Record<string, string>
}): ProviderCredentialRequest {
  return {
    provider: providerDialog.provider!.provider,
    credentialId: providerDialog.credential?.credential_id,
    name: payload.name,
    credentials: payload.credentials
  }
}

async function validateProviderCredential(payload: {
  name: string
  credentials: Record<string, string>
}): Promise<void> {
  if (!providerDialog.provider) return
  providerDialog.validating = true
  providerDialog.error = ''
  providerDialog.validateResult = null
  try {
    const result = await modelApi.validateProvider(buildProviderRequest(payload))
    providerDialog.validateResult = {
      ok: result.result === 'success',
      message: result.result === 'success' ? '连接成功，凭据可用' : result.error || '校验未通过'
    }
  } catch (error: any) {
    providerDialog.validateResult = { ok: false, message: error?.message || '校验请求失败' }
  } finally {
    providerDialog.validating = false
  }
}

async function submitProviderCredential(payload: {
  name: string
  credentials: Record<string, string>
}): Promise<void> {
  if (!providerDialog.provider) return
  providerDialog.submitting = true
  providerDialog.error = ''
  providerDialog.validateResult = null
  try {
    const request = buildProviderRequest(payload)
    if (providerDialog.credential) {
      await modelApi.updateProviderCredential(request)
      ElMessage.success('凭据已更新')
    } else {
      await modelApi.createProviderCredential(request)
      ElMessage.success('凭据已保存并通过连接校验')
    }
    providerDialog.visible = false
    await refresh()
  } catch (error: any) {
    providerDialog.error = error?.message || '保存失败，Dify 未返回具体原因'
  } finally {
    providerDialog.submitting = false
  }
}

async function removeProviderCredential(
  provider = providerDialog.provider,
  credential = providerDialog.credential
): Promise<void> {
  if (!provider || !credential?.credential_id) return
  try {
    await ElMessageBox.confirm(
      `删除凭据「${credential.credential_name}」后，Dify 中依赖它的模型会立即不可用。`,
      '删除凭据',
      { type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' }
    )
    providerDialog.submitting = true
    providerDialog.error = ''
    await modelApi.removeProviderCredential(provider.provider, credential.credential_id)
    providerDialog.visible = false
    ElMessage.success('凭据已删除')
    await refresh()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    const message = error?.message || '删除失败'
    if (providerDialog.visible) providerDialog.error = message
    else ElMessage.error(message)
  } finally {
    providerDialog.submitting = false
  }
}

async function switchProviderCredential(
  provider: ModelProvider,
  credential: ProviderCredential
): Promise<void> {
  try {
    await modelApi.switchProviderCredential(provider.provider, credential.credential_id)
    ElMessage.success(`已切换到「${credential.credential_name}」`)
    await refresh()
  } catch (error: any) {
    ElMessage.error(error?.message || '切换凭据失败')
  }
}

/* ── 自定义模型 ───────────────────────────────────────── */

function openCreateModel(provider: ModelProvider): void {
  Object.assign(customDialog, {
    visible: true,
    provider,
    model: undefined,
    submitting: false,
    validating: false,
    error: '',
    validateResult: null
  })
}

function openEditModel(provider: ModelProvider, model: CustomModel): void {
  Object.assign(customDialog, {
    visible: true,
    provider,
    model,
    submitting: false,
    validating: false,
    error: '',
    validateResult: null
  })
}

async function validateCustomModel(payload: ModelCredentialRequest): Promise<void> {
  customDialog.validating = true
  customDialog.error = ''
  customDialog.validateResult = null
  try {
    const result = await modelApi.validateCustomModel(payload)
    customDialog.validateResult = {
      ok: result.result === 'success',
      message: result.result === 'success' ? '连接成功，模型可用' : result.error || '校验未通过'
    }
  } catch (error: any) {
    customDialog.validateResult = { ok: false, message: error?.message || '校验请求失败' }
  } finally {
    customDialog.validating = false
  }
}

async function submitCustomModel(payload: ModelCredentialRequest): Promise<void> {
  customDialog.submitting = true
  customDialog.error = ''
  customDialog.validateResult = null
  try {
    if (customDialog.model) {
      await modelApi.updateCustomModel(payload)
      ElMessage.success('模型已更新')
    } else {
      await modelApi.createCustomModel(payload)
      ElMessage.success('模型已添加并通过连接校验')
    }
    customDialog.visible = false
    await refresh()
  } catch (error: any) {
    customDialog.error = error?.message || '保存失败，Dify 未返回具体原因'
  } finally {
    customDialog.submitting = false
  }
}

async function changeModelStatus(
  provider: ModelProvider,
  model: CustomModel,
  enabled: boolean
): Promise<void> {
  try {
    await modelApi.setCustomModelStatus({
      provider: provider.provider,
      model: model.model,
      modelType: model.model_type,
      enabled
    })
    ElMessage.success(enabled ? `${model.model} 已启用` : `${model.model} 已停用`)
  } catch (error: any) {
    ElMessage.error(error?.message || '状态更新失败')
  } finally {
    await refresh()
  }
}

async function switchModelCredential(
  provider: ModelProvider,
  model: CustomModel,
  credentialId: string
): Promise<void> {
  try {
    await modelApi.switchModelCredential({
      provider: provider.provider,
      model: model.model,
      modelType: model.model_type,
      credentialId
    })
    ElMessage.success('已切换该模型使用的凭据')
    await refresh()
  } catch (error: any) {
    ElMessage.error(error?.message || '切换凭据失败')
    await refresh()
  }
}

async function removeCustomModel(provider: ModelProvider, model: CustomModel): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除「${model.model}」会同步从 Dify 移除，正在使用它的应用会报错。`,
      '删除模型',
      { type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' }
    )
    await modelApi.removeCustomModel(provider.provider, model.model, model.model_type)
    ElMessage.success('模型已删除')
    await refresh()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.message || '删除失败')
  }
}

async function saveDefaultModel(settings: DefaultModelSetting[]): Promise<void> {
  defaultDialog.submitting = true
  defaultDialog.error = ''
  try {
    await modelApi.setDefaultModel(settings)
    defaultDialog.visible = false
    ElMessage.success('默认模型已更新')
  } catch (error: any) {
    defaultDialog.error = error?.message || '保存失败'
  } finally {
    defaultDialog.submitting = false
  }
}

function toggleExpand(provider: ModelProvider): void {
  const index = expandedKeys.value.indexOf(provider.provider)
  if (index >= 0) expandedKeys.value.splice(index, 1)
  else expandedKeys.value.push(provider.provider)
}

/** 表格内部展开状态才是唯一真相，这里同步回来，避免点行和点箭头互相抵消 */
function onExpandChange(_row: ModelProvider, expandedRows: ModelProvider[] | boolean): void {
  if (Array.isArray(expandedRows)) {
    expandedKeys.value = expandedRows.map((item) => item.provider)
  }
}

onMounted(() => void refresh())
</script>

<template>
  <ContentWrap>
    <header class="page-head">
      <div class="head-main">
        <div class="head-icon">
          <el-icon><Cpu /></el-icon>
        </div>
        <div class="head-text">
          <span class="head-eyebrow">AI 基础设施</span>
          <h2>模型管理</h2>
          <p>集中维护 Dify 工作空间的供应商凭据、自定义模型与默认模型。</p>
        </div>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="refresh">刷新</el-button>
        <el-button type="primary" :icon="Setting" @click="defaultDialog.visible = true">
          默认模型
        </el-button>
      </div>
    </header>

    <div class="stat-grid">
      <div class="stat-card stat-primary">
        <span class="stat-mark"></span>
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">已安装供应商</span>
      </div>
      <div class="stat-card stat-success">
        <span class="stat-mark"></span>
        <span class="stat-value">{{ stats.configured }}</span>
        <span class="stat-label">已配置</span>
      </div>
      <div class="stat-card stat-neutral">
        <span class="stat-mark"></span>
        <span class="stat-value">{{ stats.models }}</span>
        <span class="stat-label">自定义模型</span>
      </div>
      <div class="stat-card stat-danger" :class="{ 'has-error': stats.failed }">
        <span class="stat-mark"></span>
        <span class="stat-value">{{ stats.failed }}</span>
        <span class="stat-label">配置异常</span>
      </div>
    </div>

    <section class="list-panel">
      <div class="filter-bar">
        <div class="filter-main">
          <el-select v-model="modelType" class="filter-type" @change="refresh">
            <el-option
              v-for="item in MODEL_TYPE_OPTIONS"
              :key="item.value || 'all'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-radio-group v-model="statusFilter">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="configured">已配置</el-radio-button>
            <el-radio-button value="unconfigured">未配置</el-radio-button>
          </el-radio-group>
        </div>
        <el-input
          v-model="keyword"
          class="filter-search"
          :prefix-icon="Search"
          clearable
          placeholder="搜索供应商或模型名"
        />
      </div>

      <el-table
        v-loading="loading"
        :data="filteredProviders"
        row-key="provider"
        :expand-row-keys="expandedKeys"
        class="provider-table"
        @expand-change="onExpandChange"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <ProviderDetail
              :provider="row"
              @add-credential="openCreateCredential"
              @edit-credential="openEditCredential"
              @delete-credential="removeProviderCredential"
              @switch-credential="switchProviderCredential"
              @add-model="openCreateModel"
              @edit-model="openEditModel"
              @delete-model="removeCustomModel"
              @change-status="changeModelStatus"
              @switch-model-credential="switchModelCredential"
            />
          </template>
        </el-table-column>

        <el-table-column label="供应商" min-width="260">
          <template #default="{ row }">
            <div class="cell-provider" @click="toggleExpand(row)">
              <ProviderAvatar :provider="row" />
              <div class="provider-text">
                <span class="provider-name">{{ providerName(row) }}</span>
                <span class="provider-code">{{ row.provider }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="支持能力" min-width="220">
          <template #default="{ row }">
            <div class="cell-tags">
              <el-tag
                v-for="type in row.supported_model_types || []"
                :key="type"
                size="small"
                effect="plain"
                type="info"
              >
                {{ modelTypeLabel(type) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tooltip v-if="errorOf(row)" :content="errorOf(row)" placement="top">
              <el-tag type="danger" size="small">配置异常</el-tag>
            </el-tooltip>
            <el-tag v-else-if="isConfigured(row)" type="success" size="small">已配置</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">未配置</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="当前凭据" min-width="180">
          <template #default="{ row }">
            <template v-if="row.custom_configuration?.current_credential_name">
              <div class="cell-credential">
                <span class="credential-name">
                  {{ row.custom_configuration.current_credential_name }}
                </span>
                <span v-if="credentialsOf(row).length > 1" class="muted">
                  共 {{ credentialsOf(row).length }} 份，可切换
                </span>
              </div>
            </template>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>

        <el-table-column label="自定义模型" width="120" align="right">
          <template #default="{ row }">
            <span v-if="modelsOf(row).length" class="model-count">
              {{ modelsOf(row).length }}
            </span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="118" align="right" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              class="manage-button"
              :icon="expandedKeys.includes(row.provider) ? undefined : ArrowRight"
              @click="toggleExpand(row)"
            >
              {{ expandedKeys.includes(row.provider) ? '收起' : '管理配置' }}
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty
            :description="
              keyword || statusFilter !== 'all'
                ? '没有匹配的供应商，换个筛选条件试试'
                : '当前模型类型下还没有已安装的供应商，先去 Dify 插件市场装一个'
            "
          />
        </template>
      </el-table>
    </section>
  </ContentWrap>

  <CredentialFormDialog
    v-if="providerDialog.provider"
    v-model="providerDialog.visible"
    :title="providerDialog.credential ? '编辑凭据' : '添加凭据'"
    :subtitle="providerName(providerDialog.provider)"
    :credential-form-schemas="
      providerDialog.provider.provider_credential_schema?.credential_form_schemas || []
    "
    :model-type="modelType || 'llm'"
    :initial-values="providerDialog.credential?.credentials"
    :initial-name="providerDialog.credential?.credential_name"
    :editing="Boolean(providerDialog.credential)"
    :show-delete="Boolean(providerDialog.credential)"
    :submitting="providerDialog.submitting"
    :validating="providerDialog.validating"
    :validate-result="providerDialog.validateResult"
    :error="providerDialog.error"
    @submit="submitProviderCredential"
    @validate="validateProviderCredential"
    @delete="removeProviderCredential()"
  />

  <CustomModelDialog
    v-if="customDialog.provider"
    v-model="customDialog.visible"
    :provider="customDialog.provider"
    :editing="Boolean(customDialog.model)"
    :initial-model="customDialog.model?.model"
    :initial-model-type="customDialog.model?.model_type || modelType || 'llm'"
    :initial-credential-id="customDialog.model?.current_credential_id"
    :initial-name="customDialog.model?.current_credential_name"
    :initial-values="customDialog.model?.credentials"
    :submitting="customDialog.submitting"
    :validating="customDialog.validating"
    :validate-result="customDialog.validateResult"
    :error="customDialog.error"
    @submit="submitCustomModel"
    @validate="validateCustomModel"
  />

  <DefaultModelDialog
    v-model="defaultDialog.visible"
    :submitting="defaultDialog.submitting"
    :error="defaultDialog.error"
    @submit="saveDefaultModel"
  />
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 4px 2px 2px;
}

.head-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.head-icon {
  display: grid;
  width: 44px;
  height: 44px;
  font-size: 22px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 12px;
  flex: 0 0 44px;
  place-items: center;
}

.head-eyebrow {
  display: block;
  margin-bottom: 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--el-color-primary);
  text-transform: uppercase;
}

.head-text h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.head-text p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.head-actions {
  display: flex;
  flex: none;
  gap: 10px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0 16px;
}

.stat-card {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  padding: 15px 16px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
}

.stat-mark {
  grid-row: 1 / 3;
  align-self: stretch;
  width: 3px;
  background: var(--el-border-color);
  border-radius: 999px;
}

.stat-primary .stat-mark {
  background: var(--el-color-primary);
}

.stat-success .stat-mark {
  background: var(--el-color-success);
}

.stat-neutral .stat-mark {
  background: var(--el-color-info);
}

.stat-danger.has-error .stat-mark {
  background: var(--el-color-danger);
}

.stat-value {
  font-size: 22px;
  font-weight: 650;
  line-height: 1.2;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-danger.has-error .stat-value {
  color: var(--el-color-danger);
}

.list-panel {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgb(15 23 42 / 4%);
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: var(--el-fill-color-extra-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-type {
  width: 160px;
}

.filter-search {
  width: 260px;
}

.provider-table {
  --el-table-border-color: var(--el-border-color-lighter);
  --el-table-header-bg-color: var(--el-fill-color-extra-light);
  --el-table-row-hover-bg-color: var(--el-color-primary-light-9);
}

.provider-table :deep(.el-table__cell) {
  padding: 12px 0;
}

.provider-table :deep(th.el-table__cell) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.provider-table :deep(.el-table__expanded-cell) {
  padding: 0 !important;
  box-shadow: inset 0 1px 0 var(--el-border-color-lighter);
}

.cell-provider {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  cursor: pointer;
}

.provider-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.provider-name {
  font-weight: 600;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.provider-code,
.muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.provider-code {
  overflow: hidden;
  font-family: var(--el-font-family-mono, ui-monospace, monospace);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cell-credential {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.credential-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-count {
  display: inline-grid;
  height: 26px;
  min-width: 26px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  border-radius: 999px;
  place-items: center;
  font-variant-numeric: tabular-nums;
}

.manage-button {
  font-weight: 500;
}

@media (width <= 900px) {
  .page-head {
    flex-direction: column;
  }

  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-bar,
  .filter-main {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-search {
    width: 100%;
  }
}

@media (width <= 520px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
