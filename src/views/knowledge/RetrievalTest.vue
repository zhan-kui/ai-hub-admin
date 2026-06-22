<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Collection } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/api/knowledge'
import type { DatasetVO } from '@/api/knowledge/types'
import RetrieveTester from './components/RetrieveTester.vue'

const loading = ref(false)
const datasets = ref<DatasetVO[]>([])
const selectedId = ref('')

const selectedDataset = computed(
  () => datasets.value.find((item) => item.id === selectedId.value) || null
)

function modeText(dataset: DatasetVO) {
  return dataset.indexingTechnique === 'high_quality' ? '高质量' : '经济'
}

async function loadDatasets() {
  loading.value = true
  try {
    const limit = 100
    let page = 1
    let total = 0
    const all: DatasetVO[] = []

    do {
      const result = await knowledgeApi.list({ page, limit, status: 'active' })
      const current = result.records || []
      all.push(...current)
      total = result.total || all.length
      if (!current.length) break
      page += 1
    } while (all.length < total)

    datasets.value = all
    selectedId.value = all[0]?.id || ''
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库列表加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadDatasets)
</script>

<template>
  <div class="retrieve-page">
    <section class="retrieve-shell">
      <header class="page-hero">
        <div>
          <span>KNOWLEDGE RETRIEVAL</span>
          <h1>检索测试</h1>
          <p>选择任意知识库，调整召回参数并快速验证内容命中效果。</p>
        </div>
        <div class="dataset-total">
          <strong>{{ datasets.length }}</strong>
          <span>可用知识库</span>
        </div>
      </header>

      <div class="retrieve-workspace">
        <aside class="dataset-panel">
          <div class="aside-heading">
            <span class="aside-icon">
              <el-icon><Collection /></el-icon>
            </span>
            <div>
              <h2>选择知识库</h2>
              <p>当前账号可访问的全部知识库</p>
            </div>
          </div>

          <el-select
            v-model="selectedId"
            class="dataset-select"
            filterable
            :loading="loading"
            placeholder="请选择知识库"
          >
            <el-option v-for="item in datasets" :key="item.id" :label="item.name" :value="item.id">
              <div class="dataset-option">
                <span>{{ item.name }}</span>
                <em>{{ modeText(item) }}</em>
              </div>
            </el-option>
          </el-select>

          <div v-if="selectedDataset" class="selected-card">
            <div class="selected-head">
              <span>当前知识库</span>
              <em :class="`mode-${selectedDataset.indexingTechnique}`">
                {{ modeText(selectedDataset) }}
              </em>
            </div>
            <h3>{{ selectedDataset.name }}</h3>
            <p>{{ selectedDataset.description || '暂无知识库描述' }}</p>
            <div class="selected-stats">
              <span>{{ selectedDataset.documentCount || 0 }} 篇文档</span>
              <span>Top K {{ selectedDataset.topK || 3 }}</span>
            </div>
          </div>

          <el-empty v-else-if="!loading" :image-size="72" description="暂无可用知识库" />
        </aside>

        <main class="tester-panel">
          <RetrieveTester
            v-if="selectedDataset"
            :dataset-id="selectedDataset.id"
            :dataset-name="selectedDataset.name"
            :default-top-k="selectedDataset.topK ?? selectedDataset.retrievalModel?.top_k"
            :default-score-threshold="
              selectedDataset.scoreThreshold ?? selectedDataset.retrievalModel?.score_threshold
            "
            :default-score-threshold-enabled="
              selectedDataset.scoreThresholdEnabled ??
              selectedDataset.retrievalModel?.score_threshold_enabled
            "
          />
          <div v-else class="tester-placeholder">
            <el-empty description="选择知识库后即可开始检索测试" />
          </div>
        </main>
      </div>
    </section>
  </div>
</template>

<style scoped lang="less">
:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.retrieve-page {
  --primary: var(--brand-primary, #2563eb);
  --primary-soft: #eaf1ff;
  --panel-soft: #f8faff;
  --border-soft: #e4eaf3;
  --text-main: #172033;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;

  min-height: 100%;
  padding: 24px;
  color: var(--text-main);
  background: #f5f7fb;
}

.retrieve-shell {
  width: 100%;
}

.page-hero {
  position: relative;
  display: flex;
  padding: 22px 24px;
  margin-bottom: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, rgb(255 255 255 / 94%) 0%, rgb(243 247 255 / 90%) 100%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgb(37 99 235 / 5%);
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.page-hero::before {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 0;
  width: 4px;
  background: var(--primary);
  border-radius: 0 999px 999px 0;
  content: '';
}

.page-hero > div > span {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--primary);
}

.page-hero h1 {
  margin: 7px 0 0;
  font-size: 26px;
}

.page-hero p {
  margin: 7px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.dataset-total {
  min-width: 112px;
  padding: 12px 16px;
  text-align: center;
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
}

.dataset-total strong,
.dataset-total span {
  display: block;
}

.dataset-total strong {
  font-family: var(--font-mono);
  font-size: 22px;
}

.dataset-total span {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-secondary);
}

.retrieve-workspace {
  display: grid;
  align-items: start;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
}

.dataset-panel,
.tester-panel {
  padding: 18px;
  background: rgb(248 250 255 / 72%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
}

.aside-heading {
  display: flex;
  margin-bottom: 16px;
  align-items: center;
  gap: 11px;
}

.aside-icon {
  display: grid;
  width: 40px;
  height: 40px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 12px;
  place-items: center;
  flex-shrink: 0;
}

.aside-heading h2 {
  margin: 0;
  font-size: 15px;
}

.aside-heading p {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.dataset-select {
  width: 100%;
}

.dataset-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dataset-option em {
  font-size: 11px;
  font-style: normal;
  color: var(--text-tertiary);
}

.selected-card {
  padding: 14px;
  margin-top: 14px;
  background: #fff;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
}

.selected-head,
.selected-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.selected-head > span {
  font-size: 11px;
  color: var(--text-tertiary);
}

.selected-head em {
  padding: 3px 8px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  border-radius: 999px;
}

.mode-high_quality {
  color: var(--primary);
  background: var(--primary-soft);
}

.mode-economy {
  color: #0f766e;
  background: #ecfdf5;
}

.selected-card h3 {
  margin: 13px 0 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-card p {
  display: -webkit-box;
  min-height: 38px;
  margin: 7px 0 14px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.selected-stats {
  padding-top: 11px;
  font-size: 11px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-soft);
}

.tester-panel {
  min-width: 0;
}

.tester-placeholder {
  display: grid;
  min-height: 420px;
  background: #fff;
  border: 1px dashed var(--border-soft);
  border-radius: 16px;
  place-items: center;
}

@media (width <= 1000px) {
  .retrieve-workspace {
    grid-template-columns: 1fr;
  }
}

@media (width <= 640px) {
  .retrieve-page {
    padding: 16px;
  }

  .page-hero {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
