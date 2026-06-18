import { onUnmounted, ref } from 'vue'
import { knowledgeDocApi } from '@/api/knowledge'
import type { IndexingStatusItem } from '@/api/knowledge/types'
import { RUNNING_STATUSES } from './constants'

export function useIndexingPoller(datasetId: string) {
  const statusMap = ref<Record<string, IndexingStatusItem>>({})
  const timers = new Map<string, number>()

  function isFinished(status: IndexingStatusItem) {
    if (status.indexing_status === 'completed') return true
    if (status.indexing_status === 'error') return true
    if (status.error) return true
    if (
      status.total_segments != null &&
      status.completed_segments != null &&
      status.total_segments > 0 &&
      status.completed_segments >= status.total_segments &&
      !RUNNING_STATUSES.includes(status.indexing_status)
    ) {
      return true
    }
    return false
  }

  async function tick(batch: string) {
    try {
      const res = await knowledgeDocApi.indexingStatus(datasetId, batch)
      const item = res?.data?.[0]
      if (item) {
        statusMap.value = { ...statusMap.value, [batch]: item }
        if (isFinished(item)) {
          stop(batch)
          return
        }
      }
    } catch {
      // Ignore one transient failure and let the next tick retry.
    }
    timers.set(
      batch,
      window.setTimeout(() => tick(batch), 2500)
    )
  }

  function start(batch: string) {
    if (timers.has(batch)) return
    void tick(batch)
  }

  function stop(batch: string) {
    const timer = timers.get(batch)
    if (timer) window.clearTimeout(timer)
    timers.delete(batch)
  }

  function stopAll() {
    timers.forEach((timer) => window.clearTimeout(timer))
    timers.clear()
  }

  onUnmounted(stopAll)

  return { statusMap, start, stop, stopAll, isFinished }
}
