<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowLeft,
  Close,
  CopyDocument,
  Delete,
  Microphone,
  Paperclip,
  Plus
} from '@element-plus/icons-vue'
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
  inThink: boolean
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
const enhanced = computed(() => route.meta.toolChain === true)

function resolveRouteAppId(): number {
  const routeId = route.params.agentId ?? route.params.appId
  const rawValue = Array.isArray(routeId) ? routeId[0] : routeId
  return Number(rawValue)
}

const appId = computed(() => resolveRouteAppId())
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
const selectedToolCodes = ref<string[]>([])
const selectedSkillCodes = ref<string[]>([])
const webToolCodes = ref<string[]>([])
const webAvailable = computed(() => webToolCodes.value.length > 0)

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
  try {
    const options = await capabilityOptionsApi.list()
    capabilityToolOptions.value = (options.tools || []).filter((item) => !item.web)
    capabilitySkillOptions.value = options.skills || []
    webToolCodes.value = options.webToolCodes || []
    selectedToolCodes.value = capabilityToolOptions.value.map((item) => item.toolCode)
    selectedSkillCodes.value = capabilitySkillOptions.value.map((item) => item.skillCode)
    webMode.value = false
  } catch (error) {
    ElMessage.error(extractErrorMessage(error) || '加载能力选项失败')
  } finally {
    capabilityLoading.value = false
  }
}

const currentConversation = computed(() =>
  conversations.value.find((item) => item.id === currentConversationId.value)
)
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
  const list = parts.map((item) => String(item || '').trim()).filter((item) => item.length > 0)
  return list.join('\n\n')
}

function splitThinkTaggedText(raw: string): ThoughtContentParts {
  if (!raw) return { thought: '', content: '' }
  const thoughtParts: string[] = []
  const contentParts: string[] = []
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi
  let cursor = 0
  let matched = false
  let match: RegExpExecArray | null = null
  while ((match = thinkRegex.exec(raw)) !== null) {
    matched = true
    contentParts.push(raw.slice(cursor, match.index))
    thoughtParts.push(match[1] || '')
    cursor = thinkRegex.lastIndex
  }
  if (!matched) return { thought: '', content: raw }
  contentParts.push(raw.slice(cursor))
  return { thought: thoughtParts.join('\n\n'), content: contentParts.join('') }
}

function trailingPartialTagLength(text: string, tag: string): number {
  const max = Math.min(tag.length - 1, text.length)
  for (let length = max; length > 0; length -= 1) {
    if (tag.startsWith(text.slice(-length))) return length
  }
  return 0
}

function splitThinkTaggedDelta(delta: string, state: ThinkStreamState): ThoughtContentParts {
  if (!delta) return { thought: '', content: '' }
  const openTag = '<think>'
  const closeTag = '</think>'
  const source = `${state.carry}${delta}`
  const lowerSource = source.toLowerCase()
  let cursor = 0
  let thought = ''
  let content = ''
  state.carry = ''
  while (cursor < source.length) {
    if (state.inThink) {
      const closeIndex = lowerSource.indexOf(closeTag, cursor)
      if (closeIndex < 0) {
        const tailLength = trailingPartialTagLength(source.slice(cursor), closeTag)
        const end = tailLength > 0 ? source.length - tailLength : source.length
        thought += source.slice(cursor, end)
        state.carry = source.slice(end)
        break
      }
      thought += source.slice(cursor, closeIndex)
      state.inThink = false
      cursor = closeIndex + closeTag.length
      continue
    }
    const openIndex = lowerSource.indexOf(openTag, cursor)
    if (openIndex < 0) {
      const tailLength = trailingPartialTagLength(source.slice(cursor), openTag)
      const end = tailLength > 0 ? source.length - tailLength : source.length
      content += source.slice(cursor, end)
      state.carry = source.slice(end)
      break
    }
    content += source.slice(cursor, openIndex)
    state.inThink = true
    cursor = openIndex + openTag.length
  }
  return { thought, content }
}

function flushThinkStreamCarry(state: ThinkStreamState): ThoughtContentParts {
  if (!state.carry) return { thought: '', content: '' }
  const part = state.inThink
    ? { thought: state.carry, content: '' }
    : { thought: '', content: state.carry }
  state.carry = ''
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
  const answer = toDisplayText(answerParts.content) || toDisplayText(record.answer)
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
      thought: draft.thought,
      content: draft.content,
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
  if (!appId.value) {
    ElMessage.warning('请先选择智能体')
    return
  }
  fileInputRef.value?.click()
}

