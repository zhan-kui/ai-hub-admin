import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type {
  CreateFromTemplateRequest,
  CreateFromTemplateResponse,
  TemplatePayloadWithVersion,
  TemplateMeta
} from '@/views/app/orchestrator/types'
import type {
  CanvasFlowPayloadWithVersion,
  CanvasSnapshotPayload
} from '@/views/app/orchestrator/canvas/types'

/**
 * 閸欘垶鈧俺绻冮崜宥囶伂閻滎垰顣ㄩ崣姗€鍣虹憰鍡欐磰
 * 娓氬顩ч敍姝廔TE_API_BASE_URL=http://localhost:8088/aihub-api
 */
export const DEFAULT_API_BASE_URL = 'http://localhost:8088/aihub-api'

export type RoleCode = 'super_admin' | 'admin' | 'user'
export type ResourceTypeCode = 'app' | 'knowledge'
export type ResourceTypeEnumValue = 'APP' | 'KNOWLEDGE'
export type MenuType = 'DIR' | 'MENU' | 'BUTTON'
export type MenuPlatform = 'pc' | 'h5' | 'all'
export type AgentId = 'simple' | 'memory' | 'skill'
export type Status01 = 0 | 1

export interface R<T> {
  code: number
  message: string
  data: T
}

export type AnyObject = Record<string, any>

export interface ApiClientOptions {
  baseURL?: string
  timeout?: number
  getToken?: () => string | null | undefined
}

export interface CaptchaResponse {
  captchaId: string
  imageBase64: string
  expireIn: number
}

export interface LoginRequest {
  username: string
  password: string
  captchaId: string
  captchaCode: string
}

export interface LoginResponse {
  token: string
  tokenType: string
  expiresIn: number
  userId: number
  username: string
  nickname?: string
  roleCode: RoleCode
}

export interface RegisterUserRequest {
  username: string
  password: string
  nickname?: string
  email?: string
  phone?: string
  roleId?: number
  deptId?: number
}

export interface UpdateUserRequest {
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface UserInfoVO {
  id: number
  username: string
  nickname?: string
  avatar?: string
  email?: string
  phone?: string
  roleCode: RoleCode
  roleName?: string
  status: Status01
  lastLoginAt?: string
  createdAt: string
}

export interface RoleSaveRequest {
  code: string
  name: string
  description?: string
  sort?: number
  status?: boolean
}

export interface RoleVO {
  id: number
  code: string
  name: string
  description?: string
  sort: number
  status: Status01
  createdAt: string
}

export interface DeptSaveRequest {
  parentId?: number
  deptName: string
  sort?: number
  leader?: string
  phone?: string
  email?: string
  defaultRoleId?: number
  status?: boolean
}

export interface DeptRoleAssignRequest {
  roleIds?: number[]
}

export interface DeptVO {
  id: number
  parentId: number
  deptName: string
  ancestors: string
  sort?: number
  leader?: string
  phone?: string
  email?: string
  defaultRoleId?: number
  defaultRoleName?: string
  status: boolean
  createdAt: string
  children: DeptVO[]
}

export interface MenuSaveRequest {
  parentId?: number
  menuName: string
  menuType: MenuType
  path?: string
  component?: string
  permission?: string
  icon?: string
  sort?: number
  visible?: boolean
  status?: boolean
  platform?: MenuPlatform
}

export interface MenuVO {
  id: number
  parentId: number
  menuName: string
  menuType: MenuType
  path?: string
  component?: string
  permission?: string
  icon?: string
  sort?: number
  visible: boolean
  status: boolean
  platform: MenuPlatform
  createdAt: string
  children: MenuVO[]
}

export interface RoleMenuAssignRequest {
  menuIds?: number[]
}

export interface CreateAppRequest {
  appName: string
  appCode: string
  appType: string
  difyApiKey: string
  difyAppId?: string
  difyBaseUrl?: string
  description?: string
  icon?: string
  sort?: number
}

export interface AppConfigVO {
  id: number
  appName: string
  appCode?: string
  appType?: string
  description?: string
  icon?: string
  iconImage?: string
  sort?: number
  enabled?: boolean

  sourceType?: 'canvas' | 'template'
  templateCode?: string
  publishStatus?: 'DRAFT' | 'SAVED' | 'PUBLISHED' | 'PUBLISH_FAILED'
  version?: number
  currentDraftVersion?: number
  currentPublishedVersion?: number
  lastEditedAt?: string
  publishedAt?: string
  lastPublishedAt?: string

  difyApiKey?: string
  difyAppId?: string
  difyBaseUrl?: string
  createdAt?: string
}

export interface UpdateAppBasicRequest {
  appName?: string
  description?: string
  icon?: string
  iconImage?: string
  sort?: number
  enabled?: boolean
}

export interface AppListParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
  appType?: string
  publishStatus?: 'PUBLISHED' | 'UNPUBLISHED' | ''
}

