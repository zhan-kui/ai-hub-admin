<script setup lang="ts">
import { computed } from 'vue'
import { toDisplayError, toDisplayText, toDisplayJson } from '@/utils/display-text'
import type { ToolCallItem, ToolSource } from '@/store/modules/chat'

const props = defineProps<{
  items?: ToolCallItem[]
}>()

const sortedItems = computed(() =>
  [...(props.items || [])].sort((left, right) => (left.seq || 0) - (right.seq || 0))
)

function statusText(status: ToolCallItem['status']): string {
  if (status === 'calling') return '调用中'
  if (status === 'success') return '成功'
  return '失败'
}

function formatArguments(value: unknown): string {
  if (value === undefined || value === null) return '{}'
  try {
    return toDisplayJson(value)
  } catch {
    return toDisplayText(value)
  }
}

function safeSourceUrl(source: ToolSource): string | null {
  try {
    const url = new URL(source.url)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
</script>

<template>
  <section v-if="sortedItems.length" class="tool-chain" aria-label="工具调用链">
    <div v-for="item in sortedItems" :key="item.callId" class="tool-node">
      <div class="tool-head">
        <span class="status-dot" :class="item.status"></span>
        <strong>{{ toDisplayText(item.toolName || item.toolCode) }}</strong>
        <span v-if="item.providerType" class="provider">{{
          toDisplayText(item.providerType)
        }}</span>
        <span class="status-label" :class="item.status">{{ statusText(item.status) }}</span>
        <span v-if="item.durationMs !== undefined" class="duration">{{ item.durationMs }} ms</span>
      </div>

      <details class="tool-arguments">
        <summary>调用参数</summary>
        <pre>{{ formatArguments(item.arguments) }}</pre>
      </details>

      <p v-if="item.error?.message" class="tool-error">
        {{ toDisplayError(item.error.message)
        }}<span v-if="item.error.code">（{{ toDisplayText(item.error.code) }}）</span>
      </p>

      <div v-if="item.sources?.length" class="tool-sources">
        <span class="sources-title">来源</span>
        <a
          v-for="(source, index) in item.sources"
          v-show="safeSourceUrl(source)"
          :key="`${item.callId}-${source.url}-${index}`"
          :href="safeSourceUrl(source) || undefined"
          target="_blank"
          rel="noopener noreferrer"
          :title="toDisplayText(source.snippet)"
        >
          {{ toDisplayText(source.title || source.url) }}
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped lang="less">
.tool-chain {
  display: grid;
  gap: 8px;
  margin: 10px 0;
}

.tool-node {
  padding: 10px 12px;
  font-size: 12px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.tool-head {
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
}

.status-dot.calling {
  background: #0ea5e9;
  animation: pulse 1s infinite;
}

.status-dot.success {
  background: #22c55e;
}

.provider,
.duration {
  color: #64748b;
}

.status-label {
  margin-left: auto;
}

.status-label.success {
  color: #15803d;
}

.status-label.error,
.tool-error {
  color: #b91c1c;
}

.tool-arguments {
  margin-top: 8px;
}

.tool-arguments summary {
  color: #64748b;
  cursor: pointer;
}

.tool-arguments pre {
  max-height: 180px;
  padding: 8px;
  margin: 6px 0 0;
  overflow: auto;
  font-size: 11px;
  white-space: pre-wrap;
  background: #fff;
  border-radius: 6px;
}

.tool-error {
  margin: 8px 0 0;
}

.tool-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 8px;
}

.sources-title {
  color: #64748b;
}

.tool-sources a {
  color: #0284c7;
  text-decoration: none;
}

.tool-sources a:hover {
  text-decoration: underline;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
