<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { knowledgeApi, knowledgeDocApi } from '@/api/knowledge'
import type { KnowledgeRetrieveRecord } from '@/api/knowledge/types'

const props = withDefaults(
  defineProps<{
    datasetId: string
    datasetName?: string
    defaultTopK?: number | null
    defaultScoreThreshold?: number | null
    defaultScoreThresholdEnabled?: boolean
  }>(),
  {
    datasetName: '',
    defaultTopK: 3,
    defaultScoreThreshold: 0.5,
    defaultScoreThresholdEnabled: false
  }
)

const loading = ref(false)
const query = ref('')
const topK = ref(3)
const scoreThresholdEnabled = ref(false)
const scoreThreshold = ref(0.5)
const records = ref<KnowledgeRetrieveRecord[]>([])
const searched = ref(false)
const documentNames = ref<Record<string, string>>({})
const expandedRecordKeys = ref<string[]>([])
let documentLoadToken = 0

function resetParameters() {
  topK.value = Math.max(1, Number(props.defaultTopK) || 3)
  scoreThreshold.value = Number(props.defaultScoreThreshold ?? 0.5)
  scoreThresholdEnabled.value = Boolean(props.defaultScoreThresholdEnabled)
  records.value = []
  searched.value = false
  expandedRecordKeys.value = []
}

function documentName(item: KnowledgeRetrieveRecord) {
  const documentId = item.segment?.document_id || item.segment?.document?.id || ''
  return item.segment?.document?.name || documentNames.value[documentId] || '未知来源文档'
}

function resultContent(item: KnowledgeRetrieveRecord) {
  return item.segment?.content || item.segment?.answer || item.summary || '暂无可展示的分段内容'
}

function scoreText(score?: number) {
  if (score == null || !Number.isFinite(Number(score))) return ''
  return `${(Number(score) * 100).toFixed(1)}%`
}

function recordKey(item: KnowledgeRetrieveRecord, index: number) {
  return item.segment?.id || `${item.segment?.document_id || 'record'}-${index}`
}

function isExpanded(item: KnowledgeRetrieveRecord, index: number) {
  return expandedRecordKeys.value.includes(recordKey(item, index))
}

function hasMoreDetails(item: KnowledgeRetrieveRecord) {
  const content = resultContent(item)
  const hasAnswer = Boolean(item.segment?.answer && item.segment.answer !== item.segment.content)
  return content.length > 160 || content.split(/\r?\n/).length > 5 || hasAnswer
}

function toggleDetails(item: KnowledgeRetrieveRecord, index: number) {
  const key = recordKey(item, index)
  expandedRecordKeys.value = isExpanded(item, index)
    ? expandedRecordKeys.value.filter((itemKey) => itemKey !== key)
    : [...expandedRecordKeys.value, key]
}

async function loadDocumentNames(datasetId: string) {
  const token = ++documentLoadToken
  documentNames.value = {}
  if (!datasetId) return

  try {
    const names: Record<string, string> = {}
    const limit = 100
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await knowledgeDocApi.list(datasetId, { page, limit })
      const documents = result.data || []
      documents.forEach((document) => {
        names[document.id] = document.name
      })
      hasMore = Boolean(result.has_more) && documents.length > 0
      page += 1
    }

    if (token === documentLoadToken) {
      documentNames.value = names
    }
  } catch (error: any) {
    if (token === documentLoadToken) {
      ElMessage.warning(error?.message || '文档名称加载失败，召回内容仍可正常查看')
    }
  }
}

async function submit() {
  const text = query.value.trim()
  if (!text) {
    ElMessage.warning('请输入检索内容')
    return
  }
  if (!props.datasetId) {
    ElMessage.warning('请先选择知识库')
    return
  }
  loading.value = true
  try {
    const res = await knowledgeApi.retrieve(props.datasetId, {
      query: text,
      external_retrieval_model: {
        top_k: Math.max(1, Math.floor(Number(topK.value) || 3)),
        score_threshold: Number(scoreThreshold.value),
        score_threshold_enabled: scoreThresholdEnabled.value
      }
    })
    records.value = Array.isArray(res?.records) ? res.records : []
    searched.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || '检索测试失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => [
    props.datasetId,
    props.defaultTopK,
    props.defaultScoreThreshold,
    props.defaultScoreThresholdEnabled
  ],
  resetParameters,
  { immediate: true }
)