export interface PageResult<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}

function listApps(): Promise<AppConfigVO[]>
function listApps(params: AppListParams): Promise<PageResult<AppConfigVO> | AppConfigVO[]>
function listApps(params?: AppListParams): Promise<PageResult<AppConfigVO> | AppConfigVO[]> {
  return unwrap<PageResult<AppConfigVO> | AppConfigVO[]>(apiClient.get('/apps/list', { params }))
}

export type KnowledgeId = string | number
export type IndexingTechnique = 'high_quality' | 'economy'
export type KnowledgePermission = 'only_me' | 'all_team_members' | 'partial_members'
export type KnowledgeDocForm = 'text_model' | 'hierarchical_model' | 'qa_model'
export type ProcessRuleMode = 'automatic' | 'custom'

export interface ProcessRulePayload {
  mode: ProcessRuleMode
  rules?: Record<string, any>
}

export interface CreateKnowledgeBaseRequest {
  kbName: string
  kbCode: string
  difyApiKey: string
  difyDatasetId: string
  difyBaseUrl?: string
  description?: string
  icon?: string
  indexingTechnique?: string
  embeddingModel?: string
  sort?: number
  enabled?: boolean
}

export interface KnowledgeBaseVO {
  id: KnowledgeId
  kbName: string
  kbCode?: string
  difyApiKey?: string
  difyDatasetId?: string
  difyBaseUrl?: string
  description?: string
  icon?: string
  documentCount?: number
  wordCount?: number
  indexingTechnique?: string
  embeddingModel?: string
  sort?: number
  enabled?: boolean
  createdAt?: string
  updatedAt?: string

  // 兼容透传字段（列表/文档接口中可能出现）
  name?: string
  provider?: string
  permission?: KnowledgePermission | string
  indexing_technique?: string
  app_count?: number
  document_count?: number
  word_count?: number
  author_name?: string
  created_at?: number
  updated_at?: number
  embedding_model?: string
  embedding_model_provider?: string
  embedding_available?: boolean
  tags?: Record<string, any>[]
  doc_form?: KnowledgeDocForm | string
  is_published?: boolean
  total_documents?: number
  total_available_documents?: number
  enable_api?: boolean
}

export interface KnowledgePagedResult<T> {
  data: T[]
  has_more?: boolean
  limit?: number
  total?: number
  page?: number
}

export interface KnowledgeDocumentVO {
  id: string
  position?: number
  data_source_type?: string
  data_source_info?: Record<string, any>
  data_source_detail_dict?: Record<string, any>
  dataset_process_rule_id?: string
  name?: string
  created_from?: string
  created_by?: string
  created_at?: number
  tokens?: number
  indexing_status?: string
  error?: string | null
  enabled?: boolean
  disabled_at?: number | null
  disabled_by?: string | null
  archived?: boolean
  display_status?: string
  word_count?: number
  hit_count?: number
  doc_form?: KnowledgeDocForm | string
  doc_metadata?: Record<string, any>[] | null
  summary_index_status?: string | null
  need_summary?: boolean
}

export interface KnowledgeSegmentVO {
  id: string
  position?: number
  document_id?: string
  content?: string
  sign_content?: string
  answer?: string
  word_count?: number
  tokens?: number
  keywords?: string[]
  index_node_id?: string
  index_node_hash?: string
  hit_count?: number
  enabled?: boolean
  status?: string
  created_at?: number
  updated_at?: number
  indexing_at?: number
  completed_at?: number
  error?: string | null
  child_chunks?: KnowledgeChildChunkVO[]
  attachments?: Record<string, any>[]
  summary?: string | null
}

export interface KnowledgeChildChunkVO {
  id: string
  segment_id?: string
  content?: string
  position?: number
  word_count?: number
  type?: string
  created_at?: number
  updated_at?: number
}

export interface CreateKnowledgeDocumentByTextRequest {
  name: string
  text: string
  indexing_technique: IndexingTechnique
  process_rule: ProcessRulePayload
  doc_form?: KnowledgeDocForm
}

export interface CreateKnowledgeDocumentByFileRequest {
  indexing_technique: IndexingTechnique
  processRule: string
  doc_form?: KnowledgeDocForm
  doc_language?: string
}

export interface GrantRequest {
  userId: number
  resourceType: ResourceTypeEnumValue
  resourceIds: number[]
}

export interface UserResourceAuthorizations {
  app: number[] | null
  knowledge: number[] | null
}

export interface ChatRequest {
  query: string
  conversationId?: string
  inputs?: Record<string, any>
  files?: ChatFilePayload[]
}

export type ChatFileType = 'document' | 'image' | 'audio' | 'video' | 'custom'
export type ChatFileTransferMethod = 'remote_url' | 'local_file'

