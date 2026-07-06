import { apiClient } from '@/api/frontend-api'
import type {
  ApiResponse,
  PageResult,
  PromptCategory,
  PromptQuery,
  PromptSaveRequest,
  PromptTemplate
} from './types'

const BASE = '/api/prompt-templates'

const unwrap = async <T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> => {
  const response = await promise
  const body = response.data
  if (body?.code !== 200) {
    const error = new Error(body?.message || '接口调用失败') as Error & {
      code?: number
      errorCode?: string
    }
    error.code = typeof body?.code === 'number' ? body.code : undefined
    error.errorCode = body?.errorCode
    throw error
  }
  return body.data as T
}

export const promptTemplateApi = {
  page: (params: PromptQuery) =>
    unwrap<PageResult<PromptTemplate>>(apiClient.get(BASE, { params })),
  categories: () => unwrap<PromptCategory[]>(apiClient.get(`${BASE}/categories`)),
  detail: (id: string) => unwrap<PromptTemplate>(apiClient.get(`${BASE}/${id}`)),
  create: (data: PromptSaveRequest) => unwrap<PromptTemplate>(apiClient.post(BASE, data)),
  update: (id: string, data: PromptSaveRequest) =>
    unwrap<PromptTemplate>(apiClient.put(`${BASE}/${id}`, data)),
  remove: (id: string) => unwrap<void>(apiClient.delete(`${BASE}/${id}`)),
  favorite: (id: string) => unwrap<void>(apiClient.post(`${BASE}/${id}/favorite`)),
  unfavorite: (id: string) => unwrap<void>(apiClient.delete(`${BASE}/${id}/favorite`)),
  copy: (id: string) => unwrap<PromptTemplate>(apiClient.post(`${BASE}/${id}/copy`))
}

export * from './types'
