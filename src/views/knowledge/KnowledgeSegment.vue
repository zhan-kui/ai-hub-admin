<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Document, Plus, Search } from '@element-plus/icons-vue'
import { knowledgeSegmentApi } from '@/api/knowledge'
import type { DifyDocForm, DifySegment, DifySegmentStatus } from '@/api/knowledge/segment'
import { compactNumber } from './utils'
import {
  docFormClass,
  docFormLabel,
  isSegmentNotFound,
  isSegmentWarning,
  segmentErrorText,
  statusLabel
} from './segment-utils'
import ChildChunkPanel from './components/ChildChunkPanel.vue'
import SegmentCard from './components/SegmentCard.vue'
import SegmentEditDialog from './components/SegmentEditDialog.vue'

type StatusFilter = '' | 'completed' | 'indexing' | 'error'

const route = useRoute()
const router = useRouter()
const datasetId = computed(() => String(route.params.datasetId || ''))
const documentId = computed(() => String(route.params.documentId || ''))
const docName = ref(String(route.query.name || '文档分段'))
const docForm = ref<DifyDocForm>(String(route.query.docForm || 'text_model'))

const loading = ref(false)
const list = ref<DifySegment[]>([])
const activeStatus = ref<StatusFilter>('')
const toggleLoadingIds = ref(new Set<string>())
const query = reactive({ page: 1, limit: 20, keyword: '', total: 0, hasMore: false })

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'indexing', label: '索引中' },
  { key: 'error', label: '失败' }
]

const editVisible = ref(false)
const editMode = ref<'create' | 'edit' | 'view'>('create')
const editTarget = ref<DifySegment | null>(null)
const childVisible = ref(false)
const childTarget = ref<DifySegment | null>(null)

const wordSum = computed(() =>
  list.value.reduce((sum, item) => sum + Number(item.word_count || 0), 0)
)
const hitSum = computed(() =>
  list.value.reduce((sum, item) => sum + Number(item.hit_count || 0), 0)
)
const statusCounts = computed(() => ({
  completed: list.value.filter((item) => item.status === 'completed').length,
  indexing: list.value.filter((item) => item.status === 'indexing').length,
  error: list.value.filter((item) => item.status === 'error').length
}))
const aggregateStatus = computed<DifySegmentStatus | undefined>(() => {
  if (list.value.some((item) => item.status === 'error')) return 'error'
  if (list.value.some((item) => item.status === 'indexing')) return 'indexing'
  if (list.value.length && list.value.every((item) => item.status === 'completed'))
    return 'completed'
  return undefined
})

function tabCount(status: StatusFilter) {
  if (!status) return query.total
  return statusCounts.value[status]
}

function showError(error: unknown, fallback: string) {
  const text = segmentErrorText(error, fallback)
  if (isSegmentWarning(error)) ElMessage.warning(text)
  else ElMessage.error(text)
}

