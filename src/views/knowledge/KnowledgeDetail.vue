<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, UploadFilled } from '@element-plus/icons-vue'
import { knowledgeApi, knowledgeDocApi } from '@/api/knowledge'
import type {
  DatasetVO,
  DocumentVO,
  IndexingStatus,
  IndexingStatusItem
} from '@/api/knowledge/types'
import { RUNNING_STATUSES } from './constants'
import { avatarColor, compactNumber, datasetInitial } from './utils'
import { useIndexingPoller } from './useIndexingPoller'
import DocumentRow from './components/DocumentRow.vue'
import RetrieveTester from './components/RetrieveTester.vue'
import UploadDocumentDialog from './components/UploadDocumentDialog.vue'

const route = useRoute()
const router = useRouter()
const datasetId = computed(() => String(route.params.datasetId || ''))

const loading = ref(false)
const docsLoading = ref(false)
const dataset = ref<DatasetVO | null>(null)
const docs = ref<DocumentVO[]>([])
const uploadVisible = ref(false)
const activeTab = ref<'documents' | 'retrieve'>('documents')
const refreshedBatches = new Set<string>()
const batchByDoc = ref<Record<string, string>>({})
const hasHierarchicalDocument = ref(false)
const documentStats = reactive({
  total: 0,
  wordCount: 0
})

const pager = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const poller = useIndexingPoller(datasetId.value)

const highModeText = computed(() =>
  dataset.value?.indexingTechnique === 'high_quality' ? '高质量' : '经济'
)
const detailDocumentCount = computed(() => documentStats.total || pager.total || docs.value.length)
const detailWordCount = computed(() => compactNumber(documentStats.wordCount))

async function loadDetail() {
  if (!datasetId.value) return
  loading.value = true
  try {
    dataset.value = await knowledgeApi.detail(datasetId.value)
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库详情加载失败')
  } finally {
    loading.value = false
  }
}

async function loadDocuments() {
  if (!datasetId.value) return
  docsLoading.value = true
  try {
    const res = await knowledgeDocApi.list(datasetId.value, {
      page: pager.page,
      limit: pager.limit
    })
    docs.value = res.data || []
    pager.total = res.total || 0
    if (docs.value.some((doc) => doc.doc_form === 'hierarchical_model')) {
      hasHierarchicalDocument.value = true
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '文档列表加载失败')
  } finally {
    docsLoading.value = false
  }
}

async function loadDocumentStats() {
  if (!datasetId.value) return
  const limit = 100
  let page = 1
  let total = 0
  let wordCount = 0
  let hasMore = true
  let hierarchical = false

  try {
    while (hasMore && page <= 50) {
      const res = await knowledgeDocApi.list(datasetId.value, { page, limit })
      const records = res.data || []
      if (page === 1) {
        total = Number(res.total || records.length)
      }
      if (records.some((doc) => doc.doc_form === 'hierarchical_model')) {
        hierarchical = true
      }
      wordCount += records.reduce((sum, doc) => sum + Number(doc.word_count || 0), 0)
      hasMore = Boolean(res.has_more) && records.length > 0
      page += 1
    }
    documentStats.total = total
    documentStats.wordCount = wordCount
    hasHierarchicalDocument.value = hierarchical
  } catch {
    documentStats.total = pager.total || docs.value.length
    documentStats.wordCount = docs.value.reduce((sum, doc) => sum + Number(doc.word_count || 0), 0)
    hasHierarchicalDocument.value = docs.value.some((doc) => doc.doc_form === 'hierarchical_model')
  }
}

async function reloadAll() {
  hasHierarchicalDocument.value = false
  await Promise.all([loadDetail(), loadDocuments(), loadDocumentStats()])
}

function goBack() {
  router.push({ name: 'KnowledgeList' })
}

function statusFor(doc: DocumentVO): IndexingStatusItem | undefined {
  const batch = batchByDoc.value[doc.id]
  return batch ? poller.statusMap.value[batch] : undefined
}

function isRunning(doc: DocumentVO) {
  const status = statusFor(doc)?.indexing_status || doc.indexing_status
  return RUNNING_STATUSES.includes(status as IndexingStatus)
}

