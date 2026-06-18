<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/api/knowledge'

const props = defineProps<{ datasetId: string }>()

const loading = ref(false)
const query = ref('')
const records = ref<any[]>([])

function pickRecords(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.records)) return payload.records
  if (Array.isArray(payload?.data?.records)) return payload.data.records
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

async function submit() {
  const text = query.value.trim()
  if (!text) {
    ElMessage.warning('请输入检索内容')
    return
  }
  loading.value = true
  try {
    const res = await knowledgeApi.retrieve(props.datasetId, { query: text })
    records.value = pickRecords(res)
  } catch (error: any) {
    ElMessage.error(error?.message || '检索测试失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="retrieve-tester">
    <div class="retrieve-input">
      <el-input
        v-model="query"
        type="textarea"
        :rows="3"
        resize="none"
        placeholder="输入一段问题或关键词，测试当前知识库的命中效果"
        @keyup.ctrl.enter="submit"
      />
      <el-button type="primary" :icon="Search" :loading="loading" @click="submit">测试</el-button>
    </div>

    <div v-if="records.length" class="retrieve-list">
      <article v-for="(item, index) in records" :key="item.id || index" class="retrieve-item">
        <div class="retrieve-head">
          <strong>{{
            item.document_name || item.documentName || item.source || `命中 ${index + 1}`
          }}</strong>
          <span v-if="item.score != null">{{ Math.round(Number(item.score) * 100) }}%</span>
        </div>
        <p>{{ item.content || item.text || item.segment || item.answer || '-' }}</p>
      </article>
    </div>

    <el-empty v-else description="暂无检索结果" />
  </div>
</template>

<style scoped lang="less">
.retrieve-tester {
  display: grid;
  gap: 14px;
}

.retrieve-input {
  display: grid;
  padding: 14px;
  background: var(--panel-soft, #f8faff);
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 16px;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

.retrieve-list {
  display: grid;
  gap: 12px;
}

.retrieve-item {
  padding: 14px;
  background: #fff;
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 14px;
}

.retrieve-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.retrieve-head strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-main, #172033);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.retrieve-head span {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--primary, #2563eb);
}

.retrieve-item p {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary, #64748b);
}

@media (width <= 760px) {
  .retrieve-input {
    grid-template-columns: 1fr;
  }
}
</style>
