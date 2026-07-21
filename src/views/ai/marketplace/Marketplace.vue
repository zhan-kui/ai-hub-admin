<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  ChatDotRound,
  Connection,
  Grid,
  MagicStick,
  Search
} from '@element-plus/icons-vue'
import { appApi, type AppConfigVO, type AppListParams } from '@/api/frontend-api'

type AppRow = AppConfigVO & Record<string, any>
type AppTypeFilter = '' | 'chat' | 'agent' | 'workflow'
// 后端 /apps/list 暂未提供 appType 入参，分类仍在前端按 appType 过滤

const router = useRouter()
const route = useRoute()
const capabilityEntry = computed(() => route.meta.permission === 'assistant:general')

const loading = ref(false)
const keyword = ref('') // 输入框内容
const appliedKeyword = ref('') // 已提交、参与过滤的关键字
const appTypeFilter = ref<AppTypeFilter>('')
const pageNum = ref(1)
const pageSize = 24
const allApps = ref<AppRow[]>([])

interface CategoryMeta {
  value: AppTypeFilter
  label: string
  icon: unknown
  aliases: string[]
}

// 分类沿用 appType 三类（聊天助手 / Agent / Chatflow）+ 全部
const categories: CategoryMeta[] = [
  { value: '', label: '全部', icon: Grid, aliases: [] },
  {
    value: 'chat',
    label: '聊天助手',
    icon: ChatDotRound,
    aliases: ['chat', 'advanced-chat', 'advanced_chat', '聊天助手']
  },
  {
    value: 'agent',
    label: 'Agent 智能体',
    icon: MagicStick,
    aliases: ['agent', 'agent 智能体']
  },
  {
    value: 'workflow',
    label: 'Chatflow 对话流',
    icon: Connection,
    aliases: ['workflow', 'chatflow', 'chatflow 对话流', 'workflow 工作流']
  }
]

function normalizeAppTypeKey(value?: string): AppTypeFilter | string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')

  for (const item of categories) {
    if (!item.value) continue
    const aliasMatches = item.aliases.some(
      (alias) =>
        String(alias)
          .trim()
          .toLowerCase()
          .replace(/[_\s]+/g, '-') === normalized
    )
    if (item.value === normalized || aliasMatches) {
      return item.value
    }
  }
  return normalized || ''
}

function getAppTypeLabel(value?: string): string {
  const key = normalizeAppTypeKey(value)
  const found = categories.find((item) => item.value === key)
  return found?.label || (value ? String(value) : '未分类')
}

function getAppTypeChipClass(value?: string): string {
  const key = normalizeAppTypeKey(value)
  return key ? `type-${key}` : 'type-unknown'
}

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['records', 'list', 'items', 'rows', 'data']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  if (payload.data && typeof payload.data === 'object') {
    for (const key of ['records', 'list', 'items', 'rows']) {
      if (Array.isArray(payload.data[key])) return payload.data[key]
    }
  }
  return []
}