function onUploaded(payload: {
  batch: string
  documentId: string
  documentName: string
  docForm?: string
}) {
  if (payload.docForm === 'hierarchical_model') {
    hasHierarchicalDocument.value = true
  }
  batchByDoc.value = { ...batchByDoc.value, [payload.documentId]: payload.batch }
  docs.value = [
    {
      id: payload.documentId,
      name: payload.documentName,
      doc_form: payload.docForm,
      indexing_status: 'waiting',
      created_at: Math.floor(Date.now() / 1000)
    },
    ...docs.value
  ]
  poller.start(payload.batch)
  window.setTimeout(() => void Promise.all([loadDocuments(), loadDocumentStats()]), 1000)
}

async function downloadDoc(doc: DocumentVO) {
  try {
    const { url } = await knowledgeDocApi.downloadUrl(datasetId.value, doc.id)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name
    a.target = '_blank'
    a.click()
  } catch (error: any) {
    ElMessage.error(error?.message || '获取下载地址失败')
  }
}

function removeErrorText(error: any) {
  const code = error?.errorCode || error?.data?.errorCode
  if (code === 'document_indexing') return '文档正在索引中，暂时无法删除'
  if (code === 'archived_document_immutable') return '归档文档不可操作'
  if (code === 'not_found') return '文档不存在或已删除'
  if (code === 'forbidden') return '无权操作该文档'
  return error?.message || '删除文档失败'
}

async function removeDoc(doc: DocumentVO) {
  if (isRunning(doc)) {
    ElMessage.warning('文档正在索引中，暂时无法删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除文档「${doc.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await knowledgeDocApi.remove(datasetId.value, doc.id)
    ElMessage.success('已删除')
    await Promise.all([loadDocuments(), loadDocumentStats()])
    void loadDetail()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(removeErrorText(error))
  }
}

function handlePageChange(page: number) {
  pager.page = page
  void loadDocuments()
}

watch(
  () => poller.statusMap.value,
  (map) => {
    Object.entries(map).forEach(([batch, status]) => {
      if (refreshedBatches.has(batch)) return
      if (poller.isFinished(status)) {
        refreshedBatches.add(batch)
        void reloadAll()
      }
    })
  },
  { deep: true }
)

onMounted(reloadAll)
</script>

<template>
  <div class="kb-detail" v-loading="loading">
    <section class="detail-shell">
      <button type="button" class="back-btn" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回知识库列表
      </button>

      <div v-if="dataset" class="detail-header">
        <div class="detail-main">
          <div class="detail-avatar" :style="{ backgroundColor: avatarColor(dataset) }">
            {{ datasetInitial(dataset) }}
          </div>
          <div class="detail-copy">
            <div class="eyebrow">KNOWLEDGE DETAIL</div>
            <h1>{{ dataset.name }}</h1>
            <p>{{ dataset.description || '暂无描述' }}</p>
            <div class="tag-row">
              <span
                :class="dataset.indexingTechnique === 'high_quality' ? 'mode-high' : 'mode-economy'"
              >
                {{ dataset.indexingTechniqueName || highModeText }}
              </span>
              <span v-if="dataset.searchMethodName">{{ dataset.searchMethodName }}</span>
              <span v-if="dataset.visibilityName">{{ dataset.visibilityName }}</span>
            </div>
          </div>
        </div>

        <div class="detail-side">
          <div class="detail-metrics">
            <div>
              <strong>{{ detailDocumentCount }}</strong>
              <span>文档数</span>
            </div>
            <div>
              <strong>{{ detailWordCount }}</strong>
              <span>总字数</span>
            </div>
          </div>
          <el-button type="primary" size="large" :icon="UploadFilled" @click="uploadVisible = true">
            上传文档
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="detail-tabs">
        <el-tab-pane label="文档管理" name="documents">
          <div v-loading="docsLoading" class="doc-list">
            <DocumentRow
              v-for="doc in docs"
              :key="doc.id"
              :doc="doc"
              :status="statusFor(doc)"
              @download="downloadDoc"
              @remove="removeDoc"
            />

            <div v-if="!docsLoading && !docs.length" class="upload-empty">
              <div class="empty-icon">
                <el-icon><UploadFilled /></el-icon>
              </div>
              <h3>还没有文档</h3>
              <p>上传文档后会自动解析、分块并建立索引。</p>
              <el-button type="primary" :icon="UploadFilled" @click="uploadVisible = true">
                上传文档
              </el-button>
            </div>
          </div>

          <div class="pager">
            <span>共 {{ pager.total }} 篇文档</span>
            <el-pagination
              layout="prev, pager, next, jumper"
              :current-page="pager.page"
              :page-size="pager.limit"
              :total="pager.total"
              @current-change="handlePageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="检索测试" name="retrieve">
          <RetrieveTester v-if="dataset" :dataset-id="dataset.id" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <UploadDocumentDialog
      v-if="dataset"
      v-model="uploadVisible"
      :dataset-id="dataset.id"
      :indexing-technique="dataset.indexingTechnique"
      :embedding-model="dataset.embeddingModel"
      :embedding-model-provider="dataset.embeddingModelProvider"
      :force-hierarchical="hasHierarchicalDocument"
      @uploaded="onUploaded"
    />
  </div>
</template>

<style scoped lang="less">
:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.kb-detail {
  --primary: var(--brand-primary, #2563eb);
  --primary-soft: #eaf1ff;
  --primary-softer: #f2f6ff;
  --app-bg: #f5f7fb;
  --surface: #fff;
  --panel-soft: #f8faff;
  --border-soft: #e4eaf3;
  --border-strong: #d5dfef;
  --text-main: #172033;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;

  min-height: 100%;
  padding: 24px;
  color: var(--text-main);
  background: var(--app-bg);
}

.detail-shell {
  width: 100%;
}

.back-btn {
  display: inline-flex;
  height: 34px;
  padding: 0 10px;
  margin-bottom: 14px;
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  align-items: center;
  gap: 6px;
}

.detail-header {
  display: grid;
  padding: 22px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, rgb(255 255 255 / 94%) 0%, rgb(242 246 255 / 88%) 100%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgb(37 99 235 / 5%);
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
}

.detail-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
}

.detail-avatar {
  display: grid;
  width: 68px;
  height: 68px;
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 800;
  color: #fff;
  border-radius: 20px;
  place-items: center;
  flex-shrink: 0;
}

.eyebrow {
  margin-bottom: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--primary);
}

