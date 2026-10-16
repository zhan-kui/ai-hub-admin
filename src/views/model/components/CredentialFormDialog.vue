<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CircleCheck, Connection, Key, WarningFilled } from '@element-plus/icons-vue'
import type { CredentialFormSchema, I18nText, ModelType } from '@/api/model'

const HIDDEN_VALUE = '[__HIDDEN__]'

export interface CredentialPayload {
  name: string
  credentials: Record<string, string>
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    subtitle?: string
    credentialFormSchemas?: CredentialFormSchema[]
    modelType: ModelType
    initialValues?: Record<string, string>
    initialName?: string
    editing?: boolean
    submitting?: boolean
    validating?: boolean
    validateResult?: { ok: boolean; message: string } | null
    error?: string
    showDelete?: boolean
    /** 由外层（CustomModelDialog）注入的额外校验，返回错误文案表示不通过 */
    beforeCollect?: () => string
  }>(),
  {
    subtitle: '',
    credentialFormSchemas: () => [],
    initialValues: () => ({}),
    initialName: '',
    editing: false,
    submitting: false,
    validating: false,
    validateResult: null,
    error: '',
    showDelete: false,
    beforeCollect: undefined
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: CredentialPayload]
  validate: [payload: CredentialPayload]
  delete: []
}>()

const name = ref('')
const values = reactive<Record<string, string>>({})
const localError = ref('')
const maskedFields = ref<Set<string>>(new Set())
const advancedOpen = ref<string[]>([])

const busy = computed(() => props.submitting || props.validating)

/** show_on 联动过滤 */
const visibleSchemas = computed(() =>
  props.credentialFormSchemas.filter((schema) =>
    (schema.show_on || []).every((condition) => {
      const current =
        condition.variable === '__model_type' ? props.modelType : values[condition.variable]
      return current === String(condition.value)
    })
  )
)

/** 必填的放主区，可选的收进「高级参数」，避免 10+ 字段一屏铺开 */
const primarySchemas = computed(() => visibleSchemas.value.filter((schema) => schema.required))
const advancedSchemas = computed(() => visibleSchemas.value.filter((schema) => !schema.required))

/**
 * 只在弹窗「打开的那一刻」初始化表单。
 * 不要监听 initialValues —— 父组件模板里的 `x?.credentials || {}` 每次渲染都是新对象，
 * 深度监听会在用户输入到一半时把表单重置掉。
 */
watch(
  () => props.modelValue,
  (opened) => {
    if (!opened) return
    name.value = props.initialName || ''
    localError.value = ''
    advancedOpen.value = []
    const masked = new Set<string>()
    Object.keys(values).forEach((key) => delete values[key])
    props.credentialFormSchemas.forEach((schema) => {
      const initial = props.initialValues?.[schema.variable]
      if (initial === HIDDEN_VALUE) {
        masked.add(schema.variable)
        values[schema.variable] = ''
      } else if (initial !== undefined && initial !== null && initial !== '') {
        values[schema.variable] = String(initial)
      } else if (schema.default !== undefined && schema.default !== null) {
        values[schema.variable] = String(schema.default)
      } else {
        values[schema.variable] = ''
      }
    })
    maskedFields.value = masked
  },
  { immediate: true }
)

function pickI18n(value?: I18nText, fallback = ''): string {
  return value?.zh_Hans || value?.en_US || fallback
}

function placeholder(schema: CredentialFormSchema): string {
  if (maskedFields.value.has(schema.variable)) return '已配置，留空表示不修改'
  return pickI18n(schema.placeholder, `请输入${pickI18n(schema.label, schema.variable)}`)
}

function optionLabel(option: { value: string; label?: I18nText }): string {
  return pickI18n(option.label, option.value)
}

/** 校验并组装提交体；不通过返回 null 并写入 localError */
function collect(): CredentialPayload | null {
  localError.value = ''

  const extraError = props.beforeCollect?.()
  if (extraError) {
    localError.value = extraError
    return null
  }

  const normalizedName = name.value.trim()
  if (!normalizedName) {
    localError.value = '请填写凭据名称，用于区分多份配置'
    return null
  }
  if (normalizedName.length > 30) {
    localError.value = '凭据名称最多 30 个字符'
    return null
  }

  const credentials: Record<string, string> = {}
  for (const schema of visibleSchemas.value) {
    const rawValue = values[schema.variable] ?? ''
    const isMasked = maskedFields.value.has(schema.variable)
    if (schema.required && !rawValue && !isMasked) {
      localError.value = `${pickI18n(schema.label, schema.variable)}不能为空`
      if (!schema.required) advancedOpen.value = ['advanced']
      return null
    }
    if (rawValue !== '') {
      credentials[schema.variable] = String(rawValue)
    } else if (isMasked) {
      // 必须原样回传 [__HIDDEN__]，字段缺失等于把它清空
      credentials[schema.variable] = HIDDEN_VALUE
    } else if (!schema.required) {
      credentials[schema.variable] = ''
    }
  }
  return { name: normalizedName, credentials }
}

