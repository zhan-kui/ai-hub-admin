import type { DifyDocForm, DifySegmentStatus } from '@/api/knowledge/segment'

export function docFormLabel(form?: DifyDocForm): string {
  if (form === 'hierarchical_model') return '父子分段'
  if (form === 'qa_model') return '问答'
  return '普通分段'
}

export function docFormClass(form?: DifyDocForm): string {
  if (form === 'hierarchical_model') return 'mode-high'
  if (form === 'qa_model') return 'mode-economy'
  return 'plain-tag'
}

export function statusLabel(status?: DifySegmentStatus): string {
  if (status === 'completed') return '索引完成'
  if (status === 'indexing') return '索引中'
  if (status === 'error') return '索引失败'
  return status || '未知'
}

export function statusColor(status?: DifySegmentStatus): string {
  if (status === 'completed') return '#16a34a'
  if (status === 'indexing') return '#f59e0b'
  if (status === 'error') return '#dc2626'
  return '#94a3b8'
}

export function fmtTime(timestamp?: number | null): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export function padPosition(position?: number): string {
  return `#${String(position ?? 0).padStart(3, '0')}`
}

type SegmentError = {
  code?: number | string
  msg?: string
  message?: string
  data?: { code?: number; msg?: string; message?: string }
  response?: {
    status?: number
    data?: { code?: number; msg?: string; message?: string }
  }
}

function errorMessage(error: unknown): string {
  const detail = error as SegmentError | null
  return (
    detail?.msg ||
    detail?.data?.msg ||
    detail?.data?.message ||
    detail?.response?.data?.msg ||
    detail?.response?.data?.message ||
    detail?.message ||
    ''
  )
}

function errorCode(error: unknown): number | undefined {
  const detail = error as SegmentError | null
  if (typeof detail?.code === 'number') return detail.code
  return detail?.data?.code || detail?.response?.data?.code || detail?.response?.status
}

export function segmentErrorText(error: unknown, fallback = '操作失败'): string {
  const message = errorMessage(error)
  const code = errorCode(error)
  if (code === 403 || message.includes('权限不足')) {
    return '知识库 API Key 异常，请联系管理员'
  }
  if (message.includes('未索引完成')) return '文档还在索引，请等待索引完成后再操作'
  if (message.includes('文档已禁用')) return '请先启用该文档'
  if (message.includes('创建子分段失败') || message.includes('更新子分段失败')) {
    return '请检查内容是否为空后重试'
  }
  if (message.includes('删除子分段失败')) return '删除子分段失败，请稍后重试'
  if (code === 404 || message.includes('分段不存在')) {
    return '分段不存在或已删除，已为你刷新列表'
  }
  return message || fallback
}

export function isSegmentWarning(error: unknown): boolean {
  const message = errorMessage(error)
  return (
    errorCode(error) === 404 ||
    message.includes('未索引完成') ||
    message.includes('文档已禁用') ||
    message.includes('分段不存在')
  )
}

export function isSegmentNotFound(error: unknown): boolean {
  return errorCode(error) === 404 || errorMessage(error).includes('分段不存在')
}
