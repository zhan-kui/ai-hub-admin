<script setup lang="ts">
import { computed } from 'vue'
import { Delete, Edit, Key, Plus } from '@element-plus/icons-vue'
import type { CustomModel, I18nText, ModelProvider, ProviderCredential } from '@/api/model'

const props = defineProps<{ provider: ModelProvider }>()

const emit = defineEmits<{
  addCredential: [provider: ModelProvider]
  editCredential: [provider: ModelProvider, credential: ProviderCredential]
  deleteCredential: [provider: ModelProvider, credential: ProviderCredential]
  addModel: [provider: ModelProvider]
  editModel: [provider: ModelProvider, model: CustomModel]
  deleteModel: [provider: ModelProvider, model: CustomModel]
  changeStatus: [provider: ModelProvider, model: CustomModel, enabled: boolean]
}>()

const configuration = computed(() => props.provider.custom_configuration || {})
const credentials = computed(() => configuration.value.available_credentials || [])
const customModels = computed(() => configuration.value.custom_models || [])
const supportsProviderCredential = computed(() =>
  props.provider.configurate_methods?.includes('predefined-model')
)
const supportsCustomModel = computed(() =>
  props.provider.configurate_methods?.includes('customizable-model')
)
const configured = computed(
  () =>
    configuration.value.status === 'active' ||
    credentials.value.length > 0 ||
    customModels.value.length > 0
)

function pickI18n(value?: I18nText, fallback = ''): string {
  return value?.zh_Hans || value?.en_US || fallback
}

function providerName(): string {
  return pickI18n(
    props.provider.label,
    props.provider.provider.split('/').at(-1) || props.provider.provider
  )
}

function iconUrl(): string {
  return pickI18n(props.provider.icon_small)
}

function isEnabled(model: CustomModel): boolean {
  if (model.status) return model.status !== 'disabled'
  return model.local_metadata?.enabled !== false
}
</script>

<template>
  <el-card class="provider-card" shadow="hover">
    <div class="provider-header">
      <div class="provider-identity">
        <div class="provider-icon">
          <img v-if="iconUrl()" :src="iconUrl()" :alt="providerName()" />
          <span v-else>{{ providerName().slice(0, 1) }}</span>
        </div>
        <div class="provider-title">
          <div class="title-line">
            <strong>{{ providerName() }}</strong>
            <el-tag :type="configured ? 'success' : 'info'" size="small">
              {{ configured ? '已配置' : '未配置' }}
            </el-tag>
          </div>
          <el-tooltip :content="provider.provider" placement="top">
            <span class="provider-code">{{ provider.provider }}</span>
          </el-tooltip>
        </div>
      </div>

      <div class="provider-actions">
        <el-button
          v-if="supportsProviderCredential"
          type="primary"
          plain
          :icon="Key"
          @click="emit('addCredential', provider)"
        >
          配置密钥
        </el-button>
        <el-button
          v-if="supportsCustomModel"
          type="primary"
          :icon="Plus"
          @click="emit('addModel', provider)"
        >
          添加模型
        </el-button>
      </div>
    </div>

    <div class="type-tags">
      <el-tag
        v-for="type in provider.supported_model_types || []"
        :key="type"
        size="small"
        effect="plain"
      >
        {{ type }}
      </el-tag>
    </div>

    <section v-if="credentials.length" class="card-section">
      <h4>供应商凭据</h4>
      <div v-for="credential in credentials" :key="credential.credential_id" class="credential-row">
        <div class="row-main">
          <span>{{ credential.credential_name }}</span>
          <el-tag
            v-if="credential.credential_id === configuration.current_credential_id"
            type="success"
            size="small"
          >
            当前
          </el-tag>
          <small v-if="credential.local_metadata?.createBy">
            {{ credential.local_metadata.createBy }} · {{ credential.local_metadata.createTime }}
          </small>
        </div>
        <div class="row-actions">
          <el-button
            link
            type="primary"
            :icon="Edit"
            @click="emit('editCredential', provider, credential)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            :icon="Delete"
            @click="emit('deleteCredential', provider, credential)"
          >
            删除
          </el-button>
        </div>
      </div>
    </section>

    <section class="card-section model-section">
      <h4>自定义模型</h4>
      <el-empty v-if="!customModels.length" description="暂无自定义模型" :image-size="56" />
      <div
        v-for="model in customModels"
        :key="`${model.model_type}:${model.model}`"
        class="model-row"
      >
        <div class="model-info">
          <div class="model-name-line">
            <strong>{{ model.model }}</strong>
            <el-tag size="small" effect="plain">{{ model.model_type }}</el-tag>
          </div>
          <small v-if="model.local_metadata?.createBy">
            {{ model.local_metadata.createBy }} · {{ model.local_metadata.createTime }}
          </small>
          <el-alert
            v-if="model.local_metadata?.lastError"
            class="model-error"
            type="error"
            :title="model.local_metadata.lastError"
            :closable="false"
          />
        </div>
        <div class="model-actions">
          <el-switch
            :model-value="isEnabled(model)"
            inline-prompt
            active-text="启"
            inactive-text="停"
            @change="emit('changeStatus', provider, model, Boolean($event))"
          />
          <el-button link type="primary" :icon="Edit" @click="emit('editModel', provider, model)">
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            :icon="Delete"
            @click="emit('deleteModel', provider, model)"
          >
            删除
          </el-button>
        </div>
      </div>
    </section>
  </el-card>
</template>

<style scoped>
.provider-card {
  height: 100%;
  border-radius: 10px;
}

.provider-header,
.provider-identity,
.provider-actions,
.title-line,
.type-tags,
.credential-row,
.model-row,
.model-name-line,
.model-actions {
  display: flex;
  align-items: center;
}

.provider-header,
.credential-row,
.model-row {
  justify-content: space-between;
  gap: 16px;
}

.provider-identity {
  min-width: 0;
  gap: 12px;
}

.provider-icon {
  display: grid;
  width: 42px;
  height: 42px;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 10px;
  flex: 0 0 42px;
  place-items: center;
}

.provider-icon img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.provider-title {
  min-width: 0;
}

.title-line,
.type-tags,
.provider-actions,
.model-name-line,
.model-actions {
  gap: 8px;
}

.provider-code {
  display: block;
  max-width: 320px;
  margin-top: 4px;
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-tags {
  flex-wrap: wrap;
  margin: 16px 0;
}

.card-section {
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.card-section h4 {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.model-section {
  margin-top: 14px;
}

.credential-row,
.model-row {
  min-height: 42px;
  padding: 8px 0;
}

.credential-row + .credential-row,
.model-row + .model-row {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.row-main,
.model-info {
  min-width: 0;
}

.row-main small,
.model-info small {
  display: block;
  margin-top: 4px;
  color: var(--el-text-color-secondary);
}

.model-error {
  margin-top: 8px;
}

@media (width <= 720px) {
  .provider-header,
  .model-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .provider-actions,
  .model-actions {
    width: 100%;
  }
}
</style>
