<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { InfoFilled, Setting } from '@element-plus/icons-vue'
import { modelApi } from '@/api/model'
import type {
  AvailableModel,
  AvailableModelResponse,
  DefaultModelSetting,
  I18nText,
  ModelType
} from '@/api/model'

interface Option {
  value: string
  label: string
  provider: string
  model: string
}

const TYPES: Array<{ value: ModelType; label: string; hint: string }> = [
  { value: 'llm', label: '对话模型', hint: '应用编排和 Agent 默认调用' },
  { value: 'text-embedding', label: '向量模型', hint: '知识库分段建索引时使用' },
  { value: 'rerank', label: '重排模型', hint: '检索结果二次排序' },
  { value: 'speech2text', label: '语音转文字', hint: '语音输入' },
  { value: 'tts', label: '文字转语音', hint: '语音播报' },
  { value: 'moderation', label: '内容审核', hint: '输入输出敏感内容拦截' }
]

const props = withDefaults(
  defineProps<{ modelValue: boolean; submitting?: boolean; error?: string }>(),
  { submitting: false, error: '' }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [settings: DefaultModelSetting[]]
}>()

const loading = ref(false)
const loadError = ref('')
const options = reactive<Record<string, Option[]>>({})
const selected = reactive<Record<string, string>>({})
const original = reactive<Record<string, string>>({})

watch(
  () => props.modelValue,
  (opened) => {
    if (opened) void load()
  },
  { immediate: true }
)

function pickI18n(value?: I18nText, fallback = ''): string {
  return value?.zh_Hans || value?.en_US || fallback
}

function keyOf(provider: string, model: string): string {
  return `${provider}::${model}`
}

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const results = await Promise.allSettled(
      TYPES.flatMap((type) => [modelApi.available(type.value), modelApi.defaultModel(type.value)])
    )

    TYPES.forEach((type, index) => {
      const availableResult = results[index * 2]
      const defaultResult = results[index * 2 + 1]

      const available =
        availableResult.status === 'fulfilled'
          ? (availableResult.value as AvailableModelResponse)
          : undefined
      options[type.value] = available
        ? (
            (available.data || []) as Array<{
              label?: I18nText
              models?: AvailableModel[]
            }>
          ).flatMap((provider) =>
            (provider.models || [])
              .filter((model) => model.status !== 'disabled')
              .map((model) => ({
                value: keyOf(model.provider, model.model),
                label: `${pickI18n(model.label, model.model)} · ${pickI18n(provider.label, model.provider)}`,
                provider: model.provider,
                model: model.model
              }))
          )
        : []

      let current = ''
      if (defaultResult.status === 'fulfilled') {
        const raw = defaultResult.value as any
        const providerName =
          typeof raw?.provider === 'string'
            ? raw.provider
            : raw?.provider?.provider || raw?.model?.provider?.provider || ''
        const modelName = typeof raw?.model === 'string' ? raw.model : raw?.model?.model || ''
        if (providerName && modelName) current = keyOf(providerName, modelName)
      }
      selected[type.value] = current
      original[type.value] = current
    })

    if (results.every((item) => item.status === 'rejected')) {
      loadError.value = '可用模型加载失败，请先确认 AI 模型服务连接正常'
    }
  } catch (error: any) {
    loadError.value = error?.message || '可用模型加载失败'
  } finally {
    loading.value = false
  }
}

function submit(): void {
  const settings: DefaultModelSetting[] = []
  for (const type of TYPES) {
    const value = selected[type.value]
    if (!value || value === original[type.value]) continue
    const option = (options[type.value] || []).find((item) => item.value === value)
    if (option) {
      settings.push({ modelType: type.value, provider: option.provider, model: option.model })
    }
  }
  if (!settings.length) {
    loadError.value = '没有改动，先选一个模型再保存'
    return
  }
  loadError.value = ''
  emit('submit', settings)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="default-model-dialog"
    width="720px"
    top="6vh"
    destroy-on-close
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-head">
        <div class="dialog-icon">
          <el-icon><Setting /></el-icon>
        </div>
        <div>
          <span class="dialog-eyebrow">WORKSPACE DEFAULTS</span>
          <h3>默认模型</h3>
          <p>为不同能力设置工作空间级默认模型</p>
        </div>
      </div>
    </template>

    <div class="dialog-hint">
      <el-icon><InfoFilled /></el-icon>
      <span>新建应用和知识库时会自动选中这里的模型。留空表示不设置，仅提交本次有改动的项。</span>
    </div>

    <el-alert
      v-if="error || loadError"
      class="dialog-error"
      type="error"
      :title="error || loadError"
      :closable="false"
      show-icon
    />

    <div v-loading="loading" class="type-list">
      <div v-for="(type, index) in TYPES" :key="type.value" class="type-row">
        <span class="type-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="type-meta">
          <span class="type-label">{{ type.label }}</span>
          <span class="type-hint">{{ type.hint }}</span>
        </div>
        <el-select
          v-model="selected[type.value]"
          class="type-select"
          filterable
          clearable
          :disabled="!(options[type.value] || []).length"
          :placeholder="
            (options[type.value] || []).length ? '未设置' : '暂无可用模型，先去配置供应商'
          "
        >
          <el-option
            v-for="option in options[type.value] || []"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span>修改保存后将立即同步到 AI 模型服务空间</span>
        <div>
          <el-button :disabled="submitting" @click="emit('update:modelValue', false)"
            >取消</el-button
          >
          <el-button type="primary" :loading="submitting" @click="submit">保存设置</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-hint {
  display: flex;
  padding: 11px 13px;
  margin: 0 0 18px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
  background: var(--el-color-info-light-9);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  align-items: flex-start;
  gap: 8px;
}

.dialog-hint .el-icon {
  flex: none;
  margin-top: 2px;
  color: var(--el-color-info);
}

.dialog-error {
  margin-bottom: 16px;
}

.type-list {
  display: grid;
  gap: 10px;
  min-height: 120px;
}

.type-row {
  display: grid;
  grid-template-columns: 34px minmax(150px, 1fr) minmax(260px, 1.5fr);
  align-items: center;
  gap: 14px;
  padding: 13px 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.type-row:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 2px 8px rgb(15 23 42 / 5%);
}

.type-index {
  display: inline-grid;
  width: 30px;
  height: 30px;
  font-size: 10px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  place-items: center;
}

.type-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.type-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.type-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.type-select {
  width: 100%;
}

.dialog-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dialog-icon {
  display: grid;
  width: 40px;
  height: 40px;
  font-size: 19px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 10px;
  flex: 0 0 40px;
  place-items: center;
}

.dialog-eyebrow {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--el-color-primary);
}

.dialog-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.dialog-head p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.dialog-footer > span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

@media (width <= 720px) {
  .type-row {
    grid-template-columns: 34px 1fr;
  }

  .type-select {
    grid-column: 1 / 3;
    width: 100%;
  }

  .dialog-footer {
    align-items: flex-end;
    flex-direction: column;
  }
}

:global(.default-model-dialog) {
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgb(15 23 42 / 18%);
}

:global(.default-model-dialog .el-dialog__header) {
  padding: 18px 22px;
  margin-right: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.default-model-dialog .el-dialog__body) {
  max-height: calc(88vh - 156px);
  padding: 18px 22px 20px;
  overflow-y: auto;
  background: var(--el-fill-color-extra-light);
}

:global(.default-model-dialog .el-dialog__footer) {
  padding: 14px 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
