<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { EChartsOption } from 'echarts'
import { Echart } from '@/components/Echart'
import {
  operationApi,
  type AgentUsage,
  type DailyUsage,
  type OperationOverview
} from '@/api/operation'
import { formatCost, formatNumber } from './utils'

defineOptions({ name: 'OperationUsageStatistics' })

const loading = ref(false)
const days = ref(30)
const overview = ref<OperationOverview>({} as OperationOverview)
const trend = ref<DailyUsage[]>([])
const agents = ref<AgentUsage[]>([])

const lineOptions = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['请求量', '活跃用户'] },
  grid: { left: 22, right: 18, top: 48, bottom: 18, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trend.value.map((item) => item.date.slice(5))
  },
  yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#edf1f7' } } },
  series: [
    {
      name: '请求量',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: trend.value.map((item) => item.requestCount),
      lineStyle: { width: 3, color: '#2563eb' },
      areaStyle: { color: 'rgba(37, 99, 235, 0.10)' }
    },
    {
      name: '活跃用户',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: trend.value.map((item) => item.activeUserCount),
      lineStyle: { width: 2, color: '#0ea5a4' }
    }
  ]
}))

const tokenOptions = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 20, right: 12, top: 22, bottom: 18, containLabel: true },
  xAxis: { type: 'category', data: trend.value.map((item) => item.date.slice(5)) },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#edf1f7' } } },
  series: [
    {
      name: 'Token',
      type: 'bar',
      barMaxWidth: 18,
      data: trend.value.map((item) => item.tokenCount),
      itemStyle: { color: '#7c3aed', borderRadius: [5, 5, 0, 0] }
    }
  ]
}))

async function load() {
  loading.value = true
  try {
    const [overviewResult, trendResult, agentResult] = await Promise.all([
      operationApi.overview(days.value),
      operationApi.usageTrend(days.value),
      operationApi.agentUsage(days.value, 12)
    ])
    overview.value = overviewResult
    trend.value = trendResult
    agents.value = agentResult
  } catch (error: any) {
    ElMessage.error(error?.message || '使用统计加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="operation-page">
    <section class="operation-hero">
      <div>
        <div class="operation-eyebrow">USAGE ANALYTICS</div>
        <h1>使用统计</h1>
        <p>聚合智能体请求、会话、用户、Token 与费用，快速识别高频应用和使用趋势。</p>
      </div>
      <el-radio-group v-model="days" @change="load">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
        <el-radio-button :value="90">近 90 天</el-radio-button>
      </el-radio-group>
    </section>

    <section class="metric-grid">
      <article class="metric-card"
        ><span>智能体总数</span><strong>{{ formatNumber(overview.appCount) }}</strong
        ><small>已发布 {{ formatNumber(overview.publishedAppCount) }}</small></article
      >
      <article class="metric-card"
        ><span>请求量</span><strong>{{ formatNumber(overview.requestCount) }}</strong
        ><small>{{ days }} 天内已落库对话</small></article
      >
      <article class="metric-card"
        ><span>活跃用户</span><strong>{{ formatNumber(overview.activeUserCount) }}</strong
        ><small>产生过对话的去重用户</small></article
      >
      <article class="metric-card"
        ><span>Token 消耗</span><strong>{{ formatNumber(overview.tokenCount) }}</strong
        ><small>模型调用累计消耗</small></article
      >
      <article class="metric-card"
        ><span>模型费用</span><strong>{{ formatCost(overview.totalCost) }}</strong
        ><small>按消息元数据汇总</small></article
      >
      <article class="metric-card"
        ><span>工具成功率</span
        ><strong>{{ Number(overview.toolSuccessRate || 0).toFixed(1) }}%</strong
        ><small>{{ formatNumber(overview.toolCallCount) }} 次工具调用</small></article
      >
      <article class="metric-card"
        ><span>反馈好评率</span><strong>{{ Number(overview.positiveRate || 0).toFixed(1) }}%</strong
        ><small
          >{{ formatNumber(overview.positiveCount + overview.negativeCount) }} 条有效反馈</small
        ></article
      >
      <article class="metric-card"
        ><span>平均响应耗时</span
        ><strong>{{ Number(overview.avgLatency || 0).toFixed(2) }} s</strong
        ><small>基于模型返回 latency</small></article
      >
    </section>

    <section class="chart-grid">
      <div class="operation-panel">
        <div class="panel-title"
          ><div><h2>请求趋势</h2><p>每日请求量与活跃用户变化</p></div></div
        >
        <Echart :options="lineOptions" :height="310" />
      </div>
      <div class="operation-panel">
        <div class="panel-title"
          ><div><h2>Token 趋势</h2><p>每日模型 Token 消耗</p></div></div
        >
        <Echart :options="tokenOptions" :height="310" />
      </div>
    </section>

    <section class="operation-panel">
      <div class="panel-title"
        ><div><h2>智能体使用排行</h2><p>按请求量排序，数据来自本地聊天记录</p></div></div
      >
      <el-table :data="agents" empty-text="当前时间范围暂无使用数据">
        <el-table-column type="index" label="#" width="56" />
        <el-table-column label="智能体" min-width="210">
          <template #default="{ row }"
            ><div class="table-primary">{{ row.appName }}</div
            ><div class="table-secondary">{{ row.appType || '未标注类型' }}</div></template
          >
        </el-table-column>
        <el-table-column label="请求量" width="110" align="right"
          ><template #default="{ row }">{{
            formatNumber(row.requestCount)
          }}</template></el-table-column
        >
        <el-table-column label="活跃用户" width="110" align="right"
          ><template #default="{ row }">{{
            formatNumber(row.activeUserCount)
          }}</template></el-table-column
        >
        <el-table-column label="Token" width="130" align="right"
          ><template #default="{ row }">{{
            formatNumber(row.tokenCount)
          }}</template></el-table-column
        >
        <el-table-column label="费用" width="120" align="right"
          ><template #default="{ row }">{{ formatCost(row.cost) }}</template></el-table-column
        >
        <el-table-column label="平均耗时" width="110" align="right"
          ><template #default="{ row }"
            >{{ Number(row.avgLatency || 0).toFixed(2) }} s</template
          ></el-table-column
        >
        <el-table-column label="反馈" width="120" align="center"
          ><template #default="{ row }"
            ><span class="positive">{{ row.positiveCount }} 赞</span> /
            <span class="negative">{{ row.negativeCount }} 踩</span></template
          ></el-table-column
        >
      </el-table>
    </section>
  </div>
</template>

<style scoped lang="less">
@import url('./operation.less');

.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.positive {
  color: #16a34a;
}

.negative {
  color: #dc2626;
}
</style>
