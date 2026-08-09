<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Delete, Edit, Key, Plus } from '@element-plus/icons-vue'
import type { CustomModel, ModelProvider, ProviderCredential } from '@/api/model'

const props = defineProps<{ provider: ModelProvider }>()

const emit = defineEmits<{
  addCredential: [provider: ModelProvider]
  editCredential: [provider: ModelProvider, credential: ProviderCredential]
  deleteCredential: [provider: ModelProvider, credential: ProviderCredential]
  switchCredential: [provider: ModelProvider, credential: ProviderCredential]
  addModel: [provider: ModelProvider]
  editModel: [provider: ModelProvider, model: CustomModel]
  deleteModel: [provider: ModelProvider, model: CustomModel]
  changeStatus: [provider: ModelProvider, model: CustomModel, enabled: boolean]
  switchModelCredential: [provider: ModelProvider, model: CustomModel, credentialId: string]
}>()

const configuration = computed(() => props.provider.custom_configuration || {})
const credentials = computed(() => {
  const seen = new Set<string>()
  return (configuration.value.available_credentials || []).filter((credential) => {
    const key = credential.credential_id || credential.credential_name
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const customModels = computed(() => configuration.value.custom_models || [])
const unaddedModels = computed(() => configuration.value.can_added_models || [])
const currentCredentialId = computed(() => configuration.value.current_credential_id)

const supportsProviderCredential = computed(() =>
  props.provider.configurate_methods?.includes('predefined-model')
)
const supportsCustomModel = computed(() =>
  props.provider.configurate_methods?.includes('customizable-model')
)

const activeTab = ref(supportsProviderCredential.value ? 'credentials' : 'models')

function isEnabled(model: CustomModel): boolean {
  if (model.status) return model.status !== 'disabled'
  return model.local_metadata?.enabled !== false
}

function author(meta?: { createBy?: string; updateBy?: string; createTime?: string }): string {
  if (!meta) return '—'
  const who = meta.updateBy || meta.createBy
  if (!who) return '—'
  return meta.createTime ? `${who} · ${meta.createTime}` : who
}
</script>

<template>
  <div class="detail-panel">
    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane v-if="supportsProviderCredential" name="credentials">
        <template #label>
          <span class="tab-label">
            供应商凭据
            <el-badge v-if="credentials.length" :value="credentials.length" type="info" />
          </span>
        </template>

        <div class="tab-body">
          <div class="tab-toolbar">
            <div>
              <h4>供应商凭据</h4>
              <p class="tab-hint">
                一份凭据可启用该供应商的全部预置模型，多份凭据可作为备用并随时切换。
              </p>
            </div>
            <el-button type="primary" plain :icon="Key" @click="emit('addCredential', provider)">
              新增凭据
            </el-button>
          </div>

          <el-table v-if="credentials.length" :data="credentials" class="inner-table">
            <el-table-column label="凭据名称" min-width="180">
              <template #default="{ row }">
                <div class="name-cell">
                  <span>{{ row.credential_name }}</span>
                  <el-tag
                    v-if="row.credential_id === currentCredentialId"
                    type="success"
                    size="small"
                  >
                    生效中
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="配置人 / 时间" min-width="200">
              <template #default="{ row }">
                <span class="muted">{{ author(row.local_metadata) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" align="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.credential_id !== currentCredentialId"
                  link
                  type="success"
                  :icon="Check"
                  @click="emit('switchCredential', provider, row)"
                >
                  设为生效
                </el-button>
                <el-button
                  link
                  type="primary"
                  :icon="Edit"
                  @click="emit('editCredential', provider, row)"
                >
                  编辑
                </el-button>
                <el-button
                  link
                  type="danger"
                  :icon="Delete"
                  @click="emit('deleteCredential', provider, row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-else class="detail-empty" :image-size="54" description="尚未配置供应商凭据" />
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="supportsCustomModel" name="models">
        <template #label>
          <span class="tab-label">
            自定义模型
            <el-badge v-if="customModels.length" :value="customModels.length" type="info" />
          </span>
        </template>

        <div class="tab-body">
          <div class="tab-toolbar">
            <div>
              <h4>自定义模型</h4>
              <p class="tab-hint">接入 OpenAI API Compatible、vLLM 或 Ollama 等自建模型服务。</p>
            </div>
            <el-button type="primary" plain :icon="Plus" @click="emit('addModel', provider)">
              新增模型
            </el-button>
          </div>

          <el-table
            v-if="customModels.length"
            :data="customModels"
            class="inner-table"
            row-key="model"
          >
            <el-table-column label="模型" min-width="200">
              <template #default="{ row }">
                <div class="name-cell">
                  <span class="model-name">{{ row.model }}</span>
                  <el-tag size="small" effect="plain" type="info">{{ row.model_type }}</el-tag>
                </div>
                <el-tooltip
                  v-if="row.local_metadata?.lastError"
                  :content="row.local_metadata.lastError"
                  placement="top"
                >
                  <span class="error-line">{{ row.local_metadata.lastError }}</span>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="使用凭据" min-width="200">
              <template #default="{ row }">
                <el-select
                  v-if="(row.available_model_credentials || []).length > 1"
                  :model-value="row.current_credential_id"
                  size="small"
                  class="credential-select"
                  @change="(value: string) => emit('switchModelCredential', provider, row, value)"
                >
                  <el-option
                    v-for="item in row.available_model_credentials"
                    :key="item.credential_id"
                    :label="item.credential_name"
                    :value="item.credential_id"
                  />
                </el-select>
                <span v-else class="muted">{{ row.current_credential_name || '—' }}</span>
              </template>
            </el-table-column>

            <el-table-column label="配置人 / 时间" min-width="180">
              <template #default="{ row }">
                <span class="muted">{{ author(row.local_metadata) }}</span>
              </template>
            </el-table-column>

            <el-table-column label="启用" width="80" align="center">
              <template #default="{ row }">
                <el-switch
                  :model-value="isEnabled(row)"
                  @change="emit('changeStatus', provider, row, Boolean($event))"
                />
              </template>
            </el-table-column>

            <el-table-column label="操作" width="150" align="right">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  :icon="Edit"
                  @click="emit('editModel', provider, row)"
                >
                  编辑
                </el-button>
                <el-button
                  link
                  type="danger"
                  :icon="Delete"
                  @click="emit('deleteModel', provider, row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-else class="detail-empty" :image-size="54" description="尚未接入自定义模型" />

          <div v-if="unaddedModels.length" class="sync-hint">
            <span class="sync-dot"></span>
            <span class="muted">
              Dify 中还有 {{ unaddedModels.length }} 个已配凭据但未加入列表的模型
            </span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.detail-panel {
  padding: 8px 24px 22px 64px;
  background: linear-gradient(180deg, var(--el-fill-color-extra-light), var(--el-bg-color));
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.detail-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--el-border-color-lighter);
}

.detail-tabs :deep(.el-tabs__item) {
  height: 44px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.detail-tabs :deep(.el-tabs__item.is-active) {
  color: var(--el-color-primary);
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
}

.tab-toolbar h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tab-hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.inner-table {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
}

.inner-table :deep(th.el-table__cell) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-extra-light);
}

.inner-table :deep(.el-table__cell) {
  padding: 10px 0;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.model-name {
  font-family: var(--el-font-family-mono, ui-monospace, monospace);
}

.error-line {
  display: block;
  max-width: 100%;
  margin-top: 4px;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-color-danger);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credential-select {
  width: 100%;
  max-width: 180px;
}

.muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-empty {
  min-height: 150px;
  padding: 14px 0;
  background: var(--el-bg-color);
  border: 1px dashed var(--el-border-color);
  border-radius: 9px;
}

.sync-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
}

.sync-dot {
  width: 6px;
  height: 6px;
  background: var(--el-color-warning);
  border-radius: 999px;
}

@media (width <= 900px) {
  .detail-panel {
    padding-left: 24px;
  }

  .tab-toolbar {
    align-items: flex-start;
  }
}
</style>