export interface ChatFilePayload {
  type: ChatFileType
  transferMethod?: ChatFileTransferMethod
  url?: string
  uploadFileId?: string
}

export interface AgentChatRequest {
  query: string
  conversationId?: string
  inputs?: Record<string, any>
}

export interface SseEventPayload {
  event: string
  data: any
}

export interface StreamChatHandlers {
  onOpen?: () => void
  onMessage?: (data: any) => void
  onThinkingDelta?: (data: any) => void
  onMessageEnd?: (data: any) => void
  onMessageReplace?: (data: any) => void
  onPing?: (data: any) => void
  onError?: (error: any) => void
  onRawEvent?: (event: SseEventPayload) => void
  onClose?: () => void
}

export interface StreamAgentHandlers {
  onOpen?: () => void
  onThinkingDelta?: (data: any) => void
  onMessage?: (data: any) => void
  onToolCall?: (data: any) => void
  onToolResult?: (data: any) => void
  onMessageEnd?: (data: any) => void
  onError?: (error: any) => void
  onRawEvent?: (event: SseEventPayload) => void
  onClose?: () => void
}

export interface StreamChatOptions {
  signal?: AbortSignal
  handlers?: StreamChatHandlers
}

export interface StreamAgentOptions {
  signal?: AbortSignal
  handlers?: StreamAgentHandlers
}

let tokenProvider: (() => string | null | undefined) | null = null

export function createApiClient(options: ApiClientOptions = {}): AxiosInstance {
  tokenProvider = options.getToken ?? null

  const client = axios.create({
    baseURL: options.baseURL ?? DEFAULT_API_BASE_URL,
    timeout: options.timeout ?? 30000
  })

  client.interceptors.request.use((config) => {
    const token = tokenProvider?.()
    if (token) {
      config.headers = config.headers ?? {}
      if (!('Authorization' in config.headers)) {
        ;(config.headers as AnyObject).Authorization = `Bearer ${token}`
      }
    }
    return config
  })

  return client
}

export const apiClient = createApiClient({
  baseURL: (import.meta as any)?.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
})

export function setStaticToken(token?: string | null): void {
  tokenProvider = () => token ?? null
}

async function unwrap<T>(promise: Promise<AxiosResponse<R<T>>>): Promise<T> {
  const resp = await promise
  const body = resp.data
  const isSuccess = body?.code === 0 || body?.code === 200
  if (!isSuccess) {
    const error = new Error(body.message || `API Error: ${body?.code}`) as Error & {
      code?: number
      data?: unknown
    }
    error.code = typeof body?.code === 'number' ? body.code : undefined
    error.data = body?.data
    throw error
  }
  return body.data
}

function toFormData(data: Record<string, any>): FormData {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    form.append(key, value as any)
  })
  return form
}

function parseSseBlock(block: string): SseEventPayload | null {
  const lines = block.split(/\r?\n/)
  if (lines.length === 0) return null

  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || eventName
      continue
    }
    if (line.startsWith('data:')) {
      const rawData = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
      dataLines.push(rawData)
      continue
    }
  }

  if (dataLines.length === 0) return null
  const raw = dataLines.join('\n')
  const data = safeJsonParse(raw)
  return { event: eventName, data }
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function getBaseURL(): string {
  return (apiClient.defaults.baseURL || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

async function readSseResponse(
  response: Response,
  onEvent: (event: SseEventPayload) => void,
  onClose?: () => void
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    onClose?.()
    return
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const block of events) {
      const event = parseSseBlock(block)
      if (!event) continue
      onEvent(event)
    }
  }

  onClose?.()
}

export const authApi = {
  getCaptchaImage(config?: AxiosRequestConfig) {
    return unwrap<CaptchaResponse>(apiClient.get('/auth/captcha/image', config))
  },

  login(payload: LoginRequest, config?: AxiosRequestConfig) {
    return unwrap<LoginResponse>(apiClient.post('/auth/login', payload, config))
  },

  logout(config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.post('/auth/logout', undefined, config))
  }
}

export const userApi = {
  me(config?: AxiosRequestConfig) {
    return unwrap<UserInfoVO>(apiClient.get('/users/me', config))
  },

  updateMe(payload: UpdateUserRequest, config?: AxiosRequestConfig) {
    return unwrap<UserInfoVO>(apiClient.put('/users/me', payload, config))
  },

  changePassword(payload: ChangePasswordRequest, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.put('/users/me/password', payload, config))
  },

  list(params?: { keyword?: string; page?: number; size?: number }, config?: AxiosRequestConfig) {
    return unwrap<UserInfoVO[]>(apiClient.get('/users/list', { ...config, params }))
  },

  create(payload: RegisterUserRequest, config?: AxiosRequestConfig) {
    return unwrap<UserInfoVO>(apiClient.post('/users/create', payload, config))
  },

  toggleStatus(id: number, status: Status01, config?: AxiosRequestConfig) {
    return unwrap<void>(
      apiClient.put(`/users/${id}/status`, undefined, { ...config, params: { status } })
    )
  },

  changeRole(id: number, roleId: number, config?: AxiosRequestConfig) {
    return unwrap<void>(
      apiClient.put(`/users/${id}/role`, undefined, { ...config, params: { roleId } })
    )
  },

  delete(id: number, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.delete(`/users/${id}`, config))
  }
}