// 收敛后的单色方块配色（与管理页保持一致）
function hashColor(text: string): string {
  const colors = [
    '#0a0a0a',
    '#2563eb',
    '#16a34a',
    '#d97706',
    '#7c3aed',
    '#db2777',
    '#0891b2',
    '#525252'
  ]
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

function avatarText(row: AppRow): string {
  const first = String(row.appName || '')
    .trim()
    .charAt(0)
  return first ? first.toUpperCase() : 'A'
}

function avatarColor(row: AppRow): string {
  return hashColor(String(getAppTypeLabel(row.appType) || row.appCode || row.appName || 'app'))
}

function formatTimeAgo(value?: string): string {
  if (!value) return '暂无更新时间'
  const date = new Date(value)
  const timestamp = date.getTime()
  if (Number.isNaN(timestamp)) return value

  const now = Date.now()
  const diff = Math.max(0, now - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < hour) {
    const minutes = Math.max(1, Math.floor(diff / minute))
    return `${minutes} 分钟前更新`
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours} 小时前更新`
  }
  if (diff < 7 * day) {
    const days = Math.floor(diff / day)
    return `${days} 天前更新`
  }
  return date.toISOString().slice(0, 10)
}

// 分类 + 关键字（前端过滤）
const filteredApps = computed<AppRow[]>(() => {
  const kw = appliedKeyword.value.trim().toLowerCase()
  return allApps.value.filter((row) => {
    const matchType =
      !appTypeFilter.value || normalizeAppTypeKey(row.appType) === appTypeFilter.value
    if (!matchType) return false
    if (!kw) return true
    const name = String(row.appName || '').toLowerCase()
    const code = String(row.appCode || '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

const total = computed(() => filteredApps.value.length)

const pagedApps = computed<AppRow[]>(() => {
  const start = (pageNum.value - 1) * pageSize
  return filteredApps.value.slice(start, start + pageSize)
})

const isEmpty = computed(() => !loading.value && filteredApps.value.length === 0)

const activeCategoryLabel = computed(
  () => categories.find((item) => item.value === appTypeFilter.value)?.label || '全部'
)

async function loadApps() {
  loading.value = true
  try {
    // 不传 pageNum -> 后端走 listByPermission 返回全量；仅取已发布且已启用
    const query: AppListParams = { publishStatus: 'PUBLISHED', enabled: true }
    const response = await appApi.list(query)
    allApps.value = pickArray(response) as AppRow[]
    pageNum.value = 1
  } catch (error: any) {
    ElMessage.error(error?.message || '智能体广场加载失败')
  } finally {
    loading.value = false
  }
}

function enterChat(row: AppRow) {
  router.push({
    path: `/agents/${row.id}/${capabilityEntry.value ? 'chat-plus' : 'chat'}`,
    query: { from: route.fullPath }
  })
}

function handleSearch() {
  appliedKeyword.value = keyword.value.trim()
  pageNum.value = 1
}

function setCategory(value: AppTypeFilter) {
  if (appTypeFilter.value === value) return
  appTypeFilter.value = value
  pageNum.value = 1
}

function handlePageChange(nextPage: number) {
  pageNum.value = nextPage
}

onMounted(() => {
  void loadApps()
})
</script>

<template>
  <div class="market-page">
    <section class="market-shell">
      <!-- 顶部检索区：与管理页的指标 hero 区分，聚焦发现与搜索 -->
      <header class="market-head">
        <div class="head-copy">
          <span class="eyebrow">AGENT MARKETPLACE</span>
          <h1>智能体广场</h1>
          <p>发现并使用已发布的企业智能体，点选卡片即可直接进入对话。</p>
        </div>

        <div class="head-search">
          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索智能体名称 / 编码"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <el-icon class="search-prefix-icon"><Search /></el-icon>
            </template>
          </el-input>
          <button type="button" class="search-btn" @click="handleSearch">搜索</button>
        </div>
      </header>

      <!-- 分类条：图标 chip，无数量徽标，主打轻量发现感 -->
      <nav class="category-bar" aria-label="智能体分类">
        <button
          v-for="cat in categories"
          :key="cat.value || 'all'"
          type="button"
          class="category-chip"
          :class="{ active: appTypeFilter === cat.value }"
          @click="setCategory(cat.value)"
        >
          <el-icon><component :is="cat.icon" /></el-icon>
          <span>{{ cat.label }}</span>
        </button>
      </nav>

      <div v-loading="loading" class="market-body">
        <div v-if="isEmpty" class="empty-state">
          <div class="empty-icon">
            <el-icon><Grid /></el-icon>
          </div>
          <p class="empty-title">{{ activeCategoryLabel }}分类下暂无可用智能体</p>
          <p class="empty-sub">智能体需「已发布」且「已启用」后才会展示在广场中。</p>
        </div>

        <div v-else class="market-grid">
          <article
            v-for="row in pagedApps"
            :key="row.id"
            class="market-card"
            role="button"
            tabindex="0"
            @click="enterChat(row)"
            @keyup.enter="enterChat(row)"
          >
            <div class="card-top">
              <div
                v-if="!row.iconImage && !row.icon"
                class="app-icon"
                :style="{ backgroundColor: avatarColor(row) }"
              >
                {{ avatarText(row) }}
              </div>
              <img v-else class="app-icon img" :src="row.iconImage || row.icon" alt="icon" />

              <div class="title-area">
                <div class="app-name">{{ row.appName || '-' }}</div>
                <span class="type-tag" :class="getAppTypeChipClass(row.appType)">
                  {{ getAppTypeLabel(row.appType) }}
                </span>
              </div>
            </div>

            <p class="card-desc">
              {{ row.description || '暂无描述，进入对话体验该智能体的能力。' }}
            </p>

            <div class="card-footer">
              <span class="meta-time">{{
                formatTimeAgo(row.lastEditedAt || row.publishedAt)
              }}</span>
              <span class="enter-btn">
                开始对话
                <el-icon><ArrowRight /></el-icon>
              </span>
            </div>
          </article>
        </div>

        <div v-if="!isEmpty" class="footer-bar">
          <span class="footer-count"
            >共 {{ total }} 个智能体 · 当前页 {{ pagedApps.length }} 个</span
          >
          <el-pagination
            layout="prev, pager, next, jumper"
            :current-page="pageNum"
            :page-size="pageSize"
            :total="total"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="less">
@media (width <= 960px) {
  .market-shell {
    padding: 18px;
  }

  .market-head {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
  }

  .head-search {
    width: 100%;
  }

  .search-input {
    flex: 1;
    width: auto !important;
  }
}

@media (width <= 720px) {
  .category-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .category-chip {
    flex: 0 0 auto;
  }

  .market-grid {
    grid-template-columns: 1fr;
  }

  .footer-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}

:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.market-page {
  --app-bg: #f5f7fb;
  --surface: #fff;
  --border-soft: #e8eef7;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-soft: #eaf1ff;
  --primary-softer: #f2f6ff;
  --text-primary: #1f2937;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
  --text-inverse: #fff;
  --shadow-card: 0 10px 26px rgb(15 23 42 / 6%);
  --shadow-hover: 0 14px 30px rgb(37 99 235 / 8%);
  --font-sans: 'Inter', -apple-system, blinkmacsystemfont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', menlo, monospace;

  min-height: 100%;
  font-family: var(--font-sans);
  color: var(--text-primary);
  background: radial-gradient(circle at 100% 0, rgb(37 99 235 / 5%), transparent 320px),
    linear-gradient(180deg, #f8faff 0%, var(--app-bg) 42%, var(--app-bg) 100%);
}

.market-shell {
  display: flex;
  min-height: 100%;
  padding: 26px 28px 22px;
  flex-direction: column;
  gap: 20px;
}

/* 顶部检索区 */
.market-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--primary);
  text-transform: uppercase;
}

.head-copy h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #172033;
}

.head-copy p {
  max-width: 540px;
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.head-search {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.search-input {
  width: min(340px, 100%);
}

.search-input :deep(.el-input__wrapper) {
  height: 44px;
  padding: 0 14px;
  background: #fff !important;
  border-radius: 14px !important;
  box-shadow: 0 0 0 1px var(--border-soft) inset !important;
  transition:
    box-shadow 0.16s ease,
    background-color 0.16s ease;
}

.search-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd8ea inset !important;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--primary) inset,
    0 0 0 4px rgb(37 99 235 / 8%) !important;
}

.search-prefix-icon {
  color: var(--text-tertiary);
}

/* 搜索按钮：文字左右分散排列、不换行；配色清淡 */
.search-btn {
  height: 44px;
  padding: 0 18px 0 24px; /* 左侧补偿字间距，保持视觉居中 */
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 6px; /* “搜 索” 左右分散 */
  color: var(--primary);
  white-space: nowrap;
  cursor: pointer;
  background: var(--primary-soft);
  border: 1px solid #d8e3f5;
  border-radius: 14px;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.search-btn:hover {
  background: #e1ebff; /* 比浅蓝稍深一点点，仍很清淡 */
  border-color: #cbdaf3;
  transform: translateY(-1px);
}

.search-btn:active {
  transform: translateY(0);
}

/* 分类条 */
.category-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.category-chip {
  display: inline-flex;
  height: 40px;
  padding: 0 16px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #516174;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  align-items: center;
  gap: 8px;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.category-chip :deep(.el-icon) {
  font-size: 15px;
}

.category-chip:hover {
  color: var(--primary);
  background: var(--primary-softer);
  border-color: #dbe6f8;
  transform: translateY(-1px);
}

/* 选中态：浅蓝底 + 蓝字，去掉重色块 */
.category-chip.active {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: #cddcf6;
  box-shadow: 0 4px 12px rgb(37 99 235 / 7%);
}

.market-body {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  gap: 18px;
  flex: 1;
}

/* 卡片网格 */
.market-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.market-card {
  position: relative;
  display: flex;
  min-height: 188px;
  padding: 20px;
  overflow: hidden;
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
  flex-direction: column;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.market-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  background: transparent;
  content: '';
  transition: background-color 0.18s ease;
}

.market-card:hover {
  border-color: #cfddf0;
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
}

/* 顶部高亮线改为浅蓝 */
.market-card:hover::before {
  background: #a9c6f5;
}

.market-card:focus-visible {
  outline: 2px solid #b9cef6;
  outline-offset: 2px;
}

.card-top {
  display: flex;
  min-width: 0;
  margin-bottom: 14px;
  align-items: center;
  gap: 14px;
}

.app-icon {
  display: grid;
  width: 52px;
  height: 52px;
  font-family: var(--font-mono);
  font-size: 19px;
  font-weight: 700;
  color: var(--text-inverse);
  border-radius: 16px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 16%);
  place-items: center;
  flex-shrink: 0;
}

.app-icon.img {
  object-fit: cover;
  background: #eef2f7;
}

.title-area {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
  flex: 1;
}

.app-name {
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  color: #172033;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-tag {
  display: inline-flex;
  align-self: flex-start;
  height: 22px;
  padding: 0 9px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #475569;
  background: #f1f5f9;
  border-radius: 999px;
  align-items: center;
}

.type-chat {
  color: #0f766e;
  background: #ecfdf5;
}

.type-agent {
  color: #b45309;
  background: #fff7ed;
}

.type-workflow {
  color: #2563eb;
  background: #eff6ff;
}

.type-unknown {
  color: #475569;
  background: #f1f5f9;
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
  flex: 1;
}

.card-footer {
  display: flex;
  padding-top: 14px;
  margin-top: auto;
  font-size: 12px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-soft);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meta-time {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enter-btn {
  display: inline-flex;
  padding: 5px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-softer);
  border: 1px solid transparent;
  border-radius: 999px;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  transition:
    color 0.18s ease,
    background-color 0.18s ease;
}

.enter-btn :deep(.el-icon) {
  font-size: 13px;
  transition: transform 0.18s ease;
}

/* hover 仅做浅蓝加深，不再变实心蓝 */
.market-card:hover .enter-btn {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: #d6e3f8;
}

.market-card:hover .enter-btn :deep(.el-icon) {
  transform: translateX(2px);
}

/* 空状态 */
.empty-state {
  display: flex;
  padding: 56px 20px;
  text-align: center;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.empty-icon {
  display: grid;
  width: 60px;
  height: 60px;
  margin-bottom: 10px;
  font-size: 26px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 18px;
  place-items: center;
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #172033;
}

.empty-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

/* 底部分页 */
.footer-bar {
  display: flex;
  min-height: 44px;
  padding: 0 2px;
  margin-top: auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.footer-bar :deep(.el-pagination) {
  --el-pagination-bg-color: transparent;
  --el-pagination-button-disabled-bg-color: transparent;
  --el-pagination-hover-color: var(--primary);
}

.footer-bar :deep(.el-pager li) {
  border-radius: 8px;
}

.footer-bar :deep(.el-pager li.is-active) {
  color: var(--primary);
  background: var(--primary-soft);
}
</style>
