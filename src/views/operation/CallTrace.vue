<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { toDisplayJson, toDisplayText } from '@/utils/display-text'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { appApi, type AppConfigVO } from '@/api/frontend-api'
import { operationApi, type ToolTraceItem } from '@/api/operation'
import JsonEditor from '@/views/tools/components/JsonEditor.vue'
import { formatDateTime, normalizeApps, parseJsonText } from './utils'

defineOptions({ name: 'OperationCallTrace' })

const loading = ref(false)
const list = ref<ToolTraceItem[]>([])
const total = ref(0)
const apps = ref<AppConfigVO[]>([])
const detail = ref<ToolTraceItem>()
const detailVisible = ref(false)
const query = reactive({
  page: 1,
  size: 20,
  days: 30,
  appId: undefined as number | undefined,
  success: undefined as 0 | 1 | undefined,
  providerType: undefined as string | undefined,
  keyword: ''
})

async function load() {
  loading.value = true
  try {
    const result = await operationApi.toolTraces({
      ...query,
      keyword: query.keyword.trim() || undefined
    })
    list.value = result.records || []
    total.value = result.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || '调用追踪加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}
function openDetail(row: ToolTraceItem) {
  detail.value = row
  detailVisible.value = true
}
function jsonText(value?: string) {
  return toDisplayJson(parseJsonText(value))
}

onMounted(async () => {
  const appResult = await appApi.list().catch(() => [])
  apps.value = normalizeApps(appResult)
  await load()
})
</script>

<template>
  <div class="operation-page">
    <section class="operation-hero"
      ><div
        ><div class="operation-eyebrow">AGENT TOOL TRACE</div><h1>调用追踪</h1
        ><p>跟踪智能体执行 MCP、HTTP 与本地工具的完整链路，快速定位失败、超时和参数问题。</p></div
      ></section
    >
    <section class="operation-panel">
      <div class="filter-bar">
        <el-input
          v-model="query.keyword"
          class="keyword"
          clearable
          :prefix-icon="Search"
          placeholder="Trace ID、工具名称或用户"
          @keyup.enter="search"
          @clear="search"
        />
        <el-select v-model="query.days" class="select" @change="search"
          ><el-option label="近 7 天" :value="7" /><el-option
            label="近 30 天"
            :value="30" /><el-option label="近 90 天" :value="90"
        /></el-select>
        <el-select
          v-model="query.appId"
          class="select"
          clearable
          filterable
          placeholder="全部智能体"
          @change="search"
          ><el-option
            v-for="app in apps"
            :key="app.id"
            :label="app.appName"
            :value="Number(app.id)"
        /></el-select>
        <el-select
          v-model="query.providerType"
          class="select"
          clearable
          placeholder="全部工具类型"
          @change="search"
          ><el-option label="MCP" value="MCP" /><el-option label="HTTP" value="HTTP" /><el-option
            label="LOCAL"
            value="LOCAL"
        /></el-select>
        <el-select
          v-model="query.success"
          class="select"
          clearable
          placeholder="全部结果"
          @change="search"
          ><el-option label="成功" :value="1" /><el-option label="失败" :value="0"
        /></el-select>
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      </div>
      <el-table v-loading="loading" :data="list" class="trace-table" empty-text="暂无工具调用记录">
        <el-table-column label="调用结果" width="96"
          ><template #default="{ row }"
            ><el-tag :type="row.success ? 'success' : 'danger'">{{
              row.success ? '成功' : '失败'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="工具" min-width="190"
          ><template #default="{ row }"
            ><div class="table-primary">{{ toDisplayText(row.toolName || row.toolCode) }}</div
            ><div class="table-secondary"
              >{{ toDisplayText(row.providerType) }} · {{ toDisplayText(row.toolCode) }}</div
            ></template
          ></el-table-column
        >
        <el-table-column label="智能体 / 用户" min-width="180"
          ><template #default="{ row }"
            ><div>{{ row.appName || '未关联智能体' }}</div
            ><div class="table-secondary">{{
              row.username || `用户 #${row.userId || '-'}`
            }}</div></template
          ></el-table-column
        >
        <el-table-column
          prop="executionTraceId"
          label="Trace ID"
          min-width="245"
          show-overflow-tooltip
        />
        <el-table-column label="耗时" width="100" align="right"
          ><template #default="{ row }">{{ row.durationMs || 0 }} ms</template></el-table-column
        >
        <el-table-column label="错误码" width="160"
          ><template #default="{ row }"
            ><span :class="{ 'error-code': row.errorCode }">{{
              toDisplayText(row.errorCode || '-')
            }}</span></template
          ></el-table-column
        >
        <el-table-column label="调用时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="80" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row)">详情</el-button></template
          ></el-table-column
        >
      </el-table>
      <div class="pagination"
        ><el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          :total="total"
          @change="load"
      /></div>
    </section>

    <el-drawer v-model="detailVisible" title="工具调用详情" size="640px">
      <template v-if="detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="结果"
            ><el-tag :type="detail.success ? 'success' : 'danger'">{{
              detail.success ? '成功' : '失败'
            }}</el-tag></el-descriptions-item
          >
          <el-descriptions-item label="耗时">{{ detail.durationMs || 0 }} ms</el-descriptions-item>
          <el-descriptions-item label="工具">{{
            toDisplayText(detail.toolName || detail.toolCode)
          }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{
            toDisplayText(detail.providerType)
          }}</el-descriptions-item>
          <el-descriptions-item label="Trace ID" :span="2">{{
            detail.executionTraceId
          }}</el-descriptions-item>
          <el-descriptions-item label="智能体">{{ detail.appName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户">{{
            detail.username || detail.userId || '-'
          }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.errorCode" label="错误码" :span="2">{{
            toDisplayText(detail.errorCode)
          }}</el-descriptions-item>
        </el-descriptions>
        <h3 class="json-title">调用参数（敏感字段已脱敏）</h3
        ><JsonEditor :model-value="jsonText(detail.argsRedactedJson)" readonly :height="240" />
        <h3 class="json-title">来源信息</h3
        ><JsonEditor :model-value="jsonText(detail.sourcesJson)" readonly :height="180" />
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="less">
@import url('./operation.less');

.trace-table {
  margin-top: 16px;
}

.error-code {
  font-weight: 650;
  color: var(--el-color-danger);
}

.json-title {
  margin: 20px 0 9px;
  font-size: 14px;
}
</style>
