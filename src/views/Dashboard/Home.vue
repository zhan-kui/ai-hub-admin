<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { dashboardApi, type DashboardOverviewVO } from '@/api/frontend-api'

interface MetricCard {
  key: string
  label: string
  value: string
  helper: string
  accent: 'blue' | 'cyan' | 'green' | 'amber' | 'violet' | 'slate'
  icon: string
}

interface ModuleCard {
  title: string
  description: string
  metrics: Array<{ label: string; value: string }>
  action: string
  icon: string
  path: string
}

interface WorkbenchItem {
  title: string
  description: string
  meta: string
  icon: string
  path: string
  routeName?: string
}

const router = useRouter()
const loading = ref(false)
const overview = ref<DashboardOverviewVO>({
  appCount: 0,
  publishedAppCount: 0,
  knowledgeCount: 0,
  writingDocCount: 0,
  conversationCount: 0,
  messageCount: 0,
  todayRequestCount: 0,
  todayTokenCount: 0,
  todayCost: 0
})

const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value || 0)

const coreMetrics = computed<MetricCard[]>(() => [
  {
    key: 'apps',
    label: 'AI 智能体',
    value: formatNumber(overview.value.appCount),
    helper: '未删除的业务智能体，不含系统应用',
    accent: 'blue',
    icon: 'app'
  },
  {
    key: 'published',
    label: '已发布智能体',
    value: formatNumber(overview.value.publishedAppCount),
    helper: '可被用户访问的智能体数量',
    accent: 'green',
    icon: 'publish'
  },
  {
    key: 'knowledge',
    label: '知识库',
    value: formatNumber(overview.value.knowledgeCount),
    helper: '已创建知识库总数',
    accent: 'cyan',
    icon: 'database'
  },
  {
    key: 'documents',
    label: '消息总量',
    value: formatNumber(overview.value.messageCount),
    helper: '平台累计保存的对话消息',
    accent: 'violet',
    icon: 'doc'
  },
  {
    key: 'writing',
    label: '写作文档',
    value: formatNumber(overview.value.writingDocCount),
    helper: 'AI 写作中保存的文档',
    accent: 'amber',
    icon: 'pen'
  },
  {
    key: 'chat',
    label: '对话会话',
    value: formatNumber(overview.value.conversationCount),
    helper: '用户与智能体产生的会话数',
    accent: 'slate',
    icon: 'chat'
  }
])

const moduleCards = computed<ModuleCard[]>(() => [
  {
    title: '智能体中心',
    description: '管理智能体、发布状态和编排入口。',
    icon: 'app',
    path: '/agents',
    action: '进入智能体管理',
    metrics: [
      { label: '智能体总数', value: formatNumber(overview.value.appCount) },
      { label: '已发布', value: formatNumber(overview.value.publishedAppCount) },
      {
        label: '待发布',
        value: formatNumber(Math.max(0, overview.value.appCount - overview.value.publishedAppCount))
      }
    ]
  },
  {
    title: '知识库',
    description: '维护企业知识库、文档、分段和检索能力。',
    icon: 'database',
    path: '/knowledge',
    action: '进入知识库',
    metrics: [{ label: '知识库', value: formatNumber(overview.value.knowledgeCount) }]
  },
  {
    title: 'AI 写作',
    description: '沉淀写作内容，支持续写、润色和文档管理。',
    icon: 'pen',
    path: '/ai/writing',
    action: '进入写作',
    metrics: [
      { label: '文档', value: formatNumber(overview.value.writingDocCount) },
      { label: '能力', value: '生成' },
      { label: '保存', value: '自动' }
    ]
  },
  {
    title: 'AI 对话',
    description: '基于已发布智能体进行对话、上传文件和语音输入。',
    icon: 'chat',
    path: '/chat',
    action: '进入对话',
    metrics: [
      { label: '会话', value: formatNumber(overview.value.conversationCount) },
      { label: '消息', value: formatNumber(overview.value.messageCount) },
      { label: '今日请求', value: formatNumber(overview.value.todayRequestCount) }
    ]
  }
])

