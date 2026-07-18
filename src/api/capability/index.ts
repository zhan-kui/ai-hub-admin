import type { AxiosResponse } from 'axios'
import { apiClient, type R } from '@/api/frontend-api'
import type {
  CapabilityStatus,
  CapabilityTool,
  CapabilityToolQuery,
  CapabilityToolUpdateRequest,
  HttpToolDetail,
  HttpToolRequest,
  McpImportRequest,
  McpImportResult,
  McpServer,
  McpServerRequest,
  McpSyncResult,
  McpTestResult,
  PageQuery,
  PageResult,
  Skill,
  SkillDetail,
  SkillParseResult,
  SkillRequest,
  ToolCallResult
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

export const mcpServerApi = {
  page: (params: PageQuery) =>
    unwrap(apiClient.get<R<PageResult<McpServer>>>('/api/mcp-servers', { params })),
  detail: (id: number) => unwrap(apiClient.get<R<McpServer>>(`/api/mcp-servers/${id}`)),
  create: (data: McpServerRequest) =>
    unwrap(apiClient.post<R<McpServer>>('/api/mcp-servers', data)),
  update: (id: number, data: McpServerRequest) =>
    unwrap(apiClient.put<R<McpServer>>(`/api/mcp-servers/${id}`, data)),
  remove: (id: number) => unwrap(apiClient.delete<R<void>>(`/api/mcp-servers/${id}`)),
  setStatus: (id: number, status: CapabilityStatus) =>
    unwrap(apiClient.put<R<void>>(`/api/mcp-servers/${id}/status`, { status })),
  test: (id: number) => unwrap(apiClient.post<R<McpTestResult>>(`/api/mcp-servers/${id}/test`)),
  syncTools: (id: number) =>
    unwrap(apiClient.post<R<McpSyncResult>>(`/api/mcp-servers/${id}/sync-tools`)),
  importConfig: (data: McpImportRequest) =>
    unwrap(apiClient.post<R<McpImportResult>>('/api/mcp-servers/import', data))
}

export const capabilityToolApi = {
  page: (params: CapabilityToolQuery) =>
    unwrap(apiClient.get<R<PageResult<CapabilityTool>>>('/api/capability-tools', { params })),
  detail: (id: number) => unwrap(apiClient.get<R<CapabilityTool>>(`/api/capability-tools/${id}`)),
  update: (id: number, data: CapabilityToolUpdateRequest) =>
    unwrap(apiClient.put<R<CapabilityTool>>(`/api/capability-tools/${id}`, data)),
  setStatus: (id: number, status: CapabilityStatus) =>
    unwrap(apiClient.put<R<void>>(`/api/capability-tools/${id}/status`, { status })),
  remove: (id: number) => unwrap(apiClient.delete<R<void>>(`/api/capability-tools/${id}`))
}

export const httpToolApi = {
  create: (data: HttpToolRequest) =>
    unwrap(apiClient.post<R<HttpToolDetail>>('/api/http-tools', data)),
  detail: (id: number) => unwrap(apiClient.get<R<HttpToolDetail>>(`/api/http-tools/${id}`)),
  update: (id: number, data: HttpToolRequest) =>
    unwrap(apiClient.put<R<HttpToolDetail>>(`/api/http-tools/${id}`, data)),
  remove: (id: number) => unwrap(apiClient.delete<R<void>>(`/api/http-tools/${id}`)),
  test: (id: number, argumentsValue: Record<string, unknown>) =>
    unwrap(
      apiClient.post<R<ToolCallResult>>(`/api/http-tools/${id}/test`, {
        arguments: argumentsValue
      })
    )
}

export const skillApi = {
  page: (params: PageQuery) =>
    unwrap(apiClient.get<R<PageResult<Skill>>>('/api/skills', { params })),
  detail: (id: number) => unwrap(apiClient.get<R<SkillDetail>>(`/api/skills/${id}`)),
  create: (data: SkillRequest) => unwrap(apiClient.post<R<SkillDetail>>('/api/skills', data)),
  update: (id: number, data: SkillRequest) =>
    unwrap(apiClient.put<R<SkillDetail>>(`/api/skills/${id}`, data)),
  remove: (id: number) => unwrap(apiClient.delete<R<void>>(`/api/skills/${id}`)),
  setStatus: (id: number, status: CapabilityStatus) =>
    unwrap(apiClient.put<R<void>>(`/api/skills/${id}/status`, { status })),
  parse: (rawContent: string) =>
    unwrap(apiClient.post<R<SkillParseResult>>('/api/skills/parse', { rawContent })),
  upload: (file: File, displayName?: string, tags?: string[], status: CapabilityStatus = 1) => {
    const form = new FormData()
    form.append('file', file)
    if (displayName?.trim()) form.append('displayName', displayName.trim())
    if (tags?.length) form.append('tags', tags.join(','))
    form.append('status', String(status))
    return unwrap(apiClient.post<R<SkillDetail>>('/api/skills/upload', form))
  }
}
