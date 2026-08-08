<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowLeft, CopyDocument, Delete, Microphone } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import {
  appApi,
  capabilityOptionsApi,
  chatApi,
  conversationApi,
  fileApi,
  type AppConfigVO,
  type AppStarterPrompt,
  type CapabilitySkillOption,
  type CapabilityMcpServerOption,
  type CapabilityToolOption,
  type ChatFilePayload,
  type ChatRequest
} from '@/api/frontend-api'
import {
  useChatStore,
  type ChatMessage,
  type ChatMessageFileReference,
  type ToolCallItem,
  type ToolSource,
  type UploadedFile
} from '@/store/modules/chat'
import { useUserStore } from '@/store/modules/user'
import { createDefaultStarterPrompts, normalizeStarterPrompts } from './starter-prompts'
import ToolCallChain from '@/components/Chat/ToolCallChain.vue'

interface ConversationItem {
  id: string
  name: string
  updatedAt?: string
  raw: Record<string, unknown>
}

type FeedbackRating = 'like' | 'dislike'
interface ThoughtContentParts {
  thought: string
  content: string
}
interface ThinkStreamState {
  thinkDepth: number
  carry: string
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, language: string) {
    const hasLanguage = Boolean(language && hljs.getLanguage(language))
    const value = hasLanguage
      ? hljs.highlight(code, { language, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value
    const langClass = hasLanguage ? language : 'plaintext'
    return `<pre class="hljs"><code class="language-${langClass}">${value}</code></pre>`
  }
})

const chatStore = useChatStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const generalAssistantEntry = computed(() => route.meta.permission === 'assistant:general')
const enhanced = computed(() => route.meta.toolChain === true || generalAssistantEntry.value)

function resolveRouteAppId(): number {
  const routeId = route.params.agentId ?? route.params.appId
  const rawValue = Array.isArray(routeId) ? routeId[0] : routeId
  return Number(rawValue)
}

const defaultAppId = ref<number | null>(null)
const appId = computed(() => {
  const routeAppId = resolveRouteAppId()
  return routeAppId > 0 && Number.isFinite(routeAppId) ? routeAppId : defaultAppId.value
})
const currentApp = ref<AppConfigVO | null>(null)
const conversations = ref<ConversationItem[]>([])
const inputValue = ref('')
const feedbackByMessageId = ref<Record<string, FeedbackRating | undefined>>({})
const suggestedByMessageId = ref<Record<string, string[]>>({})
const suggestedLoadingByMessageId = ref<Record<string, boolean>>({})

const conversationLoading = ref(false)
const messageLoading = ref(false)
const deletingConversationId = ref<string | null>(null)
const uploadLoading = ref(false)
const audioRecognizing = ref(false)
const isRecording = ref(false)
const stopLoading = ref(false)
const capabilityLoading = ref(false)
const webMode = ref(false)
const capabilityToolOptions = ref<CapabilityToolOption[]>([])
const capabilitySkillOptions = ref<CapabilitySkillOption[]>([])
const capabilityMcpServerOptions = ref<CapabilityMcpServerOption[]>([])
const selectedToolCodes = ref<string[]>([])
const selectedSkillCodes = ref<string[]>([])
const webToolCodes = ref<string[]>([])
const webAvailable = computed(() => webToolCodes.value.length > 0)
const fixedAgentConfig = computed(() =>
  currentApp.value?.appType === 'agent' ? currentApp.value.agentRuntimeConfig || null : null
)
const isFixedAgent = computed(() => Boolean(fixedAgentConfig.value))
const fixedMcpToolCount = computed(() => new Set(selectedToolCodes.value).size)

const streamController = ref<AbortController | null>(null)
const activeAssistantMessageId = ref<string | null>(null)
const mediaRecorderRef = ref<MediaRecorder | null>(null)
const mediaStreamRef = ref<MediaStream | null>(null)
const audioChunksRef = ref<Blob[]>([])

const messageScrollbarRef = ref<any>(null)
const messageListRef = ref<HTMLElement | null>(null)
const draftRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const shouldStickToBottom = ref(true)
const showJumpToLatest = ref(false)
const thoughtOpenByMessageId = ref<Record<string, boolean>>({})

// ── 流式草稿：流式过程中只更新这个 ref，完全不碰 store ──
interface StreamingDraft {
  id: string
  thought: string
  content: string
  isThinking: boolean
  backendMessageId?: string
  createdAt: string
  // 用于渲染思维链面板的展开态
  thoughtOpen: boolean
  toolCalls?: ToolCallItem[]
}
const streamingDraft = ref<StreamingDraft | null>(null)
// 草稿内容的 rendered HTML，用 shallowRef 避免深度响应
const draftThoughtHtml = shallowRef('')
const draftContentHtml = shallowRef('')

// 用 RAF 节流刷新草稿 HTML，避免每个 chunk 都调 renderMarkdown
let draftRafId: number | null = null
function scheduleDraftRender() {
  if (draftRafId !== null) return
  draftRafId = requestAnimationFrame(() => {
    draftRafId = null
    if (!streamingDraft.value) return
    draftThoughtHtml.value = renderMarkdown(streamingDraft.value.thought || '')
    draftContentHtml.value = renderMarkdown(streamingDraft.value.content || '')
  })
}

// 自动跟底部：只监听草稿 div 的 resize，不用每帧 scrollToBottom
const draftResizeObserver = new ResizeObserver(() => {
  const wrap = getScrollWrapEl()
  if (shouldStickToBottom.value) {
    if (wrap) wrap.scrollTop = wrap.scrollHeight
    showJumpToLatest.value = false
    return
  }
  if (wrap) updateJumpToLatestVisibility(wrap)
})

const currentConversationId = computed(() => chatStore.getCurrentConversationId)
const messages = computed(() => chatStore.getMessages)
const isGenerating = computed(() => chatStore.getIsGenerating)
const uploadedFiles = computed(() => chatStore.getUploadedFiles)
const displayName = computed(() => userStore.getDisplayName)
const canSend = computed(() =>
  Boolean(
    appId.value &&
      inputValue.value.trim() &&
      !isGenerating.value &&
      !uploadLoading.value &&
      !audioRecognizing.value
  )
)
const canStop = computed(() =>
  Boolean(appId.value && chatStore.getTaskId && isGenerating.value && !stopLoading.value)
)
const canUseVoice = computed(() =>
  Boolean(
    appId.value &&
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof MediaRecorder !== 'undefined'
  )
)

const promptSuggestions = computed<AppStarterPrompt[]>(() => {
  if (!currentApp.value?.starterPrompts?.length) {
    return createDefaultStarterPrompts()
  }
  return normalizeStarterPrompts(currentApp.value.starterPrompts)
})

async function loadCapabilityOptions() {
  if (!enhanced.value) return
  capabilityLoading.value = true
  if (fixedAgentConfig.value) {
    selectedSkillCodes.value = [...(fixedAgentConfig.value.skillCodes || [])]
    webMode.value = fixedAgentConfig.value.accessMode === 'web'
  }
  try {
    const options = await capabilityOptionsApi.list()
    capabilityToolOptions.value = (options.tools || []).filter((item) => !item.web)
    capabilitySkillOptions.value = options.skills || []
    capabilityMcpServerOptions.value = options.mcpServers || []
    webToolCodes.value = options.webToolCodes || []
    if (fixedAgentConfig.value) {
      const selectedServers = new Set(fixedAgentConfig.value.mcpServerCodes || [])
      selectedToolCodes.value = capabilityMcpServerOptions.value
        .filter((item) => selectedServers.has(item.serverCode))
        .flatMap((item) => item.toolCodes || [])
      selectedSkillCodes.value = [...(fixedAgentConfig.value.skillCodes || [])]
      webMode.value = fixedAgentConfig.value.accessMode === 'web'
    } else {
      selectedToolCodes.value = capabilityToolOptions.value.map((item) => item.toolCode)
      selectedSkillCodes.value = capabilitySkillOptions.value.map((item) => item.skillCode)
      webMode.value = false
    }
  } catch (error) {
    ElMessage.error(extractErrorMessage(error) || '加载能力选项失败')
  } finally {
    capabilityLoading.value = false
  }
}

const showWelcome = computed(
  () =>
    !currentConversationId.value &&
    messages.value.length === 0 &&
    !messageLoading.value &&
    !streamingDraft.value
)

const maxUploadSize = 20 * 1024 * 1024
const allowedFileExtensions = new Set([
  'txt',
  'md',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'mp3',
  'wav',
  'm4a',
  'mp4'
])
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])
const audioExtensions = new Set(['mp3', 'wav', 'm4a'])
const videoExtensions = new Set(['mp4'])
const documentExtensions = new Set(['txt', 'md', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'])
const remoteUrlRegex = /https?:\/\/[^\s]+/gi

function renderMarkdown(content: string): string {
  return md.render(content || '')
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return null
}

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function toRawText(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function normalizeEscapedText(value: string): string {
  let normalized = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')

  const newlineCount = (normalized.match(/\n/g) || []).length
  const hasMarkdownToken = /#{1,6}|```|\|\s*.+\s*\||---|- |\d+\. /.test(normalized)
  const looksFlattenedMarkdown = hasMarkdownToken && newlineCount < 2

  if (looksFlattenedMarkdown) {
    normalized = normalized
      .replace(/(#{1,6})([^\s#])/g, '$1 $2')
      .replace(/(---)(?=\S)/g, '$1\n')
      .replace(/(?<!\n)(#{1,6}\s)/g, '\n$1')
      .replace(/(?<!\n)(\d+\. )/g, '\n$1')
      .replace(/(?<!\n)(- )/g, '\n$1')
      .replace(/\n{3,}/g, '\n\n')
  }

  return normalized
}

function toDisplayText(value: unknown): string | null {
  const raw = toRawText(value)
  if (raw === null) return null
  const normalized = normalizeEscapedText(raw)
  return normalized.trim() ? normalized : null
}

function normalizeTimeValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1_000_000_000_000 ? value * 1000 : value
    const parsed = new Date(millis)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric)) {
        const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
        const parsed = new Date(millis)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
      }
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    return trimmed
  }
  return undefined
}

function extractStringByKeys(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toText(record[key])
    if (value) return value
  }
  return null
}

function extractRawStringByKeys(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toRawText(record[key])
    if (value !== null) return value
  }
  return null
}

function extractDisplayStringByKeys(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = toDisplayText(record[key])
    if (value !== null) return value
  }
  return null
}

function extractThoughtFromAgentThoughts(value: unknown): string {
  if (!Array.isArray(value)) return ''
  const blocks = value
    .map((item) => {
      const record = toRecord(item)
      if (!record) return toDisplayText(item) || ''
      return (
        extractDisplayStringByKeys(record, [
          'thought',
          'thinking',
          'content',
          'text',
          'reasoning'
        ]) || ''
      )
    })
    .filter(Boolean)
  return blocks.join('\n\n')
}

function extractThought(record: Record<string, unknown>): string {
  const directThought = extractDisplayStringByKeys(record, [
    'thought',
    'thinking',
    'reasoning',
    'reasoning_content'
  ])
  if (directThought) return directThought
  return extractThoughtFromAgentThoughts(record.agent_thoughts) || ''
}

function mergeThoughtText(...parts: Array<string | null | undefined>): string {
  const list = parts
    .map((item) => sanitizeThinkTags(String(item || '')).trim())
    .filter((item) => item.length > 0)
  return list.join('\n\n')
}

function hasVisibleAnswerContent(content: string): boolean {
  return content.trim().length > 0
}

function sanitizeThinkTags(text: string): string {
  return text.replace(/<\/?think\s*>/gi, '')
}

function splitThinkTaggedText(raw: string): ThoughtContentParts {
  if (!raw) return { thought: '', content: '' }
  const thoughtParts: string[] = []
  let currentThought = ''
  let content = ''
  let thinkDepth = 0
  const thinkTagRegex = /<\/?think\s*>/gi
  let cursor = 0
  let match: RegExpExecArray | null = null
  while ((match = thinkTagRegex.exec(raw)) !== null) {
    const text = raw.slice(cursor, match.index)
    if (thinkDepth > 0) currentThought += text
    else content += text

    const isClosingTag = /^<\//.test(match[0])
    if (isClosingTag) {
      if (thinkDepth > 0) {
        thinkDepth -= 1
        if (thinkDepth === 0) {
          thoughtParts.push(currentThought)
          currentThought = ''
        }
      }
    } else {
      thinkDepth += 1
    }
    cursor = thinkTagRegex.lastIndex
  }

  const tail = raw.slice(cursor)
  if (thinkDepth > 0) {
    currentThought += tail
    thoughtParts.push(currentThought)
  } else {
    content += tail
  }
  return {
    thought: sanitizeThinkTags(thoughtParts.join('\n\n')),
    content: sanitizeThinkTags(content)
  }
}

function trailingPartialTagLength(text: string, tag: string): number {
  const lowerText = text.toLowerCase()
  const lowerTag = tag.toLowerCase()
  const max = Math.min(tag.length - 1, text.length)
  for (let length = max; length > 0; length -= 1) {
    if (lowerTag.startsWith(lowerText.slice(-length))) return length
  }
  return 0
}

function splitThinkTaggedDelta(delta: string, state: ThinkStreamState): ThoughtContentParts {
  if (!delta) return { thought: '', content: '' }
  const source = `${state.carry}${delta}`
  const partialTagLength = Math.max(
    trailingPartialTagLength(source, '<think>'),
    trailingPartialTagLength(source, '</think>')
  )
  const completeSource = partialTagLength > 0 ? source.slice(0, -partialTagLength) : source
  state.carry = partialTagLength > 0 ? source.slice(-partialTagLength) : ''

  const thinkTagRegex = /<\/?think\s*>/gi
  let cursor = 0
  let thought = ''
  let content = ''
  let match: RegExpExecArray | null = null
  while ((match = thinkTagRegex.exec(completeSource)) !== null) {
    const text = completeSource.slice(cursor, match.index)
    if (state.thinkDepth > 0) thought += text
    else content += text

    const isClosingTag = /^<\//.test(match[0])
    if (isClosingTag) {
      if (state.thinkDepth > 0) state.thinkDepth -= 1
    } else {
      state.thinkDepth += 1
    }
    cursor = thinkTagRegex.lastIndex
  }

  const tail = completeSource.slice(cursor)
  if (state.thinkDepth > 0) thought += tail
  else content += tail
  return { thought: sanitizeThinkTags(thought), content: sanitizeThinkTags(content) }
}

function flushThinkStreamCarry(state: ThinkStreamState): ThoughtContentParts {
  if (!state.carry) return { thought: '', content: '' }
  const part =
    state.thinkDepth > 0
      ? { thought: state.carry, content: '' }
      : { thought: '', content: state.carry }
  state.carry = ''
  state.thinkDepth = 0
  return part
}

function getScrollWrapEl(): HTMLElement | null {
  return (messageScrollbarRef.value?.wrapRef as HTMLElement | undefined) || null
}

async function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  await nextTick()
  const wrap = getScrollWrapEl()
  if (!wrap) return
  wrap.scrollTo({ top: wrap.scrollHeight, behavior })
  if (behavior === 'auto') showJumpToLatest.value = false
}

function requestStickBottom(behavior: ScrollBehavior = 'auto') {
  if (!shouldStickToBottom.value) return
  void scrollToBottom(behavior)
}

function updateJumpToLatestVisibility(wrap: HTMLElement) {
  const distanceToBottom = wrap.scrollHeight - (wrap.scrollTop + wrap.clientHeight)
  const hasActiveOutput = Boolean(streamingDraft.value || isGenerating.value)
  showJumpToLatest.value = hasActiveOutput && distanceToBottom > 120
}

