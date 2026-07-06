<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { promptTemplateApi } from '@/api/promptTemplate'
import type {
  PromptCategory,
  PromptCategoryCode,
  PromptSaveRequest,
  PromptTemplate,
  PromptVariable
} from '@/api/promptTemplate'
import { useWritingStream } from '@/views/ai/writing/composables/useWritingStream'
import type { WritingStreamPayload } from '@/views/ai/writing/types'
import { extractVariables, mergeVariableDescriptions } from '../composables/usePromptVariables'

type AssistMode = 'generate' | 'polish' | 'continue'

const props = defineProps<{
  modelValue: boolean
  template?: PromptTemplate | null
  categories: PromptCategory[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'saved', template: PromptTemplate): void
}>()

const formRef = ref<FormInstance>()
const saving = ref(false)
const aiSuggestion = ref('')
const aiError = ref('')
const assistMode = ref<AssistMode>('polish')
const assistBaseContent = ref('')
const form = reactive<PromptSaveRequest>({
  title: '',
  description: '',
  content: '',
  category: 'other',
  icon: '',
  variables: []
})

const rules: FormRules<PromptSaveRequest> = {
  title: [
    { required: true, message: '请输入提示词标题', trigger: 'blur' },
    { max: 80, message: '标题不能超过 80 个字符', trigger: 'blur' }
  ],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  description: [{ max: 255, message: '描述不能超过 255 个字符', trigger: 'blur' }],
  content: [{ required: true, message: '请输入提示词正文', trigger: 'blur' }]
}

const { isStreaming, start, stop, reset } = useWritingStream()
const drawerTitle = computed(() => (props.template?.id ? '编辑提示词' : '创建提示词'))
const variables = computed(() => form.variables || [])

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    const source = props.template
    Object.assign(form, {
      title: source?.title || '',
      description: source?.description || '',
      content: source?.content || '',
      category: source?.category || props.categories[0]?.code || 'other',
      icon: source?.icon || '',
      variables: (source?.variables || []).map((variable) => ({ ...variable }))
    })
    aiSuggestion.value = ''
    aiError.value = ''
    nextTick(() => formRef.value?.clearValidate())
  },
  { immediate: true }
)

watch(
  () => form.content,
  (content) => {
    form.variables = mergeVariableDescriptions(extractVariables(content), form.variables || [])
  }
)

function buildAssistPayload(mode: AssistMode): WritingStreamPayload | null {
  const placeholderRule =
    '必须完整保留所有 {{占位符}}，占位符名称、数量和花括号格式不得改变。只输出提示词正文，不要解释。'

  if (mode === 'generate') {
    const brief = [form.title.trim(), form.description?.trim()].filter(Boolean).join('：')
    if (!brief) return null
    return {
      action: 'continue',
      query: `请根据主题与说明生成一份可复用的专业提示词模板；需要用户补充的信息使用 {{变量名}} 留位。${placeholderRule}`,
      inputs: {
        selected_text: brief,
        prefix_context: '',
        suffix_context: '',
        length_limit: '500字以内'
      }
    }
  }

  if (!form.content.trim()) return null
  if (mode === 'polish') {
    return {
      action: 'polish',
      query: `请润色这份提示词，使其目标明确、约束清晰、结构合理。${placeholderRule}`,
      inputs: {
        selected_text: form.content,
        prefix_context: '',
        suffix_context: '',
        length_limit: '与原文字数接近'
      }
    }
  }

  return {
    action: 'continue',
    query: `请自然续写并完善这份提示词模板，补充必要约束和输出要求。${placeholderRule}`,
    inputs: {
      selected_text: form.content,
      prefix_context: form.content,
      suffix_context: '',
      length_limit: '300字以内'
    }
  }
}