export const roleApi = {
  list(params?: { keyword?: string }, config?: AxiosRequestConfig) {
    return unwrap<RoleVO[]>(apiClient.get('/roles/list', { ...config, params }))
  },

  detail(id: number, config?: AxiosRequestConfig) {
    return unwrap<RoleVO>(apiClient.get(`/roles/${id}`, config))
  },

  create(payload: RoleSaveRequest, config?: AxiosRequestConfig) {
    return unwrap<RoleVO>(apiClient.post('/roles/create', payload, config))
  },

  update(id: number, payload: RoleSaveRequest, config?: AxiosRequestConfig) {
    return unwrap<RoleVO>(apiClient.put(`/roles/${id}`, payload, config))
  },

  delete(id: number, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.delete(`/roles/${id}`, config))
  },

  toggleStatus(id: number, status: Status01, config?: AxiosRequestConfig) {
    return unwrap<void>(
      apiClient.put(`/roles/${id}/status`, undefined, { ...config, params: { status } })
    )
  }
}

export const deptApi = {
  tree(config?: AxiosRequestConfig) {
    return unwrap<DeptVO[]>(apiClient.get('/depts/tree', config))
  },

  detail(id: number, config?: AxiosRequestConfig) {
    return unwrap<DeptVO>(apiClient.get(`/depts/${id}`, config))
  },

  create(payload: DeptSaveRequest, config?: AxiosRequestConfig) {
    return unwrap<DeptVO>(apiClient.post('/depts/create', payload, config))
  },

  update(id: number, payload: DeptSaveRequest, config?: AxiosRequestConfig) {
    return unwrap<DeptVO>(apiClient.put(`/depts/${id}`, payload, config))
  },

  delete(id: number, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.delete(`/depts/${id}`, config))
  },

  getDeptRoleIds(deptId: number, config?: AxiosRequestConfig) {
    return unwrap<number[]>(apiClient.get(`/depts/${deptId}/roles`, config))
  },

  assignDeptRoles(deptId: number, payload: DeptRoleAssignRequest, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.post(`/depts/${deptId}/roles`, payload, config))
  }
}

export const menuApi = {
  tree(platform?: MenuPlatform, config?: AxiosRequestConfig) {
    return unwrap<MenuVO[]>(
      apiClient.get('/menus/tree', { ...config, params: platform ? { platform } : undefined })
    )
  },

  permissions(platform?: MenuPlatform, config?: AxiosRequestConfig) {
    return unwrap<string[]>(
      apiClient.get('/menus/permissions', {
        ...config,
        params: platform ? { platform } : undefined
      })
    )
  },

  list(platform?: MenuPlatform, config?: AxiosRequestConfig) {
    return unwrap<MenuVO[]>(
      apiClient.get('/menus/list', { ...config, params: platform ? { platform } : undefined })
    )
  },

  create(payload: MenuSaveRequest, config?: AxiosRequestConfig) {
    return unwrap<MenuVO>(apiClient.post('/menus', payload, config))
  },

  updateByQuery(id: number, payload: MenuSaveRequest, config?: AxiosRequestConfig) {
    return unwrap<MenuVO>(apiClient.put('/menus', payload, { ...config, params: { id } }))
  },

  update(id: number, payload: MenuSaveRequest, config?: AxiosRequestConfig) {
    return unwrap<MenuVO>(apiClient.put(`/menus/${id}`, payload, config))
  },

  deleteByQuery(id: number, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.delete('/menus', { ...config, params: { id } }))
  },

  delete(id: number, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.delete(`/menus/${id}`, config))
  },

  getRoleMenus(roleId: number, config?: AxiosRequestConfig) {
    return unwrap<number[]>(apiClient.get(`/menus/role/${roleId}`, config))
  },

  getRoleMenuIds(roleId: number, config?: AxiosRequestConfig) {
    return menuApi.getRoleMenus(roleId, config)
  },

  assignRoleMenus(roleId: number, payload: RoleMenuAssignRequest, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.post(`/menus/role/${roleId}`, payload, config))
  }
}

export const appApi = {
  list: listApps,

  detail(id: number, config?: AxiosRequestConfig) {
    return unwrap<AppConfigVO>(apiClient.get(`/apps/${id}`, config))
  },

  updateBasic(id: number, payload: UpdateAppBasicRequest, config?: AxiosRequestConfig) {
    return unwrap<AppConfigVO>(apiClient.put(`/apps/${id}`, payload, config))
  },

  delete(id: number, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.delete(`/apps/${id}`, config))
  },

  getParameters(id: number, config?: AxiosRequestConfig) {
    return unwrap<AnyObject>(apiClient.get(`/apps/${id}/parameters`, config))
  }
}