async function scrollToMessageStart(messageId: string, behavior: ScrollBehavior = 'auto') {
  await nextTick()
  const wrap = getScrollWrapEl()
  const list = messageListRef.value
  if (!wrap || !list) return
  const target = Array.from(list.querySelectorAll<HTMLElement>('[data-message-id]')).find(
    (item) => item.dataset.messageId === messageId
  )
  if (!target) return
  shouldStickToBottom.value = false
  const targetTop = target.getBoundingClientRect().top - wrap.getBoundingClientRect().top
  wrap.scrollTo({ top: wrap.scrollTop + targetTop, behavior })
  updateJumpToLatestVisibility(wrap)
}

function handleMessageScroll() {
  const wrap = getScrollWrapEl()
  if (!wrap) return
  const distanceToBottom = wrap.scrollHeight - (wrap.scrollTop + wrap.clientHeight)
  shouldStickToBottom.value = distanceToBottom < 80
  updateJumpToLatestVisibility(wrap)
}

useResizeObserver(messageListRef, () => {
  if (shouldStickToBottom.value) {
    void scrollToBottom('auto')
    return
  }
  const wrap = getScrollWrapEl()
  if (wrap) updateJumpToLatestVisibility(wrap)
})

function handleJumpToLatest() {
  shouldStickToBottom.value = true
  showJumpToLatest.value = false
  void scrollToBottom('smooth')
}

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const record = toRecord(payload)
  if (!record) return []
  const keys = ['list', 'items', 'records', 'rows', 'data']
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  const nested = toRecord(record.data)
  if (!nested) return []
  for (const key of keys) {
    const value = nested[key]
    if (Array.isArray(value)) return value
  }
  return []
}

async function resolveDefaultSystemAgent(): Promise<boolean> {
  if (appId.value) return true
  if (!generalAssistantEntry.value) return false
  try {
    const response = await appApi.list({
      pageNum: 1,
      pageSize: 1,
      appType: 'agent',
      systemAgent: true,
      publishStatus: 'PUBLISHED',
      enabled: true
    })
    const app = toRecord(pickList(response)[0])
    const id = Number(app?.id)
    if (id > 0 && Number.isFinite(id)) {
      defaultAppId.value = id
      return true
    }
  } catch (error) {
    ElMessage.error(extractErrorMessage(error) || '加载通用助手失败')
    return false
  }
  ElMessage.warning('未找到已发布且启用的系统智能体')
  return false
}

function parseConversation(rawItem: unknown, index: number): ConversationItem | null {
  const record = toRecord(rawItem)
  if (!record) return null
  const id =
    extractStringByKeys(record, ['conversationId', 'conversation_id', 'id', 'uuid']) || null
  if (!id) return null
  const messageSummaryRecord =
    toRecord(record.firstMessage) ||
    toRecord(record.first_message) ||
    toRecord(record.lastMessage) ||
    toRecord(record.last_message)
  const dataRecord = toRecord(record.data)
  const name =
    extractStringByKeys(record, [
      'name',
      'title',
      'conversationName',
      'conversation_name',
      'summary',
      'subject',
      'firstQuery',
      'first_query',
      'firstMessage',
      'first_message',
      'lastMessage',
      'last_message',
      'query',
      'question'
    ]) ||
    extractStringByKeys(dataRecord || {}, [
      'name',
      'title',
      'conversationName',
      'conversation_name',
      'summary',
      'subject',
      'firstQuery',
      'first_query',
      'firstMessage',
      'first_message',
      'lastMessage',
      'last_message',
      'query',
      'question'
    ]) ||
    extractStringByKeys(messageSummaryRecord || {}, [
      'name',
      'title',
      'query',
      'question',
      'content',
      'answer'
    ]) ||
    extractStringByKeys(toRecord(record.inputs) || {}, ['name', 'title', 'query', 'question']) ||
    `会话 ${index + 1}`
  const updatedAt = normalizeTimeValue(
    record.updatedAt ?? record.updated_at ?? record.createdAt ?? record.created_at
  )
  return { id, name, updatedAt, raw: record }
}

function parseMessageRole(rawRole: string | null): ChatMessage['role'] {
  const value = (rawRole || 'assistant').toLowerCase()
  if (value.includes('user') || value.includes('human') || value === 'question') return 'user'
  if (value.includes('system')) return 'system'
  return 'assistant'
}

function normalizeToolSources(value: unknown): ToolSource[] | undefined {
  if (!Array.isArray(value)) return undefined
  const sources: ToolSource[] = []
  value.forEach((item) => {
    const record = toRecord(item)
    const url = record ? extractStringByKeys(record, ['url']) : null
    if (!record || !url) return
    const position = Number(record.position)
    sources.push({
      title: extractStringByKeys(record, ['title']) || url,
      url,
      snippet: extractStringByKeys(record, ['snippet']) || undefined,
      position: Number.isFinite(position) ? position : undefined
    })
  })
  return sources.length ? sources : undefined
}

function normalizeToolCalls(value: unknown): ToolCallItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items: ToolCallItem[] = []
  value.forEach((item) => {
    const record = toRecord(item)
    if (!record) return
    const callId = extractStringByKeys(record, ['callId', 'call_id'])
    const toolCode = extractStringByKeys(record, ['toolCode', 'tool_code'])
    if (!callId || !toolCode) return
    const rawStatus = extractStringByKeys(record, ['status'])
    const status: ToolCallItem['status'] =
      rawStatus === 'calling' ? 'calling' : rawStatus === 'success' ? 'success' : 'error'
    const durationMs = Number(record.durationMs ?? record.duration_ms)
    const seq = Number(record.seq)
    const errorRecord = toRecord(record.error)
    items.push({
      callId,
      seq: Number.isFinite(seq) ? seq : undefined,
      toolCode,
      toolName: extractStringByKeys(record, ['toolName', 'tool_name']) || undefined,
      providerType: extractStringByKeys(record, ['providerType', 'provider_type']) || undefined,
      status,
      arguments: record.arguments,
      durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
      sources: normalizeToolSources(record.sources),
      error: errorRecord
        ? {
            code: extractStringByKeys(errorRecord, ['code']) || 'TOOL_EXECUTION_ERROR',
            message: extractStringByKeys(errorRecord, ['message']) || '工具调用失败',
            retryable: errorRecord.retryable === true
          }
        : undefined
    })
  })
  return items.length ? items : undefined
}

function parseMessageItem(rawItem: unknown, index: number): ChatMessage[] {
  const record = toRecord(rawItem)
  if (!record) return []
  const query = toDisplayText(record.query)
  const recordThought = extractThought(record)
  const answerRaw = extractRawStringByKeys(record, ['answer']) || ''
  const answerParts = splitThinkTaggedText(answerRaw)
  const answer = toDisplayText(answerParts.content) || ''
  const thoughtText = mergeThoughtText(recordThought, toDisplayText(answerParts.thought))
  const createdAt = normalizeTimeValue(
    record.createdAt ?? record.created_at ?? record.updatedAt ?? record.updated_at
  )
  const backendMessageId =
    extractStringByKeys(record, ['messageId', 'message_id', 'id']) || undefined
  const toolCalls = normalizeToolCalls(record.toolCalls ?? record.tool_calls)

  if (query || answer) {
    const pairMessages: ChatMessage[] = []
    const baseId = extractStringByKeys(record, ['id', 'messageId']) || `q-${index}`
    if (query) {
      pairMessages.push({
        id: `${baseId}-u`,
        role: 'user',
        thought: '',
        content: query,
        isThinking: false,
        createdAt
      })
    }
    if (answer || thoughtText) {
      pairMessages.push({
        id: `${baseId}-a`,
        role: 'assistant',
        thought: thoughtText,
        content: answer || '',
        isThinking: false,
        createdAt,
        backendMessageId,
        toolCalls
      })
    }
    return pairMessages
  }

  const nestedData = toRecord(record.data)
  if (nestedData) {
    const nested = parseMessageItem(nestedData, index)
    if (nested.length > 0) return nested
  }

  const rawContent =
    extractRawStringByKeys(record, ['content', 'message', 'text', 'output']) ||
    extractRawStringByKeys(record, ['answer']) ||
    ''
  const contentParts = splitThinkTaggedText(rawContent)
  const content = toDisplayText(contentParts.content) || ''
  const mergedThought = mergeThoughtText(thoughtText, toDisplayText(contentParts.thought))
  if (!content) return []
  const role = parseMessageRole(extractStringByKeys(record, ['role', 'type']))
  return [
    {
      id: extractStringByKeys(record, ['id', 'messageId']) || `message-${index}`,
      role,
      thought: mergedThought,
      content,
      isThinking: false,
      createdAt,
      backendMessageId: role === 'assistant' ? backendMessageId : undefined,
      toolCalls: role === 'assistant' ? toolCalls : undefined
    }
  ]
}

function normalizeMessages(payload: unknown): ChatMessage[] {
  const list = pickList(payload)
  const source = list.length > 0 ? list : [payload]
  return source
    .flatMap((item, index) => parseMessageItem(item, index))
    .filter((item) => Boolean(item.content || item.thought || item.toolCalls?.length))
}

function formatTime(time?: string): string {
  if (!time) return ''
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return time
  return date.toLocaleString('zh-CN', { hour12: false })
}

function roleLabel(role: ChatMessage['role']): string {
  if (role === 'user') return '用户'
  if (role === 'system') return '系统'
  return 'AI'
}

function isFallbackConversationName(value?: string): boolean {
  if (!value) return true
  return /^会话\s*\d+$/i.test(value.trim())
}

function summarizeConversationNameFromMessages(list: ChatMessage[]): string | null {
  const firstUserMessage = list.find((item) => item.role === 'user' && item.content.trim())
  if (!firstUserMessage) return null
  return firstUserMessage.content.replace(/\s+/g, ' ').trim().slice(0, 28)
}

function summarizeConversationNameFromText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 28) || '新对话'
}

function ensureConversationInList(conversationId: string, name: string) {
  if (!conversationId) return
  const fallbackName = name.trim() || '新对话'
  const exists = conversations.value.some((item) => item.id === conversationId)
  if (exists) {
    conversations.value = conversations.value.map((item) => {
      if (item.id !== conversationId) return item
      if (!isFallbackConversationName(item.name)) return item
      return { ...item, name: fallbackName }
    })
    return
  }
  conversations.value = [
    {
      id: conversationId,
      name: fallbackName,
      raw: {
        id: conversationId,
        name: fallbackName
      }
    },
    ...conversations.value
  ]
}

function patchConversationNameIfNeeded(conversationId: string, fallbackSource: ChatMessage[]) {
  if (!conversationId) return
  const nextName = summarizeConversationNameFromMessages(fallbackSource)
  if (!nextName) return
  conversations.value = conversations.value.map((item) => {
    if (item.id !== conversationId) return item
    if (!isFallbackConversationName(item.name)) return item
    return { ...item, name: nextName }
  })
}

function isThoughtPanelOpen(message: ChatMessage): boolean {
  return thoughtOpenByMessageId.value[message.id] === true
}

function handleThoughtToggle(message: ChatMessage, event: Event) {
  const target = event.target as HTMLDetailsElement
  thoughtOpenByMessageId.value = {
    ...thoughtOpenByMessageId.value,
    [message.id]: target.open
  }
}

function handleDraftThoughtToggle(event: Event) {
  if (!streamingDraft.value) return
  const target = event.target as HTMLDetailsElement
  streamingDraft.value.thoughtOpen = target.open
}

// 流式结束后一次性将草稿写入 store
function commitDraft(draft: StreamingDraft) {
  // 把之前 appendMessage 占位的 assistant 消息（isThinking:true, content:''）
  // 替换成最终完整内容，只触发一次 setMessages
  const next = chatStore.getMessages.map((item) => {
    if (item.id !== draft.id) return item
    return {
      ...item,
      thought: sanitizeThinkTags(draft.thought),
      content: sanitizeThinkTags(draft.content),
      isThinking: false,
      backendMessageId: draft.backendMessageId,
      toolCalls: draft.toolCalls
    }
  })
  chatStore.setMessages(next)
  if (draft.thoughtOpen) {
    thoughtOpenByMessageId.value = {
      ...thoughtOpenByMessageId.value,
      [draft.id]: true
    }
  }
}

function normalizeStreamPayload(raw: unknown): Record<string, unknown> {
  const record = toRecord(raw) || {}
  const nested = toRecord(record.data)
  if (!nested) return record
  return { ...record, ...nested }
}

function updateStreamMeta(payload: Record<string, unknown>) {
  const conversationId = extractStringByKeys(payload, ['conversationId', 'conversation_id'])
  if (conversationId) chatStore.setCurrentConversationId(conversationId)
  const taskId = extractStringByKeys(payload, ['taskId', 'task_id'])
  if (taskId) chatStore.setTaskId(taskId)
}

function extractChunkType(payload: Record<string, unknown>): string {
  return extractStringByKeys(payload, ['chunk_type', 'chunkType']) || 'text'
}

function extractThoughtText(payload: Record<string, unknown>): string {
  return (
    extractRawStringByKeys(payload, [
      'thought',
      'thinking',
      'answer',
      'content',
      'text',
      'delta'
    ]) || ''
  )
}

function extractContentText(payload: Record<string, unknown>): string {
  return (
    extractRawStringByKeys(payload, ['answer', 'content', 'text', 'delta', 'message', 'output']) ||
    ''
  )
}

function extractBackendMessageId(payload: Record<string, unknown>): string | null {
  return (
    extractStringByKeys(payload, ['messageId', 'message_id']) ||
    extractStringByKeys(toRecord(payload.metadata) || {}, ['messageId', 'message_id']) ||
    null
  )
}

function getFeedbackValue(message: ChatMessage): FeedbackRating | undefined {
  if (!message.backendMessageId) return undefined
  return feedbackByMessageId.value[message.backendMessageId]
}

function getSuggestedQuestions(message: ChatMessage): string[] {
  if (!message.backendMessageId) return []
  return suggestedByMessageId.value[message.backendMessageId] || []
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  const record = toRecord(error)
  if (record) return extractStringByKeys(record, ['message', 'msg', 'error']) || '请求失败'
  return '请求失败'
}

function extractErrorCode(error: unknown): number | undefined {
  const record = toRecord(error)
  if (!record) return undefined
  return toFiniteNumber(record.code ?? toRecord(record.response)?.status)
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index < 0) return ''
  return filename.slice(index + 1).toLowerCase()
}

function inferChatFileType(fileName: string, mimeType?: string): ChatFilePayload['type'] {
  const extension = getFileExtension(fileName)
  const normalizedMimeType = (mimeType || '').toLowerCase()
  if (normalizedMimeType.startsWith('image/') || imageExtensions.has(extension)) return 'image'
  if (normalizedMimeType.startsWith('audio/') || audioExtensions.has(extension)) return 'audio'
  if (normalizedMimeType.startsWith('video/') || videoExtensions.has(extension)) return 'video'
  if (
    normalizedMimeType.startsWith('text/') ||
    normalizedMimeType.startsWith('application/pdf') ||
    normalizedMimeType.includes('word') ||
    normalizedMimeType.includes('excel') ||
    normalizedMimeType.includes('sheet') ||
    documentExtensions.has(extension)
  )
    return 'document'
  return 'custom'
}

function normalizeRemoteUrl(value: string): string | null {
  const trimmed = value.trim().replace(/[),.;!?]+$/, '')
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (!/^https?:$/.test(parsed.protocol)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function extractRemoteUrls(question: string): string[] {
  const matches = question.match(remoteUrlRegex) || []
  const seen = new Set<string>()
  for (const item of matches) {
    const normalized = normalizeRemoteUrl(item)
    if (!normalized) continue
    seen.add(normalized)
  }
  return Array.from(seen)
}

function splitFileName(rawName: string): { name: string; extension?: string } {
  const normalized = rawName.trim()
  if (!normalized) return { name: '未命名文件' }
  const dotIndex = normalized.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) return { name: normalized }
  return {
    name: normalized.slice(0, dotIndex),
    extension: normalized.slice(dotIndex + 1).toLowerCase()
  }
}

