<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
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

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="节点标题">
      <el-input v-model="formData.title" maxlength="40" />
    </el-form-item>

    <el-form-item label="系统提示词" required>
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
</template>

<style scoped lang="less">
.form-tip {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

.footer {
  display: flex;
  margin-top: 8px;
  justify-content: flex-end;
}
</style>
