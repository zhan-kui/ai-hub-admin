<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { KnowledgeRetrievalNodeData } from '../../types'

interface Props {
  nodeData: KnowledgeRetrievalNodeData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: KnowledgeRetrievalNodeData): void
}>()

const formData = reactive<KnowledgeRetrievalNodeData>(cloneData(props.nodeData))

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, cloneData(value))
  },
  { deep: true, immediate: true }
)

const datasetIdsText = computed({
  get: () => formData.datasetIds?.join('\n') || '',
  set: (value: string) => {
    formData.datasetIds = value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }
})

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

    <el-form-item label="知识库 ID">
      <el-input
        v-model="datasetIdsText"
        type="textarea"
        :rows="5"
        placeholder="每行一个 dataset_id"
      />
    </el-form-item>

    <el-form-item label="TopK">
      <el-input-number v-model="formData.topK" :min="1" :max="20" class="w-full" />
    </el-form-item>

    <el-form-item label="Rerank">
      <el-switch v-model="formData.rerankingEnable" />
    </el-form-item>
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
