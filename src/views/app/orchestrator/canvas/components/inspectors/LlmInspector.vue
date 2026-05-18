<script setup lang="ts">
import { reactive, watch } from 'vue'
import { MODEL_OPTIONS } from '../../constants'
import type { LlmNodeData } from '../../types'

interface Props {
  nodeData: LlmNodeData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: LlmNodeData): void
}>()

const formData = reactive<LlmNodeData>(cloneData(props.nodeData))

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
      <el-input
        v-model="formData.systemPrompt"
        type="textarea"
        :rows="6"
        maxlength="4000"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="用户提示词模板">
      <el-input
        v-model="formData.userPromptTemplate"
        type="textarea"
        :rows="3"
        maxlength="2000"
        placeholder="{{#sys.query#}}"
      />
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
        <el-form-item label="Temperature">
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
        <el-form-item label="启用记忆">
          <el-switch v-model="formData.memory.enabled" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="记忆窗口">
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
.footer {
  display: flex;
  margin-top: 8px;
  justify-content: flex-end;
}
</style>
