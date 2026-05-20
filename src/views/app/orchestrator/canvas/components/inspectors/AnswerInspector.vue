<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { AnswerNodeData } from '../../types'

interface Props {
  nodeData: AnswerNodeData
  forceStatic?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: AnswerNodeData): void
}>()

const formData = reactive<AnswerNodeData>(cloneData(props.nodeData))

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, cloneData(value))
    if (!formData.answerMode) formData.answerMode = 'auto'
    if (typeof formData.answerText !== 'string') formData.answerText = ''
  },
  { deep: true, immediate: true }
)

watch(
  () => props.forceStatic,
  (forceStatic) => {
    if (!forceStatic) return
    formData.answerMode = 'static'
  },
  { immediate: true }
)

function handleSave() {
  if (props.forceStatic) {
    formData.answerMode = 'static'
  }
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

    <el-form-item label="回复模式">
      <el-radio-group v-model="formData.answerMode" :disabled="props.forceStatic">
        <el-radio-button label="auto">自动引用</el-radio-button>
        <el-radio-button label="static">静态回复</el-radio-button>
      </el-radio-group>
    </el-form-item>

    <el-form-item v-if="formData.answerMode === 'static'" label="回复内容">
      <el-input v-model="formData.answerText" type="textarea" :rows="5" maxlength="4000" />
    </el-form-item>

    <el-alert
      v-if="props.forceStatic"
      title="当前 answer 直接连接在条件分支后，请填写静态回复内容。"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else
      title="Answer 节点内容会根据回复模式生成。auto 模式由后端根据入线自动引用，引用格式为 {{#<llm_id>.text#}}。"
      type="info"
      :closable="false"
      show-icon
    />
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