export const resourceAuthApi = {
  grant(payload: GrantRequest, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.post('/resource-auth/grant', payload, config))
  },

  revoke(userId: number, resourceType: ResourceTypeEnumValue, config?: AxiosRequestConfig) {
    return unwrap<void>(
      apiClient.post('/resource-auth/revoke', undefined, {
        ...config,
        params: { userId, resourceType }
      })
    )
  },

  getUserAuthorizations(userId: number, config?: AxiosRequestConfig) {
    return unwrap<UserResourceAuthorizations>(
      apiClient.get(`/resource-auth/user/${userId}`, config)
    )
  }
}

export const chatApi = {
  stopGeneration(appId: number, taskId: string, config?: AxiosRequestConfig) {
    return unwrap<void>(
      apiClient.post('/chat/stop', undefined, { ...config, params: { appId, taskId } })
    )
  },

  feedback(appId: number, messageId: string, rating: string, config?: AxiosRequestConfig) {
    return unwrap<void>(
      apiClient.post('/chat/feedback', undefined, {
        ...config,
        params: { appId, messageId, rating }
      })
    )
  },

  suggested(appId: number, messageId: string, config?: AxiosRequestConfig) {
    return unwrap<AnyObject>(
      apiClient.get('/chat/suggested', { ...config, params: { appId, messageId } })
    )
  },

  audioToText(appId: number, file: File | Blob, config?: AxiosRequestConfig) {
    const form = new FormData()
    form.append('appId', String(appId))

    // 关键：Blob 必须显式提供文件名，且文件名要带合法扩展名
    if (file instanceof File) {
      form.append('file', file, file.name)
    } else {
      // Blob 兜底：根据 type 推断扩展名
      const mime = file.type || 'audio/webm'
      const ext = mime.includes('webm')
        ? 'webm'
        : mime.includes('mp4')
          ? 'mp4'
          : mime.includes('mpeg')
            ? 'mp3'
            : mime.includes('wav')
              ? 'wav'
              : 'webm'
      form.append('file', file, `recording-${Date.now()}.${ext}`)
    }

    return unwrap<AnyObject>(
      apiClient.post('/chat/audio-to-text', form, {
        ...config,
        headers: {
          ...(config?.headers ?? {})
          // 不要手动设置 Content-Type，让浏览器自动加 boundary
        }
      })
    )
  },

  /**
   * POST + SSE 濞翠礁绱￠懕濠傘亯
   */
  async streamChat(
    appId: number,
    payload: ChatRequest,
    options: StreamChatOptions = {}
  ): Promise<void> {
    const token = tokenProvider?.() ?? null
    const response = await fetch(
      `${getBaseURL()}/chat/stream?appId=${encodeURIComponent(String(appId))}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        signal: options.signal
      }
    )

    if (!response.ok) {
      const msg = `stream request failed: ${response.status} ${response.statusText}`
      options.handlers?.onError?.(new Error(msg))
      throw new Error(msg)
    }

    options.handlers?.onOpen?.()

    await readSseResponse(
      response,
      (event) => {
        options.handlers?.onRawEvent?.(event)

        switch (event.event) {
          case 'message': {
            const chunkType = event.data?.chunk_type
            if (
              chunkType === 'thought' ||
              chunkType === 'thought_start' ||
              chunkType === 'thought_end'
            ) {
              options.handlers?.onThinkingDelta?.(event.data)
            } else {
              options.handlers?.onMessage?.(event.data)
            }
            break
          }
          case 'thinking':
            options.handlers?.onThinkingDelta?.(event.data)
            break
          case 'message_end':
            options.handlers?.onMessageEnd?.(event.data)
            break
          case 'message_replace':
            options.handlers?.onMessageReplace?.(event.data)
            break
          case 'ping':
            options.handlers?.onPing?.(event.data)
            break
          case 'error':
            options.handlers?.onError?.(event.data)
            break
          default:
            break
        }
      },
      options.handlers?.onClose
    )
  }
}

export const conversationApi = {
  list(params: { appId: number; page?: number; limit?: number }, config?: AxiosRequestConfig) {
    return unwrap<AnyObject>(apiClient.get('/conversations', { ...config, params }))
  },

  messages(
    conversationId: string,
    params: { appId: number; firstId?: string; limit?: number },
    config?: AxiosRequestConfig
  ) {
    return unwrap<AnyObject>(
      apiClient.get(`/conversations/${conversationId}/messages`, { ...config, params })
    )
  },

  rename(
    conversationId: string,
    params: { appId: number; name?: string; autoGenerate?: boolean },
    config?: AxiosRequestConfig
  ) {
    return unwrap<AnyObject>(
      apiClient.put(`/conversations/${conversationId}/name`, undefined, { ...config, params })
    )
  },

  delete(conversationId: string, appId: number, config?: AxiosRequestConfig) {
    return unwrap<void>(
      apiClient.delete(`/conversations/${conversationId}`, { ...config, params: { appId } })
    )
  }
}

const KNOWLEDGE_BASE_PATH = ((import.meta as any)?.env?.VITE_KNOWLEDGE_BASE_PATH || '/knowledge')
  .trim()
  .replace(/\/$/, '')

export const knowledgeApi = {
  list(config?: AxiosRequestConfig) {
    return unwrap<KnowledgeBaseVO[]>(apiClient.get(`${KNOWLEDGE_BASE_PATH}/list`, config))
  },

  detail(id: KnowledgeId, config?: AxiosRequestConfig) {
    return unwrap<KnowledgeBaseVO>(apiClient.get(`${KNOWLEDGE_BASE_PATH}/${id}`, config))
  },

  create(payload: CreateKnowledgeBaseRequest, config?: AxiosRequestConfig) {
    return unwrap<KnowledgeBaseVO>(apiClient.post(`${KNOWLEDGE_BASE_PATH}/create`, payload, config))
  },

  update(id: KnowledgeId, payload: CreateKnowledgeBaseRequest, config?: AxiosRequestConfig) {
    return unwrap<KnowledgeBaseVO>(apiClient.put(`${KNOWLEDGE_BASE_PATH}/${id}`, payload, config))
  },

  delete(id: KnowledgeId, config?: AxiosRequestConfig) {
    return unwrap<void>(apiClient.delete(`${KNOWLEDGE_BASE_PATH}/${id}`, config))
  },

  retrieve(
    id: KnowledgeId,
    payload: {
      query: string
      retrieval_model?: {
        search_method?: 'semantic_search' | 'keyword_search' | 'full_text_search' | 'hybrid_search'
        reranking_enable?: boolean
        top_k?: number
        score_threshold_enabled?: boolean
        score_threshold?: number
      }
    },
    config?: AxiosRequestConfig
  ) {
    return unwrap<AnyObject>(
      apiClient.post(`${KNOWLEDGE_BASE_PATH}/${id}/retrieve`, payload, config)
    )
  },

  listDocuments(
    id: KnowledgeId,
    params?: {
      keyword?: string
      page?: number
      limit?: number
      status?: string | string[]
    },
    config?: AxiosRequestConfig
  ) {
    return unwrap<KnowledgePagedResult<KnowledgeDocumentVO>>(
      apiClient.get(`${KNOWLEDGE_BASE_PATH}/${id}/documents`, { ...config, params })
    )
  },

  createDocumentByText(
    id: KnowledgeId,
    payload: CreateKnowledgeDocumentByTextRequest,
    config?: AxiosRequestConfig
  ) {
    return unwrap<AnyObject>(
      apiClient.post(`${KNOWLEDGE_BASE_PATH}/${id}/documents/text`, payload, config)
    )
  },

  createDocumentByFile(
    id: KnowledgeId,
    file: File | Blob,
    options: CreateKnowledgeDocumentByFileRequest,
    config?: AxiosRequestConfig
  ) {
    const form = toFormData({
      file,
      indexing_technique: options.indexing_technique,
      doc_form: options.doc_form,
      doc_language: options.doc_language,
      processRule: options.processRule
    })

    return unwrap<AnyObject>(
      apiClient.post(`${KNOWLEDGE_BASE_PATH}/${id}/documents/file`, form, {
        ...config,
        headers: {
          ...(config?.headers ?? {}),
          'Content-Type': 'multipart/form-data'
        }
      })
    )
  },

  deleteDocument(id: KnowledgeId, docId: string, config?: AxiosRequestConfig) {
    return unwrap<AnyObject>(
      apiClient.delete(`${KNOWLEDGE_BASE_PATH}/${id}/documents/${docId}`, config)
    )
  },

  indexingStatus(id: KnowledgeId, batch: string, config?: AxiosRequestConfig) {
    return unwrap<AnyObject>(
      apiClient.get(`${KNOWLEDGE_BASE_PATH}/${id}/documents/${batch}/indexing-status`, config)
    )
  },

  async downloadDocumentsZip(id: KnowledgeId, documentIds: string[], config?: AxiosRequestConfig) {
    const response = await apiClient.post(
      `${KNOWLEDGE_BASE_PATH}/${id}/documents/download-zip`,
      { document_ids: documentIds },
      { ...config, responseType: 'blob' }
    )
    return {
      blob: response.data as Blob,
      headers: response.headers
    }
  },

  listSegments(
    id: KnowledgeId,
    docId: string,
    params?: { page?: number; limit?: number; keyword?: string; status?: string | string[] },
    config?: AxiosRequestConfig
  ) {
    return unwrap<KnowledgePagedResult<KnowledgeSegmentVO>>(
      apiClient.get(`${KNOWLEDGE_BASE_PATH}/${id}/documents/${docId}/segments`, {
        ...config,
        params
      })
    )
  },

  createSegments(
    id: KnowledgeId,
    docId: string,
    segments: Array<{ content: string; answer?: string; keywords?: string[] }>,
    config?: AxiosRequestConfig
  ) {
    return unwrap<AnyObject>(
      apiClient.post(
        `${KNOWLEDGE_BASE_PATH}/${id}/documents/${docId}/segments`,
        { segments },
        config
      )
    )
  },

  updateSegment(
    id: KnowledgeId,
    docId: string,
    segmentId: string,
    segment: {
      content: string
      answer?: string
      keywords?: string[]
      enabled?: boolean
      regenerate_child_chunks?: boolean
    },
    config?: AxiosRequestConfig
  ) {
    return unwrap<KnowledgeSegmentVO>(
      apiClient.patch(
        `${KNOWLEDGE_BASE_PATH}/${id}/documents/${docId}/segments/${segmentId}`,
        { segment },
        config
      )
    )
  },

  deleteSegment(id: KnowledgeId, docId: string, segmentId: string, config?: AxiosRequestConfig) {
    return unwrap<AnyObject>(
      apiClient.delete(
        `${KNOWLEDGE_BASE_PATH}/${id}/documents/${docId}/segments/${segmentId}`,
        config
      )
    )
  },

  createChildChunk(
    id: KnowledgeId,
    docId: string,
    segmentId: string,
    payload: { content: string },
    config?: AxiosRequestConfig
  ) {
    return unwrap<KnowledgeChildChunkVO>(
      apiClient.post(
        `${KNOWLEDGE_BASE_PATH}/${id}/documents/${docId}/segments/${segmentId}/child-chunks`,
        payload,
        config
      )
    )
  },

  updateChildChunk(
    id: KnowledgeId,
    docId: string,
    segmentId: string,
    chunkId: string,
    payload: { content: string },
    config?: AxiosRequestConfig
  ) {
    return unwrap<KnowledgeChildChunkVO>(
      apiClient.patch(
        `${KNOWLEDGE_BASE_PATH}/${id}/documents/${docId}/segments/${segmentId}/child-chunks/${chunkId}`,
        payload,
        config
      )
    )
  }
}

export const fileApi = {
  upload(appId: number, file: File | Blob, config?: AxiosRequestConfig) {
    const form = toFormData({ file })
    return unwrap<AnyObject>(
      apiClient.post('/files/upload', form, {
        ...config,
        params: {
          ...(config?.params ?? {}),
          appId
        },
        headers: {
          ...(config?.headers ?? {}),
          'Content-Type': 'multipart/form-data'
        }
      })
    )
  }
}

export const agentApi = {
  /**
   * POST + SSE Agent 濞翠礁绱＄€电鐦?
   */
  async stream(
    agentId: AgentId,
    payload: AgentChatRequest,
    options: StreamAgentOptions = {}
  ): Promise<void> {
    const token = tokenProvider?.() ?? null
    const response = await fetch(
      `${getBaseURL()}/agents/stream?agentId=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        signal: options.signal
      }
    )

    if (!response.ok) {
      const msg = `agent stream request failed: ${response.status} ${response.statusText}`
      options.handlers?.onError?.(new Error(msg))
      throw new Error(msg)
    }

    options.handlers?.onOpen?.()

    await readSseResponse(
      response,
      (event) => {
        options.handlers?.onRawEvent?.(event)

        switch (event.event) {
          case 'thinking':
            options.handlers?.onThinkingDelta?.(event.data)
            break
          case 'message':
            options.handlers?.onMessage?.(event.data)
            break
          case 'tool_call':
            options.handlers?.onToolCall?.(event.data)
            break
          case 'tool_result':
            options.handlers?.onToolResult?.(event.data)
            break
          case 'message_end':
            options.handlers?.onMessageEnd?.(event.data)
            break
          case 'error':
            options.handlers?.onError?.(event.data)
            break
          default:
            break
        }
      },
      options.handlers?.onClose
    )
  },

  async streamChat(
    agentId: AgentId,
    payload: AgentChatRequest,
    options: StreamAgentOptions = {}
  ): Promise<void> {
    return this.stream(agentId, payload, options)
  }
}

