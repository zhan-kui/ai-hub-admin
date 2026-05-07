import { ref } from 'vue'
import { stopWriting, streamWriting } from '@/api/ai/writing'
import type { SseEventPayload } from '@/api/frontend-api'
import type { WritingAction, WritingStreamPayload } from '../types'

interface StreamCallbacks {
  onChunk: (text: string) => void
  onReplace?: (text: string) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }
  return null
}

function toRawText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function extractStringByKeys(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toRawText(record[key])
    if (value !== null) {
      return value
    }
  }
  return null
}

function normalizePayload(raw: unknown): Record<string, unknown> {
  const record = toRecord(raw) || {}
  const nested = toRecord(record.data)
  return nested ? { ...record, ...nested } : record
}

function extractText(payload: Record<string, unknown>): string {
  return (
    extractStringByKeys(payload, ['answer', 'content', 'text', 'delta', 'message', 'output']) || ''
  )
}

function extractTaskId(payload: Record<string, unknown>): string | null {
  return extractStringByKeys(payload, ['taskId', 'task_id'])
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (typeof error === 'string') {
    return new Error(error)
  }
  const record = toRecord(error)
  if (record) {
    const message = extractStringByKeys(record, ['message', 'msg', 'error'])
    if (message) {
      return new Error(message)
    }
  }
  return new Error('生成失败，请稍后重试')
}

export function useWritingStream() {
  const isStreaming = ref(false)
  const accumulated = ref('')
  const currentTaskId = ref<string | null>(null)
  const currentAction = ref<WritingAction | null>(null)

  let abortCtrl: AbortController | null = null
  let requestSeq = 0

  const syncTaskId = (requestId: number, payload: Record<string, unknown>) => {
    if (requestId !== requestSeq) return
    const taskId = extractTaskId(payload)
    if (taskId) {
      currentTaskId.value = taskId
    }
  }

  const appendText = (requestId: number, text: string, callbacks: StreamCallbacks) => {
    if (requestId !== requestSeq || !text) return
    accumulated.value += text
    callbacks.onChunk(text)
  }

  const replaceText = (requestId: number, text: string, callbacks: StreamCallbacks) => {
    if (requestId !== requestSeq || !text) return
    accumulated.value = text
    callbacks.onReplace?.(text)
  }

  const handleRawEvent = (requestId: number, event: SseEventPayload) => {
    if (requestId !== requestSeq) return null
    return normalizePayload(event.data)
  }

  const stop = async () => {
    const taskId = currentTaskId.value
    const action = currentAction.value
    const controller = abortCtrl

    requestSeq += 1
    abortCtrl = null
    currentTaskId.value = null
    currentAction.value = null
    isStreaming.value = false

    controller?.abort()

    if (taskId && action) {
      try {
        await stopWriting(action, taskId)
      } catch (error) {
        console.warn('[useWritingStream] stop generation failed', error)
      }
    }
  }

  const reset = async () => {
    await stop()
    accumulated.value = ''
  }

  const start = async (payload: WritingStreamPayload, callbacks: StreamCallbacks) => {
    await stop()

    const { action, ...requestPayload } = payload
    const requestId = ++requestSeq
    const controller = new AbortController()

    abortCtrl = controller
    accumulated.value = ''
    currentTaskId.value = null
    currentAction.value = action
    isStreaming.value = true

    try {
      await streamWriting(action, requestPayload, {
        signal: controller.signal,
        handlers: {
          onRawEvent: (event) => {
            const normalized = handleRawEvent(requestId, event)
            if (!normalized) return
            syncTaskId(requestId, normalized)
          },
          onMessage: (data) => {
            const normalized = normalizePayload(data)
            syncTaskId(requestId, normalized)
            appendText(requestId, extractText(normalized), callbacks)
          },
          onMessageReplace: (data) => {
            const normalized = normalizePayload(data)
            syncTaskId(requestId, normalized)
            replaceText(requestId, extractText(normalized), callbacks)
          },
          onMessageEnd: (data) => {
            const normalized = normalizePayload(data)
            syncTaskId(requestId, normalized)
            if (!accumulated.value) {
              replaceText(requestId, extractText(normalized), callbacks)
            }
          },
          onError: (error) => {
            if (requestId !== requestSeq) return
            callbacks.onError?.(toError(error))
          },
          onClose: () => {
            if (requestId !== requestSeq) return
            callbacks.onDone?.()
          }
        }
      })
    } catch (error) {
      if (requestId === requestSeq && !controller.signal.aborted) {
        callbacks.onError?.(toError(error))
      }
    } finally {
      if (requestId === requestSeq) {
        abortCtrl = null
        currentTaskId.value = null
        currentAction.value = null
        isStreaming.value = false
      }
    }
  }

  return {
    isStreaming,
    accumulated,
    start,
    stop,
    reset
  }
}