const operationMetrics = computed(() => [
  {
    label: '今日请求量',
    value: formatNumber(overview.value.todayRequestCount),
    helper: '已落库的对话调用（含系统应用）'
  },
  {
    label: '今日 Token',
    value: formatNumber(overview.value.todayTokenCount),
    helper: '平台模型调用 Token 消耗'
  },
  {
    label: '今日费用',
    value: `¥${Number(overview.value.todayCost || 0).toFixed(4)}`,
    helper: '模型调用累计费用'
  },
  {
    label: '消息总量',
    value: formatNumber(overview.value.messageCount),
    helper: '平台历史消息记录'
  }
])

const workbenchItems: WorkbenchItem[] = [
  {
    title: '管理智能体',
    description: '查看、创建和维护平台智能体。',
    meta: '智能体管理',
    icon: 'plus',
    path: '/agents',
    routeName: 'AgentManagement'
  },
  {
    title: '新建知识库',
    description: '按流程配置知识库并接入文档。',
    meta: '知识库',
    icon: 'database',
    path: '/knowledge'
  },
  {
    title: '上传知识文档',
    description: '为知识库补充可检索的业务资料。',
    meta: '文档管理',
    icon: 'upload',
    path: '/knowledge'
  },
  {
    title: '开始写作',
    description: '使用 AI 续写、润色企业内容。',
    meta: 'AI 写作',
    icon: 'pen',
    path: '/ai/writing',
    routeName: 'AiWriting'
  }
]

async function loadOverview() {
  loading.value = true
  try {
    overview.value = await dashboardApi.overview()
  } catch (error: any) {
    ElMessage.error(error?.message || '首页数据加载失败')
  } finally {
    loading.value = false
  }
}

function navigate(path: string) {
  void router.push(path)
}

function navigateWorkbench(item: WorkbenchItem) {
  void router.push(item.routeName ? { name: item.routeName } : item.path)
}

onMounted(loadOverview)
</script>

