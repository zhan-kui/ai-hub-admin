import { chatApi, type StreamChatOptions } from '@/api/frontend-api'
import { WRITING_APP_ID_MAP, type WritingActionType, type WritingGeneratePayload } from './types'

export * from './types'

export function streamWriting(
  action: WritingActionType,
  payload: WritingGeneratePayload,
  options: StreamChatOptions = {}
) {
  return chatApi.streamChat(WRITING_APP_ID_MAP[action], payload, options)
}

export function stopWriting(action: WritingActionType, taskId: string) {
  return chatApi.stopGeneration(WRITING_APP_ID_MAP[action], taskId)
}
