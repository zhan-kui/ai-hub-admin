<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { PromptTemplate } from '@/api/promptTemplate'
import ImportPromptDialog from '@/views/PromptTemplate/components/ImportPromptDialog.vue'
import { MODEL_OPTIONS } from '../../constants'
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

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, cloneData(value))
  },
  { deep: true, immediate: true }
)

function handleModelChange(modelName: string) {
  const matched = MODEL_OPTIONS.find((item) => item.value === modelName)
  if (matched) {
    formData.model.provider = matched.provider
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
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="节点标题">
      <el-input v-model="formData.title" maxlength="40" />
    </el-form-item>

    <el-form-item required>
      <template #label>
        <div class="prompt-label">
          <span>系统提示词</span>
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
        <button type="button" class="import-prompt-btn" @click="importVisible = true">
          <span class="import-icon"><Icon icon="tabler:sparkles" /></span>
          <span>
            <strong>引入提示词</strong>
            <em>模板库</em>
          </span>
        </button>
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
        说明：Dify 的 user prompt 仅支持 <code>sys.query</code> 和 <code>sys.files</code>
        引用，自定义文本与其他变量在此处不会生效。
      </div>
    </el-form-item>

    <el-row :gutter="12">
      <el-col :span="14">
        <el-form-item label="模型">
          <el-select v-model="formData.model.name" @change="handleModelChange">
            <el-option
              v-for="item in MODEL_OPTIONS"
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
        <el-form-item label="启用思考">
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
        <el-form-item label="记忆窗口配置">
          <el-switch v-model="formData.memory.enabled" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="记忆窗口数量">
          <el-input-number v-model="formData.memory.windowSize" :min="1" :max="50" class="w-full" />
        </el-form-item>
      </el-col>
    </el-row>
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
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.system-prompt-wrap {
  position: relative;
  width: 100%;

  :deep(.vp-textarea),
  :deep(.vp-highlight-layer) {
    padding-top: 42px;
  }
}

.import-prompt-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
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

.footer {
  display: flex;
  margin-top: 8px;
  justify-content: flex-end;
}
</style>