function getRemoteReferenceName(url: string): string {
  const normalized = normalizeRemoteUrl(url)
  if (!normalized) return ''
  try {
    const parsed = new URL(normalized)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const tail = segments.length > 0 ? segments[segments.length - 1] : ''
    if (tail) return decodeURIComponent(tail)
    return parsed.hostname
  } catch {
    return ''
  }
}

function buildMessageFileReferences(
  files: UploadedFile[]
): NonNullable<ChatMessage['fileReferences']> | undefined {
  if (files.length === 0) return undefined
  const references: ChatMessageFileReference[] = files.map((item, index) => {
    const transferMethod = item.transferMethod || 'local_file'
    const fallbackName = item.fileName || `文件${index + 1}`
    const referenceName =
      transferMethod === 'remote_url'
        ? getRemoteReferenceName(item.url || '') || fallbackName
        : fallbackName
    const { name, extension } = splitFileName(referenceName)
    return {
      id: item.fileId || item.uploadFileId || `${transferMethod}-${index}-${referenceName}`,
      name,
      extension,
      transferMethod
    }
  })
  return references.length > 0 ? references : undefined
}

function validateUploadFile(file: File): string | null {
  if (file.size > maxUploadSize) return `文件 ${file.name} 超过 20MB 限制`
  const extension = getFileExtension(file.name)
  if (!extension || !allowedFileExtensions.has(extension)) return `文件 ${file.name} 类型暂不支持`
  return null
}

function findUploadRecord(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const record = toRecord(item)
      if (record) return record
    }
    return null
  }
  const directRecord = toRecord(payload)
  if (!directRecord) return null
  const list = pickList(payload)
  if (list.length > 0) return findUploadRecord(list[0])
  const nested = toRecord(directRecord.data)
  if (nested) {
    const id = extractStringByKeys(nested, ['fileId', 'file_id', 'id', 'upload_file_id'])
    if (id) return nested
  }
  return directRecord
}

function parseUploadedFile(response: unknown, sourceFile: File): UploadedFile | null {
  const record = findUploadRecord(response)
  if (!record) return null
  const fileId = extractStringByKeys(record, ['fileId', 'file_id', 'id', 'upload_file_id'])
  if (!fileId) return null
  const fileName =
    extractStringByKeys(record, ['fileName', 'filename', 'name', 'originalFilename']) ||
    sourceFile.name
  const fileSize =
    toFiniteNumber(record.fileSize) ??
    toFiniteNumber(record.size) ??
    toFiniteNumber(record.file_size) ??
    sourceFile.size
  const fileType =
    extractStringByKeys(record, ['fileType', 'type', 'mimeType', 'mime_type']) ||
    sourceFile.type ||
    undefined
  return {
    fileId,
    fileName,
    fileSize,
    fileType,
    type: inferChatFileType(fileName, fileType),
    transferMethod: 'local_file',
    uploadFileId: fileId
  }
}

function parseAudioToTextResult(response: unknown): string {
  const record = toRecord(response)
  if (!record) return ''
  const text =
    extractDisplayStringByKeys(record, [
      'text',
      'message',
      'content',
      'query',
      'result',
      'transcript'
    ]) || ''
  if (text) return text
  const nested = toRecord(record.data)
  if (!nested) return ''
  return (
    extractDisplayStringByKeys(nested, [
      'text',
      'message',
      'content',
      'query',
      'result',
      'transcript'
    ]) || ''
  )
}

function buildChatFiles(
  files: UploadedFile[],
  question: string
): { files?: ChatFilePayload[]; validationError?: string } {
  const payloadFiles: ChatFilePayload[] = []
  const remoteUrls = new Set<string>()
  for (const item of files) {
    const transferMethod = item.transferMethod || 'local_file'
    const fileType = item.type || inferChatFileType(item.fileName, item.fileType)
    if (transferMethod === 'local_file') {
      const uploadFileId = (item.uploadFileId || item.fileId || '').trim()
      if (!uploadFileId)
        return {
          validationError: `本地文件 ${item.fileName || '未命名文件'} 缺少 uploadFileId，请重新上传后再试`
        }
      payloadFiles.push({ type: fileType, transferMethod, uploadFileId })
      continue
    }
    const remoteUrl = normalizeRemoteUrl(item.url || '')
    if (!remoteUrl)
      return {
        validationError: `远程文件 ${item.fileName || '未命名文件'} 缺少有效 url，请检查后再试`
      }
    remoteUrls.add(remoteUrl)
    payloadFiles.push({ type: fileType, transferMethod, url: remoteUrl })
  }
  const extractedUrls = extractRemoteUrls(question)
  for (const url of extractedUrls) {
    if (remoteUrls.has(url)) continue
    payloadFiles.push({ type: 'document', transferMethod: 'remote_url', url })
  }
  return { files: payloadFiles.length > 0 ? payloadFiles : undefined }
}

function removeUploadedFile(fileId: string) {
  chatStore.setUploadedFiles(chatStore.getUploadedFiles.filter((item) => item.fileId !== fileId))
}

function triggerFileSelect() {
  if (isFixedAgent.value) return
  if (!appId.value) {
    ElMessage.warning('请先选择智能体')
    return
  }
  fileInputRef.value?.click()
}

async function handleFileInputChange(event: Event) {
  if (isFixedAgent.value) return
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''
  if (!appId.value || files.length === 0) return
  const invalidReason = files
    .map((file) => validateUploadFile(file))
    .find((reason) => Boolean(reason))
  if (invalidReason) {
    ElMessage.warning(invalidReason)
    return
  }
  uploadLoading.value = true
  const nextFiles = [...chatStore.getUploadedFiles]
  let successCount = 0
  try {
    for (const file of files) {
      try {
        const response = await fileApi.upload(appId.value, file)
        const parsed = parseUploadedFile(response, file)
        if (!parsed) {
          ElMessage.warning(`文件 ${file.name} 上传成功，但未返回可用文件ID`)
          continue
        }
        if (!nextFiles.some((item) => item.fileId === parsed.fileId)) {
          nextFiles.push(parsed)
          successCount += 1
        }
      } catch (error: unknown) {
        ElMessage.error(extractErrorMessage(error) || `文件 ${file.name} 上传失败`)
      }
    }
  } finally {
    uploadLoading.value = false
  }
  chatStore.setUploadedFiles(nextFiles)
  if (successCount > 0) ElMessage.success(`已上传 ${successCount} 个文件`)
}

function appendTextToInput(text: string) {
  const appended = text.trim()
  if (!appended) return
  const current = inputValue.value.trimEnd()
  if (!current) {
    inputValue.value = appended
    return
  }
  inputValue.value = `${current}\n${appended}`
}

function releaseAudioResources() {
  if (mediaRecorderRef.value && mediaRecorderRef.value.state !== 'inactive') {
    mediaRecorderRef.value.onstop = null
    mediaRecorderRef.value.onerror = null
    mediaRecorderRef.value.stop()
  }
  mediaRecorderRef.value = null
  audioChunksRef.value = []
  if (mediaStreamRef.value) {
    mediaStreamRef.value.getTracks().forEach((track) => track.stop())
    mediaStreamRef.value = null
  }
  isRecording.value = false
}

const recordStartTimeRef = ref<number>(0)

async function startVoiceInput() {
  if (!appId.value) {
    ElMessage.warning('请先选择智能体')
    return
  }
  if (!canUseVoice.value) {
    ElMessage.warning('当前浏览器不支持语音输入')
    return
  }
  if (isRecording.value || audioRecognizing.value || isGenerating.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaStreamRef.value = stream
    mediaRecorderRef.value = recorder
    audioChunksRef.value = []
    recordStartTimeRef.value = Date.now()
    recorder.ondataavailable = (recorderEvent: BlobEvent) => {
      if (recorderEvent.data && recorderEvent.data.size > 0)
        audioChunksRef.value.push(recorderEvent.data)
    }
    recorder.onstop = async () => {
      isRecording.value = false
      const duration = Date.now() - recordStartTimeRef.value
      if (duration < 800) {
        ElMessage.warning('录音时间太短')
        releaseAudioResources()
        return
      }
      const chunks = [...audioChunksRef.value]
      audioChunksRef.value = []
      if (mediaStreamRef.value) {
        mediaStreamRef.value.getTracks().forEach((track) => track.stop())
        mediaStreamRef.value = null
      }
      mediaRecorderRef.value = null
      if (!appId.value || chunks.length === 0) return
      const audioBlob = new Blob(chunks, { type: mimeType })
      if (audioBlob.size < 3000) {
        ElMessage.warning('未检测到有效语音，请按住说话')
        return
      }
      const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: mimeType })
      audioRecognizing.value = true
      try {
        const response = await chatApi.audioToText(appId.value, audioFile)
        const recognizedText = parseAudioToTextResult(response)
        if (recognizedText) appendTextToInput(recognizedText)
        else ElMessage.warning('未能识别出文字')
      } catch (error: unknown) {
        ElMessage.error(extractErrorMessage(error) || '语音识别失败')
      } finally {
        audioRecognizing.value = false
      }
    }
    recorder.start(200)
    isRecording.value = true
  } catch (error: unknown) {
    releaseAudioResources()
    ElMessage.error('无法启动录音，请检查麦克风权限')
  }
}

function stopVoiceInput() {
  const recorder = mediaRecorderRef.value
  if (!recorder || recorder.state === 'inactive') return
  recorder.stop()
}

function resetMessageActionsState() {
  feedbackByMessageId.value = {}
  suggestedByMessageId.value = {}
  suggestedLoadingByMessageId.value = {}
  thoughtOpenByMessageId.value = {}
}

function resetChatState() {
  chatStore.setCurrentConversationId(null)
  chatStore.setMessages([])
  chatStore.setTaskId(null)
  chatStore.setUploadedFiles([])
  resetMessageActionsState()
  conversations.value = []
  inputValue.value = ''
  chatStore.resetConversationState()
}

function resolveAppAvatar(app?: AppConfigVO | null): string {
  if (!app) return ''
  return app.iconImage || app.icon || ''
}

function resolveAppAvatarText(app?: AppConfigVO | null): string {
  const first = String(app?.appName || '')
    .trim()
    .charAt(0)
  return (first || 'A').toUpperCase()
}

function resolveAgentListFallbackPath(): string {
  const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from
  return typeof from === 'string' && from.startsWith('/') ? from : '/dashboard/home'
}

function backToApps() {
  const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from
  if (typeof from === 'string' && from.startsWith('/')) {
    void router.push(from)
    return
  }
  const historyState = window.history.state as { back?: string | null } | null
  if (historyState?.back) {
    router.back()
    return
  }
  void router.push(resolveAgentListFallbackPath())
}

async function loadConversations(preferredId?: string, selectFirst = false, silent = false) {
  if (!appId.value) {
    conversations.value = []
    return
  }
  if (!silent) conversationLoading.value = true
  const previousConversations = conversations.value
  try {
    const response = await conversationApi.list({ appId: appId.value, page: 1, limit: 100 })
    const list = pickList(response)
    const parsed = list
      .map((item, index) => parseConversation(item, index))
      .filter((item): item is ConversationItem => Boolean(item))
    if (parsed.length === 0) {
      if (silent) {
        conversations.value = previousConversations
        return
      }
      conversations.value = []
      chatStore.setCurrentConversationId(null)
      chatStore.setMessages([])
      return
    }
    conversations.value = parsed
    if (preferredId && parsed.some((item) => item.id === preferredId)) {
      chatStore.setCurrentConversationId(preferredId)
      if (!silent) await loadMessages(preferredId)
      return
    }
    if (preferredId && silent) {
      const previousPreferred = previousConversations.find((item) => item.id === preferredId)
      if (previousPreferred) {
        conversations.value = [previousPreferred, ...parsed]
      }
      chatStore.setCurrentConversationId(preferredId)
      return
    }
    if (selectFirst) {
      const first = parsed[0].id
      chatStore.setCurrentConversationId(first)
      if (!silent) await loadMessages(first)
      return
    }
    if (
      currentConversationId.value &&
      parsed.some((item) => item.id === currentConversationId.value)
    )
      return
    if (silent) return
    chatStore.setCurrentConversationId(null)
    chatStore.setMessages([])
  } catch (error: unknown) {
    ElMessage.error(extractErrorMessage(error) || '对话列表加载失败')
  } finally {
    if (!silent) conversationLoading.value = false
  }
}

async function handleSelectConversation(conversationId: string) {
  if (!appId.value) return
  chatStore.setCurrentConversationId(conversationId)
  chatStore.setUploadedFiles([])
  await loadMessages(conversationId)
}

async function loadMessages(conversationId: string) {
  if (!appId.value) return
  messageLoading.value = true
  try {
    const response = await conversationApi.messages(conversationId, {
      appId: appId.value,
      limit: 100
    })
    resetMessageActionsState()
    const nextMessages = normalizeMessages(response)
    chatStore.setMessages(nextMessages)
    patchConversationNameIfNeeded(conversationId, nextMessages)
    requestStickBottom('auto')
  } catch (error: unknown) {
    chatStore.setMessages([])
    ElMessage.error(extractErrorMessage(error) || '消息列表加载失败')
  } finally {
    messageLoading.value = false
  }
}

async function handleDeleteConversation(conversationId: string) {
  if (!appId.value || deletingConversationId.value) return
  deletingConversationId.value = conversationId
  try {
    await conversationApi.delete(conversationId, appId.value)
    const previous = [...conversations.value]
    conversations.value = previous.filter((item) => item.id !== conversationId)
    if (currentConversationId.value === conversationId) {
      chatStore.setCurrentConversationId(null)
      chatStore.setMessages([])
      chatStore.setTaskId(null)
    }
    ElMessage.success('会话删除成功')
  } catch (error: unknown) {
    if (extractErrorCode(error) === 404) {
      ElMessage.warning('会话不存在或已删除')
      await loadConversations(undefined, false, true)
      return
    }
    ElMessage.error(extractErrorMessage(error) || '会话删除失败')
  } finally {
    deletingConversationId.value = null
  }
}

function handleNewConversation() {
  chatStore.setCurrentConversationId(null)
  chatStore.setMessages([])
  chatStore.setTaskId(null)
  chatStore.setUploadedFiles([])
  showJumpToLatest.value = false
  resetMessageActionsState()
  inputValue.value = ''
  requestStickBottom('auto')
}