watch(
  () => props.datasetId,
  (datasetId) => void loadDocumentNames(datasetId),
  { immediate: true }
)
</script>

<template>
  <div class="retrieve-tester">
    <section class="query-panel">
      <div class="panel-heading">
        <div>
          <span>RETRIEVAL QUERY</span>
          <h3>输入检索内容</h3>
        </div>
        <em v-if="datasetName">{{ datasetName }}</em>
      </div>

      <div class="retrieve-input">
        <el-input
          v-model="query"
          type="textarea"
          :rows="3"
          maxlength="250"
          show-word-limit
          resize="none"
          placeholder="输入问题或关键词，查看知识库中最相关的内容"
          @keyup.ctrl.enter="submit"
        />
        <el-button type="primary" :icon="Search" :loading="loading" @click="submit">
          开始检索
        </el-button>
      </div>

      <div class="parameter-row">
        <div class="parameter-item">
          <div class="parameter-head">
            <div class="parameter-copy">
              <strong>召回数量</strong>
              <span>最多返回的相关分段数</span>
            </div>
          </div>
          <el-input-number v-model="topK" :min="1" :precision="0" controls-position="right" />
        </div>
        <div class="parameter-item threshold-item">
          <div class="parameter-head">
            <div class="parameter-copy">
              <strong>相关度阈值</strong>
              <span>过滤低于指定分数的内容</span>
            </div>
            <el-switch v-model="scoreThresholdEnabled" />
          </div>
          <el-input-number
            v-model="scoreThreshold"
            :min="0"
            :max="1"
            :step="0.1"
            :precision="2"
            :disabled="!scoreThresholdEnabled"
            controls-position="right"
          />
        </div>
      </div>
      <p class="shortcut-hint">快捷键：Ctrl + Enter</p>
    </section>

    <section v-if="records.length" class="result-panel">
      <div class="result-summary">
        <div>
          <span>RETRIEVAL RESULT</span>
          <h3>召回结果</h3>
        </div>
        <em>共 {{ records.length }} 条</em>
      </div>

      <div class="retrieve-list">
        <article
          v-for="(item, index) in records"
          :key="item.segment?.id || index"
          class="retrieve-item"
        >
          <div class="retrieve-head">
            <div class="document-title">
              <span class="result-index">{{ index + 1 }}</span>
              <div>
                <strong>{{ documentName(item) }}</strong>
                <small v-if="item.segment?.position != null">
                  文档分段 #{{ item.segment.position }}
                </small>
              </div>
            </div>
            <span v-if="scoreText(item.score)" class="score-tag">{{ scoreText(item.score) }}</span>
          </div>
          <p class="result-content" :class="{ expanded: isExpanded(item, index) }">
            {{ resultContent(item) }}
          </p>
          <div class="detail-action">
            <button
              v-if="hasMoreDetails(item)"
              type="button"
              class="detail-toggle"
              @click="toggleDetails(item, index)"
            >
              {{ isExpanded(item, index) ? '收起详情' : '查看详情' }}
            </button>
          </div>
          <div
            v-if="
              isExpanded(item, index) &&
              item.segment?.answer &&
              item.segment.answer !== item.segment.content
            "
            class="result-answer"
          >
            <span>参考答案</span>
            <p>{{ item.segment.answer }}</p>
          </div>
        </article>
      </div>
    </section>

    <div v-else class="empty-panel">
      <el-empty
        :description="
          searched ? '没有召回到相关内容，请尝试调整关键词或检索参数' : '输入内容后开始检索测试'
        "
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.retrieve-tester {
  display: grid;
  gap: 16px;
}

.query-panel,
.result-panel,
.empty-panel {
  background: #fff;
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 16px;
}

