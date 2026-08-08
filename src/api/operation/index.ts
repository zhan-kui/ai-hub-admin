import type { AxiosResponse } from 'axios'
import { apiClient, type R } from '@/api/frontend-api'
import type {
  AgentUsage,
  DailyUsage,
  FeedbackPage,
  FeedbackQuery,
  OperationOverview,
  ToolTracePage,
  ToolTraceQuery
} from './types'

export * from './types'

async function unwrap<T>(promise: Promise<AxiosResponse<R<T>>>): Promise<T> {
  const response = await promise
  const body = response.data
  if (body?.code !== 0 && body?.code !== 200) {
    throw new Error(body?.message || `接口请求失败：${body?.code}`)
  }
  return body.data
}

export const operationApi = {
  overview: (days: number) =>
    unwrap(apiClient.get<R<OperationOverview>>('/api/operations/overview', { params: { days } })),
  usageTrend: (days: number) =>
    unwrap(apiClient.get<R<DailyUsage[]>>('/api/operations/usage/trend', { params: { days } })),
  agentUsage: (days: number, limit = 10) =>
    unwrap(
      apiClient.get<R<AgentUsage[]>>('/api/operations/usage/agents', {
        params: { days, limit }
      })
    ),
  feedbacks: (params: FeedbackQuery) =>
    unwrap(apiClient.get<R<FeedbackPage>>('/api/operations/feedbacks', { params })),
  toolTraces: (params: ToolTraceQuery) =>
    unwrap(apiClient.get<R<ToolTracePage>>('/api/operations/tool-traces', { params }))
}
