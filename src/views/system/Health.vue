<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import { DEFAULT_API_BASE_URL, systemApi } from '@/api/frontend-api'

interface HealthState {
  status: string
  timestamp: string
}

const loading = ref(false)
const health = ref<HealthState | null>(null)
const latencyMs = ref<number | null>(null)
const errorMessage = ref('')
const autoRefresh = ref(true)
const intervalSeconds = ref(30)

let timer: number | null = null

const statusTagType = computed(() => (health.value?.status === 'UP' ? 'success' : 'danger'))
const refreshedAt = computed(() => {
  if (!health.value?.timestamp) return '-'
  return new Date(health.value.timestamp).toLocaleString()
})

function clearTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

function setupTimer() {
  clearTimer()
  if (!autoRefresh.value) return
  timer = window.setInterval(
    () => {
      void fetchHealth(false)
    },
    Math.max(5, Number(intervalSeconds.value || 30)) * 1000
  )
}

async function fetchHealth(showToast = false) {
  loading.value = true
  errorMessage.value = ''
  const start = performance.now()
  try {
    const response = await systemApi.health()
    health.value = {
      status: response?.status || 'UNKNOWN',
      timestamp: response?.timestamp || ''
    }
    latencyMs.value = Math.round(performance.now() - start)
    if (showToast) ElMessage.success('健康状态已刷新')
  } catch (error: any) {
    health.value = null
    latencyMs.value = null
    errorMessage.value = error?.message || '健康检查失败'
    if (showToast) ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchHealth()
  setupTimer()
})

onBeforeUnmount(() => {
  clearTimer()
})
</script>

<template>
  <ContentWrap title="系统监控" message="监控 API 服务运行状态">
    <div class="toolbar">
      <el-space>
        <el-switch v-model="autoRefresh" active-text="自动刷新" @change="setupTimer" />
        <el-input-number
          v-model="intervalSeconds"
          :min="5"
          :max="300"
          :step="5"
          controls-position="right"
          @change="setupTimer"
        />
        <span class="interval-label">秒</span>
      </el-space>

      <el-button type="primary" :loading="loading" @click="fetchHealth(true)">刷新</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="status-card">
          <div class="status-title">服务状态</div>
          <el-tag :type="statusTagType" size="large">{{ health?.status || 'UNKNOWN' }}</el-tag>
          <div class="status-meta">
            <div><strong>最近时间戳：</strong>{{ refreshedAt }}</div>
            <div><strong>请求耗时：</strong>{{ latencyMs ?? '-' }} ms</div>
          </div>
          <el-alert
            v-if="errorMessage"
            class="mt-12px"
            type="error"
            :closable="false"
            :title="errorMessage"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="status-card">
          <div class="status-title">运行信息</div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="API 基础地址">{{
              DEFAULT_API_BASE_URL
            }}</el-descriptions-item>
            <el-descriptions-item label="自动刷新">{{
              autoRefresh ? '已开启' : '已关闭'
            }}</el-descriptions-item>
            <el-descriptions-item label="刷新间隔">{{ intervalSeconds }} 秒</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </ContentWrap>
</template>

<style scoped lang="less">
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 12px;
}

.interval-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-card {
  min-height: 220px;
}

.status-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.status-meta {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
}
</style>
