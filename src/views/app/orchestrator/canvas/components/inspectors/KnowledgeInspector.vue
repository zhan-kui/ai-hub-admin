<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { knowledgeApi } from '@/api/knowledge'
import type { DatasetVO } from '@/api/knowledge/types'
import type { KnowledgeRetrievalNodeData } from '../../types'

interface Props {
  nodeData: KnowledgeRetrievalNodeData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: KnowledgeRetrievalNodeData): void
}>()

const formData = reactive<KnowledgeRetrievalNodeData>(normalizeData(props.nodeData))
const datasetLoading = ref(false)
const datasets = ref<DatasetVO[]>([])

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, normalizeData(value))
  },
  { deep: true, immediate: true }
)

const selectedDatasets = computed(() => {
  const datasetMap = new Map(datasets.value.map((item) => [String(item.id), item]))
  return (formData.datasetIds || [])
    .map((id) => datasetMap.get(String(id)))
    .filter((item): item is DatasetVO => Boolean(item))
})

const unknownDatasetIds = computed(() => {
  const datasetIds = new Set(datasets.value.map((item) => String(item.id)))
  return (formData.datasetIds || []).filter((id) => !datasetIds.has(String(id)))
})

function handleSave() {
  emit('save', cloneData(formData))
}

function removeDataset(id: string) {
  formData.datasetIds = (formData.datasetIds || []).filter((item) => String(item) !== String(id))
}

function datasetMeta(dataset: DatasetVO): string {
  const documents = Number(dataset.documentCount || dataset.totalDocuments || 0)
  return `${documents} 个文档 · ${dataset.visibilityName || visibilityText(dataset.visibility)}`
}

function techniqueText(value?: string): string {
  if (value === 'high_quality') return '高质量'
  if (value === 'economy') return '经济'
  return '知识库'
}

function visibilityText(value?: string): string {
  if (value === 'private') return '私有'
  if (value === 'team') return '团队'
  if (value === 'dept') return '部门'
  if (value === 'public') return '公开'
  if (value === 'custom') return '自定义'
  return '默认'
}

async function loadDatasets() {
  datasetLoading.value = true
  try {
    const all: DatasetVO[] = []
    let page = 1
    const limit = 100
    let hasMore = true
    while (hasMore && page <= 20) {
      const response = await knowledgeApi.list({
        page,
        limit,
        status: 'active'
      })
      const records = response.records || []
      all.push(...records)
      hasMore = all.length < Number(response.total || 0) && records.length > 0
      page += 1
    }
    datasets.value = all
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库列表加载失败')
  } finally {
    datasetLoading.value = false
  }
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeData(value: KnowledgeRetrievalNodeData): KnowledgeRetrievalNodeData {
  const cloned = cloneData(value)
  cloned.datasetIds = Array.from(new Set((cloned.datasetIds || []).map((id) => String(id))))
  return cloned
}

onMounted(() => {
  void loadDatasets()
})
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="节点标题">
      <el-input v-model="formData.title" maxlength="40" />
    </el-form-item>

    <el-form-item label="知识库">
      <div class="dataset-picker">
        <el-select
          v-model="formData.datasetIds"
          class="dataset-select"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="2"
          :loading="datasetLoading"
          placeholder="选择一个或多个知识库"
        >
          <el-option
            v-for="dataset in datasets"
            :key="dataset.id"
            :label="dataset.name"
            :value="dataset.id"
          >
            <div class="dataset-option">
              <div class="dataset-option-main">
                <strong>{{ dataset.name }}</strong>
                <span>{{ datasetMeta(dataset) }}</span>
              </div>
              <em>
                {{ dataset.indexingTechniqueName || techniqueText(dataset.indexingTechnique) }}
              </em>
            </div>
          </el-option>
        </el-select>

        <div class="dataset-summary">
          <span>已选择 {{ formData.datasetIds?.length || 0 }} 个知识库</span>
          <el-button link type="primary" :loading="datasetLoading" @click="loadDatasets">
            刷新
          </el-button>
        </div>

        <div v-if="selectedDatasets.length || unknownDatasetIds.length" class="selected-list">
          <div v-for="dataset in selectedDatasets" :key="dataset.id" class="selected-item">
            <div class="selected-mark">{{ dataset.name.charAt(0).toUpperCase() }}</div>
            <div class="selected-info">
              <strong>{{ dataset.name }}</strong>
              <span>{{ datasetMeta(dataset) }}</span>
            </div>
            <el-button link type="danger" @click="removeDataset(dataset.id)">移除</el-button>
          </div>
          <div v-for="id in unknownDatasetIds" :key="id" class="selected-item unknown">
            <div class="selected-mark">ID</div>
            <div class="selected-info">
              <strong>未在列表中</strong>
              <span>{{ id }}</span>
            </div>
            <el-button link type="danger" @click="removeDataset(id)">移除</el-button>
          </div>
        </div>
        <el-empty v-else class="dataset-empty" :image-size="48" description="暂未选择知识库" />
      </div>
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

.dataset-picker {
  width: 100%;
}

.dataset-select {
  width: 100%;
}

.dataset-select :deep(.el-select__wrapper) {
  min-height: 40px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
}

.dataset-select :deep(.el-tag) {
  border-radius: 6px;
}

.dataset-option {
  display: flex;
  width: 100%;
  height: 48px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
}

.dataset-option-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.dataset-option-main strong {
  overflow: hidden;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dataset-option-main span {
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dataset-option em {
  padding: 2px 8px;
  font-size: 12px;
  font-style: normal;
  line-height: 20px;
  color: #0f766e;
  background: #d9f3ec;
  border-radius: 999px;
  flex: 0 0 auto;
}

.dataset-summary {
  display: flex;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  align-items: center;
  justify-content: space-between;
}

.selected-list {
  display: flex;
  max-height: 240px;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  overflow: auto;
}

.selected-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.selected-item.unknown {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}

.selected-mark {
  display: inline-flex;
  width: 34px;
  height: 34px;
  font-size: 12px;
  font-weight: 700;
  color: #0f766e;
  background: #d9f3ec;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
}

.selected-info {
  min-width: 0;
}

.selected-info strong,
.selected-info span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-info strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.selected-info span {
  margin-top: 3px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dataset-empty {
  padding: 8px 0 0;
}
</style>