async function handleFeedback(message: ChatMessage, rating: FeedbackRating) {
  if (!appId.value || !message.backendMessageId) return
  const backendMessageId = message.backendMessageId
  if (feedbackByMessageId.value[backendMessageId] === rating) return
  try {
    feedbackByMessageId.value = { ...feedbackByMessageId.value, [backendMessageId]: rating }
    await chatApi.feedback(appId.value, backendMessageId, rating)
    ElMessage.success('收到啦！您的建议将帮助我们变得更好。')
  } catch (error: unknown) {
    const rollback = { ...feedbackByMessageId.value }
    if (rollback[backendMessageId] === rating) delete rollback[backendMessageId]
    feedbackByMessageId.value = rollback
    ElMessage.error(extractErrorMessage(error) || '哎呀，这里好像有点小问题')
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

async function handleCopyMessage(message: ChatMessage) {
  const content = message.content?.trim()
  if (!content) {
    ElMessage.warning('暂无可复制内容')
    return
  }
  try {
    await copyTextToClipboard(content)
    ElMessage.success('已复制')
  } catch (error: unknown) {
    ElMessage.error(extractErrorMessage(error) || '复制失败')
  }
}

function handlePickSuggestedQuestion(question: string) {
  if (!question.trim()) return
  inputValue.value = question
  nextTick(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>('.input-panel .el-textarea__inner')
    textarea?.focus()
  })
}

async function handleStopGeneration() {
  if (!canStop.value || !appId.value || !chatStore.getTaskId) return
  stopLoading.value = true
  try {
    await chatApi.stopGeneration(appId.value, chatStore.getTaskId)
  } catch (error: unknown) {
    ElMessage.warning(extractErrorMessage(error) || 'Stop request failed')
  } finally {
    streamController.value?.abort()
    streamController.value = null
    chatStore.setGenerating(false)
    chatStore.setTaskId(null)
    // 将草稿当前内容 commit 进 store，然后清空草稿
    if (streamingDraft.value) {
      commitDraft({ ...streamingDraft.value, isThinking: false })
      streamingDraft.value = null
      draftThoughtHtml.value = ''
      draftContentHtml.value = ''
      if (draftRafId !== null) {
        cancelAnimationFrame(draftRafId)
        draftRafId = null
      }
    }
    activeAssistantMessageId.value = null
    showJumpToLatest.value = false
    stopLoading.value = false
  }
}

async function handleSend() {
  if (!canSend.value || !appId.value) return
  const question = inputValue.value.trim()
  if (!question) return
  const attachedFiles = [...uploadedFiles.value]
  const messageFileReferences = buildMessageFileReferences(attachedFiles)
  const { files, validationError } = buildChatFiles(attachedFiles, question)
  if (validationError) {
    ElMessage.warning(validationError)
    return
  }

  const now = Date.now()
  const userMessageId = `local-user-${now}`
  const assistantMessageId = `local-assistant-${now}`

  // 只往 store 写用户消息 + 一条空占位（不会触发列表闪烁，因为 content 为空）
  chatStore.appendMessage({
    id: userMessageId,
    role: 'user',
    thought: '',
    content: question,
    isThinking: false,
    createdAt: new Date().toISOString(),
    fileReferences: messageFileReferences
  })
  chatStore.appendMessage({
    id: assistantMessageId,
    role: 'assistant',
    thought: '',
    content: '',
    isThinking: true,
    createdAt: new Date().toISOString(),
    backendMessageId: undefined,
    toolCalls: enhanced.value ? [] : undefined
  })
  shouldStickToBottom.value = false
  void scrollToMessageStart(userMessageId, 'smooth')

  // 初始化草稿，流式内容全部写这里
  streamingDraft.value = {
    id: assistantMessageId,
    thought: '',
    content: '',
    isThinking: true,
    backendMessageId: undefined,
    createdAt: new Date().toISOString(),
    thoughtOpen: false,
    toolCalls: enhanced.value ? [] : undefined
  }
  draftThoughtHtml.value = ''
  draftContentHtml.value = ''

  const previousConversationId = currentConversationId.value
  const controller = new AbortController()
  streamController.value = controller
  activeAssistantMessageId.value = assistantMessageId
  chatStore.setGenerating(true)
  chatStore.setTaskId(null)
  inputValue.value = ''
  let sendSucceeded = false
  const streamThinkState: ThinkStreamState = { thinkDepth: 0, carry: '' }

  // 内联辅助：直接修改草稿对象（普通对象赋值，不触发 Vue 深度响应）
  // 然后调 scheduleDraftRender 用 RAF 批量刷新 HTML
  function patchDraft(patch: Partial<StreamingDraft>) {
    if (!streamingDraft.value) return
    Object.assign(streamingDraft.value, patch)
    scheduleDraftRender()
  }

  try {
    const streamPayload: ChatRequest = {
      query: question,
      conversationId: previousConversationId || undefined,
      inputs: {},
      files
    }
    if (enhanced.value) {
      streamPayload.mode = webMode.value ? 'web' : 'tool'
      streamPayload.selectedToolCodes = webMode.value ? [] : [...selectedToolCodes.value]
      streamPayload.selectedSkillCodes = webMode.value ? [] : [...selectedSkillCodes.value]
    }
    await chatApi.streamChat(appId.value, streamPayload, {
      signal: controller.signal,
      handlers: {
        onRawEvent: (event) => {
          if (!streamingDraft.value) return

          if (event.event === 'message') {
            const payload = normalizeStreamPayload(event.data)
            updateStreamMeta(payload)
            const backendMessageId = extractBackendMessageId(payload)
            const chunkType = extractChunkType(payload)

            if (chunkType === 'thought_start' || chunkType === 'thought') {
              const delta = sanitizeThinkTags(extractThoughtText(payload))
              patchDraft({
                thought: streamingDraft.value.thought + delta,
                isThinking: !hasVisibleAnswerContent(streamingDraft.value.content),
                backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
              })
            } else if (chunkType === 'thought_end') {
              const delta = sanitizeThinkTags(extractThoughtText(payload))
              patchDraft({
                thought: streamingDraft.value.thought + delta,
                isThinking: !hasVisibleAnswerContent(streamingDraft.value.content),
                backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
              })
            } else if (chunkType === 'text') {
              const textDelta = extractContentText(payload)
              const parts = splitThinkTaggedDelta(textDelta, streamThinkState)
              const nextContent = streamingDraft.value.content + parts.content
              patchDraft({
                thought: streamingDraft.value.thought + parts.thought,
                content: nextContent,
                isThinking: !hasVisibleAnswerContent(nextContent),
                backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
              })
            } else {
              const fallbackText = extractContentText(payload)
              if (fallbackText) {
                const parts = splitThinkTaggedDelta(fallbackText, streamThinkState)
                const nextContent = streamingDraft.value.content + parts.content
                patchDraft({
                  thought: streamingDraft.value.thought + parts.thought,
                  content: nextContent,
                  isThinking: !hasVisibleAnswerContent(nextContent),
                  backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
                })
              }
            }
          } else if (event.event === 'message_replace') {
            const payload = normalizeStreamPayload(event.data)
            updateStreamMeta(payload)
            const backendMessageId = extractBackendMessageId(payload)
            const content = extractContentText(payload)
            streamThinkState.thinkDepth = 0
            streamThinkState.carry = ''
            const parts = splitThinkTaggedText(content)
            const nextContent = toDisplayText(parts.content) || ''
            patchDraft({
              content: nextContent,
              thought: mergeThoughtText(streamingDraft.value.thought, toDisplayText(parts.thought)),
              isThinking: !hasVisibleAnswerContent(nextContent),
              backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
            })
          } else if (event.event === 'message_end') {
            const payload = normalizeStreamPayload(event.data)
            updateStreamMeta(payload)
            const backendMessageId = extractBackendMessageId(payload)
            const finalText = extractContentText(payload)
            const finalParts = splitThinkTaggedText(finalText)
            const carryParts = flushThinkStreamCarry(streamThinkState)
            const nextThought = mergeThoughtText(
              toDisplayText(finalParts.thought),
              toDisplayText(carryParts.thought)
            )
            const nextContent =
              (toDisplayText(finalParts.content) || '') + (toDisplayText(carryParts.content) || '')
            patchDraft({
              thought: mergeThoughtText(streamingDraft.value.thought, nextThought),
              content: streamingDraft.value.content || nextContent,
              isThinking: false,
              backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
            })
          } else if (event.event === 'tool_call' && enhanced.value) {
            const payload = normalizeStreamPayload(event.data)
            const callId = extractStringByKeys(payload, ['callId', 'call_id'])
            const toolCode = extractStringByKeys(payload, ['toolCode', 'tool_code'])
            if (!callId || !toolCode) return
            const seq = Number(payload.seq)
            const current = streamingDraft.value.toolCalls || []
            const index = current.findIndex((item) => item.callId === callId)
            const nextItem: ToolCallItem = {
              callId,
              seq: Number.isFinite(seq) ? seq : undefined,
              toolCode,
              toolName: extractStringByKeys(payload, ['toolName', 'tool_name']) || toolCode,
              providerType:
                extractStringByKeys(payload, ['providerType', 'provider_type']) || undefined,
              status: 'calling',
              arguments: payload.arguments
            }
            const next = [...current]
            if (index >= 0) next[index] = { ...next[index], ...nextItem }
            else next.push(nextItem)
            patchDraft({ toolCalls: next })
          } else if (event.event === 'tool_result' && enhanced.value) {
            const payload = normalizeStreamPayload(event.data)
            const callId = extractStringByKeys(payload, ['callId', 'call_id'])
            const toolCode = extractStringByKeys(payload, ['toolCode', 'tool_code'])
            if (!callId || !toolCode) return
            const success = payload.success === true || payload.success === 'true'
            const durationMs = Number(payload.durationMs ?? payload.duration_ms)
            const seq = Number(payload.seq)
            const errorRecord = toRecord(payload.error)
            const resultPatch: ToolCallItem = {
              callId,
              seq: Number.isFinite(seq) ? seq : undefined,
              toolCode,
              toolName: extractStringByKeys(payload, ['toolName', 'tool_name']) || toolCode,
              providerType:
                extractStringByKeys(payload, ['providerType', 'provider_type']) || undefined,
              status: success ? 'success' : 'error',
              durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
              sources: normalizeToolSources(payload.sources),
              error: errorRecord
                ? {
                    code: extractStringByKeys(errorRecord, ['code']) || 'TOOL_EXECUTION_ERROR',
                    message: extractStringByKeys(errorRecord, ['message']) || '工具调用失败',
                    retryable: errorRecord.retryable === true
                  }
                : undefined
            }
            const current = streamingDraft.value.toolCalls || []
            const index = current.findIndex((item) => item.callId === callId)
            const next = [...current]
            if (index >= 0) next[index] = { ...next[index], ...resultPatch }
            else next.push(resultPatch)
            patchDraft({ toolCalls: next })
          } else if (event.event === 'error') {
            const payload = normalizeStreamPayload(event.data)
            const errMsg = extractErrorMessage(payload)
            patchDraft({
              content: streamingDraft.value.content || `请求失败：${errMsg}`,
              isThinking: false
            })
          }
        },
        onError: (error) => {
          if (!streamingDraft.value) return
          const errMsg = extractErrorMessage(error)
          if (!streamingDraft.value.content && !streamingDraft.value.thought) {
            patchDraft({ content: `请求失败：${errMsg}`, isThinking: false })
          }
        }
      }
    })
    sendSucceeded = true

    const latestConversationId = chatStore.getCurrentConversationId
    if (!previousConversationId && latestConversationId) {
      const fallbackTitle = summarizeConversationNameFromText(question)
      ensureConversationInList(latestConversationId, fallbackTitle)
      await loadConversations(latestConversationId, false, true)
      if (fallbackTitle) {
        conversations.value = conversations.value.map((item) => {
          if (item.id !== latestConversationId) return item
          if (!isFallbackConversationName(item.name)) return item
          return { ...item, name: fallbackTitle }
        })
      }
    }
  } catch (error: unknown) {
    if (!controller.signal.aborted && streamingDraft.value) {
      const errMsg = extractErrorMessage(error)
      if (!streamingDraft.value.content && !streamingDraft.value.thought) {
        patchDraft({ content: `请求失败：${errMsg}`, isThinking: false })
        ElMessage.error(errMsg)
      }
    }
  } finally {
    // 确保 RAF 执行完最后一帧
    if (draftRafId !== null) {
      cancelAnimationFrame(draftRafId)
      draftRafId = null
    }
    // 同步最后状态的 HTML
    if (streamingDraft.value) {
      draftThoughtHtml.value = renderMarkdown(streamingDraft.value.thought || '')
      draftContentHtml.value = renderMarkdown(streamingDraft.value.content || '')
    }

    // 等一帧，让草稿 DOM 渲染完毕再 commit，避免视觉跳变
    await nextTick()
    if (streamingDraft.value) {
      commitDraft(streamingDraft.value)
      streamingDraft.value = null
      draftThoughtHtml.value = ''
      draftContentHtml.value = ''
    }

    if (streamController.value === controller) streamController.value = null
    if (activeAssistantMessageId.value === assistantMessageId) activeAssistantMessageId.value = null
    chatStore.setGenerating(false)
    showJumpToLatest.value = false
    if (sendSucceeded && attachedFiles.length > 0) chatStore.setUploadedFiles([])
  }
}

// 监听草稿 DOM，挂载 ResizeObserver 实现自动跟底
watch(draftRef, (el) => {
  draftResizeObserver.disconnect()
  if (el) draftResizeObserver.observe(el)
})

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void handleSend()
  }
}

onMounted(async () => {
  chatStore.setChatMode('dify')
  resetChatState()
  if (!(await resolveDefaultSystemAgent()) || !appId.value) {
    if (generalAssistantEntry.value) return
    ElMessage.error('智能体 ID 无效')
    backToApps()
    return
  }
  try {
    currentApp.value = await appApi.detail(appId.value)
  } catch (error) {
    ElMessage.error('智能体不存在或无权访问')
    backToApps()
    return
  }
  if (currentApp.value?.publishStatus !== 'PUBLISHED') {
    ElMessage.warning('该智能体未发布，无法对话')
    backToApps()
    return
  }
  if (isFixedAgent.value) {
    chatStore.setUploadedFiles([])
  }
  chatStore.setCurrentAppId(appId.value)
  await loadCapabilityOptions()
  await loadConversations()
  requestStickBottom('auto')
})

onBeforeUnmount(() => {
  if (streamController.value) {
    streamController.value.abort()
    streamController.value = null
  }
  activeAssistantMessageId.value = null
  showJumpToLatest.value = false
  stopLoading.value = false
  thoughtOpenByMessageId.value = {}
  releaseAudioResources()
  chatStore.setGenerating(false)
  // 清理草稿相关资源
  if (draftRafId !== null) {
    cancelAnimationFrame(draftRafId)
    draftRafId = null
  }
  draftResizeObserver.disconnect()
  streamingDraft.value = null
})

/* ============================================================
 * 布局改造新增(仅 UI 状态,不影响原有业务逻辑)
 * ============================================================ */
const sidebarCollapsed = ref(false)

// 原生 textarea 承载输入(实现灰色轮播占位),行为与原 el-input 一致
const composerFocused = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
function composerAutoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
watch(inputValue, () => nextTick(composerAutoGrow))

const greetingText = computed(() => {
  const h = new Date().getHours()
  return h < 6 ? '凌晨好' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
})

// 灰色轮播引导词:复用原 starterPrompts,不再铺卡片
const ghostIndex = ref(0)
let ghostTimer: ReturnType<typeof setInterval> | null = null
const ghostPlaceholder = computed(() => {
  const list = promptSuggestions.value
  if (!list.length) return '给我发消息…'
  const item = list[ghostIndex.value % list.length]
  return (item?.prompt || item?.title || '给我发消息…') as string
})
onMounted(() => {
  ghostTimer = setInterval(() => {
    const len = promptSuggestions.value.length
    if (len > 1) ghostIndex.value = (ghostIndex.value + 1) % len
  }, 18000)
})
onBeforeUnmount(() => {
  if (ghostTimer) {
    clearInterval(ghostTimer)
    ghostTimer = null
  }
})

// ── 技能 / 工具独立选择面板，支持搜索 / 全选 / 清空 ──
const skillFilter = ref('')
const toolFilter = ref('')
const toolPickerVisible = ref(false)
const skillPickerVisible = ref(false)
type CapabilityPicker = 'tools' | 'skills'
let capabilityPickerCloseTimer: ReturnType<typeof setTimeout> | null = null

function cancelCapabilityPickerClose() {
  if (!capabilityPickerCloseTimer) return
  clearTimeout(capabilityPickerCloseTimer)
  capabilityPickerCloseTimer = null
}

function closeCapabilityPickers() {
  cancelCapabilityPickerClose()
  toolPickerVisible.value = false
  skillPickerVisible.value = false
}

function scheduleCapabilityPickerClose(picker: CapabilityPicker) {
  cancelCapabilityPickerClose()
  capabilityPickerCloseTimer = setTimeout(() => {
    if (picker === 'tools') toolPickerVisible.value = false
    else skillPickerVisible.value = false
    capabilityPickerCloseTimer = null
  }, 120)
}

onBeforeUnmount(cancelCapabilityPickerClose)