function submit(): void {
  const payload = collect()
  if (payload) emit('submit', payload)
}

function validate(): void {
  const payload = collect()
  if (payload) emit('validate', payload)
}

function close(): void {
  if (busy.value) return
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="model-config-dialog"
    width="700px"
    top="5vh"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-head">
        <div class="dialog-icon">
          <el-icon><Key /></el-icon>
        </div>
        <div class="dialog-heading">
          <span class="dialog-eyebrow">MODEL CREDENTIAL</span>
          <div class="dialog-title-line">
            <span class="dialog-title">{{ title }}</span>
            <span v-if="subtitle" class="dialog-subtitle">{{ subtitle }}</span>
          </div>
        </div>
      </div>
    </template>

    <el-alert v-if="error || localError" class="feedback" type="error" :closable="false" show-icon>
      <template #title>保存失败</template>
      <pre class="feedback-detail">{{ error || localError }}</pre>
    </el-alert>

    <el-alert
      v-else-if="validateResult"
      class="feedback"
      :type="validateResult.ok ? 'success' : 'error'"
      :closable="false"
      show-icon
    >
      <template #title>{{ validateResult.ok ? '连接正常' : '连接失败' }}</template>
      <pre v-if="!validateResult.ok" class="feedback-detail">{{ validateResult.message }}</pre>
      <template v-else>{{ validateResult.message }}</template>
    </el-alert>

    <div class="security-note">
      <el-icon><WarningFilled /></el-icon>
      <span>
        保存前会向模型服务发起一次真实连接校验；密钥仅用于 AI 模型服务配置，不会在页面明文回显。
      </span>
    </div>

    <el-form label-position="top" class="credential-form" @submit.prevent>
      <section class="form-section">
        <div class="section-head">
          <span class="section-index">01</span>
          <div>
            <h4>基础信息</h4>
            <p>用于识别当前配置及其对应的模型服务。</p>
          </div>
        </div>

        <slot name="before-fields"></slot>

        <el-form-item required>
          <template #label>
            凭据名称
            <span class="label-hint">同一供应商下不可重名，最多 30 字</span>
          </template>
          <el-input
            v-model="name"
            maxlength="30"
            show-word-limit
            placeholder="例如：生产 Key、测试 Key"
          />
        </el-form-item>
      </section>

      <section v-if="primarySchemas.length" class="form-section">
        <div class="section-head">
          <span class="section-index">02</span>
          <div>
            <h4>连接配置</h4>
            <p>填写插件要求的必填参数，字段由 AI 模型服务动态提供。</p>
          </div>
        </div>

        <el-form-item
          v-for="schema in primarySchemas"
          :key="schema.variable"
          :label="pickI18n(schema.label, schema.variable)"
          required
        >
          <el-input
            v-if="schema.type === 'text-input' || schema.type === 'secret-input'"
            v-model="values[schema.variable]"
            :type="schema.type === 'secret-input' ? 'password' : 'text'"
            :show-password="schema.type === 'secret-input'"
            :placeholder="placeholder(schema)"
          />
          <el-select
            v-else-if="schema.type === 'select'"
            v-model="values[schema.variable]"
            class="full-width"
            :placeholder="placeholder(schema)"
          >
            <el-option
              v-for="option in schema.options || []"
              :key="option.value"
              :label="optionLabel(option)"
              :value="String(option.value)"
            />
          </el-select>
          <el-radio-group v-else-if="schema.type === 'radio'" v-model="values[schema.variable]">
            <el-radio
              v-for="option in schema.options || []"
              :key="option.value"
              :value="String(option.value)"
            >
              {{ optionLabel(option) }}
            </el-radio>
          </el-radio-group>
          <el-switch
            v-else-if="schema.type === 'switch'"
            v-model="values[schema.variable]"
            active-value="true"
            inactive-value="false"
          />
          <el-input v-else v-model="values[schema.variable]" :placeholder="placeholder(schema)" />
        </el-form-item>
      </section>

      <section v-if="advancedSchemas.length" class="form-section advanced-section">
        <el-collapse v-model="advancedOpen" class="advanced">
          <el-collapse-item name="advanced">
            <template #title>
              <div class="section-head advanced-head">
                <span class="section-index">03</span>
                <div>
                  <h4>高级参数</h4>
                  <p>{{ advancedSchemas.length }} 项可选配置，留空时使用插件默认值。</p>
                </div>
              </div>
            </template>
            <div class="advanced-fields">
              <el-form-item
                v-for="schema in advancedSchemas"
                :key="schema.variable"
                :label="pickI18n(schema.label, schema.variable)"
              >
                <el-input
                  v-if="schema.type === 'text-input' || schema.type === 'secret-input'"
                  v-model="values[schema.variable]"
                  :type="schema.type === 'secret-input' ? 'password' : 'text'"
                  :show-password="schema.type === 'secret-input'"
                  :placeholder="placeholder(schema)"
                />
                <el-select
                  v-else-if="schema.type === 'select'"
                  v-model="values[schema.variable]"
                  class="full-width"
                  :placeholder="placeholder(schema)"
                >
                  <el-option
                    v-for="option in schema.options || []"
                    :key="option.value"
                    :label="optionLabel(option)"
                    :value="String(option.value)"
                  />
                </el-select>
                <el-radio-group
                  v-else-if="schema.type === 'radio'"
                  v-model="values[schema.variable]"
                >
                  <el-radio
                    v-for="option in schema.options || []"
                    :key="option.value"
                    :value="String(option.value)"
                  >
                    {{ optionLabel(option) }}
                  </el-radio>
                </el-radio-group>
                <el-switch
                  v-else-if="schema.type === 'switch'"
                  v-model="values[schema.variable]"
                  active-value="true"
                  inactive-value="false"
                />
                <el-input
                  v-else
                  v-model="values[schema.variable]"
                  :placeholder="placeholder(schema)"
                />
              </el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>
      </section>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <el-button v-if="showDelete" type="danger" plain :disabled="busy" @click="emit('delete')">
            删除凭据
          </el-button>
        </div>
        <div class="footer-actions">
          <el-button :disabled="busy" @click="close">取消</el-button>
          <el-button
            :icon="Connection"
            :loading="validating"
            :disabled="submitting"
            @click="validate"
          >
            {{ validating ? '连接中…' : '测试连接' }}
          </el-button>
          <el-button
            type="primary"
            :icon="CircleCheck"
            :loading="submitting"
            :disabled="validating"
            @click="submit"
          >
            {{ submitting ? '校验并保存中…' : editing ? '保存修改' : '保存配置' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dialog-icon {
  display: grid;
  width: 38px;
  height: 38px;
  font-size: 18px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 10px;
  flex: 0 0 38px;
  place-items: center;
}

.dialog-heading {
  min-width: 0;
}

.dialog-eyebrow {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--el-color-primary);
}

.dialog-title-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.dialog-title {
  font-size: 17px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.dialog-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.feedback {
  margin-bottom: 16px;
  border-radius: 8px;
}

.feedback-detail {
  max-height: 180px;
  margin: 4px 0 0;
  overflow: auto;
  font-family: var(--el-font-family-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  user-select: text;
}

.credential-form :deep(.el-form-item) {
  margin-bottom: 17px;
}

.security-note {
  display: flex;
  padding: 10px 12px;
  margin-bottom: 16px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
  background: var(--el-color-info-light-9);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  align-items: flex-start;
  gap: 8px;
}

.security-note .el-icon {
  flex: none;
  margin-top: 2px;
  color: var(--el-color-info);
}

.form-section {
  padding: 17px 18px 1px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.form-section + .form-section {
  margin-top: 14px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 17px;
}

.section-index {
  display: inline-grid;
  width: 26px;
  height: 26px;
  font-size: 10px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 7px;
  flex: 0 0 26px;
  place-items: center;
}

.section-head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-head p {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}

.label-hint {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.full-width {
  width: 100%;
}

.advanced {
  border-top: none;
  border-bottom: none;
}

.advanced-section {
  padding-bottom: 0;
}

.advanced-head {
  margin: 0;
}

.advanced :deep(.el-collapse-item__header) {
  height: auto;
  padding-bottom: 16px;
  border-bottom: none;
}

.advanced :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.advanced-fields {
  padding-top: 4px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

@media (width <= 720px) {
  .dialog-title-line {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }

  .dialog-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .footer-actions {
    justify-content: flex-end;
    margin-left: 0;
  }
}

:global(.model-config-dialog) {
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgb(15 23 42 / 18%);
}

:global(.model-config-dialog .el-dialog__header) {
  padding: 18px 22px;
  margin-right: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.model-config-dialog .el-dialog__body) {
  max-height: calc(90vh - 156px);
  padding: 18px 22px 20px;
  overflow-y: auto;
  background: var(--el-fill-color-extra-light);
}

:global(.model-config-dialog .el-dialog__footer) {
  padding: 14px 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
