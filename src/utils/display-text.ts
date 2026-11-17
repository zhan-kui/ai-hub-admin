/** Platform-owned UI text only; never use this to transform request payloads or chat answers. */
export function toDisplayText(value: unknown): string {
  return String(value ?? '').replace(/dify/gi, 'AI 平台')
}

export function toDisplayError(value: unknown, fallback = '请求失败'): string {
  const record = value && typeof value === 'object' ? (value as Record<string, any>) : null
  const body = record?.response?.data
  const message =
    (typeof body === 'string' ? body : body?.message || body?.error) ||
    record?.message ||
    record?.msg ||
    record?.error
  const raw = typeof value === 'string' ? value : typeof message === 'string' ? message : fallback
  return toDisplayText(
    raw
      .replace(/https?:\/\/[^\s"'<>]+/gi, '[服务地址已隐藏]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[标识已隐藏]')
      .replace(/\b(?:app|sk|dataset)-[a-z0-9_-]+/gi, '[已隐藏]')
      .replace(/\bBearer\s+\S+/gi, '[凭据已隐藏]')
      .replace(/eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, '[凭据已隐藏]')
      .replace(
        /(?:password|secret|token|cookie|api[_-]?key|authorization)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
        '[凭据已隐藏]'
      )
      .replace(
        /\b(?:app_id|import_id|tenant_id|account_id|appId|importId|tenantId|accountId)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
        '[标识已隐藏]'
      )
  )
}

/** Read-only projection: hide implementation/credential keys; keep the source object intact. */
export function toDisplayValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toDisplayValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/dify|password|secret|cookie|token|credential|authorization|api[_-]?key/i.test(key)
        )
        .map(([key, child]) => [key, toDisplayValue(child)])
    )
  }
  return typeof value === 'string' ? toDisplayError(value) : value
}

export function toDisplayJson(value: unknown): string {
  return JSON.stringify(toDisplayValue(value), null, 2) ?? ''
}
