<script setup lang="ts">
import { computed } from 'vue'
import { Delete, Download } from '@element-plus/icons-vue'
import { Icon } from '@/components/Icon'
import type { DocumentVO, IndexingStatusItem } from '@/api/knowledge/types'
import { RUNNING_STATUSES } from '../constants'
import { compactNumber, fileIcon, fmtTs } from '../utils'
import IndexingStatusBadge from './IndexingStatusBadge.vue'

const props = defineProps<{
  doc: DocumentVO
  status?: IndexingStatusItem
}>()

const emit = defineEmits<{
  download: [DocumentVO]
  remove: [DocumentVO]
}>()

const currentStatus = computed(() => props.status?.indexing_status || props.doc.indexing_status)
const currentError = computed(() => props.status?.error || props.doc.error)
const completed = computed(() => Number(props.status?.completed_segments || 0))
const total = computed(() => Number(props.status?.total_segments || 0))
const progress = computed(() =>
  total.value > 0 ? Math.min(100, Math.round((completed.value / total.value) * 100)) : 0
)
const isRunning = computed(() => RUNNING_STATUSES.includes(currentStatus.value))
const canRemove = computed(() => !isRunning.value && !props.doc.archived)
</script>

<template>
  <article class="doc-row">
    <div class="doc-icon">
      <Icon :icon="fileIcon(doc.name)" :size="30" />
    </div>

    <div class="doc-main">
      <h3>{{ doc.name }}</h3>
      <div class="doc-meta">
        <span>{{ compactNumber(doc.word_count) }} 字</span>
        <span>{{ fmtTs(doc.created_at) }}</span>
      </div>
    </div>

    <div class="doc-status">
      <IndexingStatusBadge :status="currentStatus" :error="currentError" />
    </div>

    <div class="doc-actions">
      <el-button :icon="Download" text bg @click="emit('download', doc)">下载</el-button>
      <el-button
        :icon="Delete"
        text
        bg
        type="danger"
        :disabled="!canRemove"
        @click="emit('remove', doc)"
      >
        删除
      </el-button>
    </div>

    <div v-if="(isRunning && total > 0) || currentError" class="doc-extra">
      <div v-if="isRunning && total > 0" class="ix-progress">
        <div class="ix-progress-track">
          <div class="ix-progress-bar" :style="{ width: `${progress}%` }"></div>
        </div>
        <span>{{ completed }}/{{ total }} 段</span>
      </div>
      <p v-if="currentError" class="doc-error">{{ currentError }}</p>
    </div>
  </article>
</template>

<style scoped lang="less">
.doc-row {
  display: grid;
  min-height: 82px;
  padding: 16px 18px;
  align-items: center;
  background: var(--surface, #fff);
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  grid-template-columns: 48px minmax(320px, 1fr) 116px 160px;
  gap: 16px;
}

.doc-row:hover {
  border-color: #c7d5ea;
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgb(15 23 42 / 6%);
}

.doc-icon {
  display: grid;
  width: 48px;
  height: 48px;
  color: var(--primary, #2563eb);
  background: var(--primary-softer, #f2f6ff);
  border: 1px solid #dce7f8;
  border-radius: 14px;
  place-items: center;
}

.doc-main {
  min-width: 0;
}

.doc-main h3 {
  margin: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main, #172033);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.doc-meta {
  display: flex;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  flex-wrap: wrap;
  gap: 8px 14px;
}

.doc-extra {
  grid-column: 2 / -1;
}

.ix-progress {
  display: grid;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.ix-progress-track {
  height: 6px;
  overflow: hidden;
  background: #eef2f8;
  border-radius: 999px;
}

.ix-progress-bar {
  height: 100%;
  background: var(--primary, #2563eb);
  border-radius: inherit;
  transition: width 0.2s ease;
}

.doc-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #b91c1c;
}

.doc-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

@media (width <= 760px) {
  .doc-row {
    align-items: flex-start;
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .doc-status {
    grid-column: 2 / -1;
    justify-content: flex-start;
  }

  .doc-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }

  .doc-extra {
    grid-column: 1 / -1;
  }
}
</style>
