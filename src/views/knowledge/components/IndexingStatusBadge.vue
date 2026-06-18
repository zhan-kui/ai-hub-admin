<script setup lang="ts">
import { computed } from 'vue'
import { INDEXING_STATUS_MAP } from '../constants'
import type { IndexingStatus } from '@/api/knowledge/types'

const props = defineProps<{ status: IndexingStatus; error?: string | null }>()

const meta = computed(() => INDEXING_STATUS_MAP[props.status] ?? INDEXING_STATUS_MAP.waiting)
</script>

<template>
  <span class="ix-badge" :class="`ix-${meta.tone}`" :title="error || meta.text">
    <span class="ix-dot" :class="{ pulse: meta.tone === 'run' }"></span>
    {{ meta.text }}
  </span>
</template>

<style scoped lang="less">
.ix-badge {
  display: inline-flex;
  height: 24px;
  padding: 0 10px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 999px;
  align-items: center;
  gap: 6px;
}

.ix-dot {
  width: 7px;
  height: 7px;
  background: currentcolor;
  border-radius: 999px;
}

.ix-dot.pulse {
  animation: ix-pulse 1.1s ease-in-out infinite;
}

.ix-wait {
  color: #64748b;
  background: #eef2f8;
}

.ix-run {
  color: var(--primary, #2563eb);
  background: var(--primary-soft, #eaf1ff);
}

.ix-done {
  color: #15803d;
  background: #eaf7ef;
}

.ix-fail {
  color: #b91c1c;
  background: #fff1f2;
}

@keyframes ix-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}
</style>