// 文件与能力二选一:上传了文件、或开启联网时,能力选择禁用
const capsDisabled = computed(
  () => isFixedAgent.value || uploadedFiles.value.length > 0 || webMode.value
)
watch(capsDisabled, (disabled) => {
  if (disabled) closeCapabilityPickers()
})
const filteredSkills = computed(() => {
  const q = skillFilter.value.trim().toLowerCase()
  const list = capabilitySkillOptions.value
  if (!q) return list
  return list.filter(
    (s) =>
      (s.displayName || '').toLowerCase().includes(q) ||
      (s.skillCode || '').toLowerCase().includes(q)
  )
})
const filteredTools = computed(() => {
  const q = toolFilter.value.trim().toLowerCase()
  const list = capabilityToolOptions.value
  if (!q) return list
  return list.filter(
    (t) =>
      (t.toolName || '').toLowerCase().includes(q) || (t.toolCode || '').toLowerCase().includes(q)
  )
})
const allFilteredSkillsSelected = computed(
  () =>
    filteredSkills.value.length > 0 &&
    filteredSkills.value.every((skill) => selectedSkillCodes.value.includes(skill.skillCode))
)
const allFilteredToolsSelected = computed(
  () =>
    filteredTools.value.length > 0 &&
    filteredTools.value.every((tool) => selectedToolCodes.value.includes(tool.toolCode))
)
const hasFilteredSkillSelection = computed(() =>
  filteredSkills.value.some((skill) => selectedSkillCodes.value.includes(skill.skillCode))
)
const hasFilteredToolSelection = computed(() =>
  filteredTools.value.some((tool) => selectedToolCodes.value.includes(tool.toolCode))
)
function toggleSkillCode(code: string) {
  if (capsDisabled.value) return
  const arr = selectedSkillCodes.value
  selectedSkillCodes.value = arr.includes(code)
    ? arr.filter((item) => item !== code)
    : [...arr, code]
}
function toggleToolCode(code: string) {
  if (capsDisabled.value) return
  const arr = selectedToolCodes.value
  selectedToolCodes.value = arr.includes(code)
    ? arr.filter((item) => item !== code)
    : [...arr, code]
}
function selectAllSkills() {
  if (capsDisabled.value) return
  const selected = new Set(selectedSkillCodes.value)
  filteredSkills.value.forEach((skill) => selected.add(skill.skillCode))
  selectedSkillCodes.value = capabilitySkillOptions.value
    .map((skill) => skill.skillCode)
    .filter((code) => selected.has(code))
}
function clearSkills() {
  if (isFixedAgent.value) return
  selectedSkillCodes.value = []
}
function clearFilteredSkills() {
  if (capsDisabled.value) return
  const visibleCodes = new Set(filteredSkills.value.map((skill) => skill.skillCode))
  selectedSkillCodes.value = selectedSkillCodes.value.filter((code) => !visibleCodes.has(code))
}
function selectAllTools() {
  if (capsDisabled.value) return
  const selected = new Set(selectedToolCodes.value)
  filteredTools.value.forEach((tool) => selected.add(tool.toolCode))
  selectedToolCodes.value = capabilityToolOptions.value
    .map((tool) => tool.toolCode)
    .filter((code) => selected.has(code))
}
function clearTools() {
  if (isFixedAgent.value) return
  selectedToolCodes.value = []
}
function clearFilteredTools() {
  if (capsDisabled.value) return
  const visibleCodes = new Set(filteredTools.value.map((tool) => tool.toolCode))
  selectedToolCodes.value = selectedToolCodes.value.filter((code) => !visibleCodes.has(code))
}

// 文件 / 能力二选一:上传文件时暂存并清空能力,移除所有文件后恢复
let stashedSkills: string[] | null = null
let stashedTools: string[] | null = null
watch(
  () => uploadedFiles.value.length,
  (n, o) => {
    if (n > 0) webMode.value = false
    if (n > 0 && o === 0) {
      stashedSkills = [...selectedSkillCodes.value]
      stashedTools = [...selectedToolCodes.value]
      selectedSkillCodes.value = []
      selectedToolCodes.value = []
    } else if (n === 0 && (o || 0) > 0) {
      if (stashedSkills) selectedSkillCodes.value = stashedSkills
      if (stashedTools) selectedToolCodes.value = stashedTools
      stashedSkills = null
      stashedTools = null
    }
  }
)
</script>

