<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { knowledgeModelApi } from '@/api/knowledge'
import type { ModelOption as KnowledgeModelOption } from '@/api/knowledge/types'
import type { PromptTemplate } from '@/api/promptTemplate'
import ImportPromptDialog from '@/views/PromptTemplate/components/ImportPromptDialog.vue'
import type { CanvasGraphEdge, CanvasGraphNode, LlmNodeData } from '../../types'
import VariablePicker from '../../variables/VariablePicker.vue'
import { useVariableSources } from '../../variables/useVariableSources'

interface Props {
  nodeId: string
  nodeData: LlmNodeData
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: LlmNodeData): void
}>()

const formData = reactive<LlmNodeData>(cloneData(props.nodeData))
const currentNodeId = computed(() => props.nodeId)
const graphNodes = computed(() => props.nodes)
const graphEdges = computed(() => props.edges)
const systemScene = computed(() => 'system' as const)
const userScene = computed(() => 'user' as const)
const systemSources = useVariableSources(systemScene, currentNodeId, graphNodes, graphEdges)
const userSources = useVariableSources(userScene, currentNodeId, graphNodes, graphEdges)
const importVisible = ref(false)
const loadingModels = ref(false)
const llmModels = ref<KnowledgeModelOption[]>([])
const selectedModelKey = computed({
  get: () => toModelKey(formData.model.provider, formData.model.name),
  set: (value: string) => updateSelectedModel(value)
})
const llmOptions = computed(() => {
  const options = llmModels.value.map((item) => ({
    label: item.name || item.model,
    value: toModelKey(item.provider, item.model),
    provider: item.provider,
    model: item.model
  }))
  const selectedValue = selectedModelKey.value
  if (selectedValue && !options.some((item) => item.value === selectedValue)) {
    options.unshift({
      label: formData.model.name,
      value: selectedValue,
      provider: formData.model.provider,
      model: formData.model.name
    })
  }
  return options
})

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, cloneData(value))
  },
  { deep: true, immediate: true }
)

function toModelKey(provider: string, model: string) {
  if (!model) return ''
  return `${provider}::${model}`
}

function updateSelectedModel(value: string) {
  if (!value) {
    formData.model.provider = ''
    formData.model.name = ''
    return
  }
  const matched = llmOptions.value.find((item) => item.value === value)
  if (matched) {
    formData.model.provider = matched.provider
    formData.model.name = matched.model
  }
}

async function loadLlmModels() {
  if (loadingModels.value || llmModels.value.length) return
  loadingModels.value = true
  try {
    const models = await knowledgeModelApi.getAvailableModels('llm')
    llmModels.value = models || []
  } catch (error: any) {
    ElMessage.error(error?.message || '模型列表加载失败')
  } finally {
    loadingModels.value = false
  }
}

function handleSave() {
  emit('save', cloneData(formData))
}

async function handleImportPrompt(template: PromptTemplate) {
  const currentPrompt = formData.systemPrompt?.trim()
  if (!currentPrompt) {
    formData.systemPrompt = template.content
  } else {
    try {
      await ElMessageBox.confirm('系统提示词已有内容，请选择替换或追加。', '引入提示词', {
        confirmButtonText: '替换',
        cancelButtonText: '追加',
        distinguishCancelAndClose: true,
        type: 'warning'
      })
      formData.systemPrompt = template.content
    } catch (action) {
      if (action !== 'cancel') return
      formData.systemPrompt = `${formData.systemPrompt}\n\n${template.content}`
    }
  }
  ElMessage.success('已引入，请用 / 把 {{占位符}} 替换为变量')
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

onMounted(() => {
  void loadLlmModels()
})
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="节点标题">
      <el-input v-model="formData.title" maxlength="40" />
    </el-form-item>

    <el-form-item required class="system-prompt-item">
      <template #label>
        <div class="prompt-label">
          <span>系统提示词</span>
          <button type="button" class="import-prompt-btn" @click="importVisible = true">
            <span class="import-icon"><Icon icon="tabler:sparkles" /></span>
            <span>
              <strong>引入提示词</strong>
              <em>模板库</em>
            </span>
          </button>
        </div>
      </template>
      <div class="system-prompt-wrap">
        <VariablePicker
          :model-value="formData.systemPrompt"
          :sources="systemSources"
          :rows="6"
          :maxlength="4000"
          :show-word-limit="true"
          placeholder="输入 / 可插入变量，例如：根据用户输入回答问题"
          aria-label="系统提示词"
          @update:model-value="(value) => (formData.systemPrompt = value)"
        />
      </div>
      <div class="form-tip">提示：输入 <code>/</code> 可插入变量。系统提示词不支持文件变量。</div>
    </el-form-item>

    <el-form-item label="用户提示词模板">
      <VariablePicker
        :model-value="formData.userPromptTemplate || ''"
        :sources="userSources"
        :rows="3"
        :maxlength="2000"
        placeholder="例如：/用户输入"
        aria-label="用户提示词"
        @update:model-value="(value) => (formData.userPromptTemplate = value)"
      />
      <div class="form-tip">
        说明：用户提示词仅支持 <code>sys.query</code> 和 <code>sys.files</code>
        引用，自定义文本与其他变量在此处不会生效。
      </div>
    </el-form-item>

    <el-row :gutter="12">
      <el-col :span="14">
        <el-form-item label="模型" required>
          <el-select
            v-model="selectedModelKey"
            filterable
            clearable
            :loading="loadingModels"
            placeholder="请选择模型"
          >
            <el-option
              v-for="item in llmOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="10">
        <el-form-item label="温度">
          <el-input-number
            v-model="formData.model.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            class="w-full"
          />
        </el-form-item>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :span="12">
        <el-form-item label="开启思维链（思考）">
          <el-switch v-model="formData.model.enableThinking" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="推理强度">
          <el-select v-model="formData.model.reasoningEffort">
            <el-option label="low" value="low" />
            <el-option label="medium" value="medium" />
            <el-option label="high" value="high" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :span="12">
        <el-form-item label="开启记忆">
          <el-switch v-model="formData.memory.enabled" />
        </el-form-item>
      </el-col>
      <el-col v-if="formData.memory.enabled" :span="12">
        <el-form-item label="开启记忆窗口">
          <el-switch v-model="formData.memory.windowEnabled" />
        </el-form-item>
      </el-col>
      <el-col v-if="formData.memory.enabled && formData.memory.windowEnabled" :span="12">
        <el-form-item label="记忆窗口数量">
          <el-input-number v-model="formData.memory.windowSize" :min="1" :max="50" class="w-full" />
        </el-form-item>
      </el-col>
    </el-row>
    <div class="form-tip memory-tip">
      开启记忆后会生成 AI 模型服务默认的用户查询模板和 user/assistant 角色配置；关闭后不生成 memory
      配置。
    </div>
  </el-form>

  <div class="footer">
    <el-button type="primary" @click="handleSave">保存配置</el-button>
  </div>

  <ImportPromptDialog v-model="importVisible" @selected="handleImportPrompt" />
</template>

<style scoped lang="less">
.form-tip {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

.prompt-label {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.prompt-label > span {
  min-width: 0;
  font-weight: 600;
}

.system-prompt-item :deep(.el-form-item__label) {
  display: block;
  width: 100%;
  padding-right: 0;
}

.system-prompt-wrap {
  width: 100%;
}

.import-prompt-btn {
  display: inline-flex;
  height: 30px;
  flex: 0 0 auto;
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
  justify-self: end;
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

.footer {
  display: flex;
  margin-top: 8px;
  justify-content: flex-end;
}
</style>
