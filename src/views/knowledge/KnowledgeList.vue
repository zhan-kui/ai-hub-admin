<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled, Plus, Search } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/api/knowledge'
import type { DatasetVO, IndexingTechnique } from '@/api/knowledge/types'
import { avatarColor, compactNumber, datasetInitial } from './utils'
import CreateDatasetDialog from './components/CreateDatasetDialog.vue'
import RetrieveTester from './components/RetrieveTester.vue'

type FilterType = '' | IndexingTechnique

const router = useRouter()
const loading = ref(false)
const list = ref<DatasetVO[]>([])
const total = ref(0)
const createVisible = ref(false)
const retrieveVisible = ref(false)
const retrieveDataset = ref<DatasetVO | null>(null)

const query = reactive({
  page: 1,
  limit: 20,
  keyword: '',
  indexingTechnique: '' as FilterType
})

const highQualityCount = computed(
  () => list.value.filter((item) => item.indexingTechnique === 'high_quality').length
)
const economyCount = computed(
  () => list.value.filter((item) => item.indexingTechnique === 'economy').length
)
const documentTotal = computed(() =>
  list.value.reduce((sum, item) => sum + Number(item.documentCount || 0), 0)
)

async function load() {
  loading.value = true
  try {
    const res = await knowledgeApi.list({
      page: query.page,
      limit: query.limit,
      keyword: query.keyword.trim() || undefined,
      indexingTechnique: query.indexingTechnique || undefined,
      status: 'active'
    })
    list.value = res.records || []
    total.value = res.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库列表加载失败')
  } finally {
    loading.value = false
  }
}

function setFilter(type: FilterType) {
  if (query.indexingTechnique === type) return
  query.indexingTechnique = type
  query.page = 1
  void load()
}

function handleSearch() {
  query.page = 1
  void load()
}

function handlePageChange(page: number) {
  query.page = page
  void load()
}

function openDetail(row: DatasetVO) {
  router.push(`/knowledge/${row.id}`)
}

function openRetrieve(row: DatasetVO) {
  retrieveDataset.value = row
  retrieveVisible.value = true
}