async function handleFileInputChange(event: Event) {
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

function handleUsePrompt(prompt: string) {
  inputValue.value = prompt
  nextTick(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>('.input-panel .el-textarea__inner')
    textarea?.focus()
  })
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
  const streamThinkState: ThinkStreamState = { inThink: false, carry: '' }

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
              const delta = extractThoughtText(payload)
              patchDraft({
                thought: streamingDraft.value.thought + delta,
                isThinking: true,
                backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
              })
            } else if (chunkType === 'thought_end') {
              const delta = extractThoughtText(payload)
              patchDraft({
                thought: streamingDraft.value.thought + delta,
                isThinking: false,
                backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
              })
            } else if (chunkType === 'text') {
              const textDelta = extractContentText(payload)
              const parts = splitThinkTaggedDelta(textDelta, streamThinkState)
              patchDraft({
                thought: streamingDraft.value.thought + parts.thought,
                content: streamingDraft.value.content + parts.content,
                isThinking: streamThinkState.inThink,
                backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
              })
            } else {
              const fallbackText = extractContentText(payload)
              if (fallbackText) {
                const parts = splitThinkTaggedDelta(fallbackText, streamThinkState)
                patchDraft({
                  thought: streamingDraft.value.thought + parts.thought,
                  content: streamingDraft.value.content + parts.content,
                  isThinking: streamThinkState.inThink,
                  backendMessageId: backendMessageId || streamingDraft.value.backendMessageId
                })
              }
            }
          } else if (event.event === 'message_replace') {
            const payload = normalizeStreamPayload(event.data)
            updateStreamMeta(payload)
            const backendMessageId = extractBackendMessageId(payload)
            const content = extractContentText(payload)
            streamThinkState.inThink = false
            streamThinkState.carry = ''
            const parts = splitThinkTaggedText(content)
            patchDraft({
              content: toDisplayText(parts.content) || content,
              thought: mergeThoughtText(streamingDraft.value.thought, toDisplayText(parts.thought)),
              isThinking: false,
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
              content: streamingDraft.value.content || nextContent || finalText,
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
  if (!appId.value || Number.isNaN(appId.value)) {
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
</script>

<template>
  <div class="chat-page">
    <!-- ═══ Header ═══ -->
    <header class="chat-header">
      <div class="header-left">
        <el-button text class="back-btn" @click="backToApps">
          <el-icon><ArrowLeft /></el-icon>
          <span>返回</span>
        </el-button>
      </div>

      <div class="header-center">
        <div class="app-avatar-wrap">
          <img
            v-if="resolveAppAvatar(currentApp)"
            :src="resolveAppAvatar(currentApp)"
            class="app-avatar-img"
            alt="avatar"
          />
          <div v-else class="app-avatar-fallback">
            {{ resolveAppAvatarText(currentApp) }}
          </div>
        </div>
        <div class="app-info">
          <div class="app-name">{{ currentApp?.appName || '智能体聊天' }}</div>
          <div v-if="currentApp?.description" class="app-desc">{{ currentApp.description }}</div>
        </div>
      </div>

      <div class="header-right">
        <!-- 保留右侧空间平衡布局 -->
      </div>
    </header>

    <div class="chat-body">
      <!-- ═══ Sidebar ═══ -->
      <aside class="chat-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">对话记录</span>
          <button class="new-chat-btn" @click="handleNewConversation">
            <el-icon><Plus /></el-icon>
            新对话
          </button>
        </div>

        <el-scrollbar class="sidebar-scroll">
          <div v-if="conversationLoading" class="sidebar-loading">
            <span>加载中...</span>
          </div>
          <template v-else>
            <div
              v-for="conversation in conversations"
              :key="conversation.id"
              class="conv-item"
              :class="{ active: conversation.id === currentConversationId }"
              @click="handleSelectConversation(conversation.id)"
            >
              <div class="conv-item-body">
                <div class="conv-item-name">{{ conversation.name }}</div>
                <div class="conv-item-time">{{ formatTime(conversation.updatedAt) }}</div>
              </div>
              <div class="conv-item-actions" @click.stop>
                <el-popconfirm
                  title="确认删除该会话？"
                  confirm-button-text="删除"
                  cancel-button-text="取消"
                  @confirm="handleDeleteConversation(conversation.id)"
                >
                  <template #reference>
                    <button
                      class="conv-delete-btn"
                      :class="{ loading: deletingConversationId === conversation.id }"
                      @click.stop
                    >
                      <el-icon><Delete /></el-icon>
                    </button>
                  </template>
                </el-popconfirm>
              </div>
            </div>
            <div v-if="conversations.length === 0" class="sidebar-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span>暂无历史对话</span>
            </div>
          </template>
        </el-scrollbar>
      </aside>

      <!-- ═══ Main ═══ -->
      <main class="chat-main">
        <!-- 顶部会话标题栏 -->
        <div class="chat-topbar">
          <div class="topbar-left">
            <div class="topbar-title">{{ currentConversation?.name || '新对话' }}</div>
            <div v-if="!currentConversationId" class="topbar-badge">NEW</div>
          </div>
        </div>

        <!-- 消息区 -->
        <div class="message-panel">
          <el-scrollbar
            ref="messageScrollbarRef"
            class="message-scroll"
            @scroll="handleMessageScroll"
          >
            <div ref="messageListRef" class="message-scroll-inner">
              <!-- 欢迎屏 -->
              <div v-if="showWelcome" class="welcome-screen">
                <div class="welcome-glow"></div>
                <div class="welcome-body">
                  <div class="welcome-icon">
                    <svg viewBox="0 0 48 48" fill="none">
                      <path
                        d="M24 4 L44 14 L44 34 L24 44 L4 34 L4 14 Z"
                        stroke="#0ea5e9"
                        stroke-width="2"
                      />
                      <path
                        d="M24 4 L24 44 M4 14 L44 34 M44 14 L4 34"
                        stroke="#0ea5e9"
                        stroke-width="1.5"
                        opacity="0.35"
                      />
                    </svg>
                  </div>
                  <h2 class="welcome-title">
                    你好，<span class="welcome-accent">{{ displayName || '开发者' }}</span>
                  </h2>
                  <p class="welcome-sub">有什么我可以帮你的？</p>

                  <div class="prompt-grid">
                    <div
                      v-for="(item, idx) in promptSuggestions"
                      :key="idx"
                      class="prompt-card"
                      :style="{ '--delay': `${idx * 0.07}s` }"
                      @click="handleUsePrompt(item.prompt)"
                    >
                      <div class="prompt-icon" :class="`icon-${item.iconKey}`">
                        <svg
                          v-if="item.iconKey === 'spark'"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        >
                          <path
                            d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"
                          />
                        </svg>
                        <svg
                          v-else-if="item.iconKey === 'code'"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        >
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                        </svg>
                        <svg
                          v-else-if="item.iconKey === 'doc'"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <svg
                          v-else
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        >
                          <path
                            d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"
                          />
                        </svg>
                      </div>
                      <div class="prompt-text">
                        <div class="prompt-title">{{ item.title }}</div>
                        <div class="prompt-desc">{{ item.description }}</div>
                      </div>
                      <svg
                        class="prompt-chevron"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="messageLoading" class="state-tip">正在加载消息...</div>

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
                          v-if="streamingDraft.content"
                          class="ai-content"
                          v-html="draftContentHtml"
                        ></div>

                        <!-- 纯等待状态（还没有任何内容） -->
                        <div v-if="!streamingDraft.content && isGenerating" class="draft-waiting">
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

        <!-- ═══ 输入区 ═══ -->
        <div class="input-panel">
          <input
            ref="fileInputRef"
            class="hidden-input"
            type="file"
            multiple
            accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.mp3,.wav,.m4a,.mp4"
            @change="handleFileInputChange"
          />

          <div v-if="enhanced" v-loading="capabilityLoading" class="capability-panel">
            <div class="capability-mode">
              <div>
                <strong>能力配置</strong>
                <span>{{ webMode ? '仅使用联网工具' : '使用已勾选的 Skill 与工具' }}</span>
              </div>
              <el-switch
                v-model="webMode"
                :disabled="!webAvailable || capabilityLoading"
                active-text="联网"
                inactive-text="工具"
              />
            </div>
            <div class="capability-selectors" :class="{ disabled: webMode }">
              <el-select
                v-model="selectedSkillCodes"
                multiple
                filterable
                collapse-tags
                :max-collapse-tags="2"
                :disabled="webMode"
                placeholder="选择 Skill"
              >
                <el-option
                  v-for="skill in capabilitySkillOptions"
                  :key="skill.skillCode"
                  :label="skill.displayName"
                  :value="skill.skillCode"
                />
              </el-select>
              <el-select
                v-model="selectedToolCodes"
                multiple
                filterable
                collapse-tags
                :max-collapse-tags="2"
                :disabled="webMode"
                placeholder="选择工具"
              >
                <el-option
                  v-for="tool in capabilityToolOptions"
                  :key="tool.toolCode"
                  :label="tool.toolName"
                  :value="tool.toolCode"
                />
              </el-select>
            </div>
          </div>

          <div class="input-box">
            <!-- 已上传文件 -->
            <div v-if="uploadedFiles.length > 0" class="file-chips">
              <div v-for="file in uploadedFiles" :key="file.fileId" class="file-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>{{ file.fileName }}</span>
                <button class="chip-remove" @click="removeUploadedFile(file.fileId)">
                  <el-icon><Close /></el-icon>
                </button>
              </div>
            </div>

            <!-- 文本输入 -->
            <el-input
              v-model="inputValue"
              type="textarea"
              :rows="3"
              resize="none"
              placeholder="输入消息…"
              @keydown="handleInputKeydown"
            />

            <!-- 操作栏 -->
            <div class="input-toolbar">
              <div class="toolbar-left">
                <button
                  class="tool-btn"
                  :class="{ loading: uploadLoading }"
                  title="上传文件"
                  @click="triggerFileSelect"
                >
                  <el-icon><Paperclip /></el-icon>
                </button>
                <button
                  v-if="canUseVoice"
                  class="tool-btn"
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
                <span v-if="isRecording" class="recording-hint">录音中，松开结束</span>
                <span v-else-if="audioRecognizing" class="recording-hint">识别中...</span>
              </div>
              <div class="toolbar-right">
                <span class="input-hint">Enter 发送 · Shift+Enter 换行</span>
                <button
                  v-if="isGenerating"
                  class="send-btn stop"
                  :disabled="!canStop"
                  @click="handleStopGeneration"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  停止
                </button>
                <button v-else class="send-btn" :disabled="!canSend" @click="handleSend">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="14"
                    height="14"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
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
  padding: 10px 14px 12px;
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
