import type { PageResult } from '@/api/frontend-api'

export interface OperationOverview {
  appCount: number
  publishedAppCount: number
  requestCount: number
  conversationCount: number
  activeUserCount: number
  tokenCount: number
  totalCost: number
  avgLatency: number
  positiveCount: number
  negativeCount: number
  positiveRate: number
  toolCallCount: number
  toolSuccessCount: number
  toolSuccessRate: number
}

export interface DailyUsage {
  date: string
  requestCount: number
  conversationCount: number
  activeUserCount: number
  tokenCount: number
  cost: number
}

export interface AgentUsage {
  appId?: number
  appName: string
  appType?: string
  requestCount: number
  activeUserCount: number
  tokenCount: number
  cost: number
  avgLatency: number
  positiveCount: number
  negativeCount: number
}

export interface FeedbackItem {
  id: number
  appId?: number
  appName: string
  userId?: number
  username?: string
  nickname?: string
  query?: string
  answer?: string
  rating: 'like' | 'dislike'
  difyMessageId?: string
  createdAt?: string
}

export interface ToolTraceItem {
  id: number
  executionTraceId: string
  sessionId?: string
  userId?: number
  username?: string
  appId?: number
  appName?: string
  difyConversationId?: string
  difyMessageId?: string
  callId?: string
  seq?: number
  toolCode: string
  toolName: string
  providerType: string
  success: 0 | 1
  durationMs: number
  errorCode?: string
  argsRedactedJson?: string
  sourcesJson?: string
  createTime?: string
}

export interface FeedbackQuery {
  page: number
  size: number
  appId?: number
  rating?: 'like' | 'dislike'
  keyword?: string
}

export interface ToolTraceQuery {
  page: number
  size: number
  days: number
  appId?: number
  success?: 0 | 1
  providerType?: string
  keyword?: string
}

export type FeedbackPage = PageResult<FeedbackItem>
export type ToolTracePage = PageResult<ToolTraceItem>
