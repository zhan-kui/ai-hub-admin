export type CapabilityStatus = 0 | 1
export type ProviderType = 'MCP' | 'HTTP' | 'LOCAL'
export type McpTransportType = 'AUTO' | 'STREAMABLE_HTTP' | 'SSE' | 'STDIO'
export type McpConnectionStatus = 'UNTESTED' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
export type McpSourceType = 'MANUAL' | 'IMPORT' | 'MODELSCOPE' | 'OTHER'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type HttpParameterLocation = 'PATH' | 'QUERY' | 'HEADER' | 'BODY'
export type HttpAuthType = 'NONE' | 'BEARER' | 'API_KEY_HEADER' | 'BASIC' | 'CUSTOM_HEADERS'
export type HttpBodyMode = 'PARAMETERS' | 'RAW_ARGUMENTS'
export type HttpResponseType = 'AUTO' | 'JSON' | 'TEXT' | 'BINARY'

export interface PageResult<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}

export interface PageQuery {
  page?: number
  size?: number
  keyword?: string
  status?: CapabilityStatus
}

export interface McpServer {
  id: number
  serverCode: string
  serverName: string
  description?: string
  sourceType: McpSourceType
  sourceUrl?: string
  transportType: McpTransportType
  baseUrl?: string
  endpoint?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  workingDirectory?: string
  connectTimeoutSeconds: number
  requestTimeoutSeconds: number
  connectionStatus: McpConnectionStatus
  protocolVersion?: string
  remoteServerName?: string
  remoteServerVersion?: string
  capabilities?: Record<string, unknown>
  rawConfig?: Record<string, unknown>
  lastSyncTime?: string
  lastError?: string
  status: CapabilityStatus
  createTime?: string
  updateTime?: string
}

export interface McpServerRequest {
  serverCode: string
  serverName: string
  description?: string
  sourceType?: McpSourceType
  sourceUrl?: string
  transportType: McpTransportType
  baseUrl?: string
  endpoint?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  workingDirectory?: string
  connectTimeoutSeconds?: number
  requestTimeoutSeconds?: number
  status?: CapabilityStatus
}

export interface McpTestResult {
  success: boolean
  protocolVersion?: string
  serverName?: string
  serverVersion?: string
  actualTransportType?: string
  toolCount: number
  tools: Array<{ name: string; description: string }>
  message: string
}

export interface McpSyncResult {
  serverId: number
  remoteTotal: number
  created: number
  updated: number
  unchanged: number
  deleted: number
}

export interface McpImportRequest {
  sourceType?: McpSourceType
  sourceUrl?: string
  configJson: string
}

export interface McpImportResult {
  createdServerIds: number[]
  created: number
  skipped: number
  warnings: string[]
}

export interface CapabilityTool {
  id: number
  toolCode: string
  toolName: string
  description: string
  tags?: string[]
  providerType: ProviderType
  providerId?: number
  originalToolName?: string
  providerRef?: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  annotations?: Record<string, unknown>
  sourceHash?: string
  lastSyncTime?: string
  status: CapabilityStatus
  createTime?: string
  updateTime?: string
}

export interface CapabilityToolQuery extends PageQuery {
  providerType?: ProviderType
}

export interface CapabilityToolUpdateRequest {
  toolName?: string
  description?: string
  tags?: string[]
  status?: CapabilityStatus
}

export interface HttpToolParameter {
  name: string
  location: HttpParameterLocation
  targetName?: string
  required?: boolean
  dataType?: string
  description?: string
  defaultValue?: unknown
}

export interface HttpToolConfig {
  id?: number
  httpMethod: HttpMethod
  baseUrl: string
  path: string
  contentType?: string
  responseType?: HttpResponseType
  authType?: HttpAuthType
  authConfig?: Record<string, unknown>
  fixedHeaders?: Record<string, string>
  parameters?: HttpToolParameter[]
  bodyMode?: HttpBodyMode
  bodyTemplate?: Record<string, unknown>
  connectTimeoutSeconds?: number
  requestTimeoutSeconds?: number
}

export interface HttpToolRequest {
  toolCode: string
  toolName: string
  description: string
  tags?: string[]
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  httpConfig: HttpToolConfig
  status?: CapabilityStatus
}

export interface HttpToolDetail {
  tool: CapabilityTool
  httpConfig: HttpToolConfig
}

export interface ToolCallError {
  code: string
  message: string
  retryable: boolean
}

export interface ToolCallResult {
  success: boolean
  toolId: string
  toolName: string
  providerType: ProviderType
  durationMs: number
  data?: unknown
  error?: ToolCallError
}

export interface Skill {
  id: number
  skillCode: string
  displayName: string
  description: string
  tags?: string[]
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string
  rawContent: string
  bodyContent: string
  contentHash: string
  sourceType: 'EDITOR' | 'UPLOAD' | 'IMPORT'
  sourceFileName?: string
  sourceUrl?: string
  version?: string
  status: CapabilityStatus
  createTime?: string
  updateTime?: string
}

export interface BoundTool {
  toolId: string
  toolDbId: number
  name: string
  description?: string
  required: boolean
  sort: number
  usageDescription?: string
  inputSchema?: Record<string, unknown>
}

export interface BoundToolRequest {
  toolId: number
  sort?: number
  requiredFlag?: boolean
  usageDescription?: string
}

export interface SkillRequest {
  displayName?: string
  tags?: string[]
  rawContent: string
  status?: CapabilityStatus
  boundTools?: BoundToolRequest[]
}

export interface SkillDetail {
  skill: Skill
  boundTools: BoundTool[]
}

export interface SkillParseResult {
  name: string
  description: string
  license: string
  compatibility: string
  metadata: Record<string, string>
  allowedTools: string
  bodyContent: string
  contentHash: string
}