async function runAssist(mode: AssistMode) {
  const payload = buildAssistPayload(mode)
  if (!payload) {
    ElMessage.warning(mode === 'generate' ? '请先填写标题或描述' : '请先填写提示词正文')
    return
  }

  assistMode.value = mode
  assistBaseContent.value = form.content
  aiSuggestion.value = ''
  aiError.value = ''
  await start(payload, {
    onChunk: (text) => {
      aiSuggestion.value = (aiSuggestion.value + text).replace(/^\s+/, '')
    },
    onReplace: (text) => {
      aiSuggestion.value = text.replace(/^\s+/, '')
    },
    onError: (error) => {
      aiError.value = error.message || 'AI 生成失败，请稍后重试'
    }
  })
}

function variableSignature(content: string) {
  return extractVariables(content)
    .map((variable) => variable.name)
    .sort()
    .join('|')
}

async function adoptSuggestion() {
  if (!aiSuggestion.value) return
  const nextContent =
    assistMode.value === 'continue'
      ? `${assistBaseContent.value.trimEnd()}\n\n${aiSuggestion.value.trim()}`
      : aiSuggestion.value.trim()
  if (
    assistMode.value !== 'generate' &&
    variableSignature(assistBaseContent.value) !== variableSignature(nextContent)
  ) {
    try {
      await ElMessageBox.confirm(
        'AI 建议中的占位符与原正文不同，采用后请检查变量清单。是否继续？',
        '占位符变化提醒',
        { type: 'warning', confirmButtonText: '继续采用', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  form.content = nextContent
  aiSuggestion.value = ''
  ElMessage.success('已采用 AI 建议')
}

async function closeDrawer() {
  await reset()
  emit('update:modelValue', false)
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload: PromptSaveRequest = {
    title: form.title.trim(),
    description: form.description?.trim() || undefined,
    content: form.content,
    category: form.category as PromptCategoryCode,
    icon: form.icon?.trim() || undefined,
    variables: (form.variables || []).map((variable: PromptVariable) => ({
      name: variable.name,
      description: variable.description?.trim() || ''
    }))
  }

  saving.value = true
  try {
    const saved = props.template?.id
      ? await promptTemplateApi.update(props.template.id, payload)
      : await promptTemplateApi.create(payload)
    ElMessage.success(props.template?.id ? '提示词更新成功' : '提示词创建成功')
    emit('saved', saved)
    await closeDrawer()
  } catch (error: any) {
    ElMessage.error(error?.message || '提示词保存失败')
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  void stop()
})
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="drawerTitle"
    direction="rtl"
    size="min(760px, 100%)"
    class="prompt-edit-drawer"
    :close-on-click-modal="false"
    @close="closeDrawer"
  >
    <div class="prompt-edit">
      <div class="ai-toolbar">
        <button type="button" class="ai-btn" :disabled="isStreaming" @click="runAssist('generate')">
          <Icon icon="tabler:sparkles" /> 生成
        </button>
        <button type="button" class="ai-btn" :disabled="isStreaming" @click="runAssist('polish')">
          <Icon icon="tabler:wand" /> 润色
        </button>
        <button type="button" class="ai-btn" :disabled="isStreaming" @click="runAssist('continue')">
          <Icon icon="tabler:writing" /> 续写
        </button>
        <el-button v-if="isStreaming" size="small" text type="danger" @click="stop"
          >停止生成</el-button
        >
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-row :gutter="14">
          <el-col :xs="24" :sm="15">
            <el-form-item label="标题" prop="title">
              <el-input
                v-model="form.title"
                maxlength="80"
                show-word-limit
                placeholder="给模板起个清晰的名字"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="9">
            <el-form-item label="分类" prop="category">
              <el-select v-model="form.category" class="w-full" placeholder="请选择分类">
                <el-option
                  v-for="item in categories"
                  :key="item.code"
                  :label="item.name"
                  :value="item.code"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            maxlength="255"
            show-word-limit
            placeholder="简要说明用途和适用场景"
          />
        </el-form-item>

        <el-form-item label="提示词正文" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="11"
            resize="vertical"
            placeholder="输入提示词正文，需要留位的内容使用 {{占位符}}"
          />
        </el-form-item>
      </el-form>

      <div v-if="isStreaming || aiSuggestion || aiError" class="ai-suggest">
        <div class="suggest-head">
          <strong>AI 建议</strong>
          <span v-if="isStreaming"><Icon icon="tabler:loader-2" class="spinning" /> 正在生成</span>
        </div>
        <p v-if="aiError" class="ai-error">{{ aiError }}</p>
        <div v-else class="suggest-content">{{ aiSuggestion || '正在思考…' }}</div>
        <div v-if="aiSuggestion && !isStreaming" class="suggest-actions">
          <el-button size="small" type="primary" @click="adoptSuggestion">采用</el-button>
          <el-button size="small" @click="aiSuggestion = ''">丢弃</el-button>
        </div>
      </div>

      <section class="variables-section">
        <div class="section-title">
          <strong>变量清单</strong>
          <span>正文中的 &#123;&#123;占位符&#125;&#125; 会自动解析</span>
        </div>
        <div v-if="variables.length" class="variable-list">
          <div v-for="variable in variables" :key="variable.name" class="variable-row">
            <code>{{ variable.name }}</code>
            <el-input v-model="variable.description" placeholder="填写变量说明（可选）" />
          </div>
        </div>
        <div v-else class="empty-vars">尚未识别到占位变量</div>
      </section>
    </div>

    <template #footer>
      <el-button @click="closeDrawer">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-drawer>
</template>

<style lang="less">
@import url('@/styles/prompt-template.less');

.prompt-edit-drawer {
  box-shadow: @shadow-drawer;

  .el-drawer__header {
    padding-bottom: 14px;
    margin-bottom: 0;
    font-weight: 700;
    color: @text-main;
    border-bottom: 1px solid @border;
  }

  .el-input__wrapper,
  .el-select__wrapper {
    border-radius: @radius-control;
  }
}

.prompt-edit {
  max-width: 760px;

  .ai-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .ai-btn {
    display: inline-flex;
    height: 32px;
    padding: 0 12px;
    font: inherit;
    font-size: 12.5px;
    color: @text-secondary;
    cursor: pointer;
    background: #fff;
    border: 1px solid @border;
    border-radius: @radius-control;
    align-items: center;
    gap: 5px;

    &:hover:not(:disabled) {
      color: @primary-strong;
      background: @primary-softer;
      border-color: @var-border;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }

  .ai-suggest {
    padding: 12px;
    margin-top: 10px;
    background: @primary-softer;
    border: 1px solid @var-border;
    border-radius: 12px;
  }

  .suggest-head,
  .suggest-actions,
  .section-title,
  .variable-row {
    display: flex;
    align-items: center;
  }

  .suggest-head {
    font-size: 12px;
    color: @primary-strong;
    justify-content: space-between;

    span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: @text-secondary;
    }
  }

  .suggest-content {
    margin-top: 9px;
    font-size: 13px;
    line-height: 1.7;
    color: @text-main;
    white-space: pre-wrap;
  }

  .suggest-actions {
    justify-content: flex-end;
    margin-top: 10px;
  }

  .ai-error {
    margin: 9px 0 0;
    font-size: 12px;
    color: var(--el-color-danger);
  }
}

.variables-section {
  padding-top: 16px;
  margin-top: 18px;
  border-top: 1px solid @border;
}

.section-title {
  margin-bottom: 10px;
  font-size: 13px;
  color: @text-main;
  justify-content: space-between;

  span {
    font-size: 11px;
    color: @text-muted;
  }
}

.variable-list {
  display: grid;
  gap: 8px;
}

.variable-row {
  gap: 10px;

  code {
    min-width: 105px;
    padding: 6px 8px;
    overflow: hidden;
    font-size: 12px;
    color: @var-color;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: @var-bg;
    border: 1px solid @var-border;
    border-radius: 8px;
  }
}

.empty-vars {
  padding: 18px;
  font-size: 12px;
  color: @text-muted;
  text-align: center;
  border: 1px dashed @border-strong;
  border-radius: 10px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