.query-panel {
  padding: 20px;
}

.panel-heading,
.result-summary {
  display: flex;
  margin-bottom: 16px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-heading span,
.result-summary span {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--primary, #2563eb);
}

.panel-heading h3,
.result-summary h3 {
  margin: 4px 0 0;
  font-size: 17px;
  color: var(--text-main, #172033);
}

.panel-heading em,
.result-summary em {
  max-width: 48%;
  padding: 5px 10px;
  overflow: hidden;
  font-size: 12px;
  font-style: normal;
  color: var(--primary, #2563eb);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--primary-soft, #eaf1ff);
  border-radius: 999px;
}

.retrieve-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

.retrieve-input :deep(.el-textarea__inner) {
  min-height: 88px !important;
  padding: 12px 14px;
  line-height: 1.65;
  border-radius: 12px;
}

.retrieve-input .el-button {
  width: 112px;
  height: 88px;
  margin: 0;
  border-radius: 12px;
}

.parameter-row {
  display: grid;
  margin-top: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.parameter-item {
  display: grid;
  min-width: 0;
  padding: 14px;
  background: var(--panel-soft, #f8faff);
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 12px;
  gap: 12px;
}

.parameter-head {
  display: flex;
  min-height: 38px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.parameter-copy strong,
.parameter-copy span {
  display: block;
}

.parameter-copy strong {
  font-size: 13px;
  color: var(--text-main, #172033);
}

.parameter-copy span {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
}

.parameter-item :deep(.el-input-number) {
  width: 100%;
}

.shortcut-hint {
  margin: 9px 2px 0;
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
}

.result-panel {
  padding: 18px;
}

.result-summary {
  margin-bottom: 12px;
}

.retrieve-list {
  display: grid;
  gap: 12px;
}

.retrieve-item {
  padding: 16px;
  background: var(--panel-soft, #f8faff);
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 14px;
}

.retrieve-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.document-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.document-title > div {
  min-width: 0;
}

.result-index {
  display: grid;
  width: 30px;
  height: 30px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--primary, #2563eb);
  background: #fff;
  border: 1px solid #dbe6f7;
  border-radius: 9px;
  place-items: center;
  flex-shrink: 0;
}

.document-title strong,
.document-title small {
  display: block;
}

.document-title strong {
  overflow: hidden;
  font-size: 13px;
  color: var(--text-main, #172033);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-title small {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
}

.score-tag {
  padding: 4px 9px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--primary, #2563eb);
  background: var(--primary-soft, #eaf1ff);
  border-radius: 999px;
  flex-shrink: 0;
}

.result-content {
  display: -webkit-box;
  height: 112px;
  margin: 12px 0 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
  word-break: break-word;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  line-clamp: 5;
}

.result-content.expanded {
  display: block;
  height: auto;
  min-height: 112px;
  overflow: visible;
}

.detail-action {
  display: flex;
  min-height: 28px;
  padding-top: 6px;
  align-items: center;
  justify-content: flex-end;
}

.detail-toggle {
  padding: 3px 0;
  font-size: 12px;
  color: var(--primary, #2563eb);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.detail-toggle:hover {
  color: var(--primary-strong, #1d4ed8);
}

.result-answer {
  padding: 10px 12px;
  margin-top: 12px;
  background: #fff;
  border-left: 3px solid var(--primary, #2563eb);
  border-radius: 0 10px 10px 0;
}

.result-answer span {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary, #2563eb);
}

.result-answer p {
  margin: 5px 0 0;
  font-size: 13px;
  line-height: 1.8;
  color: #475569;
  word-break: break-word;
  white-space: pre-wrap;
}

.empty-panel {
  display: grid;
  min-height: 210px;
  place-items: center;
}

@media (width <= 640px) {
  .retrieve-input {
    grid-template-columns: 1fr;
  }

  .retrieve-input .el-button {
    width: 100%;
    height: 42px;
  }

  .parameter-row {
    grid-template-columns: 1fr;
  }
}
</style>
