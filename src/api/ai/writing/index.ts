import { apiClient, chatApi, type R, type StreamChatOptions } from '@/api/frontend-api'
import {
  WRITING_APP_ID_MAP,
  type DocId,
  type DocListParams,
  type DocListResult,
  type RenameDocPayload,
  type SaveDocPayload,
  type WritingActionType,
  type WritingGeneratePayload
} from './types'

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

const DOC_API_BASE = '/api/writing/doc'

function unwrapWritingResponse<T>(response: R<T>): T {
  const isSuccess = response?.code === 0 || response?.code === 200
  if (!isSuccess) {
    throw new Error(response?.message || `API Error: ${response?.code}`)
  }
  return response.data
}

export async function getDocList(params: DocListParams = {}) {
  const response = await apiClient.get<R<DocListResult>>(`${DOC_API_BASE}/list`, { params })
  return unwrapWritingResponse(response.data)
}

export async function getDocDetail(id: DocId) {
  const response = await apiClient.get<R<Record<string, unknown>>>(`${DOC_API_BASE}/detail/${id}`)
  return unwrapWritingResponse(response.data)
}

export async function saveDoc(payload: SaveDocPayload) {
  const response = await apiClient.post<R<Record<string, unknown>>>(`${DOC_API_BASE}/save`, payload)
  return unwrapWritingResponse(response.data)
}

export async function renameDoc(payload: RenameDocPayload) {
  const response = await apiClient.post<R<Record<string, unknown>>>(
    `${DOC_API_BASE}/rename`,
    payload
  )
  return unwrapWritingResponse(response.data)
}

export async function deleteDoc(id: DocId) {
  const response = await apiClient.delete<R<Record<string, unknown>>>(`${DOC_API_BASE}/${id}`)
  return unwrapWritingResponse(response.data)
}

export async function duplicateDoc(id: DocId) {
  const response = await apiClient.post<R<Record<string, unknown>>>(
    `${DOC_API_BASE}/duplicate/${id}`
  )
  return unwrapWritingResponse(response.data)
}
