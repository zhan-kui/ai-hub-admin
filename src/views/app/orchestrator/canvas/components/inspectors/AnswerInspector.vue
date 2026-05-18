<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { AnswerNodeData } from '../../types'

interface Props {
  nodeData: AnswerNodeData
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
  },
  { deep: true, immediate: true }
)

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
    <el-alert
      title="Answer 节点内容由后端根据入线自动生成，不需要手动填写模板。"
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