<template>
  <div class="cc-root" :class="{ 'cc-collapsed': sidebarCollapsed }">
    <!-- ============================ 侧边栏 ============================ -->
    <aside class="cc-sidebar">
      <div class="cc-sidebar__top">
        <span class="cc-brand" v-show="!sidebarCollapsed">AI Hub</span>
        <button
          class="cc-iconbtn"
          title="收起 / 展开"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M9 4v16H5.6C4.7 20 4 19.3 4 18.4V5.6C4 4.7 4.7 4 5.6 4H9zm2 0h7.4c.9 0 1.6.7 1.6 1.6v12.8c0 .9-.7 1.6-1.6 1.6H11V4z"
            />
          </svg>
        </button>
      </div>

      <button class="cc-newchat" @click="handleNewConversation">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1z"
          />
        </svg>
        <span v-show="!sidebarCollapsed">开启新对话</span>
      </button>

      <el-scrollbar class="cc-convscroll" v-show="!sidebarCollapsed">
        <div v-if="conversationLoading" class="cc-conv-loading">加载中…</div>
        <template v-else>
          <div class="cc-conv-label" v-if="conversations.length">对话记录</div>
          <div
            v-for="conversation in conversations"
            :key="conversation.id"
            class="cc-conv"
            :class="{ 'is-active': conversation.id === currentConversationId }"
            @click="handleSelectConversation(conversation.id)"
          >
            <span class="cc-conv__name">{{ conversation.name }}</span>
            <div class="cc-conv__act" @click.stop>
              <el-popconfirm
                title="确认删除该会话？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="handleDeleteConversation(conversation.id)"
              >
                <template #reference>
                  <button
                    class="cc-conv__del"
                    :class="{ loading: deletingConversationId === conversation.id }"
                    title="删除"
                    @click.stop
                  >
                    <el-icon><Delete /></el-icon>
                  </button>
                </template>
              </el-popconfirm>
            </div>
          </div>
          <div v-if="conversations.length === 0" class="cc-conv-empty">暂无历史对话</div>
        </template>
      </el-scrollbar>

      <div v-show="!sidebarCollapsed && !generalAssistantEntry" class="cc-sidebar__foot">
        <div class="cc-sidebar-agent">
          <div class="cc-sidebar-agent__avatar">
            <img
              v-if="resolveAppAvatar(currentApp)"
              :src="resolveAppAvatar(currentApp)"
              class="cc-sidebar-agent__avatar-img"
              alt="智能体头像"
            />
            <span v-else class="cc-sidebar-agent__avatar-fallback">
              {{ resolveAppAvatarText(currentApp) }}
            </span>
          </div>
          <span class="cc-sidebar-agent__name">{{ currentApp?.appName || '智能体聊天' }}</span>
        </div>
      </div>
    </aside>

    <!-- ============================ 主区域 ============================ -->
    <main class="cc-main">
      <header class="cc-topbar">
        <button
          class="cc-iconbtn cc-topbar__menu"
          title="菜单"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
          </svg>
        </button>

        <button class="cc-back" title="返回" @click="backToApps">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="cc-topbar__spacer"></div>
      </header>

      <div class="cc-stage" :class="{ 'is-welcome': showWelcome }">
        <!-- 空状态:居中问候 + 输入框 -->
        <div v-if="showWelcome" class="cc-hero">
          <h1 class="cc-hero__title"
            >{{ greetingText }}，<span class="cc-hero__accent">{{
              displayName || '朋友'
            }}</span></h1
          >
          <p class="cc-hero__sub">有什么可以帮你的？</p>
        </div>

        <div v-else class="message-panel">
          <el-scrollbar
            ref="messageScrollbarRef"
            class="message-scroll"
            @scroll="handleMessageScroll"
          >
            <div ref="messageListRef" class="message-scroll-inner">
              <!-- 欢迎屏 -->
              <div v-if="messageLoading" class="state-tip">正在加载消息...</div>

              <template v-else>
                <div class="message-list">
                  <!-- 历史消息：过滤掉流式占位（isThinking:true 且 content/thought 均为空） -->
                  <template v-for="message in messages" :key="message.id">
                    <div
                      v-if="
                        !(
                          message.role === 'assistant' &&
                          message.isThinking &&
                          !message.content &&
                          !message.thought &&
                          !message.toolCalls?.length
                        )
                      "
                      class="msg-row"
                      :class="`role-${message.role}`"
                      :data-message-id="message.id"
                    >
                      <!-- Avatar -->
                      <div
                        class="msg-avatar"
                        :class="message.role === 'user' ? 'avatar-user' : 'avatar-ai'"
                      >
                        <template v-if="message.role === 'user'">
                          {{ displayName ? displayName.charAt(0).toUpperCase() : 'U' }}
                        </template>
                        <template v-else>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
                            <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.4" />
                          </svg>
                        </template>
                      </div>

                      <div class="msg-body">
                        <div class="msg-meta">
                          <span class="msg-role">{{ roleLabel(message.role) }}</span>
                          <span class="msg-time">{{ formatTime(message.createdAt) }}</span>
                        </div>

                        <div class="msg-bubble" :class="{ 'bubble-user': message.role === 'user' }">
                          <!-- AI 消息（历史） -->
                          <template v-if="message.role === 'assistant'">
                            <details
                              v-if="message.thought || message.isThinking"
                              class="thought-panel"
                              :open="isThoughtPanelOpen(message)"
                              @toggle="handleThoughtToggle(message, $event)"
                            >
                              <summary class="thought-summary">
                                <span
                                  class="thinking-icon"
                                  :class="{ spinning: message.isThinking }"
                                >
                                  <svg viewBox="0 0 48 48">
                                    <circle class="ring ring-1" cx="24" cy="24" r="16" />
                                    <circle class="ring ring-2" cx="24" cy="24" r="16" />
                                    <circle class="ring ring-3" cx="24" cy="24" r="16" />
                                    <circle class="ring ring-4" cx="24" cy="24" r="16" />
                                    <path
                                      class="star-core"
                                      d="M24 13L27.4 20.6L35 24L27.4 27.4L24 35L20.6 27.4L13 24L20.6 20.6Z"
                                    />
                                  </svg>
                                </span>
                                <span>{{ message.isThinking ? '思考中...' : '查看思考过程' }}</span>
                              </summary>
                              <div
                                class="thought-body"
                                v-html="renderMarkdown(message.thought || '')"
                              ></div>
                            </details>

                            <ToolCallChain
                              v-if="enhanced && message.toolCalls?.length"
                              :items="message.toolCalls"
                            />

                            <div
                              v-if="message.content"
                              class="ai-content"
                              v-html="renderMarkdown(message.content)"
                            ></div>

                            <div
                              v-if="message.backendMessageId && !message.isThinking"
                              class="msg-actions"
                            >
                              <div class="feedback-row">
                                <button
                                  class="feedback-btn"
                                  :class="{ active: getFeedbackValue(message) === 'like' }"
                                  @click="handleFeedback(message, 'like')"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                  >
                                    <path
                                      d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
                                    />
                                  </svg>
                                  <span>有帮助</span>
                                </button>
                                <button
                                  class="feedback-btn"
                                  :class="{
                                    active: getFeedbackValue(message) === 'dislike',
                                    dislike: true
                                  }"
                                  @click="handleFeedback(message, 'dislike')"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                  >
                                    <path
                                      d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"
                                    />
                                  </svg>
                                  <span>没帮助</span>
                                </button>
                                <button
                                  v-if="message.content"
                                  class="copy-reply-btn"
                                  title="复制回复"
                                  aria-label="复制回复"
                                  @click="handleCopyMessage(message)"
                                >
                                  <el-icon><CopyDocument /></el-icon>
                                </button>
                              </div>
                              <div
                                v-if="getSuggestedQuestions(message).length > 0"
                                class="suggested-list"
                              >
                                <button
                                  v-for="q in getSuggestedQuestions(message)"
                                  :key="`${message.id}-${q}`"
                                  class="suggested-chip"
                                  @click="handlePickSuggestedQuestion(q)"
                                  >{{ q }}</button
                                >
                              </div>
                            </div>
                          </template>

                          <!-- 用户消息 -->
                          <template v-else>
                            <div v-if="message.fileReferences?.length" class="file-ref-list">
                              <div
                                v-for="fileRef in message.fileReferences"
                                :key="fileRef.id"
                                class="file-ref-chip"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                >
                                  <path
                                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                                  />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span
                                  >{{ fileRef.name
                                  }}{{ fileRef.extension ? `.${fileRef.extension}` : '' }}</span
                                >
                              </div>
                            </div>
                            <div class="user-text">{{ message.content }}</div>
                          </template>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- ══ 流式草稿气泡（完全独立，不在 v-for 内，不受 store 更新影响） ══ -->
                  <div v-if="streamingDraft" ref="draftRef" class="msg-row role-assistant">
                    <div class="msg-avatar avatar-ai">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
                        <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.4" />
                      </svg>
                    </div>
                    <div class="msg-body">
                      <div class="msg-meta">
                        <span class="msg-role">AI</span>
                      </div>
                      <div class="msg-bubble">
                        <!-- 思维链 -->
                        <details
                          v-if="streamingDraft.thought || streamingDraft.isThinking"
                          class="thought-panel"
                          :open="streamingDraft.thoughtOpen"
                          @toggle="handleDraftThoughtToggle"
                        >
                          <summary class="thought-summary">
                            <span
                              class="thinking-icon"
                              :class="{ spinning: streamingDraft.isThinking }"
                            >
                              <svg viewBox="0 0 48 48">
                                <circle class="ring ring-1" cx="24" cy="24" r="16" />
                                <circle class="ring ring-2" cx="24" cy="24" r="16" />
                                <circle class="ring ring-3" cx="24" cy="24" r="16" />
                                <circle class="ring ring-4" cx="24" cy="24" r="16" />
                                <path
                                  class="star-core"
                                  d="M24 13L27.4 20.6L35 24L27.4 27.4L24 35L20.6 27.4L13 24L20.6 20.6Z"
                                />
                              </svg>
                            </span>
                            <span>{{
                              streamingDraft.isThinking ? '思考中...' : '查看思考过程'
                            }}</span>
                          </summary>
                          <div class="thought-body" v-html="draftThoughtHtml"></div>
                        </details>

                        <ToolCallChain
                          v-if="enhanced && streamingDraft.toolCalls?.length"
                          :items="streamingDraft.toolCalls"
                        />

                        <!-- 正文（思维链结束前不显示，避免空块闪烁） -->
                        <div
                          v-if="hasVisibleAnswerContent(streamingDraft.content)"
                          class="ai-content"
                          v-html="draftContentHtml"
                        ></div>

                        <!-- 纯等待状态（还没有任何内容） -->
                        <div
                          v-if="!hasVisibleAnswerContent(streamingDraft.content) && isGenerating"
                          class="draft-waiting"
                        >
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </el-scrollbar>
          <button
            v-if="showJumpToLatest"
            type="button"
            class="jump-latest-btn"
            title="跳转到最新输出"
            aria-label="跳转到最新输出"
            @click="handleJumpToLatest"
          >
            <el-icon><ArrowDown /></el-icon>
          </button>
        </div>

        <!-- ═══ 输入区（一体化，集成 上传 / 技能 / 工具 / 联网 / 语音） ═══ -->
        <div class="cc-io">
          <input
            ref="fileInputRef"
            class="cc-hidden"
            type="file"
            multiple
            accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.mp3,.wav,.m4a,.mp4"
            @change="handleFileInputChange"
          />

          <div class="cx" :class="{ 'is-focused': composerFocused }">
            <!-- 顶部：附件 / 工具 / 技能状态（联网仅在工具栏显示） -->
            <div class="cx__pills">
              <template v-if="uploadedFiles.length">
                <span
                  v-for="file in uploadedFiles"
                  :key="file.fileId"
                  class="cx-pill cx-pill--file"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13">
                    <path
                      fill="currentColor"
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                    />
                  </svg>
                  <span class="cx-pill__name">{{ file.fileName }}</span>
                  <i class="cx-pill__x" title="移除" @click="removeUploadedFile(file.fileId)">×</i>
                </span>
              </template>

              <template v-else-if="enhanced && !webMode">
                <span
                  v-if="selectedToolCodes.length || (isFixedAgent && fixedMcpToolCount)"
                  class="cx-pill cx-pill--cap"
                  :class="{ 'is-readonly': isFixedAgent }"
                  :title="isFixedAgent ? '由 Agent 发布配置固定' : '点击清空工具'"
                  @click="clearTools"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13">
                    <path
                      fill="currentColor"
                      d="M21.7 6.3a1 1 0 0 0-1.6-.3l-2.5 2.5-2.1-2.1 2.5-2.5a1 1 0 0 0-.4-1.6 5 5 0 0 0-6.2 6.6l-8 8a1.5 1.5 0 0 0 2.2 2.2l8-8a5 5 0 0 0 6.6-6.2z"
                    />
                  </svg>
                  {{
                    isFixedAgent ? `工具 ${fixedMcpToolCount}` : `工具 ${selectedToolCodes.length}`
                  }}<i v-if="!isFixedAgent" class="cx-pill__x">×</i>
                </span>
                <span
                  v-if="selectedSkillCodes.length"
                  class="cx-pill cx-pill--cap"
                  :class="{ 'is-readonly': isFixedAgent }"
                  :title="isFixedAgent ? '由 Agent 发布配置固定' : '点击清空技能'"
                  @click="clearSkills"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13">
                    <path
                      fill="currentColor"
                      d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"
                    />
                  </svg>
                  技能 {{ selectedSkillCodes.length
                  }}<i v-if="!isFixedAgent" class="cx-pill__x">×</i>
                </span>
                <span
                  v-if="
                    isFixedAgent &&
                    !selectedToolCodes.length &&
                    !selectedSkillCodes.length &&
                    !fixedMcpToolCount
                  "
                  class="cx-pill cx-pill--cap is-readonly"
                  title="该 Agent 未配置 Skill 或 MCP 工具"
                >
                  纯模型模式
                </span>
              </template>
            </div>

            <!-- 文本域 + 灰色轮播引导词 -->
            <div class="cx__field">
              <textarea
                ref="textareaRef"
                v-model="inputValue"
                class="cx__ta"
                rows="3"
                @focus="composerFocused = true"
                @blur="composerFocused = false"
                @input="composerAutoGrow"
                @keydown="handleInputKeydown"
              ></textarea>
              <span v-if="!inputValue && !composerFocused" class="cx__ghost">{{
                ghostPlaceholder
              }}</span>
            </div>

            <!-- 工具条 -->
            <div class="cx__bar">
              <div class="cx__left">
                <!-- 上传文件 -->
                <button
                  type="button"
                  class="cx-btn cx-btn--pill cx-btn--direct"
                  :class="{ 'is-active': uploadedFiles.length > 0 }"
                  :disabled="uploadLoading || isFixedAgent"
                  :title="isFixedAgent ? 'Agent 智能体暂不支持文件上传' : '上传文件'"
                  @click="triggerFileSelect"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17">
                    <path
                      fill="currentColor"
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 2 4 4h-4V4zM8 13h8v2H8zm0 4h8v2H8z"
                    />
                  </svg>
                  <span class="cx-btn__txt">上传文件</span>
                </button>

                <!-- 工具选择 -->
                <el-popover
                  v-if="enhanced && !isFixedAgent"
                  v-model:visible="toolPickerVisible"
                  placement="top-start"
                  :width="260"
                  :offset="10"
                  trigger="click"
                  popper-class="cx-pop"
                  :show-arrow="false"
                  :disabled="capsDisabled"
                >
                  <template #reference>
                    <button
                      type="button"
                      class="cx-btn cx-btn--pill cx-btn--direct"
                      :class="{ 'is-soft-on': selectedToolCodes.length > 0 && !capsDisabled }"
                      :disabled="capsDisabled"
                      :title="
                        webMode
                          ? '联网模式下工具不可用'
                          : uploadedFiles.length
                            ? '已上传文件，工具与文件二选一'
                            : '选择工具'
                      "
                      @mouseenter="cancelCapabilityPickerClose"
                      @mouseleave="scheduleCapabilityPickerClose('tools')"
                    >
                      <svg viewBox="0 0 24 24" width="17" height="17">
                        <path
                          fill="currentColor"
                          d="M21.7 6.3a1 1 0 0 0-1.6-.3l-2.5 2.5-2.1-2.1 2.5-2.5a1 1 0 0 0-.4-1.6 5 5 0 0 0-6.2 6.6l-8 8a1.5 1.5 0 0 0 2.2 2.2l8-8a5 5 0 0 0 6.6-6.2z"
                        />
                      </svg>
                      <span class="cx-btn__txt">工具</span>
                      <span v-if="selectedToolCodes.length" class="cx-btn__count">
                        {{ selectedToolCodes.length }}
                      </span>
                    </button>
                  </template>

                  <div
                    class="cx-cap-picker"
                    v-loading="capabilityLoading"
                    @mouseenter="cancelCapabilityPickerClose"
                    @mouseleave="scheduleCapabilityPickerClose('tools')"
                    @mousedown.stop
                    @click.stop
                  >
                    <div class="cx-flyout__head">
                      <input
                        v-model="toolFilter"
                        class="cx-flyout__search"
                        placeholder="搜索工具…"
                        @click.stop
                        @keydown.stop
                      />
                      <div class="cx-flyout__actions">
                        <span class="cx-flyout__selected">
                          已选 {{ selectedToolCodes.length }}/{{ capabilityToolOptions.length }}
                        </span>
                        <div class="cx-flyout__quick">
                          <button
                            type="button"
                            :disabled="!filteredTools.length || allFilteredToolsSelected"
                            @mousedown.prevent.stop
                            @click.stop="selectAllTools"
                          >
                            {{ toolFilter.trim() ? '全选结果' : '全选' }}
                          </button>
                          <button
                            type="button"
                            :disabled="!hasFilteredToolSelection"
                            @mousedown.prevent.stop
                            @click.stop="clearFilteredTools"
                          >
                            {{ toolFilter.trim() ? '清空结果' : '清空' }}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="cx-flyout__list">
                      <button
                        v-for="tool in filteredTools"
                        :key="tool.toolCode"
                        type="button"
                        class="cx-opt"
                        :class="{ 'is-on': selectedToolCodes.includes(tool.toolCode) }"
                        @click.stop="toggleToolCode(tool.toolCode)"
                      >
                        <span class="cx-opt__box">
                          <svg
                            v-if="selectedToolCodes.includes(tool.toolCode)"
                            viewBox="0 0 24 24"
                            width="13"
                            height="13"
                          >
                            <path
                              fill="currentColor"
                              d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                            />
                          </svg>
                        </span>
                        <span class="cx-opt__txt">{{ tool.toolName }}</span>
                      </button>
                      <div v-if="!filteredTools.length" class="cx-flyout__empty">无匹配工具</div>
                    </div>
                  </div>
                </el-popover>

                <!-- 技能选择 -->
                <el-popover
                  v-if="enhanced && !isFixedAgent"
                  v-model:visible="skillPickerVisible"
                  placement="top-start"
                  :width="260"
                  :offset="10"
                  trigger="click"
                  popper-class="cx-pop"
                  :show-arrow="false"
                  :disabled="capsDisabled"
                >
                  <template #reference>
                    <button
                      type="button"
                      class="cx-btn cx-btn--pill cx-btn--direct"
                      :class="{ 'is-soft-on': selectedSkillCodes.length > 0 && !capsDisabled }"
                      :disabled="capsDisabled"
                      :title="
                        webMode
                          ? '联网模式下技能不可用'
                          : uploadedFiles.length
                            ? '已上传文件，技能与文件二选一'
                            : '选择技能'
                      "
                      @mouseenter="cancelCapabilityPickerClose"
                      @mouseleave="scheduleCapabilityPickerClose('skills')"
                    >
                      <svg viewBox="0 0 24 24" width="17" height="17">
                        <path
                          fill="currentColor"
                          d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"
                        />
                      </svg>
                      <span class="cx-btn__txt">技能</span>
                      <span v-if="selectedSkillCodes.length" class="cx-btn__count">
                        {{ selectedSkillCodes.length }}
                      </span>
                    </button>
                  </template>

                  <div
                    class="cx-cap-picker"
                    v-loading="capabilityLoading"
                    @mouseenter="cancelCapabilityPickerClose"
                    @mouseleave="scheduleCapabilityPickerClose('skills')"
                    @mousedown.stop
                    @click.stop
                  >
                    <div class="cx-flyout__head">
                      <input
                        v-model="skillFilter"
                        class="cx-flyout__search"
                        placeholder="搜索技能…"
                        @click.stop
                        @keydown.stop
                      />
                      <div class="cx-flyout__actions">
                        <span class="cx-flyout__selected">
                          已选 {{ selectedSkillCodes.length }}/{{ capabilitySkillOptions.length }}
                        </span>
                        <div class="cx-flyout__quick">
                          <button
                            type="button"
                            :disabled="!filteredSkills.length || allFilteredSkillsSelected"
                            @mousedown.prevent.stop
                            @click.stop="selectAllSkills"
                          >
                            {{ skillFilter.trim() ? '全选结果' : '全选' }}
                          </button>
                          <button
                            type="button"
                            :disabled="!hasFilteredSkillSelection"
                            @mousedown.prevent.stop
                            @click.stop="clearFilteredSkills"
                          >
                            {{ skillFilter.trim() ? '清空结果' : '清空' }}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="cx-flyout__list">
                      <button
                        v-for="skill in filteredSkills"
                        :key="skill.skillCode"
                        type="button"
                        class="cx-opt"
                        :class="{ 'is-on': selectedSkillCodes.includes(skill.skillCode) }"
                        @click.stop="toggleSkillCode(skill.skillCode)"
                      >
                        <span class="cx-opt__box">
                          <svg
                            v-if="selectedSkillCodes.includes(skill.skillCode)"
                            viewBox="0 0 24 24"
                            width="13"
                            height="13"
                          >
                            <path
                              fill="currentColor"
                              d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                            />
                          </svg>
                        </span>
                        <span class="cx-opt__txt">{{ skill.displayName }}</span>
                      </button>
                      <div v-if="!filteredSkills.length" class="cx-flyout__empty">无匹配技能</div>
                    </div>
                  </div>
                </el-popover>

                <!-- 联网开关 -->
                <button
                  v-if="enhanced && (webAvailable || (isFixedAgent && webMode))"
                  class="cx-btn cx-btn--pill"
                  :class="{ 'is-soft-on': webMode }"
                  :disabled="isFixedAgent || uploadedFiles.length > 0"
                  :title="
                    isFixedAgent
                      ? '联网状态由 Agent 发布配置固定'
                      : uploadedFiles.length
                        ? '已上传文件，联网功能不可用'
                        : '联网搜索'
                  "
                  @click="!isFixedAgent && (webMode = !webMode)"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17">
                    <path
                      fill="currentColor"
                      d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3.1a15 15 0 0 0-1-4.6A8 8 0 0 1 18.9 11zM12 4c.8 1 1.5 2.7 1.8 5H10.2C10.5 6.7 11.2 5 12 4zM4.6 13H7.7c.1 1.7.5 3.3 1 4.6A8 8 0 0 1 4.6 13zm0-2A8 8 0 0 1 9.7 6.4a15 15 0 0 0-1 4.6H4.6zm5.6 2h3.6c-.3 2.3-1 4-1.8 5-.8-1-1.5-2.7-1.8-5zm5 4.6c.5-1.3.9-2.9 1-4.6h3.1a8 8 0 0 1-4.1 4.6z"
                    />
                  </svg>
                  <span class="cx-btn__txt">联网</span>
                </button>

                <!-- 语音 -->
                <button
                  v-if="canUseVoice"
                  class="cx-btn cx-btn--round"
                  :class="{ recording: isRecording, loading: audioRecognizing }"
                  :title="isRecording ? '松开结束' : '按住说话'"
                  @mousedown.prevent="startVoiceInput"
                  @mouseup.prevent="stopVoiceInput"
                  @mouseleave.prevent="stopVoiceInput"
                  @touchstart.prevent="startVoiceInput"
                  @touchend.prevent="stopVoiceInput"
                >
                  <el-icon><Microphone /></el-icon>
                </button>
                <span v-if="isRecording" class="cx-rec">录音中，松开结束</span>
                <span v-else-if="audioRecognizing" class="cx-rec">识别中…</span>
              </div>

              <div class="cx__right">
                <button
                  v-if="isGenerating"
                  class="cx-send cx-send--stop"
                  :disabled="!canStop"
                  title="停止生成"
                  @click="handleStopGeneration"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                  </svg>
                </button>
                <button
                  v-else
                  class="cx-send"
                  :disabled="!canSend"
                  title="发送"
                  @click="handleSend"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 4l7 7-1.4 1.4L13 7.8V20h-2V7.8L6.4 12.4 5 11z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="cc-disclaimer">内容由 AI 生成，请核对重要信息。</div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════
   Welcome Screen
═══════════════════════════════ */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes iconFloat {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

/* ═══════════════════════════════
   Thought Panel
═══════════════════════════════ */
@keyframes orbit {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.85;
    transform: scale(0.82);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes pulse-red {
  0%,
  100% {
    box-shadow: none;
  }

  50% {
    box-shadow: 0 0 0 4px rgb(239 68 68 / 15%);
  }
}

/* 草稿等待动画（三个点） */
@keyframes dot-bounce {
  0%,
  80%,
  100% {
    opacity: 0.4;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-5px);
  }
}

@media (width <= 600px) {
  .prompt-grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 680px) {
  .input-hint {
    display: none;
  }
}

.chat-page {
  --sky: #0ea5e9;
  --sky-dark: #0284c7;
  --sky-light: #e0f2fe;
  --sky-pale: #f0f9ff;
  --slate-900: #0f172a;
  --slate-700: #334155;
  --slate-500: #64748b;
  --slate-400: #94a3b8;
  --slate-200: #e2e8f0;
  --slate-100: #f1f5f9;
  --slate-50: #f8fafc;
  --white: #fff;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 3px rgb(15 23 42 / 6%);
  --shadow-md: 0 4px 12px rgb(15 23 42 / 8%);

  display: flex;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  background: var(--slate-100);
  flex-direction: column;
}

/* ═══════════════════════════════
   Header
═══════════════════════════════ */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 20px;
  background: var(--white);
  border-bottom: 1px solid var(--slate-200);
  flex-shrink: 0;
  gap: 16px;
}

.header-left,
.header-right {
  min-width: 120px;
}

.header-right {
  display: flex;
  justify-content: flex-end;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px !important;
  font-size: 13px;
  font-weight: 500;
  color: var(--slate-500) !important;
  border-radius: var(--radius-md) !important;
  transition: all 0.18s;
}

.back-btn:hover {
  color: var(--sky) !important;
  background: var(--sky-pale) !important;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.app-avatar-wrap {
  flex-shrink: 0;
}

.app-avatar-img,
.app-avatar-fallback {
  width: 42px;
  height: 42px;
  border-radius: 12px;
}

.app-avatar-img {
  object-fit: cover;
}

.app-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--white);
  background: linear-gradient(135deg, var(--sky-dark), var(--sky));
}

.app-info {
  min-width: 0;
  text-align: center;
}

.app-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  color: var(--slate-900);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-desc {
  max-width: 360px;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  color: var(--slate-400);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ═══════════════════════════════
   Body
═══════════════════════════════ */
.chat-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ═══════════════════════════════
   Sidebar
═══════════════════════════════ */
.chat-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  background: var(--white);
  border-right: 1px solid var(--slate-200);
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--slate-200);
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--slate-400);
  text-transform: uppercase;
}

.new-chat-btn {
  display: inline-flex;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--sky);
  cursor: pointer;
  background: var(--sky-pale);
  border: 1px solid rgb(14 165 233 / 20%);
  border-radius: var(--radius-md);
  transition: all 0.18s;
  align-items: center;
  gap: 4px;
}

