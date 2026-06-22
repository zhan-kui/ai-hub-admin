import type { AxiosResponse } from 'axios'
import { apiClient } from '@/api/frontend-api'
import type { ApiResult } from './types'

/** 文档分块模式 */
export type DifyDocForm = 'text_model' | 'hierarchical_model' | 'qa_model' | string

/** 分段索引状态 */
export type DifySegmentStatus = 'completed' | 'indexing' | 'error' | string

export interface DifySegmentAttachment {
  id: string
  name?: string
  size?: number
  extension?: string
  mime_type?: string
  source_url?: string
}

export interface DifyChildChunk {
  id: string
  segment_id?: string
  content?: string
  position?: number
  word_count?: number
  type?: 'automatic' | 'custom' | string
  created_at?: number
  updated_at?: number
}

export interface DifySegment {
  id: string
  position?: number
  document_id?: string
  content?: string
  sign_content?: string
  answer?: string | null
  word_count?: number
  tokens?: number
  keywords?: string[]
  index_node_id?: string
  index_node_hash?: string
  hit_count?: number
  enabled?: boolean
  disabled_at?: number | null
  disabled_by?: string | null
  status?: DifySegmentStatus
  created_by?: string
  created_at?: number
  updated_at?: number
  updated_by?: string
  indexing_at?: number | null
  completed_at?: number | null
  error?: string | null
  stopped_at?: number | null
  child_chunks?: DifyChildChunk[]
  attachments?: DifySegmentAttachment[]
  summary?: string | null
}

export interface DifySegmentPageQuery {
  page?: number
  limit?: number
  keyword?: string
  status?: DifySegmentStatus[]
}

export interface DifySegmentPageResponse {
  data: DifySegment[]
  doc_form?: DifyDocForm
  total?: number
  has_more?: boolean
  limit?: number
  page?: number
}

export interface DifySegmentDetailResponse {
  data: DifySegment
  doc_form?: DifyDocForm
}

export interface DifySegmentCreateItem {
  content: string
  answer?: string | null
  keywords?: string[]
  attachment_ids?: string[]
}

export interface DifySegmentCreateRequest {
  segments: DifySegmentCreateItem[]
}

export interface DifySegmentCreateResponse {
  data: DifySegment[]
  doc_form?: DifyDocForm
}

export interface DifySegmentUpdateItem {
  content?: string | null
  answer?: string | null
  keywords?: string[]
  enabled?: boolean
  regenerate_child_chunks?: boolean
  attachment_ids?: string[]
  summary?: string | null
}

export interface DifySegmentUpdateRequest {
  segment: DifySegmentUpdateItem
}

export interface DifyChildChunkPageQuery {
  page?: number
  limit?: number
  keyword?: string
}

export interface DifyChildChunkPageResponse {
  data: DifyChildChunk[]
  total?: number
  total_pages?: number
  page?: number
  limit?: number
}

export interface DifyChildChunkCreateRequest {
  content: string
}

export interface DifyChildChunkResponse {
  data: DifyChildChunk
}

export interface DifyChildChunkUpdateRequest {
  content: string
}

const BASE = '/api/knowledge/datasets'

async function unwrap<T>(promise: Promise<AxiosResponse<ApiResult<T>>>): Promise<T> {
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

function segmentParamsSerializer(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)))
      return
    }
    searchParams.append(key, String(value))
  })
  return searchParams.toString()
}

export const knowledgeSegmentApi = {
  pageSegments(datasetId: string, documentId: string, params: DifySegmentPageQuery) {
    return unwrap<DifySegmentPageResponse>(
      apiClient.get(`${BASE}/${datasetId}/documents/${documentId}/segments`, {
        params,
        paramsSerializer: { serialize: segmentParamsSerializer }
      })
    )
  },

  getSegmentDetail(datasetId: string, documentId: string, segmentId: string) {
    return unwrap<DifySegmentDetailResponse>(
      apiClient.get(`${BASE}/${datasetId}/documents/${documentId}/segments/${segmentId}`)
    )
  },

  createSegments(datasetId: string, documentId: string, data: DifySegmentCreateRequest) {
    return unwrap<DifySegmentCreateResponse>(
      apiClient.post(`${BASE}/${datasetId}/documents/${documentId}/segments`, data)
    )
  },

  updateSegment(
    datasetId: string,
    documentId: string,
    segmentId: string,
    data: DifySegmentUpdateRequest
  ) {
    return unwrap<DifySegmentDetailResponse>(
      apiClient.post(`${BASE}/${datasetId}/documents/${documentId}/segments/${segmentId}`, data)
    )
  },

  deleteSegment(datasetId: string, documentId: string, segmentId: string) {
    return unwrap<boolean>(
      apiClient.delete(`${BASE}/${datasetId}/documents/${documentId}/segments/${segmentId}`)
    )
  },

  pageChildChunks(
    datasetId: string,
    documentId: string,
    segmentId: string,
    params: DifyChildChunkPageQuery
  ) {
    return unwrap<DifyChildChunkPageResponse>(
      apiClient.get(
        `${BASE}/${datasetId}/documents/${documentId}/segments/${segmentId}/child-chunks`,
        { params }
      )
    )
  },

  createChildChunk(
    datasetId: string,
    documentId: string,
    segmentId: string,
    data: DifyChildChunkCreateRequest
  ) {
    return unwrap<DifyChildChunkResponse>(
      apiClient.post(
        `${BASE}/${datasetId}/documents/${documentId}/segments/${segmentId}/child-chunks`,
        data
      )
    )
  },

  updateChildChunk(
    datasetId: string,
    documentId: string,
    segmentId: string,
    childChunkId: string,
    data: DifyChildChunkUpdateRequest
  ) {
    return unwrap<DifyChildChunkResponse>(
      apiClient.patch(
        `${BASE}/${datasetId}/documents/${documentId}/segments/${segmentId}/child-chunks/${childChunkId}`,
        data
      )
    )
  },

  deleteChildChunk(datasetId: string, documentId: string, segmentId: string, childChunkId: string) {
    return unwrap<boolean>(
      apiClient.delete(
        `${BASE}/${datasetId}/documents/${documentId}/segments/${segmentId}/child-chunks/${childChunkId}`
      )
    )
  }
}
