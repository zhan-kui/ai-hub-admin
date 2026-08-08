import type { AppConfigVO, PageResult } from '@/api/frontend-api'

export function formatNumber(value?: number): string {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

export function formatCost(value?: number): string {
  return `¥${Number(value || 0).toFixed(4)}`
}

export function formatDateTime(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

export function normalizeApps(result: AppConfigVO[] | PageResult<AppConfigVO>): AppConfigVO[] {
  return Array.isArray(result) ? result : result.records || []
}

export function parseJsonText(value?: string): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