<template>
  <div v-loading="loading" class="dashboard-page">
    <section class="dashboard-hero">
      <div class="hero-copy">
        <div class="eyebrow">AI HUB OVERVIEW</div>
        <h1>工作台总览</h1>
        <p>围绕 AI 智能体、知识库、智能写作和对话能力，集中查看业务数据与常用入口。</p>
      </div>
    </section>

    <section class="metrics-grid" aria-label="核心数据">
      <article
        v-for="metric in coreMetrics"
        :key="metric.key"
        class="metric-card"
        :class="`tone-${metric.accent}`"
      >
        <div class="metric-top">
          <span class="metric-icon" :class="`icon-${metric.icon}`">
            <svg
              v-if="metric.icon === 'app'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <rect x="4" y="4" width="7" height="7" rx="2" />
              <rect x="13" y="4" width="7" height="7" rx="2" />
              <rect x="4" y="13" width="7" height="7" rx="2" />
              <rect x="13" y="13" width="7" height="7" rx="2" />
            </svg>
            <svg
              v-else-if="metric.icon === 'publish'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path d="M12 3v12" />
              <path d="M7 8l5-5 5 5" />
              <path d="M5 15v4h14v-4" />
            </svg>
            <svg
              v-else-if="metric.icon === 'database'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <ellipse cx="12" cy="5" rx="7" ry="3" />
              <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
              <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
            </svg>
            <svg
              v-else-if="metric.icon === 'doc'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
              <path d="M14 3v5h5" />
              <path d="M8 13h8M8 17h6" />
            </svg>
            <svg
              v-else-if="metric.icon === 'pen'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </span>
          <span class="metric-tag">{{ metric.key }}</span>
        </div>
        <div class="metric-label">{{ metric.label }}</div>
        <div class="metric-value">{{ metric.value }}</div>
        <div class="metric-helper">{{ metric.helper }}</div>
      </article>
    </section>

    <section class="dashboard-layout">
      <div class="module-overview">
        <div class="section-head">
          <div>
            <h2>功能数据概览</h2>
            <p>按已有业务模块聚合统计，后续可直接接入各模块接口。</p>
          </div>
        </div>

        <div class="module-grid">
          <article
            v-for="item in moduleCards"
            :key="item.title"
            class="module-card"
            role="button"
            tabindex="0"
            @click="navigate(item.path)"
            @keyup.enter="navigate(item.path)"
          >
            <div class="module-head">
              <span class="module-icon" :class="`icon-${item.icon}`">
                <svg
                  v-if="item.icon === 'app'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <rect x="4" y="4" width="7" height="7" rx="2" />
                  <rect x="13" y="4" width="7" height="7" rx="2" />
                  <rect x="4" y="13" width="7" height="7" rx="2" />
                  <rect x="13" y="13" width="7" height="7" rx="2" />
                </svg>
                <svg
                  v-else-if="item.icon === 'database'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <ellipse cx="12" cy="5" rx="7" ry="3" />
                  <path d="M5 5v12c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
                </svg>
                <svg
                  v-else-if="item.icon === 'pen'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
            </div>
            <div class="module-metrics">
              <div v-for="metric in item.metrics" :key="metric.label">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
              </div>
            </div>
            <button class="module-action" type="button" @click.stop="navigate(item.path)">
              <span>{{ item.action }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </article>
        </div>
      </div>

      <aside class="operation-panel">
        <div class="section-head compact">
          <div>
            <h2>今日调用概览</h2>
            <p>对话、写作、知识检索等调用数据。</p>
          </div>
        </div>

        <div class="operation-list">
          <div v-for="item in operationMetrics" :key="item.label" class="operation-item">
            <div class="operation-row">
              <div>
                <div class="operation-label">{{ item.label }}</div>
                <div class="operation-helper">{{ item.helper }}</div>
              </div>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>
      </aside>
    </section>

    <section class="workbench-section">
      <div class="section-head">
        <div>
          <h2>常用工作区</h2>
          <p>围绕已有功能提供更直接的操作入口。</p>
        </div>
      </div>

      <div class="workbench-grid">
        <article
          v-for="item in workbenchItems"
          :key="item.title"
          class="workbench-card"
          role="button"
          tabindex="0"
          @click="navigateWorkbench(item)"
          @keyup.enter="navigateWorkbench(item)"
        >
          <div class="workbench-icon" :class="`icon-${item.icon}`">
            <svg
              v-if="item.icon === 'plus'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <svg
              v-else-if="item.icon === 'database'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <ellipse cx="12" cy="5" rx="7" ry="3" />
              <path d="M5 5v12c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
            </svg>
            <svg
              v-else-if="item.icon === 'upload'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path d="M12 3v12" />
              <path d="M7 8l5-5 5 5" />
              <path d="M4 17v3h16v-3" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
            </svg>
          </div>
          <div class="workbench-body">
            <span>{{ item.meta }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </div>
          <svg
            class="workbench-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.dashboard-page {
  --page-bg: #f5f7fb;
  --panel-bg: #fff;
  --panel-soft: #f8faff;
  --border: #e4eaf3;
  --border-strong: #d5dfef;
  --primary: #2563eb;
  --primary-soft: #eaf1ff;
  --text-main: #1f2937;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --success: #16a34a;
  --cyan: #0891b2;
  --amber: #d97706;
  --violet: #7c3aed;
  --font-sans: 'Inter', -apple-system, blinkmacsystemfont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', menlo, monospace;

  min-height: 100%;
  padding: 24px;
  font-family: var(--font-sans);
  color: var(--text-main);
  background: linear-gradient(180deg, #f8fbff 0%, var(--page-bg) 44%, #f5f7fb 100%);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: end;
  margin-bottom: 18px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--primary);
}

.hero-copy h1 {
  margin: 8px 0 6px;
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.03em;
}

.hero-copy p {
  max-width: 720px;
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.metric-card,
.module-overview,
.operation-panel,
.workbench-section {
  background: rgb(255 255 255 / 76%);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 4%);
}

.metric-card {
  position: relative;
  padding: 16px;
  overflow: hidden;
  transition: all 0.18s ease;
}

.metric-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgb(15 23 42 / 6%);
}

.metric-card::before {
  position: absolute;
  top: 0;
  right: 0;
  width: 78px;
  height: 78px;
  background: var(--tone-soft, var(--primary-soft));
  border-bottom-left-radius: 100%;
  content: '';
  opacity: 0.78;
}

.metric-top {
  position: relative;
  z-index: 1;
  display: flex;
  margin-bottom: 16px;
  align-items: center;
  justify-content: space-between;
}

