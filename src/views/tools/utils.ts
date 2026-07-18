export function formatDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

export function stringifyJson(value: unknown, fallback = '{}'): string {
  if (value === undefined || value === null) return fallback
  return JSON.stringify(value, null, 2)
}

export function parseJsonObject(text: string, fieldName: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(text || '{}')
  } catch {
    throw new Error(`${fieldName}不是合法的 JSON`)
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${fieldName}必须是 JSON 对象`)
  }
  return value as Record<string, unknown>
}

export function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}