.new-chat-btn:hover {
  background: var(--sky-light);
  border-color: rgb(14 165 233 / 40%);
}

.sidebar-scroll {
  flex: 1;
  padding: 8px;
}

.sidebar-loading,
.sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  font-size: 13px;
  color: var(--slate-400);
}

.sidebar-empty svg {
  width: 32px;
  height: 32px;
  opacity: 0.4;
}

/* 会话条目 */
.conv-item {
  display: flex;
  padding: 10px 10px 10px 12px;
  margin-bottom: 2px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  transition: background 0.15s;
  align-items: center;
  gap: 8px;
}

.conv-item:hover {
  background: var(--slate-100);
}

.conv-item.active {
  background: var(--sky-pale);
  border-color: rgb(14 165 233 / 20%);
}

.conv-item-body {
  flex: 1;
  min-width: 0;
}

.conv-item-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--slate-700);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-item.active .conv-item-name {
  color: var(--sky-dark);
}

.conv-item-time {
  margin-top: 2px;
  font-size: 11px;
  color: var(--slate-400);
}

.conv-item-actions {
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.conv-item:hover .conv-item-actions,
.conv-item.active .conv-item-actions {
  opacity: 1;
}

.conv-delete-btn {
  display: flex;
  width: 26px;
  height: 26px;
  font-size: 14px;
  color: var(--slate-400);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: all 0.15s;
  align-items: center;
  justify-content: center;
}

.conv-delete-btn:hover {
  color: #ef4444;
  background: #fee2e2;
}

/* ═══════════════════════════════
   Chat Main
═══════════════════════════════ */
.chat-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--slate-50);
}

.chat-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 24px;
  background: var(--white);
  border-bottom: 1px solid var(--slate-200);
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.topbar-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  color: var(--slate-700);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-badge {
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--sky);
  white-space: nowrap;
  background: var(--sky-pale);
  border: 1px solid rgb(14 165 233 / 25%);
  border-radius: 4px;
}

/* ═══════════════════════════════
   Message Panel
═══════════════════════════════ */
.message-panel {
  position: relative;
  flex: 1;
  min-height: 0;
}

.message-scroll {
  width: 100%;
  height: 100%;
}

.jump-latest-btn {
  position: absolute;
  right: 28px;
  bottom: 18px;
  z-index: 10;
  display: inline-flex;
  width: 38px;
  height: 38px;
  padding: 0;
  color: var(--sky-dark);
  cursor: pointer;
  background: var(--white);
  border: 1px solid rgb(14 165 233 / 24%);
  border-radius: 999px;
  box-shadow:
    0 10px 24px rgb(15 23 42 / 12%),
    0 0 0 6px rgb(14 165 233 / 8%);
  align-items: center;
  justify-content: center;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease;
}

.jump-latest-btn:hover {
  color: var(--sky);
  transform: translateY(-2px);
  box-shadow:
    0 14px 30px rgb(15 23 42 / 16%),
    0 0 0 8px rgb(14 165 233 / 12%);
}

.jump-latest-btn :deep(.el-icon) {
  font-size: 18px;
}

.message-scroll-inner {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.welcome-screen {
  position: relative;
  display: flex;
  padding: 48px 24px;
  overflow: hidden;
  flex: 1;
  align-items: center;
  justify-content: center;
}

.welcome-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 600px;
  height: 400px;
  pointer-events: none;
  background: radial-gradient(ellipse, rgb(14 165 233 / 7%) 0%, transparent 70%);
  transform: translate(-50%, -50%);
}

.welcome-body {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 680px;
  text-align: center;
  animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.welcome-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 20px;
  animation: iconFloat 4s ease-in-out infinite;
}

.welcome-icon svg {
  width: 52px;
  height: 52px;
  filter: drop-shadow(0 0 10px rgb(14 165 233 / 40%));
}

.welcome-title {
  margin-bottom: 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--slate-900);
}

.welcome-accent {
  background: linear-gradient(135deg, var(--sky-dark), #22d3ee);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-sub {
  margin-bottom: 32px;
  font-size: 14px;
  color: var(--slate-400);
}

/* Prompt 卡片 */
.prompt-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  text-align: left;
}

.prompt-card {
  display: flex;
  padding: 14px;
  cursor: pointer;
  background: var(--white);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  opacity: 0;
  animation: cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--delay)) forwards;
  transition: all 0.2s ease;
  align-items: center;
  gap: 12px;
}

.prompt-card:hover {
  border-color: var(--sky);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgb(14 165 233 / 10%);
}

.prompt-icon {
  display: flex;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.prompt-icon svg {
  width: 16px;
  height: 16px;
}

.icon-spark {
  color: var(--sky);
  background: var(--sky-pale);
}

.icon-code {
  color: #0891b2;
  background: #ecfeff;
}

.icon-doc {
  color: #059669;
  background: #ecfdf5;
}

.icon-idea {
  color: #d97706;
  background: #fffbeb;
}

.prompt-text {
  flex: 1;
  min-width: 0;
}

.prompt-title {
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--slate-700);
}

.prompt-desc {
  overflow: hidden;
  font-size: 12px;
  color: var(--slate-400);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-chevron {
  width: 14px;
  height: 14px;
  color: var(--slate-200);
  flex-shrink: 0;
  transition: all 0.2s;
}

.prompt-card:hover .prompt-chevron {
  color: var(--sky);
  transform: translateX(2px);
}

/* ═══════════════════════════════
   Message List
═══════════════════════════════ */
.state-tip {
  padding: 32px;
  font-size: 13px;
  color: var(--slate-400);
  text-align: center;
}

.message-list {
  display: flex;
  width: 100%;
  max-width: 880px;
  padding: 24px 24px 16px;
  margin: 0 auto;
  flex-direction: column;
  gap: 24px;
}

/* ── 消息行 ── */
.msg-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.msg-row.role-user {
  flex-direction: row-reverse;
}

.msg-body {
  max-width: 78%;
  min-width: 0;
  flex: 1;
}

.role-user .msg-body {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

/* ── Avatar ── */
.msg-avatar {
  display: flex;
  width: 32px;
  height: 32px;
  margin-top: 24px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 9px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-ai {
  color: #38bdf8;
  background: #0f172a;
  border: 1px solid rgb(56 189 248 / 20%);
}

.avatar-ai svg {
  width: 16px;
  height: 16px;
  filter: drop-shadow(0 0 3px rgb(56 189 248 / 40%));
}

.avatar-user {
  color: var(--white);
  background: linear-gradient(135deg, var(--sky-dark), var(--sky));
  box-shadow: 0 2px 8px rgb(14 165 233 / 30%);
}

/* ── Meta ── */
.msg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--slate-400);
}

.role-user .msg-meta {
  justify-content: flex-end;
}

.msg-role {
  font-weight: 600;
  color: var(--slate-500);
}

/* ── Bubble ── */
.msg-bubble {
  padding: 13px 16px;
  font-size: 14px;
  line-height: 1.7;
  background: var(--white);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  border-top-left-radius: 4px;
  box-shadow: var(--shadow-sm);
}

.bubble-user {
  color: var(--white);
  background: linear-gradient(135deg, var(--sky-dark), var(--sky));
  border-color: transparent;
  border-top-right-radius: 4px;
  border-top-left-radius: var(--radius-lg);
  box-shadow: 0 3px 12px rgb(14 165 233 / 25%);
}

.user-text {
  word-break: break-word;
  white-space: pre-wrap;
}

/* 文件引用 */
.file-ref-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.file-ref-chip {
  display: inline-flex;
  max-width: 200px;
  padding: 3px 9px;
  font-size: 12px;
  color: rgb(255 255 255 / 90%);
  background: rgb(255 255 255 / 15%);
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 999px;
  align-items: center;
  gap: 5px;
}

.file-ref-chip svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.file-ref-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thought-panel {
  margin-bottom: 10px;
  overflow: hidden;
  background: var(--sky-pale);
  border: 1px solid rgb(14 165 233 / 15%);
  border-radius: var(--radius-md);
}

.thought-summary {
  display: flex;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--sky-dark);
  list-style: none;
  cursor: pointer;
  user-select: none;
  align-items: center;
  gap: 8px;
}

.thought-summary::-webkit-details-marker {
  display: none;
}

.thinking-icon {
  display: flex;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.thinking-icon svg {
  width: 18px;
  height: 18px;
  animation: orbit 6s linear infinite;
}

.thinking-icon.spinning svg {
  animation-duration: 1.8s;
}

.ring {
  fill: none;
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-dasharray: 18 84;
  transform-origin: 24px 24px;
}

.ring-1 {
  stroke: #0ea5e9;
  transform: rotate(0deg);
}

.ring-2 {
  stroke: #22d3ee;
  transform: rotate(90deg);
}

.ring-3 {
  stroke: #38bdf8;
  transform: rotate(180deg);
}

.ring-4 {
  stroke: #67e8f9;
  transform: rotate(270deg);
}

.star-core {
  fill: var(--white);
  filter: drop-shadow(0 0 3px rgb(14 165 233 / 50%));
  animation: breathe 1.4s ease-in-out infinite;
  transform-origin: 24px 24px;
}

.thought-body {
  padding: 10px 18px 12px 24px;
  margin: 0 10px 10px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--slate-500);
  word-break: break-word;
  background: var(--white);
  border-left: 2px solid var(--sky);
  border-radius: 6px;
  overflow-wrap: anywhere;
}

.thought-body :deep(ul),
.thought-body :deep(ol) {
  padding-left: 22px;
  margin: 8px 0;
}

/* ── AI 内容 ── */
.ai-content {
  font-size: 14px;
  line-height: 1.75;
  color: var(--slate-700);
  word-break: break-word;
  transition:
    opacity 0.25s,
    transform 0.25s;
  overflow-wrap: anywhere;
}

.ai-content.fading {
  opacity: 0.6;
  transform: translateY(2px);
}

.ai-content :deep(p) {
  margin: 0;
}

.ai-content :deep(p + p) {
  margin-top: 10px;
}

.ai-content :deep(pre) {
  margin: 10px 0;
  overflow: auto;
  border-radius: var(--radius-md);
}

.ai-content :deep(.hljs) {
  padding: 14px 16px;
  font-size: 13px;
  color: #e2e8f0;
  background: #0f172a;
  border-radius: var(--radius-md);
}

.ai-content :deep(code) {
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}

.ai-content :deep(:not(pre) > code) {
  padding: 1px 5px;
  font-size: 13px;
  color: var(--sky-dark);
  background: var(--sky-pale);
  border: 1px solid rgb(14 165 233 / 15%);
  border-radius: 4px;
}

.ai-content :deep(a) {
  color: var(--sky);
  text-decoration: none;
}

.ai-content :deep(a:hover) {
  text-decoration: underline;
}

.ai-content :deep(ul),
.ai-content :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}

.ai-content :deep(li) {
  margin: 3px 0;
}

.ai-content :deep(blockquote) {
  padding: 8px 14px;
  margin: 8px 0;
  color: var(--slate-500);
  background: var(--sky-pale);
  border-left: 3px solid var(--sky);
  border-radius: 0 6px 6px 0;
}

/* ── 消息操作 ── */
.msg-actions {
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--slate-100);
}

.feedback-row {
  display: flex;
  width: 100%;
  gap: 6px;
  align-items: center;
}

.feedback-btn {
  display: inline-flex;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--slate-400);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  transition: all 0.18s;
  align-items: center;
  gap: 5px;
}

.feedback-btn svg {
  width: 13px;
  height: 13px;
}

.feedback-btn:hover {
  color: var(--slate-600);
  background: var(--slate-100);
}

.feedback-btn.active {
  color: #059669;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.feedback-btn.dislike.active {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

.copy-reply-btn {
  display: inline-flex;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: auto;
  color: var(--slate-400);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  opacity: 1;
  align-items: center;
  justify-content: center;
  transition:
    opacity 0.16s ease,
    color 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease;
}

.copy-reply-btn:hover,
.copy-reply-btn:focus-visible {
  color: var(--sky-dark);
  background: var(--sky-pale);
  border-color: rgb(14 165 233 / 22%);
  outline: none;
}

.copy-reply-btn :deep(.el-icon) {
  font-size: 15px;
}

.suggested-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.suggested-chip {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--slate-500);
  cursor: pointer;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: 999px;
  transition: all 0.18s;
}

.suggested-chip:hover {
  color: var(--sky-dark);
  background: var(--sky-pale);
  border-color: rgb(14 165 233 / 30%);
}

/* ═══════════════════════════════
   Input Panel
═══════════════════════════════ */
.input-panel {
  padding: 12px 24px 16px;
  background: var(--white);
  border-top: 1px solid var(--slate-200);
  flex-shrink: 0;
}

.capability-panel {
  max-width: 880px;
  padding: 10px 12px;
  margin: 0 auto 10px;
  background: #f8fafc;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
}

.capability-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.capability-mode > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.capability-mode strong {
  font-size: 13px;
  color: var(--slate-800);
}

.capability-mode span {
  font-size: 12px;
  color: var(--slate-400);
}

.capability-selectors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 9px;
}

.capability-selectors :deep(.el-select) {
  width: 100%;
}

.capability-selectors.disabled {
  opacity: 0.55;
}

.hidden-input {
  display: none;
}

.input-box {
  max-width: 880px;
  margin: 0 auto;
  overflow: hidden;
  background: var(--white);
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius-lg);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.input-box:focus-within {
  border-color: var(--sky);
  box-shadow: 0 0 0 3px rgb(14 165 233 / 10%);
}

/* 已上传文件 */
.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 14px 0;
}

.file-chip {
  display: inline-flex;
  height: 26px;
  max-width: 220px;
  padding: 0 6px 0 8px;
  font-size: 12px;
  color: var(--sky-dark);
  background: var(--sky-pale);
  border: 1px solid rgb(14 165 233 / 20%);
  border-radius: 999px;
  align-items: center;
  gap: 5px;
}

.file-chip svg {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}

.file-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.chip-remove {
  display: flex;
  width: 18px;
  height: 18px;
  font-size: 12px;
  color: var(--sky-dark);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 50%;
  opacity: 0.6;
  transition: opacity 0.15s;
  align-items: center;
  justify-content: center;
}

.chip-remove:hover {
  opacity: 1;
}

/* 输入框 */
.input-box :deep(.el-textarea__inner) {
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--slate-900);
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  resize: none;
}

.input-box :deep(.el-textarea__inner::placeholder) {
  color: var(--slate-400);
}

.input-box :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}

/* 工具栏 */
.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 8px 12px;
  border-top: 1px solid var(--slate-100);
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-btn {
  display: flex;
  width: 30px;
  height: 30px;
  font-size: 15px;
  color: var(--slate-400);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  align-items: center;
  justify-content: center;
}

.tool-btn:hover {
  color: var(--slate-600);
  background: var(--slate-100);
}

.tool-btn.recording {
  color: #ef4444;
  background: #fef2f2;
  animation: pulse-red 1.2s ease-in-out infinite;
}

.recording-hint {
  font-size: 12px;
  font-weight: 500;
  color: #ef4444;
}

.input-hint {
  font-size: 11px;
  color: var(--slate-300);
  white-space: nowrap;
}

/* 发送按钮 */
.send-btn {
  display: inline-flex;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 600;
  color: var(--white);
  white-space: nowrap;
  cursor: pointer;
  background: linear-gradient(135deg, var(--sky-dark), var(--sky));
  border: none;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgb(14 165 233 / 30%);
  transition: all 0.2s;
  align-items: center;
  gap: 6px;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgb(14 165 233 / 40%);
}

.send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  box-shadow: none;
}

.send-btn.stop {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  box-shadow: 0 2px 8px rgb(239 68 68 / 25%);
}

.draft-waiting {
  display: flex;
  height: 24px;
  padding: 4px 2px;
  align-items: center;
  gap: 5px;
}

