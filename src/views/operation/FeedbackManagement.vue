<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { appApi, type AppConfigVO } from '@/api/frontend-api'
import { operationApi, type FeedbackItem } from '@/api/operation'
import { formatDateTime, normalizeApps } from './utils'

defineOptions({ name: 'OperationFeedbackManagement' })

const loading = ref(false)
const list = ref<FeedbackItem[]>([])
const total = ref(0)
const apps = ref<AppConfigVO[]>([])
const detail = ref<FeedbackItem>()
const detailVisible = ref(false)
const query = reactive({
  page: 1,
  size: 20,
  appId: undefined as number | undefined,
  rating: undefined as 'like' | 'dislike' | undefined,
  keyword: ''
})

const positiveCount = computed(() => list.value.filter((item) => item.rating === 'like').length)

async function load() {
  loading.value = true
  try {
    const result = await operationApi.feedbacks({
      ...query,
      keyword: query.keyword.trim() || undefined
    })
    list.value = result.records || []
    total.value = result.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || '反馈数据加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

function openDetail(row: FeedbackItem) {
  detail.value = row
  detailVisible.value = true
}

onMounted(async () => {
  const appResult = await appApi.list().catch(() => [])
  apps.value = normalizeApps(appResult)
  await load()
})
</script>

<template>
  <div class="operation-page">
    <section class="operation-hero">
      <div
        ><div class="operation-eyebrow">AGENT FEEDBACK</div><h1>反馈管理</h1
        ><p>查看用户对智能体回复的点赞与点踩记录，结合问题和回答原文定位体验问题。</p></div
      >
    </section>

    <section class="operation-panel">
      <div class="filter-bar">
        <el-input
          v-model="query.keyword"
          class="keyword"
          clearable
          :prefix-icon="Search"
          placeholder="搜索用户、智能体或对话内容"
          @keyup.enter="search"
          @clear="search"
        />
        <el-select
          v-model="query.appId"
          class="select"
          clearable
          filterable
          placeholder="全部智能体"
          @change="search"
        >
          <el-option
            v-for="app in apps"
            :key="app.id"
            :label="app.appName"
            :value="Number(app.id)"
          />
        </el-select>
        <el-select
          v-model="query.rating"
          class="select"
          clearable
          placeholder="全部反馈"
          @change="search"
        >
          <el-option label="点赞" value="like" /><el-option label="点踩" value="dislike" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        <span class="filter-summary"
          >当前页 {{ positiveCount }} 条点赞，{{ list.length - positiveCount }} 条点踩</span
        >
      </div>

      <el-table v-loading="loading" :data="list" class="feedback-table" empty-text="暂无反馈数据">
        <el-table-column label="反馈" width="90" align="center">
          <template #default="{ row }"
            ><el-tag :type="row.rating === 'like' ? 'success' : 'danger'" effect="light">{{
              row.rating === 'like' ? '点赞' : '点踩'
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="智能体 / 用户" min-width="190">
          <template #default="{ row }"
            ><div class="table-primary">{{ row.appName || '-' }}</div
            ><div class="table-secondary">{{
              row.nickname || row.username || `用户 #${row.userId || '-'}`
            }}</div></template
          >
        </el-table-column>
        <el-table-column label="用户问题" min-width="260" show-overflow-tooltip
          ><template #default="{ row }">{{ row.query || '-' }}</template></el-table-column
        >
        <el-table-column label="智能体回答" min-width="320" show-overflow-tooltip
          ><template #default="{ row }">{{ row.answer || '-' }}</template></el-table-column
        >
        <el-table-column label="反馈时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createdAt)
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

    <el-drawer v-model="detailVisible" title="反馈详情" size="560px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="反馈"
            ><el-tag :type="detail.rating === 'like' ? 'success' : 'danger'">{{
              detail.rating === 'like' ? '点赞' : '点踩'
            }}</el-tag></el-descriptions-item
          >
          <el-descriptions-item label="智能体">{{ detail.appName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户">{{
            detail.nickname || detail.username || detail.userId || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="时间">{{
            formatDateTime(detail.createdAt)
          }}</el-descriptions-item>
        </el-descriptions>
        <div class="detail-block"
          ><h3>用户问题</h3><p>{{ detail.query || '-' }}</p></div
        >
        <div class="detail-block"
          ><h3>智能体回答</h3><p>{{ detail.answer || '-' }}</p></div
        >
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="less">
@import url('./operation.less');

.feedback-table {
  margin-top: 16px;
}

.filter-summary {
  margin-left: auto;
  font-size: 12px;
  color: var(--op-muted);
}

.detail-block {
  padding: 15px;
  margin-top: 18px;
  background: var(--op-soft);
  border: 1px solid var(--op-border);
  border-radius: 12px;
}

.detail-block h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.detail-block p {
  margin: 0;
  line-height: 1.75;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
}
</style>