export const systemApi = {
  health(config?: AxiosRequestConfig) {
    return unwrap<{ status: 'UP'; timestamp: string }>(apiClient.get('/system/health', config))
  }
}

// === 流程编排相关 ===
export type {
  CreateFromTemplateRequest,
  CreateFromTemplateResponse,
  TemplateMeta
} from '@/views/app/orchestrator/types'
export type {
  CanvasFlowPayload,
  CanvasSnapshotPayload
} from '@/views/app/orchestrator/canvas/types'

export const orchestrationApi = {
  /** 拿可用模板列表 */
  listTemplates(config?: AxiosRequestConfig) {
    return unwrap<TemplateMeta[]>(apiClient.get('/dify/app/templates', config))
  },

  /** 拿单个模板详情(第一版可暂不调用,留接口位) */
  getTemplate(code: string, config?: AxiosRequestConfig) {
    return unwrap<TemplateMeta>(apiClient.get(`/dify/app/templates/${code}`, config))
  },

  /** 新建模板编排 - 保存 */
  saveTemplateDraft(payload: TemplatePayloadWithVersion, config?: AxiosRequestConfig) {
    return unwrap<CreateFromTemplateResponse>(
      apiClient.post('/dify/app/template/save', payload, config)
    )
  },

  /** 编辑模板编排 - 查询 */
  getTemplateDraft(id: number, config?: AxiosRequestConfig) {
    return unwrap<any>(apiClient.get(`/dify/app/template/${id}`, config))
  },

  /** 编辑模板编排 - 保存 */
  updateTemplateDraft(
    id: number,
    payload: TemplatePayloadWithVersion,
    config?: AxiosRequestConfig
  ) {
    return unwrap<CreateFromTemplateResponse>(
      apiClient.put(`/dify/app/template/${id}/save`, payload, config)
    )
  },

  /** 新建空白编排 - 保存 */
  saveCanvasDraft(
    payload: CanvasSnapshotPayload & { version?: number },
    config?: AxiosRequestConfig
  ) {
    return unwrap<CreateFromTemplateResponse>(
      apiClient.post('/dify/app/canvas/save', payload, config)
    )
  },

  /** 编辑空白编排 - 查询 */
  getCanvasDraft(id: number, config?: AxiosRequestConfig) {
    return unwrap<any>(apiClient.get(`/dify/app/canvas/${id}`, config))
  },

  /** 编辑空白编排 - 保存 */
  updateCanvasDraft(
    id: number,
    payload: CanvasSnapshotPayload & { version?: number },
    config?: AxiosRequestConfig
  ) {
    return unwrap<CreateFromTemplateResponse>(
      apiClient.put(`/dify/app/canvas/${id}/save`, payload, config)
    )
  },

  /** 列表页发布 */
  publishApp(id: number, payload?: { version?: number }, config?: AxiosRequestConfig) {
    return unwrap<CreateFromTemplateResponse>(
      apiClient.post(`/dify/app/${id}/publish`, payload, config)
    )
  },

  /** 兼容旧调用 */
  saveTemplate(payload: TemplatePayloadWithVersion, config?: AxiosRequestConfig) {
    return orchestrationApi.saveTemplateDraft(payload, config)
  },

  /** 兼容旧调用 */
  getTemplateConfig(id: number, config?: AxiosRequestConfig) {
    return orchestrationApi.getTemplateDraft(id, config)
  },

  /** 兼容旧调用 */
  saveTemplateConfig(id: number, payload: TemplatePayloadWithVersion, config?: AxiosRequestConfig) {
    return orchestrationApi.updateTemplateDraft(id, payload, config)
  },

  /** 兼容旧调用 */
  saveCanvas(payload: CanvasSnapshotPayload & { version?: number }, config?: AxiosRequestConfig) {
    return orchestrationApi.saveCanvasDraft(payload, config)
  },

  /** 兼容旧调用 */
  getCanvasConfig(id: number, config?: AxiosRequestConfig) {
    return orchestrationApi.getCanvasDraft(id, config)
  },

  /** 兼容旧调用 */
  saveCanvasConfig(
    id: number,
    payload: CanvasSnapshotPayload & { version?: number },
    config?: AxiosRequestConfig
  ) {
    return orchestrationApi.updateCanvasDraft(id, payload, config)
  },

  /** 兼容旧调用: 从模板创建（映射为保存） */
  createFromTemplate(payload: CreateFromTemplateRequest, config?: AxiosRequestConfig) {
    return orchestrationApi.saveTemplateDraft(payload, config)
  },

  /** 兼容旧调用: 从空白画布创建（映射为保存） */
  createFromCanvas(payload: CanvasFlowPayloadWithVersion, config?: AxiosRequestConfig) {
    return orchestrationApi.saveCanvasDraft(payload as unknown as CanvasSnapshotPayload, config)
  }
}

export const api = {
  auth: authApi,
  user: userApi,
  role: roleApi,
  dept: deptApi,
  menu: menuApi,
  app: appApi,
  resourceAuth: resourceAuthApi,
  chat: chatApi,
  conversation: conversationApi,
  knowledge: knowledgeApi,
  file: fileApi,
  agent: agentApi,
  system: systemApi,
  orchestration: orchestrationApi
}

export default api