async function removeDataset(row: DatasetVO) {
  try {
    await ElMessageBox.confirm(`确认删除知识库「${row.name}」？该操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await knowledgeApi.remove(row.id)
    ElMessage.success('已删除')
    if (list.value.length === 1 && query.page > 1) {
      query.page -= 1
    }
    void load()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.message || '删除失败')
  }
}

function handleMore(command: string, row: DatasetVO) {
  if (command === 'detail') openDetail(row)
  if (command === 'retrieve') openRetrieve(row)
  if (command === 'delete') void removeDataset(row)
}

function modeText(row: DatasetVO) {
  return row.indexingTechniqueName || (row.indexingTechnique === 'high_quality' ? '高质量' : '经济')
}

function modeClass(row: DatasetVO) {
  return row.indexingTechnique === 'high_quality' ? 'mode-high' : 'mode-economy'
}

function onCreated(created: DatasetVO) {
  createVisible.value = false
  ElMessage.success('知识库创建成功')
  router.push(`/knowledge/${created.id}`)
}

onMounted(load)
</script>

<template>
  <div class="kb-page">
    <section class="kb-shell">
      <div class="kb-hero">
        <div class="hero-copy">
          <div class="eyebrow">KNOWLEDGE · {{ total }}</div>
          <h1>知识库</h1>
          <p>沉淀企业文档、FAQ 与业务知识，供智能体和检索测试统一使用。</p>
        </div>

        <div class="hero-metrics">
          <div class="metric-card">
            <span>知识库总数</span>
            <strong>{{ total }}</strong>
          </div>
          <div class="metric-card">
            <span>高质量</span>
            <strong>{{ highQualityCount }}</strong>
          </div>
          <div class="metric-card">
            <span>当前页文档</span>
            <strong>{{ documentTotal }}</strong>
          </div>
        </div>
      </div>

      <div class="kb-content">
        <div class="kb-toolbar">
          <div class="filter-tabs" aria-label="知识库类型筛选">
            <button
              type="button"
              class="filter-tab"
              :class="{ active: query.indexingTechnique === '' }"
              @click="setFilter('')"
            >
              <span>全部</span>
              <em>{{ total }}</em>
            </button>
            <button
              type="button"
              class="filter-tab"
              :class="{ active: query.indexingTechnique === 'high_quality' }"
              @click="setFilter('high_quality')"
            >
              <span>高质量</span>
              <em>{{ highQualityCount }}</em>
            </button>
            <button
              type="button"
              class="filter-tab"
              :class="{ active: query.indexingTechnique === 'economy' }"
              @click="setFilter('economy')"
            >
              <span>经济</span>
              <em>{{ economyCount }}</em>
            </button>
          </div>

          <el-input
            v-model="query.keyword"
            class="search-input"
            clearable
            placeholder="搜索知识库名称"
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <div v-loading="loading" class="kb-grid">
          <button type="button" class="kb-card create-card" @click="createVisible = true">
            <span class="create-plus">
              <el-icon><Plus /></el-icon>
            </span>
            <span class="create-title">创建知识库</span>
            <span class="create-subtitle">选择高质量或经济模式，开始整理企业知识</span>
          </button>

          <article v-for="row in list" :key="row.id" class="kb-card data-card">
            <div class="card-click" @click="openDetail(row)">
              <div class="card-top">
                <div class="kb-avatar" :style="{ backgroundColor: avatarColor(row) }">
                  {{ datasetInitial(row) }}
                </div>
                <div class="title-area">
                  <h3>{{ row.name }}</h3>
                  <span>{{ row.ownerUserName || row.provider || 'vendor' }}</span>
                </div>
              </div>

              <p class="card-desc">{{ row.description || '暂无描述' }}</p>

              <div class="tag-row">
                <span class="type-tag" :class="modeClass(row)">{{ modeText(row) }}</span>
                <span v-if="row.visibilityName" class="plain-tag">{{ row.visibilityName }}</span>
                <span v-if="row.searchMethodName" class="plain-tag">{{
                  row.searchMethodName
                }}</span>
              </div>
            </div>

            <div class="card-footer">
              <span
                >{{ row.documentCount || 0 }} 篇文档 · {{ compactNumber(row.wordCount) }} 字</span
              >
              <el-dropdown
                trigger="click"
                @command="(command) => handleMore(command as string, row)"
              >
                <button type="button" class="more-btn" @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                  <span>更多</span>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="detail">进入知识库</el-dropdown-item>
                    <el-dropdown-item command="retrieve">检索测试</el-dropdown-item>
                    <el-dropdown-item command="delete">
                      <span class="danger-text">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </article>

          <div v-if="!loading && !list.length" class="empty-hint">
            还没有知识库，点击左侧卡片创建第一个。
          </div>
        </div>

        <div class="kb-footer">
          <span>共 {{ total }} 个知识库 · 当前页 {{ list.length }} 个</span>
          <el-pagination
            layout="prev, pager, next, jumper"
            :current-page="query.page"
            :page-size="query.limit"
            :total="total"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </section>

    <CreateDatasetDialog v-model="createVisible" @created="onCreated" />

    <el-drawer v-model="retrieveVisible" size="520px" title="检索测试">
      <RetrieveTester v-if="retrieveDataset" :dataset-id="retrieveDataset.id" />
    </el-drawer>
  </div>
</template>

<style scoped lang="less">
:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.kb-page {
  --primary: var(--brand-primary, #2563eb);
  --primary-strong: var(--brand-primary-dark, #1d4ed8);
  --primary-soft: #eaf1ff;
  --primary-softer: #f2f6ff;
  --app-bg: #f5f7fb;
  --surface: #fff;
  --panel-soft: #f8faff;
  --border: #e4eaf3;
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

.kb-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.kb-hero {
  position: relative;
  display: grid;
  padding: 22px 24px;
  margin-bottom: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, rgb(255 255 255 / 92%) 0%, rgb(245 247 251 / 88%) 100%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgb(37 99 235 / 5%);
  grid-template-columns: minmax(0, 1.2fr) auto;
  gap: 22px;
}

.kb-hero::before {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 0;
  width: 4px;
  background: var(--primary);
  border-radius: 0 999px 999px 0;
  content: '';
}

.eyebrow {
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--primary);
}

.hero-copy h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.18;
}

.hero-copy p {
  max-width: 560px;
  margin: 7px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 1fr));
  gap: 10px;
}

.metric-card {
  min-width: 94px;
  padding: 12px 14px;
  background: rgb(255 255 255 / 54%);
  border: 1px solid rgb(226 232 240 / 76%);
  border-radius: 14px;
}

.metric-card span {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-card strong {
  font-family: var(--font-mono);
  font-size: 22px;
}

.kb-content {
  display: grid;
  padding: 18px;
  background: rgb(248 250 255 / 70%);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  gap: 16px;
}

.kb-toolbar {
  display: flex;
  align-items: center;
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

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(286px, 1fr));
  gap: 16px;
}

.kb-card {
  min-height: 184px;
  padding: 18px 18px 16px;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.data-card {
  display: flex;
  flex-direction: column;
}

.kb-card:hover {
  border-color: #c7d5ea;
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgb(37 99 235 / 9%);
}

.create-card {
  display: flex;
  width: 100%;
  color: var(--text-secondary);
  text-align: center;
  cursor: pointer;
  background: linear-gradient(180deg, #f8fbff 0%, #f2f6ff 100%);
  border: 1px dashed #b9c8df;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
}

.create-plus {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 8px;
  color: var(--primary);
  background: #fff;
  border: 1px solid #d8e3f5;
  border-radius: 14px;
  box-shadow: 0 8px 18px rgb(37 99 235 / 8%);
  place-items: center;
}

.create-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
}

.create-subtitle {
  max-width: 210px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.card-click {
  cursor: pointer;
}

.card-top {
  display: flex;
  min-width: 0;
  margin-bottom: 14px;
  align-items: center;
  gap: 12px;
}

.kb-avatar {
  display: grid;
  width: 44px;
  height: 44px;
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  border-radius: 14px;
  place-items: center;
  flex-shrink: 0;
}

.title-area {
  min-width: 0;
}

.title-area h3 {
  margin: 0;
  overflow: hidden;
  font-size: 15px;
  color: var(--text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-area span {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  font-size: 12px;
  color: var(--text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  display: -webkit-box;
  min-height: 40px;
  margin: 0 0 14px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.tag-row {
  display: flex;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 7px;
}

.type-tag,
.plain-tag {
  display: inline-flex;
  height: 24px;
  padding: 0 8px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 999px;
  align-items: center;
}

.mode-high {
  color: var(--primary);
  background: var(--primary-soft);
}

.mode-economy {
  color: #0f766e;
  background: #ecfdf5;
}

.plain-tag {
  color: #475569;
  background: #f1f5f9;
}

.card-footer {
  display: flex;
  padding-top: 12px;
  margin-top: auto;
  font-size: 12px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-soft);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.more-btn {
  display: inline-flex;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  align-items: center;
  gap: 4px;
}

.danger-text {
  color: #dc2626;
}

.empty-hint {
  display: grid;
  min-height: 184px;
  padding: 18px;
  color: var(--text-secondary);
  text-align: center;
  background: #fff;
  border: 1px dashed var(--border-strong);
  border-radius: 16px;
  place-items: center;
}

.kb-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.kb-footer span {
  margin-right: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (width <= 900px) {
  .kb-hero,
  .kb-toolbar {
    grid-template-columns: 1fr;
    align-items: stretch;
    flex-direction: column;
  }

  .hero-metrics {
    grid-template-columns: repeat(3, 1fr);
  }

  .search-input {
    width: 100%;
    margin-left: 0;
  }
}

@media (width <= 640px) {
  .kb-page {
    padding: 16px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .kb-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
