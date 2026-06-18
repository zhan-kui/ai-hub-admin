import { apiClient } from '@/api/frontend-api'
import type { AxiosProgressEvent } from 'axios'
import type {
  ApiResult,
  CreateDatasetRequest,
  CreateDocByFileData,
  CreateDocByFileResult,
  DatasetVO,
  DocumentPageResult,
  DocumentVO,
  IndexingStatusItem,
  ModelOption,
  ModelType,
  PageResult,
  UpdateDatasetRequest
} from './types'

const BASE = '/api/knowledge'

const unwrap = async <T>(promise: Promise<{ data: ApiResult<T> }>): Promise<T> => {
  const response = await promise
  const body = response.data
  if (body?.code !== 200) {
    const error = new Error(body?.message || '接口调用失败') as Error & {
      code?: number
      data?: unknown
      errorCode?: string | null
    }
    error.code = typeof body?.code === 'number' ? body.code : undefined
    error.errorCode = body?.errorCode
    error.data = body?.data
    throw error
  }
  return body.data
}

export const knowledgeModelApi = {
  getAvailableModels: (modelType: ModelType) =>
    unwrap<ModelOption[]>(apiClient.get(`${BASE}/models/${modelType}`))
}

export const knowledgeApi = {
  list: (params: {
    page?: number
    limit?: number
    keyword?: string
    indexingTechnique?: string
    visibility?: string
    status?: string
  }) => unwrap<PageResult<DatasetVO>>(apiClient.get(`${BASE}/datasets`, { params })),

  create: (body: CreateDatasetRequest) =>
    unwrap<DatasetVO>(apiClient.post(`${BASE}/datasets`, body)),

  detail: (datasetId: string) => unwrap<DatasetVO>(apiClient.get(`${BASE}/datasets/${datasetId}`)),

  update: (datasetId: string, body: UpdateDatasetRequest) =>
    unwrap<DatasetVO>(apiClient.patch(`${BASE}/datasets/${datasetId}`, body)),

  remove: (datasetId: string) => unwrap<boolean>(apiClient.delete(`${BASE}/datasets/${datasetId}`)),

  retrieve: (datasetId: string, body: { query: string }) =>
    unwrap<any>(apiClient.post(`${BASE}/datasets/${datasetId}/retrieve`, body))
}

export const knowledgeDocApi = {
  list: (datasetId: string, params: { page?: number; limit?: number }) =>
    unwrap<DocumentPageResult>(
      apiClient.get(`${BASE}/datasets/${datasetId}/documents`, {
        params
      })
    ),

  detail: (datasetId: string, documentId: string) =>
    unwrap<DocumentVO>(
      apiClient.get(`${BASE}/datasets/${datasetId}/documents/${documentId}`, {
        params: { metadata: 'all' }
      })
    ),

  createByFile: (
    datasetId: string,
    file: File,
    data: CreateDocByFileData,
    onUploadProgress?: (event: AxiosProgressEvent) => void
  ) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('data', JSON.stringify(data))
    return unwrap<CreateDocByFileResult>(
      apiClient.post(`${BASE}/datasets/${datasetId}/documents/create-by-file`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress
      })
    )
  },

  remove: (datasetId: string, documentId: string) =>
    unwrap<boolean>(apiClient.delete(`${BASE}/datasets/${datasetId}/documents/${documentId}`)),

  downloadUrl: (datasetId: string, documentId: string) =>
    unwrap<{ url: string }>(
      apiClient.get(`${BASE}/datasets/${datasetId}/documents/${documentId}/download`)
    ),

  indexingStatus: (datasetId: string, batch: string) =>
    unwrap<{ data: IndexingStatusItem[] }>(
      apiClient.get(`${BASE}/datasets/${datasetId}/documents/indexing-status/${batch}`)
    )
}