.draft-waiting span {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: var(--sky);
  border-radius: 50%;
  animation: dot-bounce 1.4s ease-in-out infinite;
}

.draft-waiting span:nth-child(2) {
  animation-delay: 0.16s;
}

.draft-waiting span:nth-child(3) {
  animation-delay: 0.32s;
}

/* ═══════════════════════════════
   基础变量
═══════════════════════════════ */
</style>

<style scoped>
/* ---------------- 响应式 ---------------- */
@media (width <= 820px) {
  .cc-root .cc-sidebar {
    position: absolute;
    z-index: 30;
    height: 100%;
    box-shadow: 2px 0 16px rgb(15 23 42 / 12%);
  }

  .cc-root.cc-collapsed .cc-sidebar {
    width: 260px;
    transform: translateX(-100%);
  }

  .cc-root .cc-topbar__menu {
    display: inline-flex;
  }
}

@media (width <= 540px) {
  .cc-root .cc-io {
    padding-right: 12px;
    padding-left: 12px;
  }

  .cc-root .cx__left {
    gap: 4px;
  }

  .cc-root .cx__left .cx-btn--pill {
    width: 32px;
    padding: 0;
    justify-content: center;
  }

  .cc-root .cx__left .cx-btn__txt,
  .cc-root .cx__left .cx-btn__count {
    display: none;
  }
}

.cc-root {
  --sky: #0ea5e9;
  --sky-dark: #0284c7;
  --sky-light: #e0f2fe;
  --sky-pale: #f0f9ff;
  --slate-900: #0f172a;
  --slate-800: #1e293b;
  --slate-700: #334155;
  --slate-600: #475569;
  --slate-500: #64748b;
  --slate-400: #94a3b8;
  --slate-300: #cbd5e1;
  --slate-200: #e2e8f0;
  --slate-100: #f1f5f9;
  --slate-50: #f8fafc;
  --white: #fff;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 3px rgb(15 23 42 / 6%);
  --shadow-md: 0 4px 12px rgb(15 23 42 / 8%);

  position: fixed;
  z-index: 1000;
  display: flex;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  color: var(--slate-900);
  background: var(--slate-100);
  inset: 0;
}

.cc-root *,
.cc-root *::before,
.cc-root *::after {
  box-sizing: border-box;
}

/* ---------------- 侧边栏 ---------------- */
.cc-root .cc-sidebar {
  display: flex;
  width: 260px;
  padding: 10px;
  background: var(--white);
  border-right: 1px solid var(--slate-200);
  transition: width 0.2s ease;
  flex-shrink: 0;
  flex-direction: column;
}

.cc-root.cc-collapsed .cc-sidebar {
  width: 62px;
}

.cc-root .cc-sidebar__top {
  display: flex;
  align-items: center;
  padding: 4px 6px 10px;
}

.cc-root .cc-sidebar__top .cc-iconbtn {
  margin-left: auto;
  flex-shrink: 0;
}

.cc-root .cc-brand {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--slate-900);
}

.cc-root .cc-iconbtn {
  display: inline-flex;
  width: 34px;
  height: 34px;
  color: var(--slate-500);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  transition:
    background 0.15s,
    color 0.15s;
  align-items: center;
  justify-content: center;
}

.cc-root .cc-iconbtn:hover {
  color: var(--slate-700);
  background: var(--slate-100);
}

.cc-root .cc-newchat {
  display: flex;
  width: 100%;
  padding: 9px 12px;
  margin-bottom: 12px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--sky-dark);
  cursor: pointer;
  background: var(--sky-pale);
  border: 1px solid rgb(14 165 233 / 20%);
  border-radius: var(--radius-md);
  transition:
    background 0.15s,
    box-shadow 0.15s;
  align-items: center;
  gap: 8px;
}

.cc-root .cc-newchat:hover {
  background: var(--sky-light);
  box-shadow: 0 2px 8px rgb(14 165 233 / 15%);
}

.cc-root.cc-collapsed .cc-newchat {
  justify-content: center;
  padding: 9px 0;
}

.cc-root .cc-convscroll {
  flex: 1;
  min-height: 0;
}

.cc-root .cc-conv-label {
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--slate-400);
}

.cc-root .cc-conv-loading,
.cc-root .cc-conv-empty {
  padding: 16px 8px;
  font-size: 13px;
  color: var(--slate-400);
  text-align: center;
}

.cc-root .cc-conv {
  display: flex;
  padding: 8px 10px;
  margin-bottom: 2px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  transition: background 0.15s;
  align-items: center;
  gap: 6px;
}

.cc-root .cc-conv:hover {
  background: var(--slate-50);
}

.cc-root .cc-conv.is-active {
  background: var(--sky-pale);
  border-color: rgb(14 165 233 / 20%);
}

.cc-root .cc-conv__name {
  overflow: hidden;
  font-size: 13.5px;
  color: var(--slate-700);
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.cc-root .cc-conv.is-active .cc-conv__name {
  font-weight: 500;
  color: var(--sky-dark);
}

.cc-root .cc-conv__del {
  display: inline-flex;
  width: 26px;
  height: 26px;
  color: var(--slate-400);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition:
    opacity 0.15s,
    color 0.15s,
    background 0.15s;
  align-items: center;
  justify-content: center;
}

.cc-root .cc-conv:hover .cc-conv__del,
.cc-root .cc-conv.is-active .cc-conv__del,
.cc-root .cc-conv__del.loading {
  opacity: 1;
}

.cc-root .cc-conv__del:hover {
  color: #ef4444;
  background: #fef2f2;
}

.cc-root .cc-sidebar__foot {
  padding-top: 8px;
  border-top: 1px solid var(--slate-200);
}

.cc-root .cc-sidebar-agent {
  display: flex;
  min-width: 0;
  padding: 8px 6px;
  border-radius: var(--radius-md);
  align-items: center;
  gap: 9px;
}

.cc-root .cc-sidebar-agent__avatar {
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 50%;
  flex-shrink: 0;
}

.cc-root .cc-sidebar-agent__avatar-img,
.cc-root .cc-sidebar-agent__avatar-fallback {
  width: 100%;
  height: 100%;
}

.cc-root .cc-sidebar-agent__avatar-img {
  display: block;
  object-fit: cover;
}

.cc-root .cc-sidebar-agent__avatar-fallback {
  display: flex;
  font-size: 12px;
  font-weight: 700;
  color: var(--white);
  background: linear-gradient(135deg, var(--sky-dark), var(--sky));
  align-items: center;
  justify-content: center;
}

.cc-root .cc-sidebar-agent__name {
  overflow: hidden;
  font-size: 13.5px;
  color: var(--slate-700);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------------- 主区域 / 顶栏 ---------------- */
.cc-root .cc-main {
  display: flex;
  min-width: 0;
  background: var(--slate-50);
  flex: 1;
  flex-direction: column;
}

.cc-root .cc-topbar {
  display: flex;
  height: 56px;
  padding: 10px 18px 4px;
  background: var(--slate-50);
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.cc-root .cc-topbar__menu {
  display: none;
}

.cc-root .cc-back {
  display: inline-flex;
  width: 34px;
  height: 34px;
  color: var(--slate-500); /* 低调的文字/图标灰色 */
  cursor: pointer;
  background: transparent; /* 默认完全透明，融入背景 */
  border: none;
  border-radius: 50%;
  box-shadow: none; /* 默认无阴影 */
  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.1s ease;
  align-items: center;
  justify-content: center;
}

.cc-root .cc-back .el-icon {
  font-size: 18px; /* 调整合适的大小 */
  transition: color 0.2s ease;
}

/* 悬停状态：仅变为白底并加上极其柔和的阴影，不产生任何位移 */
.cc-root .cc-back:hover {
  color: var(--slate-800); /* 箭头图标稍微加深 */
  background: var(--white); /* 变为白色圆底，利于阴影展现 */
  box-shadow: 0 2px 8px rgb(15 23 42 / 8%); /* 柔和、干净的边缘阴影 */
}

/* 彻底清除并覆盖可能残留的子元素悬停变形与背景，避免任何抖动 */
.cc-root .cc-back:hover .el-icon {
  background: transparent !important;
  transform: none !important;
}

.cc-root .cc-back:focus-visible {
  outline: 3px solid rgb(14 165 233 / 16%);
  outline-offset: 2px;
}

/* 按下状态：仅提供极轻微的整体向内缩放反馈 */
.cc-root .cc-back:active {
  transform: scale(0.95);
}

.cc-root .cc-topbar__spacer {
  flex: 1;
}

/* ---------------- 舞台:空状态居中 / 有消息时底部 ---------------- */
.cc-root .cc-stage {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.cc-root .cc-stage.is-welcome {
  justify-content: center;
}

.cc-root .cc-hero {
  padding: 0 24px 18px;
  text-align: center;
}

.cc-root .cc-hero__title {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--slate-900);
}

.cc-root .cc-hero__accent {
  background: linear-gradient(135deg, var(--sky-dark), #22d3ee);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.cc-root .cc-hero__sub {
  margin: 0;
  font-size: 15px;
  color: var(--slate-500);
}

/* message-panel 沿用原样式(flex:1),空状态时不渲染 */

/* ---------------- 一体化输入框 ---------------- */
.cc-root .cc-io {
  width: 100%;
  max-width: 768px;
  padding: 10px 24px 14px;
  margin: 0 auto;
  flex-shrink: 0;
}

.cc-root .cc-hidden {
  display: none;
}

.cc-root .cx {
  padding: 6px;
  background: var(--white);
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.cc-root .cx.is-focused {
  border-color: var(--sky);
  box-shadow: 0 0 0 3px rgb(14 165 233 / 10%);
}

.cc-root .cx__pills {
  display: flex;
  width: 100%;
  height: 34px;
  padding: 4px 6px;
  overflow: auto hidden;
  box-sizing: border-box;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  scrollbar-width: none;
}

.cc-root .cx__pills::-webkit-scrollbar {
  display: none;
}

.cc-root .cx-pill {
  display: inline-flex;
  height: 26px;
  max-width: 220px;
  padding: 0 6px 0 9px;
  font-size: 12px;
  color: var(--sky-dark);
  cursor: pointer;
  background: var(--sky-pale);
  border: 1px solid rgb(14 165 233 / 20%);
  border-radius: 999px;
  user-select: none;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.cc-root .cx-pill--file {
  cursor: default;
}

.cc-root .cx-pill.is-readonly {
  cursor: default;
}

.cc-root .cx-pill__name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-root .cx-pill__x {
  padding-left: 2px;
  font-size: 15px;
  font-style: normal;
  line-height: 1;
  cursor: pointer;
  opacity: 0.65;
}

.cc-root .cx-pill__x:hover {
  opacity: 1;
}

.cc-root .cx__field {
  position: relative;
  padding: 1px 10px 2px;
}

.cc-root .cx__ta {
  display: block;
  width: 100%;
  max-height: 200px;
  min-height: 72px;
  font: inherit;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--slate-900);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
}

.cc-root .cx__ghost {
  position: absolute;
  top: 3px;
  right: 10px;
  left: 10px;
  overflow: hidden;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--slate-400);
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.cc-root .cx__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
}

.cc-root .cx__left,
.cc-root .cx__right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cc-root .cx-btn {
  display: inline-flex;
  height: 32px;
  padding: 0 10px;
  color: var(--slate-400);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 16px;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  align-items: center;
  gap: 5px;
}

.cc-root .cx-btn--round {
  width: 32px;
  padding: 0;
  justify-content: center;
}

.cc-root .cx-btn:hover {
  color: var(--slate-600);
  background: var(--slate-100);
}

.cc-root .cx-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.cc-root .cx-btn--pill {
  border: 1px solid var(--slate-200);
}

.cc-root .cx-btn.is-active {
  color: var(--sky-dark);
}

.cc-root .cx-btn.is-soft-on {
  color: #0369a1;
  background: #e0f2fe;
  border-color: #bae6fd;
}

.cc-root .cx-btn.is-soft-on:hover {
  color: #0369a1;
  background: #d6effc;
}

.cc-root .cx-btn.recording {
  color: #ef4444;
  background: #fef2f2;
}

.cc-root .cx-btn__txt {
  font-size: 13px;
}

.cc-root .cx-btn__count {
  display: inline-flex;
  height: 18px;
  min-width: 18px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 1;
  color: currentcolor;
  background: rgb(255 255 255 / 22%);
  border-radius: 9px;
  align-items: center;
  justify-content: center;
}

.cc-root .cx-btn.is-soft-on .cx-btn__count {
  background: rgb(14 165 233 / 14%);
}

.cc-root .cx-rec {
  font-size: 12px;
  color: var(--slate-500);
}

.cc-root .cx-send {
  display: inline-flex;
  width: 36px;
  height: 36px;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, var(--sky-dark), var(--sky));
  border: none;
  border-radius: 50%;
  transition:
    transform 0.15s,
    box-shadow 0.15s,
    opacity 0.15s;
  align-items: center;
  justify-content: center;
}

.cc-root .cx-send:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgb(14 165 233 / 40%);
}

.cc-root .cx-send:disabled {
  cursor: not-allowed;
  background: var(--slate-300);
  opacity: 0.4;
}

.cc-root .cx-send--stop {
  background: var(--slate-800);
}

.cc-root .cx-send--stop:hover:not(:disabled) {
  box-shadow: 0 4px 14px rgb(15 23 42 / 25%);
}

.cc-root .cc-disclaimer {
  margin-top: 8px;
  font-size: 12px;
  color: var(--slate-400);
  text-align: center;
}

/* =======================================================================
 * 外壳 / 输入框皮肤 —— 沿用原页面 sky/slate 配色,保持与系统其它页面一致
 * 消息区(msg / thought / ai-content 等)完全沿用原样式,不覆盖
 * ===================================================================== */
</style>

<style>
/* ===== 工具 / 技能选择弹层（el-popover teleport 到 body，需非 scoped） ===== */
.cx-pop.el-popover.el-popper {
  padding: 6px !important;
  overflow: visible !important;
  border-color: #e2e8f0 !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 30px rgb(15 23 42 / 14%) !important;
}

.cx-pop .cx-cap-picker {
  width: 100%;
  min-height: 96px;
}

.cx-pop .cx-flyout__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 2px 6px;
}

.cx-pop .cx-flyout__search {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}

.cx-pop .cx-flyout__search:focus {
  background: #fff;
  border-color: #0ea5e9;
}

.cx-pop .cx-flyout__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 30px;
  gap: 6px;
}

.cx-pop .cx-flyout__selected {
  padding-left: 4px;
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.cx-pop .cx-flyout__quick {
  display: flex;
  gap: 2px;
}

.cx-pop .cx-flyout__quick button {
  height: 30px;
  padding: 0 7px;
  font-size: 12px;
  color: #0284c7;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 7px;
}

.cx-pop .cx-flyout__quick button:hover {
  background: #f0f9ff;
}

.cx-pop .cx-flyout__quick button:disabled {
  color: #94a3b8;
  cursor: default;
  background: transparent;
  opacity: 0.65;
}

.cx-pop .cx-flyout__list {
  display: flex;
  max-height: 264px;
  overflow-y: auto;
  flex-direction: column;
  gap: 1px;
}

.cx-pop .cx-opt {
  display: flex;
  width: 100%;
  padding: 7px 9px;
  font-size: 13px;
  color: #334155;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 7px;
  align-items: center;
  gap: 9px;
}

.cx-pop .cx-opt:hover {
  background: #f1f5f9;
}

.cx-pop .cx-opt__box {
  display: inline-flex;
  width: 16px;
  height: 16px;
  color: #fff;
  border: 1.5px solid #cbd5e1;
  border-radius: 4px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.cx-pop .cx-opt.is-on .cx-opt__box {
  background: #0ea5e9;
  border-color: #0ea5e9;
}

.cx-pop .cx-opt__txt {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cx-pop .cx-flyout__empty {
  padding: 14px 8px;
  font-size: 12.5px;
  color: #94a3b8;
  text-align: center;
}
</style>
