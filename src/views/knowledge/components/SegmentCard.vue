<script setup lang="ts">
import { computed } from 'vue'
import { Delete, EditPen, View } from '@element-plus/icons-vue'
import type { DifyDocForm, DifySegment } from '@/api/knowledge/segment'
import { padPosition, statusColor, statusLabel } from '../segment-utils'

const props = withDefaults(
  defineProps<{
    segment: DifySegment
    docForm: DifyDocForm
    toggleLoading?: boolean
  }>(),
  { toggleLoading: false }
)

const emit = defineEmits<{
  edit: [DifySegment]
  view: [DifySegment]
  remove: [DifySegment]
  child: [DifySegment]
  toggle: [boolean]
}>()

const isIndexing = computed(() => props.segment.status === 'indexing')
const visibleKeywords = computed(() => (props.segment.keywords || []).slice(0, 5))
const hiddenKeywordCount = computed(() => Math.max(0, (props.segment.keywords?.length || 0) - 5))
const childCount = computed(() => props.segment.child_chunks?.length || 0)

function viewSegment() {
  emit('view', props.segment)
}

function handleToggle(value: string | number | boolean) {
  emit('toggle', Boolean(value))
}
</script>

<template>
  <article
    class="seg-card"
    :class="{
      disabled: segment.enabled === false,
      error: segment.status === 'error',
      indexing: isIndexing
    }"
    @click="viewSegment"
  >
    <div class="card-head">
      <div class="head-left">
        <span class="position-tag">{{ padPosition(segment.position) }}</span>
        <el-tooltip :content="segment.error || statusLabel(segment.status)" placement="top">
          <span class="status-wrap">
            <i class="status-dot" :style="{ backgroundColor: statusColor(segment.status) }"></i>
            {{ statusLabel(segment.status) }}
          </span>
        </el-tooltip>
        <span v-if="segment.enabled === false" class="disabled-tag">已禁用</span>
      </div>
      <el-tooltip content="启用或禁用检索" placement="top">
        <el-switch
          :model-value="segment.enabled !== false"
          size="small"
          :loading="toggleLoading"
          :disabled="isIndexing"
          @click.stop
          @change="handleToggle"
        />
      </el-tooltip>
    </div>

    <div class="card-body">
      <template v-if="docForm === 'qa_model'">
        <div class="qa-block question-block">
          <span>Q</span>
          <p>{{ segment.content || '暂无问题内容' }}</p>
        </div>
        <div class="qa-block answer-block">
          <span>A</span>
          <p>{{ segment.answer || '暂无回答内容' }}</p>
        </div>
      </template>
      <p v-else class="content-preview">{{ segment.content || '暂无内容' }}</p>
    </div>

    <button
      v-if="docForm === 'hierarchical_model'"
      type="button"
      class="child-entry"
      :disabled="isIndexing"
      @click.stop="emit('child', segment)"
    >
      管理子分段（{{ childCount }}）
    </button>

    <div class="card-meta">
      <span>{{ segment.word_count || 0 }} 字</span>
      <span>{{ segment.tokens || 0 }} tokens</span>
      <span>命中 {{ segment.hit_count || 0 }}</span>
    </div>

    <div v-if="visibleKeywords.length" class="card-keywords">
      <span v-for="keyword in visibleKeywords" :key="keyword" class="plain-tag"
        >#{{ keyword }}</span
      >
      <span v-if="hiddenKeywordCount" class="plain-tag">+{{ hiddenKeywordCount }}</span>
    </div>

    <div class="card-actions" @click.stop>
      <el-button text :icon="View" @click="emit('view', segment)">详情</el-button>
      <el-button text :icon="EditPen" :disabled="isIndexing" @click="emit('edit', segment)">
        编辑
      </el-button>
      <el-button
        text
        type="danger"
        :icon="Delete"
        :disabled="isIndexing"
        @click="emit('remove', segment)"
      >
        删除
      </el-button>
    </div>
  </article>
</template>

<style scoped lang="less">
.seg-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 266px;
  padding: 18px;
  cursor: pointer;
  background: var(--surface, #fff);
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease,
    opacity 0.18s ease;
  flex-direction: column;
}

.seg-card:hover {
  border-color: #c7d5ea;
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgb(37 99 235 / 9%);
}

.seg-card.disabled {
  opacity: 0.72;
}

.seg-card.error {
  border-left: 3px solid #dc2626;
}

.card-head,
.head-left,
.card-meta,
.card-keywords,
.card-actions,
.status-wrap {
  display: flex;
  align-items: center;
}

.card-head {
  justify-content: space-between;
  gap: 12px;
}

.head-left {
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.position-tag,
.disabled-tag,
.plain-tag {
  display: inline-flex;
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  align-items: center;
}

.position-tag {
  font-family: var(--font-mono);
  color: var(--primary, #2563eb);
  background: var(--primary-soft, #eaf1ff);
}

.disabled-tag,
.plain-tag {
  color: #64748b;
  background: #f1f5f9;
}

.status-wrap {
  font-size: 11px;
  color: var(--text-secondary, #64748b);
  gap: 5px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-body {
  min-height: 96px;
  margin-top: 16px;
}

.content-preview,
.qa-block p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary, #64748b);
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
}

.qa-block {
  display: grid;
  padding-left: 10px;
  border-left: 3px solid #93c5fd;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 7px;
}

.qa-block + .qa-block {
  margin-top: 12px;
}

.qa-block > span {
  display: grid;
  width: 22px;
  height: 22px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
  color: var(--primary, #2563eb);
  background: var(--primary-soft, #eaf1ff);
  border-radius: 7px;
  place-items: center;
}

.qa-block p {
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.answer-block {
  border-left-color: #5eead4;
}

.answer-block > span {
  color: #0f766e;
  background: #ecfdf5;
}

.child-entry {
  align-self: flex-start;
  padding: 0;
  margin: 8px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary, #2563eb);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.child-entry:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.card-meta {
  margin-top: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
  flex-wrap: wrap;
  gap: 6px 12px;
}

.card-keywords {
  margin-top: 10px;
  flex-wrap: wrap;
  gap: 6px;
}

.plain-tag {
  height: 22px;
  font-size: 10.5px;
}

.card-actions {
  max-height: 0;
  margin-top: 0;
  overflow: hidden;
  border-top: 1px solid transparent;
  opacity: 0;
  transition:
    max-height 0.18s ease,
    margin-top 0.18s ease,
    opacity 0.18s ease;
  justify-content: flex-end;
}

.seg-card:hover .card-actions,
.seg-card:focus-within .card-actions {
  max-height: 42px;
  padding-top: 8px;
  margin-top: 10px;
  border-top-color: var(--border-soft, #e4eaf3);
  opacity: 1;
}

.card-actions :deep(.el-button + .el-button) {
  margin-left: 2px;
}

@media (width <= 640px) {
  .seg-card {
    min-height: 248px;
  }

  .card-actions {
    max-height: 42px;
    padding-top: 8px;
    margin-top: 10px;
    border-top-color: var(--border-soft, #e4eaf3);
    opacity: 1;
  }
}
</style>