.detail-copy {
  min-width: 0;
}

.detail-copy h1 {
  margin: 0;
  overflow: hidden;
  font-size: 26px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-copy p {
  margin: 7px 0 10px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tag-row span {
  display: inline-flex;
  height: 24px;
  padding: 0 8px;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  border-radius: 999px;
  align-items: center;
}

.tag-row .mode-high {
  color: var(--primary);
  background: var(--primary-soft);
}

.tag-row .mode-economy {
  color: #0f766e;
  background: #ecfdf5;
}

.detail-side {
  display: flex;
  align-items: center;
  gap: 14px;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(2, 96px);
  gap: 8px;
}

.detail-metrics div {
  padding: 11px;
  text-align: center;
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
}

.detail-metrics strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 18px;
}

.detail-metrics span {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-secondary);
}

.detail-tabs {
  padding: 18px;
  background: rgb(248 250 255 / 70%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}

.detail-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--border-soft);
}

.doc-list {
  display: grid;
  align-content: flex-start;
  align-items: flex-start;
  gap: 12px;
}

.upload-empty {
  display: grid;
  min-height: 260px;
  padding: 24px;
  text-align: center;
  background: #fff;
  border: 1px dashed var(--border-strong);
  border-radius: 16px;
  place-items: center;
}

.empty-icon {
  display: grid;
  width: 58px;
  height: 58px;
  margin: 0 auto 10px;
  font-size: 26px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 18px;
  place-items: center;
}

.upload-empty h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.upload-empty p {
  margin: 0 0 14px;
  color: var(--text-secondary);
}

.pager {
  display: flex;
  margin-top: 14px;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.pager span {
  margin-right: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (width <= 980px) {
  .detail-header,
  .detail-side {
    grid-template-columns: 1fr;
    align-items: stretch;
    flex-direction: column;
  }

  .detail-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width <= 640px) {
  .kb-detail {
    padding: 16px;
  }

  .detail-main {
    align-items: flex-start;
  }

  .detail-copy h1 {
    white-space: normal;
  }

  .detail-metrics {
    grid-template-columns: 1fr;
  }

  .pager {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
