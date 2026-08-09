<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type {
  CredentialFormSchema,
  I18nText,
  ModelCredentialRequest,
  ModelProvider,
  ModelType
} from '@/api/model'
import CredentialFormDialog from './CredentialFormDialog.vue'
import type { CredentialPayload } from './CredentialFormDialog.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    provider?: ModelProvider
    editing?: boolean
    initialModel?: string
    initialModelType?: ModelType
    initialCredentialId?: string
    initialName?: string
    initialValues?: Record<string, string>
    submitting?: boolean
    validating?: boolean
    validateResult?: { ok: boolean; message: string } | null
    error?: string
  }>(),
  {
    provider: undefined,
    editing: false,
    initialModel: '',
    initialModelType: 'llm',
    initialCredentialId: '',
    initialName: '',
    initialValues: () => ({}),
    submitting: false,
    validating: false,
    validateResult: null,
    error: ''
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ModelCredentialRequest]
  validate: [payload: ModelCredentialRequest]
}>()

const MODEL_TYPE_LABELS: Partial<Record<ModelType, string>> = {
  llm: '对话 LLM',
  'text-embedding': '向量 Embedding',
  rerank: '重排 Rerank',
  speech2text: '语音识别',
  tts: '语音合成',
  moderation: '内容审核'
}

const form = reactive({ model: '', modelType: 'llm' as ModelType })

watch(
  () => props.modelValue,
  (opened) => {
    if (!opened) return
    form.model = props.initialModel || ''
    form.modelType = props.initialModelType || 'llm'
  },
  { immediate: true }
)

/** Dify 已知但还没加进模型列表的模型，做成候选，避免手打错名字 */
const modelSuggestions = computed(() =>
  (props.provider?.custom_configuration?.can_added_models || []).filter(
    (item) => item.model_type === form.modelType
  )
)

const supportedTypes = computed(() => props.provider?.supported_model_types || ['llm'])

function pickI18n(value?: I18nText, fallback = ''): string {
  return value?.zh_Hans || value?.en_US || fallback
}

function schemas(): CredentialFormSchema[] {
  return props.provider?.model_credential_schema?.credential_form_schemas || []
}

function checkModel(): string {
  return form.model.trim() ? '' : '请填写模型名称，要和模型服务里的名字完全一致'
}

function buildRequest(payload: CredentialPayload): ModelCredentialRequest {
  return {
    provider: props.provider!.provider,
    model: form.model.trim(),
    modelType: form.modelType,
    credentialId: props.initialCredentialId || undefined,
    name: payload.name,
    credentials: payload.credentials
  }
}
</script>

<template>
  <CredentialFormDialog
    :model-value="modelValue"
    :title="editing ? '编辑模型' : '添加模型'"
    :subtitle="pickI18n(provider?.label, provider?.provider)"
    :credential-form-schemas="schemas()"
    :model-type="form.modelType"
    :initial-values="initialValues"
    :initial-name="initialName"
    :editing="editing"
    :submitting="submitting"
    :validating="validating"
    :validate-result="validateResult"
    :error="error"
    :before-collect="checkModel"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="(payload) => emit('submit', buildRequest(payload))"
    @validate="(payload) => emit('validate', buildRequest(payload))"
  >
    <template #before-fields>
      <div class="model-basics">
        <el-form-item label="模型类型" required>
          <el-select v-model="form.modelType" class="full-width" :disabled="editing">
            <el-option
              v-for="type in supportedTypes"
              :key="type"
              :label="MODEL_TYPE_LABELS[type] || type"
              :value="type"
            />
          </el-select>
        </el-form-item>

        <el-form-item required>
          <template #label>
            {{ pickI18n(provider?.model_credential_schema?.model?.label, '模型名称') }}
            <span class="label-hint">区分大小写</span>
          </template>
          <el-select
            v-model="form.model"
            class="full-width"
            filterable
            allow-create
            default-first-option
            :disabled="editing"
            :placeholder="
              pickI18n(provider?.model_credential_schema?.model?.placeholder, '例如：qwen3-32b')
            "
          >
            <el-option
              v-for="item in modelSuggestions"
              :key="item.model"
              :label="item.model"
              :value="item.model"
            />
          </el-select>
        </el-form-item>
      </div>
    </template>
  </CredentialFormDialog>
</template>

<style scoped>
.full-width {
  width: 100%;
}

.label-hint {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.model-basics {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 14px;
}

@media (width <= 720px) {
  .model-basics {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