async function load() {
  if (!datasetId.value || !documentId.value) return
  loading.value = true
  try {
    const response = await knowledgeSegmentApi.pageSegments(datasetId.value, documentId.value, {
      page: query.page,
      limit: query.limit,
      keyword: query.keyword.trim() || undefined,
      status: activeStatus.value ? [activeStatus.value] : undefined
    })
    list.value = response.data || []
    query.total = response.total || 0
    query.hasMore = Boolean(response.has_more)
    if (response.doc_form) docForm.value = response.doc_form
  } catch (error: unknown) {
    showError(error, '分段列表加载失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ name: 'KnowledgeDetail', params: { datasetId: datasetId.value } })
}

function setStatus(status: StatusFilter) {
  if (activeStatus.value === status) return
  activeStatus.value = status
  query.page = 1
  void load()
}

function handleSearch() {
  query.page = 1
  void load()
}

function handlePage(page: number) {
  query.page = page
  void load()
}

function openCreate() {
  editMode.value = 'create'
  editTarget.value = null
  editVisible.value = true
}

function openEdit(segment: DifySegment) {
  editMode.value = 'edit'
  editTarget.value = segment
  editVisible.value = true
}

function openView(segment: DifySegment) {
  editMode.value = 'view'
  editTarget.value = segment
  editVisible.value = true
}

function openChild(segment: DifySegment) {
  editVisible.value = false
  childTarget.value = segment
  childVisible.value = true
}

async function toggleEnabled(segment: DifySegment, value: boolean) {
  const previous = segment.enabled !== false
  segment.enabled = value
  toggleLoadingIds.value = new Set(toggleLoadingIds.value).add(segment.id)
  try {
    await knowledgeSegmentApi.updateSegment(datasetId.value, documentId.value, segment.id, {
      segment: { enabled: value }
    })
    ElMessage.success(value ? '已启用' : '已禁用')
  } catch (error: unknown) {
    segment.enabled = previous
    showError(error, '检索状态更新失败')
    if (isSegmentNotFound(error)) void load()
  } finally {
    const next = new Set(toggleLoadingIds.value)
    next.delete(segment.id)
    toggleLoadingIds.value = next
  }
}

async function removeSegment(segment: DifySegment) {
  try {
    await ElMessageBox.confirm('确认删除该分段？删除后不可恢复。', '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await knowledgeSegmentApi.deleteSegment(datasetId.value, documentId.value, segment.id)
    ElMessage.success('已删除')
    editVisible.value = false
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') return
    showError(error, '删除分段失败')
    if (isSegmentNotFound(error)) void load()
  }
}

function onSaved() {
  editVisible.value = false
  void load()
}

onMounted(load)
</script>

<template>
  <div class="kb-segment">
    <section class="segment-shell">
      <button type="button" class="back-btn" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回文档列表
      </button>

      <div class="seg-header">
        <div class="header-main">
          <div class="header-icon"
            ><el-icon><Document /></el-icon
          ></div>
          <div class="header-copy">
            <div class="eyebrow">DOCUMENT SEGMENTS</div>
            <h1>{{ docName }}</h1>
            <div class="tag-row">
              <span :class="docFormClass(docForm)">{{ docFormLabel(docForm) }}</span>
              <span v-if="aggregateStatus" :class="`status-${aggregateStatus}`">
                {{ statusLabel(aggregateStatus) }}
              </span>
            </div>
          </div>
        </div>

        <div class="header-side">
          <div class="seg-metrics">
            <div
              ><strong>{{ query.total }}</strong
              ><span>分段数</span></div
            >
            <div
              ><strong>{{ compactNumber(wordSum) }}</strong
              ><span>当前页字数</span></div
            >
            <div
              ><strong>{{ compactNumber(hitSum) }}</strong
              ><span>当前页命中</span></div
            >
          </div>
          <el-button type="primary" size="large" :icon="Plus" @click="openCreate">
            新增分段
          </el-button>
        </div>
      </div>

      <div class="seg-panel">
        <div class="seg-toolbar">
          <div class="filter-tabs" aria-label="分段状态筛选">
            <button
              v-for="tab in STATUS_TABS"
              :key="tab.key"
              type="button"
              class="filter-tab"
              :class="{ active: activeStatus === tab.key }"
              @click="setStatus(tab.key)"
            >
              <span>{{ tab.label }}</span>
              <em>{{ tabCount(tab.key) }}</em>
            </button>
          </div>

          <el-input
            v-model="query.keyword"
            class="search-input"
            clearable
            placeholder="搜索分段内容"
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          >
            <template #prefix
              ><el-icon><Search /></el-icon
            ></template>
          </el-input>
        </div>

        <div v-loading="loading" class="seg-grid">
          <SegmentCard
            v-for="segment in list"
            :key="segment.id"
            :segment="segment"
            :doc-form="docForm"
            :toggle-loading="toggleLoadingIds.has(segment.id)"
            @edit="openEdit"
            @view="openView"
            @remove="removeSegment"
            @toggle="(value) => toggleEnabled(segment, value)"
            @child="openChild"
          />

          <div v-if="!loading && !list.length" class="seg-empty">
            <div class="empty-icon"
              ><el-icon><Document /></el-icon
            ></div>
            <h3>还没有分段</h3>
            <p>该文档还没有分段，新增第一个分段或等待索引完成。</p>
            <el-button type="primary" :icon="Plus" @click="openCreate">新增分段</el-button>
          </div>
        </div>

        <div class="seg-footer">
          <span>共 {{ query.total }} 个分段</span>
          <el-pagination
            layout="prev, pager, next, jumper"
            :current-page="query.page"
            :page-size="query.limit"
            :total="query.total"
            @current-change="handlePage"
          />
        </div>
      </div>
    </section>

    <SegmentEditDialog
      v-model="editVisible"
      :mode="editMode"
      :doc-form="docForm"
      :dataset-id="datasetId"
      :document-id="documentId"
      :segment="editTarget"
      @saved="onSaved"
      @request-edit="openEdit"
      @request-delete="removeSegment"
      @request-child="openChild"
    />

    <ChildChunkPanel
      v-if="childTarget"
      v-model="childVisible"
      :dataset-id="datasetId"
      :document-id="documentId"
      :segment="childTarget"
      @changed="load"
    />
  </div>
</template>

<style scoped lang="less">
:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.kb-segment {
  --primary: var(--brand-primary, #2563eb);
  --primary-strong: var(--brand-primary-dark, #1d4ed8);
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

.segment-shell {
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

.seg-header {
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

.header-main,
.header-side,
.tag-row,
.seg-toolbar,
.seg-footer {
  display: flex;
  align-items: center;
}

.header-main {
  min-width: 0;
  gap: 16px;
}

.header-icon {
  display: grid;
  width: 68px;
  height: 68px;
  font-size: 28px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 20px;
  place-items: center;
  flex-shrink: 0;
}

.header-copy {
  min-width: 0;
}

.eyebrow {
  margin-bottom: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--primary);
}

.header-copy h1 {
  margin: 0;
  overflow: hidden;
  font-size: 26px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-row {
  margin-top: 10px;
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

.tag-row .status-completed {
  color: #15803d;
  background: #f0fdf4;
}

.tag-row .status-indexing {
  color: #b45309;
  background: #fffbeb;
}

.tag-row .status-error {
  color: #b91c1c;
  background: #fef2f2;
}

.header-side {
  gap: 14px;
}

.seg-metrics {
  display: grid;
  grid-template-columns: repeat(3, 92px);
  gap: 8px;
}

.seg-metrics div {
  padding: 11px;
  text-align: center;
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
}

.seg-metrics strong,
.seg-metrics span {
  display: block;
}

.seg-metrics strong {
  font-family: var(--font-mono);
  font-size: 18px;
}

.seg-metrics span {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-secondary);
}

.seg-panel {
  display: grid;
  padding: 18px;
  background: rgb(248 250 255 / 70%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
  gap: 16px;
}

.seg-toolbar {
  gap: 14px;
}

.filter-tabs {
  display: inline-flex;
  padding: 4px;
  background: #edf3ff;
  border: 1px solid #dfe8f6;
  border-radius: 12px;
  gap: 4px;
}

.filter-tab {
  display: inline-flex;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #516174;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9px;
  align-items: center;
  gap: 8px;
}

.filter-tab em {
  min-width: 20px;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-style: normal;
  color: #64748b;
  background: rgb(255 255 255 / 72%);
  border-radius: 999px;
}

.filter-tab:hover,
.filter-tab.active {
  color: var(--primary);
  background: #fff;
}

.filter-tab.active {
  box-shadow: 0 6px 16px rgb(37 99 235 / 10%);
}

.search-input {
  width: min(320px, 100%);
  margin-left: auto;
}

.seg-grid {
  display: grid;
  min-height: 280px;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  align-content: flex-start;
  gap: 16px;
}

.seg-empty {
  display: grid;
  min-height: 260px;
  padding: 24px;
  text-align: center;
  background: #fff;
  border: 1px dashed var(--border-strong);
  border-radius: 16px;
  place-items: center;
  grid-column: 1 / -1;
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

.seg-empty h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.seg-empty p {
  margin: 0 0 14px;
  color: var(--text-secondary);
}

.seg-footer {
  justify-content: flex-end;
  gap: 16px;
}

.seg-footer > span {
  margin-right: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (width <= 980px) {
  .seg-header {
    grid-template-columns: 1fr;
  }

  .header-side {
    align-items: stretch;
    flex-direction: column;
  }

  .seg-metrics {
    grid-template-columns: repeat(3, 1fr);
  }

  .seg-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-input {
    width: 100%;
    margin-left: 0;
  }
}

@media (width <= 640px) {
  .kb-segment {
    padding: 16px;
  }

  .header-main {
    align-items: flex-start;
  }

  .header-copy h1 {
    white-space: normal;
  }

  .seg-metrics,
  .seg-grid {
    grid-template-columns: 1fr;
  }

  .filter-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .filter-tab {
    justify-content: center;
  }

  .seg-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