.metric-icon,
.module-icon,
.workbench-icon {
  display: grid;
  width: 38px;
  height: 38px;
  color: var(--tone, var(--primary));
  background: var(--tone-soft, var(--primary-soft));
  border: 1px solid color-mix(in srgb, var(--tone, var(--primary)) 18%, white);
  border-radius: 12px;
  place-items: center;
  flex-shrink: 0;
}

.metric-icon svg,
.module-icon svg,
.workbench-icon svg {
  width: 19px;
  height: 19px;
}

.metric-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.metric-label {
  position: relative;
  z-index: 1;
  margin-bottom: 7px;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-secondary);
}

.metric-value {
  position: relative;
  z-index: 1;
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 780;
  letter-spacing: -0.02em;
}

.metric-helper {
  position: relative;
  z-index: 1;
  min-height: 34px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}

.tone-blue,
.icon-app,
.icon-plus {
  --tone: var(--primary);
  --tone-soft: #eaf1ff;
}

.tone-green,
.icon-publish {
  --tone: var(--success);
  --tone-soft: #eaf7ef;
}

.tone-cyan,
.icon-database,
.icon-upload {
  --tone: var(--cyan);
  --tone-soft: #e6f7fb;
}

.tone-amber,
.icon-pen {
  --tone: var(--amber);
  --tone-soft: #fff5e6;
}

.tone-violet,
.icon-doc {
  --tone: var(--violet);
  --tone-soft: #f1ebff;
}

.tone-slate,
.icon-chat {
  --tone: #475569;
  --tone-soft: #eef2f7;
}

.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.module-overview,
.operation-panel,
.workbench-section {
  padding: 18px;
}

.operation-panel {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.section-head {
  display: flex;
  margin-bottom: 14px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-head.compact {
  margin-bottom: 16px;
}

.section-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.015em;
}

.section-head p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.module-card,
.workbench-card,
.operation-item {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.module-card {
  padding: 16px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.module-card:hover,
.workbench-card:hover {
  border-color: #bfd0ef;
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgb(15 23 42 / 5%);
}

.module-head {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.module-head h3 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 750;
}

.module-head p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.module-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 16px 0 14px;
}

.module-metrics div {
  padding: 10px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.module-metrics span {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.module-metrics strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 17px;
}

.module-action {
  display: flex;
  width: 100%;
  padding-top: 12px;
  font-size: 13px;
  font-weight: 650;
  color: var(--primary);
  cursor: pointer;
  background: transparent;
  border-top: 1px solid var(--border);
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  align-items: center;
  justify-content: space-between;
}

.module-action svg,
.workbench-arrow {
  width: 16px;
  height: 16px;
  transition: transform 0.18s ease;
}

.module-card:hover .module-action svg,
.workbench-card:hover .workbench-arrow {
  transform: translateX(3px);
}

.operation-list {
  display: grid;
  flex: 1;
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.operation-item {
  display: flex;
  padding: 14px;
  flex-direction: column;
  justify-content: center;
}

.operation-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.operation-label {
  margin-bottom: 3px;
  font-size: 13px;
  font-weight: 700;
}

.operation-helper {
  font-size: 12px;
  color: var(--text-secondary);
}

.operation-row strong {
  font-family: var(--font-mono);
  font-size: 18px;
}

.operation-track {
  height: 6px;
  margin-top: 12px;
  overflow: hidden;
  background: #edf2fa;
  border-radius: 999px;
}

.operation-track span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #2563eb 0%, #0891b2 100%);
  border-radius: inherit;
}

.workbench-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.workbench-card {
  position: relative;
  display: flex;
  min-height: 150px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.18s ease;
  flex-direction: column;
}

.workbench-body {
  padding-right: 22px;
  margin-top: 16px;
}

.workbench-body span {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.workbench-body h3 {
  margin: 6px 0 5px;
  font-size: 15px;
  font-weight: 750;
}

.workbench-body p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.workbench-arrow {
  position: absolute;
  right: 16px;
  bottom: 16px;
  color: var(--text-muted);
}

@media (width <= 1440px) {
  .metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dashboard-layout {
    grid-template-columns: 1fr;
  }

  .workbench-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 900px) {
  .dashboard-page {
    padding: 18px;
  }

  .dashboard-hero {
    grid-template-columns: 1fr;
  }

  .metrics-grid,
  .module-grid,
  .workbench-grid {
    grid-template-columns: 1fr;
  }
}
</style>
