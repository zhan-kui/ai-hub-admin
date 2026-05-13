<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { Close, Delete, Microphone, Paperclip, Plus, Refresh } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import {
  appApi,
  chatApi,
  conversationApi,
  fileApi,
  type AppConfigVO,
  type ChatFilePayload
} from '@/api/frontend-api'
import {
  useChatStore,
  type ChatMessage,
  type ChatMessageFileReference,
  type UploadedFile
} from '@/store/modules/chat'
import { useUserStore } from '@/store/modules/user'

interface ConversationItem {
  id: string
  name: string
  updatedAt?: string
  raw: Record<string, unknown>
}

interface PromptSuggestion {
  icon: string
  title: string
  description: string
  prompt: string
}

type FeedbackRating = 'like' | 'dislike'

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

const apps = ref<AppConfigVO[]>([])
const conversations = ref<ConversationItem[]>([])
const inputValue = ref('')
const feedbackByMessageId = ref<Record<string, FeedbackRating | undefined>>({})
const suggestedByMessageId = ref<Record<string, string[]>>({})
const suggestedLoadingByMessageId = ref<Record<string, boolean>>({})

const appLoading = ref(false)
const conversationLoading = ref(false)
const messageLoading = ref(false)
const deletingConversationId = ref<string | null>(null)
const uploadLoading = ref(false)
const audioRecognizing = ref(false)
const isRecording = ref(false)
const stopLoading = ref(false)

const streamController = ref<AbortController | null>(null)
const activeAssistantMessageId = ref<string | null>(null)
const mediaRecorderRef = ref<MediaRecorder | null>(null)
const mediaStreamRef = ref<MediaStream | null>(null)
const audioChunksRef = ref<Blob[]>([])

const messageScrollbarRef = ref<any>(null)
const messageListRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const shouldStickToBottom = ref(true)

const currentAppId = computed(() => chatStore.getCurrentAppId)
const currentConversationId = computed(() => chatStore.getCurrentConversationId)
const messages = computed(() => chatStore.getMessages)
const isGenerating = computed(() => chatStore.getIsGenerating)
const uploadedFiles = computed(() => chatStore.getUploadedFiles)
const displayName = computed(() => userStore.getDisplayName)
const canSend = computed(() =>
  Boolean(
    currentAppId.value &&
      inputValue.value.trim() &&
      !isGenerating.value &&
      !uploadLoading.value &&
      !audioRecognizing.value
  )
)
const canStop = computed(() =>
  Boolean(currentAppId.value && chatStore.getTaskId && isGenerating.value && !stopLoading.value)
)
const canUseVoice = computed(() =>
  Boolean(
    currentAppId.value &&
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof MediaRecorder !== 'undefined'
  )
)

// ═══════════════════════════════════════════════
// 空状态下展示的提示词引导（可自由修改文案）
// ═══════════════════════════════════════════════
const promptSuggestions: PromptSuggestion[] = [
  {
    icon: 'spark',
    title: '介绍一下你自己',
    description: '了解 AI 助手的能力范围',
    prompt: '你好，请介绍一下你的能力以及我可以如何使用你。'
  },
  {
    icon: 'code',
    title: '帮我写一段代码',
    description: '生成、调试或优化代码片段',
    prompt: '帮我写一个 Python 函数，用于计算斐波那契数列的第 n 项。'
  },
  {
    icon: 'doc',
    title: '分析文档内容',
    description: '上传文件后基于内容提问',
    prompt: '请帮我总结这份文档的核心观点，并列出三个关键要点。'
  },
  {
    icon: 'idea',
    title: '创意头脑风暴',
    description: '为业务场景提供多样化思路',
    prompt: '我想为一款面向企业的 AI 产品策划一次线上发布会，请给我 5 个创意方向。'
  }
]

const currentConversation = computed(() =>
  conversations.value.find((item) => item.id === currentConversationId.value)
)
const currentApp = computed(() => apps.value.find((item) => item.id === currentAppId.value))
// 是否展示空状态欢迎屏
const showWelcome = computed(
  () => !currentConversationId.value && messages.value.length === 0 && !messageLoading.value
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
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }
  return null
}

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function toRawText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
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
  if (raw === null) {
    return null
  }
  const normalized = normalizeEscapedText(raw)
  return normalized.trim() ? normalized : null
}

function normalizeTimeValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1_000_000_000_000 ? value * 1000 : value
    const parsed = new Date(millis)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric)) {
        const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
        const parsed = new Date(millis)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
      }
    }

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
    return trimmed
  }

  return undefined
}

function extractStringByKeys(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toText(record[key])
    if (value) {
      return value
    }
  }
  return null
}

function extractRawStringByKeys(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toRawText(record[key])
    if (value !== null) {
      return value
    }
  }
  return null
}

function extractDisplayStringByKeys(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = toDisplayText(record[key])
    if (value !== null) {
      return value
    }
  }
  return null
}

function extractThoughtFromAgentThoughts(value: unknown): string {
  if (!Array.isArray(value)) {
    return ''
  }

  const blocks = value
    .map((item) => {
      const record = toRecord(item)
      if (!record) {
        return toDisplayText(item) || ''
      }
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
  if (directThought) {
    return directThought
  }
  return extractThoughtFromAgentThoughts(record.agent_thoughts) || ''
}

function getScrollWrapEl(): HTMLElement | null {
  return (messageScrollbarRef.value?.wrapRef as HTMLElement | undefined) || null
}

async function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  await nextTick()
  const wrap = getScrollWrapEl()
  if (!wrap) {
    return
  }
  wrap.scrollTo({ top: wrap.scrollHeight, behavior })
}

function requestStickBottom(behavior: ScrollBehavior = 'auto') {
  if (!shouldStickToBottom.value) {
    return
  }
  void scrollToBottom(behavior)
}

function handleMessageScroll() {
  const wrap = getScrollWrapEl()
  if (!wrap) {
    return
  }
  const distanceToBottom = wrap.scrollHeight - (wrap.scrollTop + wrap.clientHeight)
  shouldStickToBottom.value = distanceToBottom < 80
}

useResizeObserver(messageListRef, () => {
  if (shouldStickToBottom.value) {
    void scrollToBottom('auto')
  }
})

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  const record = toRecord(payload)
  if (!record) {
    return []
  }

  const keys = ['list', 'items', 'records', 'rows', 'data']
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  const nested = toRecord(record.data)
  if (!nested) {
    return []
  }

  for (const key of keys) {
    const value = nested[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function parseConversation(rawItem: unknown, index: number): ConversationItem | null {
  const record = toRecord(rawItem)
  if (!record) {
    return null
  }

  const id =
    extractStringByKeys(record, ['conversationId', 'conversation_id', 'id', 'uuid']) || null

  if (!id) {
    return null
  }

  const name =
    extractStringByKeys(record, ['name', 'title', 'conversationName', 'conversation_name']) ||
    `会话 ${index + 1}`

  const updatedAt = normalizeTimeValue(
    record.updatedAt ?? record.updated_at ?? record.createdAt ?? record.created_at
  )

  return {
    id,
    name,
    updatedAt,
    raw: record
  }
}

function parseMessageRole(rawRole: string | null): ChatMessage['role'] {
  const value = (rawRole || 'assistant').toLowerCase()
  if (value.includes('user') || value.includes('human') || value === 'question') {
    return 'user'
  }
  if (value.includes('system')) {
    return 'system'
  }
  return 'assistant'
}

function parseMessageItem(rawItem: unknown, index: number): ChatMessage[] {
  const record = toRecord(rawItem)
  if (!record) {
    return []
  }

  const query = toDisplayText(record.query)
  const answer = toDisplayText(record.answer)
  const thoughtText = extractThought(record)
  const createdAt = normalizeTimeValue(
    record.createdAt ?? record.created_at ?? record.updatedAt ?? record.updated_at
  )
  const backendMessageId =
    extractStringByKeys(record, ['messageId', 'message_id', 'id']) || undefined

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
        backendMessageId
      })
    }
    return pairMessages
  }

  const nestedData = toRecord(record.data)
  if (nestedData) {
    const nested = parseMessageItem(nestedData, index)
    if (nested.length > 0) {
      return nested
    }
  }

  const content =
    extractDisplayStringByKeys(record, ['content', 'message', 'text', 'output']) ||
    extractDisplayStringByKeys(record, ['answer']) ||
    ''

  if (!content) {
    return []
  }

  const role = parseMessageRole(extractStringByKeys(record, ['role', 'type']))

  return [
    {
      id: extractStringByKeys(record, ['id', 'messageId']) || `message-${index}`,
      role,
      thought: thoughtText,
      content,
      isThinking: false,
      createdAt,
      backendMessageId: role === 'assistant' ? backendMessageId : undefined
    }
  ]
}

function normalizeMessages(payload: unknown): ChatMessage[] {
  const list = pickList(payload)
  const source = list.length > 0 ? list : [payload]

  return source
    .flatMap((item, index) => parseMessageItem(item, index))
    .filter((item) => Boolean(item.content || item.thought))
}

function formatTime(time?: string): string {
  if (!time) {
    return ''
  }
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) {
    return time
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

function roleLabel(role: ChatMessage['role']): string {
  if (role === 'user') {
    return '用户'
  }
  if (role === 'system') {
    return '系统'
  }
  return 'AI'
}

function updateMessageById(messageId: string, updater: (message: ChatMessage) => ChatMessage) {
  const next = chatStore.getMessages.map((item) => {
    if (item.id !== messageId) {
      return item
    }
    return updater(item)
  })
  chatStore.setMessages(next)
  requestStickBottom('auto')
}

function getMessageById(messageId: string): ChatMessage | undefined {
  return chatStore.getMessages.find((item) => item.id === messageId)
}

function normalizeStreamPayload(raw: unknown): Record<string, unknown> {
  const record = toRecord(raw) || {}
  const nested = toRecord(record.data)
  if (!nested) {
    return record
  }
  return {
    ...record,
    ...nested
  }
}

function updateStreamMeta(payload: Record<string, unknown>) {
  const conversationId = extractStringByKeys(payload, ['conversationId', 'conversation_id'])
  if (conversationId) {
    chatStore.setCurrentConversationId(conversationId)
  }

  const taskId = extractStringByKeys(payload, ['taskId', 'task_id'])
  if (taskId) {
    chatStore.setTaskId(taskId)
  }
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
    extractStringByKeys(payload, ['messageId', 'message_id', 'id']) ||
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

function collectStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item))
      .filter((item): item is string => Boolean(item && item.trim()))
  }
  const record = toRecord(value)
  if (!record) return []
  for (const key of ['questions', 'suggestions', 'list', 'items', 'records', 'data']) {
    const result = collectStringList(record[key])
    if (result.length > 0) return result
  }
  return []
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  const record = toRecord(error)
  if (record) {
    return extractStringByKeys(record, ['message', 'msg', 'error']) || '请求失败'
  }
  return '请求失败'
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index < 0) {
    return ''
  }
  return filename.slice(index + 1).toLowerCase()
}

function inferChatFileType(fileName: string, mimeType?: string): ChatFilePayload['type'] {
  const extension = getFileExtension(fileName)
  const normalizedMimeType = (mimeType || '').toLowerCase()

  if (normalizedMimeType.startsWith('image/') || imageExtensions.has(extension)) {
    return 'image'
  }
  if (normalizedMimeType.startsWith('audio/') || audioExtensions.has(extension)) {
    return 'audio'
  }
  if (normalizedMimeType.startsWith('video/') || videoExtensions.has(extension)) {
    return 'video'
  }
  if (
    normalizedMimeType.startsWith('text/') ||
    normalizedMimeType.startsWith('application/pdf') ||
    normalizedMimeType.includes('word') ||
    normalizedMimeType.includes('excel') ||
    normalizedMimeType.includes('sheet') ||
    documentExtensions.has(extension)
  ) {
    return 'document'
  }
  return 'custom'
}

function normalizeRemoteUrl(value: string): string | null {
  const trimmed = value.trim().replace(/[),.;!?]+$/, '')
  if (!trimmed) {
    return null
  }
  try {
    const parsed = new URL(trimmed)
    if (!/^https?:$/.test(parsed.protocol)) {
      return null
    }
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
    if (!normalized) {
      continue
    }
    seen.add(normalized)
  }

  return Array.from(seen)
}

function splitFileName(rawName: string): { name: string; extension?: string } {
  const normalized = rawName.trim()
  if (!normalized) {
    return { name: '未命名文件' }
  }

  const dotIndex = normalized.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return { name: normalized }
  }

  return {
    name: normalized.slice(0, dotIndex),
    extension: normalized.slice(dotIndex + 1).toLowerCase()
  }
}

function getRemoteReferenceName(url: string): string {
  const normalized = normalizeRemoteUrl(url)
  if (!normalized) {
    return ''
  }
  try {
    const parsed = new URL(normalized)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const tail = segments.length > 0 ? segments[segments.length - 1] : ''
    if (tail) {
      return decodeURIComponent(tail)
    }
    return parsed.hostname
  } catch {
    return ''
  }
}

function buildMessageFileReferences(
  files: UploadedFile[]
): NonNullable<ChatMessage['fileReferences']> | undefined {
  if (files.length === 0) {
    return undefined
  }

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
  if (file.size > maxUploadSize) {
    return `文件 ${file.name} 超过 20MB 限制`
  }

  const extension = getFileExtension(file.name)
  if (!extension || !allowedFileExtensions.has(extension)) {
    return `文件 ${file.name} 类型暂不支持`
  }

  return null
}

function findUploadRecord(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const record = toRecord(item)
      if (record) {
        return record
      }
    }
    return null
  }

  const directRecord = toRecord(payload)
  if (!directRecord) {
    return null
  }

  const list = pickList(payload)
  if (list.length > 0) {
    return findUploadRecord(list[0])
  }

  const nested = toRecord(directRecord.data)
  if (nested) {
    const id = extractStringByKeys(nested, ['fileId', 'file_id', 'id', 'upload_file_id'])
    if (id) {
      return nested
    }
  }

  return directRecord
}

function parseUploadedFile(response: unknown, sourceFile: File): UploadedFile | null {
  const record = findUploadRecord(response)
  if (!record) {
    return null
  }

  const fileId = extractStringByKeys(record, ['fileId', 'file_id', 'id', 'upload_file_id'])
  if (!fileId) {
    return null
  }

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
  if (!record) {
    return ''
  }

  const text =
    extractDisplayStringByKeys(record, [
      'text',
      'message',
      'content',
      'query',
      'result',
      'transcript'
    ]) || ''

  if (text) {
    return text
  }

  const nested = toRecord(record.data)
  if (!nested) {
    return ''
  }
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
      if (!uploadFileId) {
        return {
          validationError: `本地文件 ${item.fileName || '未命名文件'} 缺少 uploadFileId，请重新上传后再试`
        }
      }
      payloadFiles.push({
        type: fileType,
        transferMethod,
        uploadFileId
      })
      continue
    }

    const remoteUrl = normalizeRemoteUrl(item.url || '')
    if (!remoteUrl) {
      return {
        validationError: `远程文件 ${item.fileName || '未命名文件'} 缺少有效 url，请检查后再试`
      }
    }

    remoteUrls.add(remoteUrl)
    payloadFiles.push({
      type: fileType,
      transferMethod,
      url: remoteUrl
    })
  }

  const extractedUrls = extractRemoteUrls(question)
  for (const url of extractedUrls) {
    if (remoteUrls.has(url)) {
      continue
    }
    payloadFiles.push({
      type: 'document',
      transferMethod: 'remote_url',
      url
    })
  }

  return {
    files: payloadFiles.length > 0 ? payloadFiles : undefined
  }
}

function removeUploadedFile(fileId: string) {
  chatStore.setUploadedFiles(chatStore.getUploadedFiles.filter((item) => item.fileId !== fileId))
}

function triggerFileSelect() {
  if (!currentAppId.value) {
    ElMessage.warning('请先选择应用')
    return
  }
  fileInputRef.value?.click()
}

async function handleFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = ''

  if (!currentAppId.value || files.length === 0) {
    return
  }

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
        const response = await fileApi.upload(currentAppId.value, file)
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
  if (successCount > 0) {
    ElMessage.success(`已上传 ${successCount} 个文件`)
  }
}

function appendTextToInput(text: string) {
  const appended = text.trim()
  if (!appended) {
    return
  }

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

// 1. 增加一个记录开始时间的变量
const recordStartTimeRef = ref<number>(0)

async function startVoiceInput() {
  if (!currentAppId.value) {
    ElMessage.warning('请先选择应用')
    return
  }
  if (!canUseVoice.value) {
    ElMessage.warning('当前浏览器不支持语音输入')
    return
  }
  if (isRecording.value || audioRecognizing.value || isGenerating.value) {
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // 指定更稳妥的 mimeType
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })

    mediaStreamRef.value = stream
    mediaRecorderRef.value = recorder
    audioChunksRef.value = []
    recordStartTimeRef.value = Date.now() // 记录开始时间

    recorder.ondataavailable = (recorderEvent: BlobEvent) => {
      // 只有当数据大小大于 0 时才推入
      if (recorderEvent.data && recorderEvent.data.size > 0) {
        audioChunksRef.value.push(recorderEvent.data)
      }
    }

    recorder.onstop = async () => {
      isRecording.value = false

      // 关键修复 1：计算录音时长
      const duration = Date.now() - recordStartTimeRef.value
      if (duration < 800) {
        // 如果录音短于 0.8 秒，视为无效点击
        ElMessage.warning('录音时间太短')
        releaseAudioResources()
        return
      }

      const chunks = [...audioChunksRef.value]
      audioChunksRef.value = []

      // 释放资源
      if (mediaStreamRef.value) {
        mediaStreamRef.value.getTracks().forEach((track) => track.stop())
        mediaStreamRef.value = null
      }
      mediaRecorderRef.value = null

      if (!currentAppId.value || chunks.length === 0) return

      const audioBlob = new Blob(chunks, { type: mimeType })

      // 关键修复 2：检查最终生成的 Blob 大小 (正常 1秒 WebM 至少 4-6KB 以上)
      console.log('最终录音大小:', audioBlob.size)
      if (audioBlob.size < 3000) {
        ElMessage.warning('未检测到有效语音，请按住说话')
        return
      }

      const extension = 'webm'
      const audioFile = new File([audioBlob], `recording-${Date.now()}.${extension}`, {
        type: mimeType
      })

      audioRecognizing.value = true
      try {
        // 注意：这里传的是 audioBlob 还是 audioFile 取决于你后端 chatApi.audioToText 的实现
        // 建议传 audioFile，因为它带有文件名后缀，方便后端 FFmpeg 识别格式
        const response = await chatApi.audioToText(currentAppId.value, audioFile)
        const recognizedText = parseAudioToTextResult(response)
        if (recognizedText) {
          appendTextToInput(recognizedText)
        } else {
          ElMessage.warning('未能识别出文字')
        }
      } catch (error: unknown) {
        ElMessage.error(extractErrorMessage(error) || '语音识别失败')
      } finally {
        audioRecognizing.value = false
      }
    }

    // 关键修复 3：设置 timeslice (每 200ms 触发一次 ondataavailable)
    // 这样可以确保数据是持续写入 chunks 的，而不是在 stop 时才尝试一次性写入
    recorder.start(200)
    isRecording.value = true
  } catch (error: unknown) {
    releaseAudioResources()
    ElMessage.error('无法启动录音，请检查麦克风权限')
  }
}
function stopVoiceInput() {
  const recorder = mediaRecorderRef.value
  if (!recorder || recorder.state === 'inactive') {
    return
  }
  recorder.stop()
}

function resetMessageActionsState() {
  feedbackByMessageId.value = {}
  suggestedByMessageId.value = {}
  suggestedLoadingByMessageId.value = {}
}

async function handleSelectApp(appId: number, forceReload = false) {
  if (!forceReload && appId === currentAppId.value) {
    return
  }

  chatStore.setCurrentAppId(appId)
  chatStore.resetConversationState()
  resetMessageActionsState()
  conversations.value = []
  inputValue.value = ''

  // ★ 切换应用后仅加载历史列表，不自动进入某个会话，保持新对话状态
  await loadConversations(undefined, false)
}

async function loadApps() {
  appLoading.value = true
  try {
    const result = await appApi.list()
    apps.value = result.filter((item) => item.enabled)

    if (apps.value.length === 0) {
      chatStore.setCurrentAppId(null)
      chatStore.resetConversationState()
      conversations.value = []
      return
    }

    const target = apps.value.find((item) => item.id === currentAppId.value) || apps.value[0]

    await handleSelectApp(target.id, true)
  } catch (error: unknown) {
    ElMessage.error(extractErrorMessage(error) || '应用列表加载失败')
  } finally {
    appLoading.value = false
  }
}

// ★ 修复抖动：新增 silent 参数
// silent=true 时跳过 conversationLoading 置 true，直接用新数据原地替换列表，不清空再重建
async function loadConversations(preferredId?: string, selectFirst = false, silent = false) {
  if (!currentAppId.value) {
    conversations.value = []
    return
  }

  // ★ 非静默模式才显示 loading，避免侧边栏内容高度突变导致页面抖动
  if (!silent) {
    conversationLoading.value = true
  }

  try {
    const response = await conversationApi.list({
      appId: currentAppId.value,
      page: 1,
      limit: 100
    })

    const list = pickList(response)
    const parsed = list
      .map((item, index) => parseConversation(item, index))
      .filter((item): item is ConversationItem => Boolean(item))

    // ★ 静默模式：直接替换数据，不经过清空状态，Vue diff 会平滑更新 DOM
    conversations.value = parsed

    if (parsed.length === 0) {
      chatStore.setCurrentConversationId(null)
      chatStore.setMessages([])
      return
    }

    // 只有明确传了 preferredId（例如刚刚发送完消息拿到新的会话 id）才选中
    if (preferredId && parsed.some((item) => item.id === preferredId)) {
      chatStore.setCurrentConversationId(preferredId)
      // ★ 静默刷新列表时不重新加载消息，避免打断当前正在显示的流式输出
      if (!silent) {
        await loadMessages(preferredId)
      }
      return
    }

    // 或者显式要求选中第一条
    if (selectFirst) {
      const first = parsed[0].id
      chatStore.setCurrentConversationId(first)
      if (!silent) {
        await loadMessages(first)
      }
      return
    }

    // 默认：保持新对话状态（不选中任何一条历史）
    // 如果之前已经选中了一条且仍然存在，则保留；否则置空
    if (
      currentConversationId.value &&
      parsed.some((item) => item.id === currentConversationId.value)
    ) {
      // 保留当前选中
      return
    }

    chatStore.setCurrentConversationId(null)
    chatStore.setMessages([])
  } catch (error: unknown) {
    ElMessage.error(extractErrorMessage(error) || '对话列表加载失败')
  } finally {
    if (!silent) {
      conversationLoading.value = false
    }
  }
}

async function handleSelectConversation(conversationId: string) {
  if (!currentAppId.value) {
    return
  }

  chatStore.setCurrentConversationId(conversationId)
  chatStore.setUploadedFiles([])
  await loadMessages(conversationId)
}

async function loadMessages(conversationId: string) {
  if (!currentAppId.value) {
    return
  }

  messageLoading.value = true
  try {
    const response = await conversationApi.messages(conversationId, {
      appId: currentAppId.value,
      limit: 100
    })

    resetMessageActionsState()
    chatStore.setMessages(normalizeMessages(response))
    requestStickBottom('auto')
  } catch (error: unknown) {
    chatStore.setMessages([])
    ElMessage.error(extractErrorMessage(error) || '消息列表加载失败')
  } finally {
    messageLoading.value = false
  }
}

async function handleDeleteConversation(conversationId: string) {
  if (!currentAppId.value || deletingConversationId.value) {
    return
  }

  deletingConversationId.value = conversationId
  try {
    await conversationApi.delete(conversationId, currentAppId.value)

    const previous = [...conversations.value]
    conversations.value = previous.filter((item) => item.id !== conversationId)

    if (currentConversationId.value === conversationId) {
      // ★ 删除当前会话后回到新对话状态
      chatStore.setCurrentConversationId(null)
      chatStore.setMessages([])
      chatStore.setTaskId(null)
    }

    ElMessage.success('会话删除成功')
  } catch (error: unknown) {
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
  resetMessageActionsState()
  inputValue.value = ''
  requestStickBottom('auto')
}

// ★ 新增：点击提示词卡片时填入输入框并聚焦
function handleUsePrompt(prompt: string) {
  inputValue.value = prompt
  nextTick(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>('.input-panel .el-textarea__inner')
    textarea?.focus()
  })
}

async function handleFeedback(message: ChatMessage, rating: FeedbackRating) {
  if (!currentAppId.value || !message.backendMessageId) return
  const backendMessageId = message.backendMessageId
  if (feedbackByMessageId.value[backendMessageId] === rating) return
  try {
    feedbackByMessageId.value = { ...feedbackByMessageId.value, [backendMessageId]: rating }
    await chatApi.feedback(currentAppId.value, backendMessageId, rating)
    ElMessage.success('收到啦！您的建议将帮助我们变得更好。')
  } catch (error: unknown) {
    const rollback = { ...feedbackByMessageId.value }
    if (rollback[backendMessageId] === rating) delete rollback[backendMessageId]
    feedbackByMessageId.value = rollback
    ElMessage.error(extractErrorMessage(error) || '哎呀，这里好像有点小问题')
  }
}

async function loadSuggestedQuestions(message: ChatMessage) {
  if (!currentAppId.value || !message.backendMessageId) return
  const backendMessageId = message.backendMessageId
  if (
    suggestedLoadingByMessageId.value[backendMessageId] ||
    suggestedByMessageId.value[backendMessageId]?.length
  ) {
    return
  }
  suggestedLoadingByMessageId.value = {
    ...suggestedLoadingByMessageId.value,
    [backendMessageId]: true
  }
  try {
    const payload = await chatApi.suggested(currentAppId.value, backendMessageId)
    const questions = collectStringList(payload).slice(0, 6)
    if (questions.length > 0) {
      suggestedByMessageId.value = {
        ...suggestedByMessageId.value,
        [backendMessageId]: questions
      }
    }
  } catch (error: unknown) {
    ElMessage.warning(extractErrorMessage(error) || 'Failed to load suggestions')
  } finally {
    const next = { ...suggestedLoadingByMessageId.value }
    delete next[backendMessageId]
    suggestedLoadingByMessageId.value = next
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
  if (!canStop.value || !currentAppId.value || !chatStore.getTaskId) return
  stopLoading.value = true
  try {
    await chatApi.stopGeneration(currentAppId.value, chatStore.getTaskId)
  } catch (error: unknown) {
    ElMessage.warning(extractErrorMessage(error) || 'Stop request failed')
  } finally {
    streamController.value?.abort()
    streamController.value = null
    chatStore.setGenerating(false)
    chatStore.setTaskId(null)
    if (activeAssistantMessageId.value) {
      updateMessageById(activeAssistantMessageId.value, (msg) => ({ ...msg, isThinking: false }))
    }
    activeAssistantMessageId.value = null
    stopLoading.value = false
  }
}

async function handleSend() {
  if (!canSend.value || !currentAppId.value) {
    return
  }

  const question = inputValue.value.trim()
  if (!question) {
    return
  }
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
    backendMessageId: undefined
  })

  requestStickBottom('smooth')

  const previousConversationId = currentConversationId.value
  const controller = new AbortController()

  streamController.value = controller
  activeAssistantMessageId.value = assistantMessageId
  chatStore.setGenerating(true)
  chatStore.setTaskId(null)

  inputValue.value = ''
  let sendSucceeded = false

  try {
    await chatApi.streamChat(
      currentAppId.value,
      {
        query: question,
        conversationId: previousConversationId || undefined,
        inputs: {},
        files
      },
      {
        signal: controller.signal,
        handlers: {
          onRawEvent: (event) => {
            if (event.event === 'message') {
              const payload = normalizeStreamPayload(event.data)
              updateStreamMeta(payload)
              const backendMessageId = extractBackendMessageId(payload)

              const chunkType = extractChunkType(payload)

              if (chunkType === 'thought_start') {
                const thoughtDelta = extractThoughtText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  thought: `${msg.thought}${thoughtDelta}`,
                  isThinking: true,
                  backendMessageId: backendMessageId || msg.backendMessageId
                }))
              } else if (chunkType === 'thought') {
                const thoughtDelta = extractThoughtText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  thought: `${msg.thought}${thoughtDelta}`,
                  isThinking: true,
                  backendMessageId: backendMessageId || msg.backendMessageId
                }))
              } else if (chunkType === 'thought_end') {
                const thoughtDelta = extractThoughtText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  thought: `${msg.thought}${thoughtDelta}`,
                  isThinking: false,
                  backendMessageId: backendMessageId || msg.backendMessageId
                }))
              } else if (chunkType === 'text') {
                const textDelta = extractContentText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  content: `${msg.content}${textDelta}`,
                  isThinking: false,
                  backendMessageId: backendMessageId || msg.backendMessageId
                }))
              } else {
                const fallbackText = extractContentText(payload)
                if (fallbackText) {
                  updateMessageById(assistantMessageId, (msg) => ({
                    ...msg,
                    content: `${msg.content}${fallbackText}`,
                    isThinking: false,
                    backendMessageId: backendMessageId || msg.backendMessageId
                  }))
                }
              }
            } else if (event.event === 'message_replace') {
              const payload = normalizeStreamPayload(event.data)
              updateStreamMeta(payload)
              const backendMessageId = extractBackendMessageId(payload)
              const content = extractContentText(payload)
              if (content) {
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  content,
                  isThinking: false,
                  backendMessageId: backendMessageId || msg.backendMessageId
                }))
              }
            } else if (event.event === 'message_end') {
              const payload = normalizeStreamPayload(event.data)
              updateStreamMeta(payload)
              const backendMessageId = extractBackendMessageId(payload)
              const finalText = extractContentText(payload)
              updateMessageById(assistantMessageId, (msg) => ({
                ...msg,
                content: msg.content || finalText,
                isThinking: false,
                backendMessageId: backendMessageId || msg.backendMessageId
              }))
              const assistantMessage = getMessageById(assistantMessageId)
              if (assistantMessage?.backendMessageId) {
                void loadSuggestedQuestions(assistantMessage)
              }
            } else if (event.event === 'error') {
              const payload = normalizeStreamPayload(event.data)
              const message = extractErrorMessage(payload)
              updateMessageById(assistantMessageId, (msg) => ({
                ...msg,
                content: msg.content || `请求失败：${message}`,
                isThinking: false
              }))
            }
          },
          onError: (error) => {
            const message = extractErrorMessage(error)
            const current = getMessageById(assistantMessageId)
            if (!current || !current.content) {
              updateMessageById(assistantMessageId, (msg) => ({
                ...msg,
                content: `请求失败：${message}`,
                isThinking: false
              }))
            }
          }
        }
      }
    )
    sendSucceeded = true

    const latestConversationId = chatStore.getCurrentConversationId
    if (!previousConversationId && latestConversationId) {
      // ★ 核心修复：传 silent=true，静默刷新侧边栏列表，不触发 loading 状态，彻底消除抖动
      await loadConversations(latestConversationId, false, true)
    }
  } catch (error: unknown) {
    if (!controller.signal.aborted) {
      const message = extractErrorMessage(error)
      const current = getMessageById(assistantMessageId)
      if (!current || !current.content) {
        updateMessageById(assistantMessageId, (msg) => ({
          ...msg,
          content: `请求失败：${message}`,
          isThinking: false
        }))
      }
      ElMessage.error(message)
    }
  } finally {
    if (streamController.value === controller) {
      streamController.value = null
    }
    if (activeAssistantMessageId.value === assistantMessageId) {
      activeAssistantMessageId.value = null
    }
    chatStore.setGenerating(false)
    if (sendSucceeded && attachedFiles.length > 0) {
      chatStore.setUploadedFiles([])
    }
  }
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void handleSend()
  }
}

onMounted(async () => {
  chatStore.setChatMode('dify')
  // ★ 每次进入页面时先重置为新对话状态
  chatStore.setCurrentConversationId(null)
  chatStore.setMessages([])
  chatStore.setTaskId(null)
  chatStore.setUploadedFiles([])
  resetMessageActionsState()
  inputValue.value = ''

  await loadApps()
  requestStickBottom('auto')
})

onBeforeUnmount(() => {
  if (streamController.value) {
    streamController.value.abort()
    streamController.value = null
  }
  activeAssistantMessageId.value = null
  stopLoading.value = false
  releaseAudioResources()
  chatStore.setGenerating(false)
})
</script>

<template>
  <div class="chat-page">
    <!-- ═══ Top Header ═══ -->
    <header class="chat-header">
      <div class="header-accent-line"></div>
      <div class="header-center">
        <svg
          class="header-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0ea5e9"
          stroke-width="2"
        >
          <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
          <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.5" />
        </svg>
        <span class="header-title-text">AI Hub Chat</span>
      </div>
    </header>

    <div class="chat-body">
      <!-- ═══ Sidebar ═══ -->
      <aside class="chat-sidebar">
        <section class="sidebar-section app-section">
          <div class="section-header">
            <span class="section-title">应用列表</span>
            <el-button text class="section-action" @click="loadApps">
              <el-icon><Refresh /></el-icon>
            </el-button>
          </div>

          <el-scrollbar class="section-scroll">
            <div v-if="appLoading" class="tip-text">正在加载应用...</div>
            <template v-else>
              <div
                v-for="app in apps"
                :key="app.id"
                class="app-item"
                :class="{ active: app.id === currentAppId }"
                @click="handleSelectApp(app.id)"
              >
                <div class="app-item-indicator"></div>
                <div class="app-item-body">
                  <div class="item-title">{{ app.appName }}</div>
                  <div class="item-sub">{{ app.appCode }}</div>
                </div>
              </div>
              <el-empty v-if="apps.length === 0" description="暂无可用应用" :image-size="60" />
            </template>
          </el-scrollbar>
        </section>

        <section class="sidebar-section conversation-section">
          <div class="section-header">
            <span class="section-title">历史对话</span>
            <el-button text class="section-action new-btn" @click="handleNewConversation">
              <el-icon><Plus /></el-icon>
              <span>新对话</span>
            </el-button>
          </div>

          <el-scrollbar class="section-scroll">
            <!-- ★ 修复：loading 状态只在非静默加载时才显示（初次加载、切换应用），
                 发送消息后的后台刷新不会触发此分支，侧边栏内容不会闪烁消失 -->
            <div v-if="conversationLoading" class="tip-text">正在加载对话...</div>
            <template v-else>
              <div
                v-for="conversation in conversations"
                :key="conversation.id"
                class="conversation-item"
                :class="{ active: conversation.id === currentConversationId }"
                @click="handleSelectConversation(conversation.id)"
              >
                <div class="conv-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <div class="conv-body">
                  <div class="item-title">{{ conversation.name }}</div>
                  <div class="item-sub">{{ formatTime(conversation.updatedAt) }}</div>
                </div>
                <div class="conversation-action" @click.stop>
                  <el-popconfirm
                    title="确认删除该会话？"
                    confirm-button-text="删除"
                    cancel-button-text="取消"
                    @confirm="handleDeleteConversation(conversation.id)"
                  >
                    <template #reference>
                      <el-button
                        text
                        type="danger"
                        :loading="deletingConversationId === conversation.id"
                        class="conversation-delete-btn"
                        @click.stop
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
              <el-empty
                v-if="conversations.length === 0"
                description="暂无历史对话"
                :image-size="60"
              />
            </template>
          </el-scrollbar>
        </section>
      </aside>

      <!-- ═══ Chat Main ═══ -->
      <main class="chat-main">
        <div class="chat-main-header">
          <div class="main-header-left">
            <span class="main-header-dot"></span>
            <span class="main-header-title">
              {{ currentConversation?.name || '新对话' }}
            </span>
            <span v-if="currentApp" class="main-header-app"> · {{ currentApp.appName }} </span>
          </div>
          <div v-if="!currentConversationId" class="main-header-status">
            <span class="status-badge">NEW SESSION</span>
          </div>
        </div>

        <div class="message-panel">
          <el-scrollbar
            ref="messageScrollbarRef"
            class="message-scroll"
            @scroll="handleMessageScroll"
          >
            <div ref="messageListRef" class="message-scroll-inner">
              <!-- ═══ 空状态：欢迎屏 + 提示词 ═══ -->
              <div v-if="showWelcome" class="welcome-screen">
                <!-- 背景装饰 -->
                <div class="welcome-bg-grid"></div>
                <div class="welcome-bg-glow"></div>

                <div class="welcome-content">
                  <!-- Logo + 标题 -->
                  <div class="welcome-logo">
                    <svg viewBox="0 0 48 48" fill="none" stroke="#0ea5e9" stroke-width="2">
                      <path d="M24 4 L44 14 L44 34 L24 44 L4 34 L4 14 Z" />
                      <path d="M24 4 L24 44 M4 14 L44 34 M44 14 L4 34" opacity="0.4" />
                    </svg>
                    <div class="welcome-logo-pulse"></div>
                  </div>

                  <h2 class="welcome-title">
                    你好，<span class="welcome-title-accent">{{ displayName || '开发者' }}</span>
                  </h2>
                  <p class="welcome-subtitle">
                    我是 AI Hub 智能助手，可以为你提供对话、分析、创作和代码生成等服务
                  </p>

                  <!-- 提示词卡片 -->
                  <div v-if="currentAppId" class="prompt-grid">
                    <div
                      v-for="(item, idx) in promptSuggestions"
                      :key="idx"
                      class="prompt-card"
                      :style="{ animationDelay: `${0.1 + idx * 0.06}s` }"
                      @click="handleUsePrompt(item.prompt)"
                    >
                      <div class="prompt-icon-wrap" :class="`prompt-icon--${item.icon}`">
                        <!-- spark -->
                        <svg
                          v-if="item.icon === 'spark'"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path
                            d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"
                          />
                        </svg>
                        <!-- code -->
                        <svg
                          v-else-if="item.icon === 'code'"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                        </svg>
                        <!-- doc -->
                        <svg
                          v-else-if="item.icon === 'doc'"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <!-- idea -->
                        <svg
                          v-else
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path
                            d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"
                          />
                        </svg>
                      </div>
                      <div class="prompt-body">
                        <div class="prompt-title">{{ item.title }}</div>
                        <div class="prompt-desc">{{ item.description }}</div>
                      </div>
                      <svg
                        class="prompt-arrow"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  <!-- 底部说明 -->
                  <div class="welcome-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>在下方输入问题开始对话，支持文件上传与语音输入</span>
                  </div>
                </div>
              </div>

              <div v-else-if="messageLoading" class="tip-text">正在加载消息...</div>

              <template v-else>
                <el-empty v-if="!currentAppId" description="请先在左侧选择应用" :image-size="88" />

                <div v-else class="message-list">
                  <div
                    v-for="message in messages"
                    :key="message.id"
                    class="message-row"
                    :class="`role-${message.role}`"
                  >
                    <div v-if="message.role !== 'user'" class="message-avatar avatar-ai">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
                        <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.5" />
                      </svg>
                    </div>
                    <div v-else class="message-avatar avatar-user">
                      {{ displayName ? displayName.charAt(0).toUpperCase() : 'U' }}
                    </div>

                    <div class="message-main">
                      <div class="message-meta">
                        <span class="message-meta-role">{{ roleLabel(message.role) }}</span>
                        <span class="message-meta-time">{{ formatTime(message.createdAt) }}</span>
                      </div>

                      <div class="message-bubble">
                        <template v-if="message.role === 'assistant'">
                          <details
                            v-if="message.thought || message.isThinking"
                            class="thought-panel"
                            :open="message.isThinking"
                          >
                            <summary class="thought-summary">
                              <span class="thinking-icon" :class="{ active: message.isThinking }">
                                <svg viewBox="0 0 48 48" aria-hidden="true">
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
                              <span class="thought-summary-text">
                                {{ message.isThinking ? '深度思考中...' : '查看思考过程' }}
                              </span>
                            </summary>

                            <div
                              class="thought-content"
                              v-html="renderMarkdown(message.thought || '正在组织思路...')"
                            ></div>
                          </details>

                          <div
                            v-if="message.content"
                            class="assistant-content"
                            v-html="renderMarkdown(message.content)"
                          ></div>

                          <div
                            v-if="message.backendMessageId && !message.isThinking"
                            class="assistant-action-row"
                          >
                            <div class="feedback-actions">
                              <!-- Like 按钮 -->
                              <el-button
                                text
                                size="small"
                                class="feedback-btn like"
                                :class="{ active: getFeedbackValue(message) === 'like' }"
                                @click="handleFeedback(message, 'like')"
                              >
                                <el-icon :size="16">
                                  <!-- 这里是大拇指向上 SVG -->
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <path
                                      d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
                                    />
                                  </svg>
                                </el-icon>
                                <span class="btn-text">赞</span>
                              </el-button>

                              <!-- Dislike 按钮 -->
                              <el-button
                                text
                                size="small"
                                class="feedback-btn dislike"
                                :class="{ active: getFeedbackValue(message) === 'dislike' }"
                                @click="handleFeedback(message, 'dislike')"
                              >
                                <el-icon :size="16">
                                  <!-- 这里是大拇指向下 SVG -->
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <path
                                      d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"
                                    />
                                  </svg>
                                </el-icon>
                                <span class="btn-text">踩</span>
                              </el-button>
                            </div>

                            <div
                              v-if="getSuggestedQuestions(message).length > 0"
                              class="suggested-question-list"
                            >
                              <button
                                v-for="question in getSuggestedQuestions(message)"
                                :key="`${message.id}-${question}`"
                                type="button"
                                class="suggested-question-chip"
                                @click="handlePickSuggestedQuestion(question)"
                              >
                                {{ question }}
                              </button>
                            </div>
                          </div>
                        </template>

                        <template v-else>
                          <div
                            v-if="message.role === 'user' && message.fileReferences?.length"
                            class="user-file-reference-list"
                          >
                            <div
                              v-for="fileRef in message.fileReferences"
                              :key="fileRef.id"
                              class="user-file-reference-chip"
                              :title="`${fileRef.name}${fileRef.extension ? `.${fileRef.extension}` : ''}`"
                            >
                              <span class="user-file-reference-name">{{ fileRef.name }}</span>
                              <span v-if="fileRef.extension" class="user-file-reference-ext">
                                .{{ fileRef.extension }}
                              </span>
                            </div>
                          </div>
                          <div class="plain-content">{{ message.content }}</div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </el-scrollbar>
        </div>

        <!-- ═══ Input Panel ═══ -->
        <div class="input-panel">
          <input
            ref="fileInputRef"
            class="hidden-file-input"
            type="file"
            multiple
            accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.mp3,.wav,.m4a,.mp4"
            @change="handleFileInputChange"
          />

          <div v-if="uploadedFiles.length > 0" class="uploaded-file-list">
            <div v-for="file in uploadedFiles" :key="file.fileId" class="file-chip">
              <svg
                class="file-chip-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span class="file-chip-name">{{ file.fileName }}</span>
              <el-button text class="file-chip-remove" @click="removeUploadedFile(file.fileId)">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>

          <div class="input-wrapper">
            <el-input
              v-model="inputValue"
              type="textarea"
              :rows="3"
              resize="none"
              placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              @keydown="handleInputKeydown"
            />
          </div>

          <div class="input-actions">
            <div class="input-actions-left">
              <el-button text :loading="uploadLoading" @click="triggerFileSelect">
                <el-icon><Paperclip /></el-icon>
                上传文件
              </el-button>

              <el-button
                v-if="canUseVoice"
                text
                :type="isRecording ? 'danger' : undefined"
                :loading="audioRecognizing"
                @mousedown.prevent="startVoiceInput"
                @mouseup.prevent="stopVoiceInput"
                @mouseleave.prevent="stopVoiceInput"
                @touchstart.prevent="startVoiceInput"
                @touchend.prevent="stopVoiceInput"
              >
                <el-icon><Microphone /></el-icon>
                {{ isRecording ? '松开结束录音' : audioRecognizing ? '语音识别中' : '按住说话' }}
              </el-button>
            </div>

            <div class="input-actions-right">
              <span class="input-hint-text">Enter 发送 · Shift+Enter 换行</span>
              <el-button
                :type="isGenerating ? 'danger' : 'primary'"
                class="send-btn"
                :loading="isGenerating ? stopLoading : false"
                :disabled="isGenerating ? !canStop : !canSend"
                @click="isGenerating ? handleStopGeneration() : handleSend()"
              >
                {{ isGenerating ? '生成中...' : '发送' }}
              </el-button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
@keyframes onlinePulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@keyframes welcomeFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes logoFloat {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }
}

@keyframes logoPulse {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(0.8);
  }

  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes thumbs-up-pop {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.3) rotate(-10deg);
  }

  100% {
    transform: scale(1);
  }
}

/* ═══════════════════════════════════════════════════
 * Keyframes
 * ═══════════════════════════════════════════════════ */
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
    opacity: 0.92;
    transform: scale(0.85);
  }

  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 窄屏下隐藏副标题 */
@media (width <= 720px) {
  .back-button {
    padding: 6px 14px 6px 10px;
    gap: 8px;
  }

  .back-button-sub {
    display: none;
  }

  .back-button-icon {
    width: 22px;
    height: 22px;
  }
}

/* 极窄屏下只保留图标 */
@media (width <= 520px) {
  .back-button-text {
    display: none;
  }

  .back-button {
    padding: 6px;
  }
}

@media (width <= 720px) {
  .prompt-grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 960px) {
  .input-hint-text {
    display: none;
  }

  .input-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .input-actions-left {
    justify-content: flex-start;
  }

  .input-actions-right {
    width: 100%;
    justify-content: flex-end;
  }

  .send-btn {
    width: 100%;
  }
}

.chat-page {
  display: flex;
  width: 100%;
  height: calc(100dvh - 104px);
  min-height: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  background: #f1f5f9;
  flex-direction: column;
}

/* ═══════════════════════════════════════════════════
 * Top Header - 科技感极简顶栏
 * ═══════════════════════════════════════════════════ */
.chat-header {
  position: relative;
  display: flex;
  height: 56px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgb(15 23 42 / 4%);
  align-items: center;
  flex-shrink: 0;
}

/* 顶部青色装饰细线 */
.header-accent-line {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgb(14 165 233 / 30%) 30%,
    rgb(14 165 233 / 50%) 50%,
    rgb(14 165 233 / 30%) 70%,
    transparent 100%
  );
}

/* ═══════════════════════════════════════════════════
 * Back Button - 显眼的返回管理后台按钮
 * ═══════════════════════════════════════════════════ */
.back-button {
  position: relative;
  display: inline-flex;
  padding: 6px 16px 6px 12px;
  overflow: hidden;
  font-family: inherit;
  cursor: pointer;
  background: linear-gradient(135deg, rgb(14 165 233 / 8%) 0%, rgb(56 189 248 / 4%) 100%);
  border: 1px solid rgb(14 165 233 / 25%);
  border-radius: 999px;
  outline: none;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  align-items: center;
  gap: 10px;
}

/* 左侧青色指示条 */
.back-button::before {
  position: absolute;
  top: 20%;
  bottom: 20%;
  left: 0;
  width: 2px;
  background: #0ea5e9;
  border-radius: 0 2px 2px 0;
  content: '';
  box-shadow: 0 0 6px rgb(14 165 233 / 60%);
  transition: all 0.22s ease;
}

/* 内部流光条（hover 时出现） */
.back-button::after {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgb(56 189 248 / 15%), transparent);
  content: '';
  transform: skewX(-20deg);
  transition: left 0.6s ease;
}

.back-button:hover {
  background: linear-gradient(135deg, rgb(14 165 233 / 14%) 0%, rgb(56 189 248 / 8%) 100%);
  border-color: rgb(14 165 233 / 50%);
  transform: translateX(-2px);
  box-shadow:
    0 4px 14px rgb(14 165 233 / 18%),
    0 0 0 3px rgb(14 165 233 / 8%);
}

.back-button:hover::before {
  top: 10%;
  bottom: 10%;
  background: #38bdf8;
  box-shadow: 0 0 10px rgb(56 189 248 / 80%);
}

.back-button:hover::after {
  left: 120%;
}

.back-button:active {
  transform: translateX(-2px) scale(0.98);
}

.back-button:focus-visible {
  box-shadow:
    0 0 0 3px rgb(14 165 233 / 25%),
    0 4px 14px rgb(14 165 233 / 20%);
}

/* 箭头图标 */
.back-button-icon {
  display: inline-flex;
  width: 26px;
  height: 26px;
  color: #0ea5e9;
  background: #fff;
  border: 1px solid rgb(14 165 233 / 30%);
  border-radius: 50%;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.back-button-icon svg {
  width: 14px;
  height: 14px;
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-button:hover .back-button-icon {
  color: #fff;
  background: linear-gradient(135deg, #0ea5e9, #38bdf8);
  border-color: transparent;
  box-shadow: 0 2px 8px rgb(14 165 233 / 40%);
}

.back-button:hover .back-button-icon svg {
  transform: translateX(-3px);
}

/* 文字区 */
.back-button-text {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  line-height: 1;
}

.back-button-label {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #0369a1;
}

.back-button-sub {
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #0ea5e9;
  opacity: 0.7;
}

.header-center {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
}

.header-icon {
  filter: drop-shadow(0 0 6px rgb(14 165 233 / 40%));
}

.header-title-text {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #0f172a;
}

.header-right {
  justify-self: end;
}

.header-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  background: rgb(14 165 233 / 6%);
  border: 1px solid rgb(14 165 233 / 15%);
  border-radius: 999px;
}

.user-online-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 5px rgb(16 185 129 / 60%);
  animation: onlinePulse 2.5s ease-in-out infinite;
}

.user-display-name {
  font-size: 12px;
  font-weight: 500;
  color: #0369a1;
}

/* ═══════════════════════════════════════════════════
 * Body
 * ═══════════════════════════════════════════════════ */
.chat-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

/* ═══════════════════════════════════════════════════
 * Sidebar - 浅色但带品牌感
 * ═══════════════════════════════════════════════════ */
.chat-sidebar {
  display: flex;
  width: 280px;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-section {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.app-section {
  height: 42%;
  border-bottom: 1px solid #e2e8f0;
}

.conversation-section {
  flex: 1;
}

.section-header {
  display: flex;
  height: 44px;
  padding: 0 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.section-title {
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #64748b;
  text-transform: uppercase;
}

.section-action {
  font-size: 12px;
  color: #64748b !important;
}

.section-action :deep(.el-icon) {
  margin-right: 2px;
}

.section-action.new-btn :deep(span + span) {
  margin-left: 2px;
}

:deep(.section-action.is-text:not(.is-disabled):hover) {
  color: #0ea5e9 !important;
  background: rgb(14 165 233 / 8%) !important;
}

.section-scroll {
  flex: 1;
  min-height: 0;
  padding: 6px 8px;
}

/* ── App Item ── */
.app-item {
  position: relative;
  display: flex;
  padding: 10px 12px;
  margin-bottom: 3px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s ease;
  align-items: center;
  gap: 10px;
}

.app-item-indicator {
  width: 3px;
  height: 26px;
  background: #cbd5e1;
  border-radius: 2px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.app-item:hover {
  background: #f1f5f9;
}

.app-item:hover .app-item-indicator {
  background: #0ea5e9;
}

.app-item.active {
  background: linear-gradient(90deg, rgb(14 165 233 / 10%), rgb(14 165 233 / 2%));
  border-color: rgb(14 165 233 / 25%);
}

.app-item.active .app-item-indicator {
  background: #0ea5e9;
  box-shadow: 0 0 6px rgb(14 165 233 / 50%);
}

.app-item-body {
  flex: 1;
  min-width: 0;
}

/* ── Conversation Item ── */
.conversation-item {
  position: relative;
  display: flex;
  padding: 10px 12px;
  padding-right: 36px;
  margin-bottom: 3px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s ease;
  align-items: flex-start;
  gap: 10px;
}

.conv-icon {
  display: flex;
  width: 28px;
  height: 28px;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  transition: all 0.2s ease;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conv-icon svg {
  width: 14px;
  height: 14px;
}

.conversation-item:hover {
  background: #f1f5f9;
}

.conversation-item:hover .conv-icon {
  color: #0ea5e9;
  background: rgb(14 165 233 / 8%);
  border-color: rgb(14 165 233 / 20%);
}

.conversation-item.active {
  background: linear-gradient(90deg, rgb(14 165 233 / 10%), rgb(14 165 233 / 2%));
  border-color: rgb(14 165 233 / 25%);
}

.conversation-item.active .conv-icon {
  color: #0ea5e9;
  background: rgb(14 165 233 / 12%);
  border-color: rgb(14 165 233 / 30%);
}

.conv-body {
  flex: 1;
  min-width: 0;
}

.conversation-action {
  position: absolute;
  top: 8px;
  right: 6px;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.conversation-item:hover .conversation-action,
.conversation-item.active .conversation-action {
  opacity: 1;
}

.conversation-delete-btn {
  padding: 4px;
}

.item-title {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-item.active .item-title,
.conversation-item.active .item-title {
  color: #0369a1;
}

.item-sub {
  margin-top: 3px;
  overflow: hidden;
  font-size: 11px;
  color: #94a3b8;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════
 * Chat Main
 * ═══════════════════════════════════════════════════ */
.chat-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  background: #f8fafc;
  flex: 1;
  flex-direction: column;
}

.chat-main-header {
  display: flex;
  height: 46px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.main-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.main-header-dot {
  width: 6px;
  height: 6px;
  background: #0ea5e9;
  border-radius: 50%;
  box-shadow: 0 0 6px rgb(14 165 233 / 50%);
  flex-shrink: 0;
}

.main-header-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-header-app {
  font-size: 12px;
  color: #94a3b8;
}

.status-badge {
  padding: 3px 10px;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: #0ea5e9;
  background: rgb(14 165 233 / 8%);
  border: 1px solid rgb(14 165 233 / 20%);
  border-radius: 4px;
}

/* ═══════════════════════════════════════════════════
 * Welcome Screen - 新对话空状态欢迎屏
 * ═══════════════════════════════════════════════════ */
.welcome-screen {
  position: relative;
  display: flex;
  min-height: 100%;
  padding: 40px 24px;
  overflow: hidden;
  align-items: center;
  justify-content: center;
}

/* 超大浅色网格背景 */
.welcome-bg-grid {
  position: absolute;
  pointer-events: none;
  background-image: linear-gradient(rgb(14 165 233 / 5%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(14 165 233 / 5%) 1px, transparent 1px);
  background-size: 40px 40px;
  inset: 0;
  mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
}

.welcome-bg-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 500px;
  height: 500px;
  pointer-events: none;
  background: radial-gradient(circle, rgb(14 165 233 / 10%) 0%, transparent 70%);
  filter: blur(40px);
  transform: translate(-50%, -50%);
}

.welcome-content {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 720px;
  text-align: center;
  animation: welcomeFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.welcome-logo {
  position: relative;
  display: flex;
  width: 64px;
  height: 64px;
  margin: 0 auto 24px;
  align-items: center;
  justify-content: center;
}

.welcome-logo svg {
  position: relative;
  z-index: 1;
  width: 48px;
  height: 48px;
  filter: drop-shadow(0 0 12px rgb(14 165 233 / 50%));
  animation: logoFloat 4s ease-in-out infinite;
}

.welcome-logo-pulse {
  position: absolute;
  width: 64px;
  height: 64px;
  background: radial-gradient(circle, rgb(14 165 233 / 30%) 0%, transparent 70%);
  border-radius: 50%;
  animation: logoPulse 3s ease-in-out infinite;
}

.welcome-title {
  margin-bottom: 8px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.welcome-title-accent {
  background: linear-gradient(135deg, #0ea5e9 0%, #22d3ee 50%, #38bdf8 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-subtitle {
  max-width: 480px;
  margin-right: auto;
  margin-bottom: 32px;
  margin-left: auto;
  font-size: 14px;
  line-height: 1.6;
  color: #64748b;
}

/* ── 提示词网格 ── */
.prompt-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 28px;
  text-align: left;
}

.prompt-card {
  position: relative;
  display: flex;
  padding: 14px 16px;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  opacity: 0;
  animation: cardFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  transition: all 0.25s ease;
  align-items: center;
  gap: 12px;
}

.prompt-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #0ea5e9, transparent);
  border-radius: 12px 12px 0 0;
  content: '';
  opacity: 0;
  transition: opacity 0.25s;
}

.prompt-card:hover {
  border-color: #0ea5e9;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgb(14 165 233 / 12%);
}

.prompt-card:hover::before {
  opacity: 1;
}

.prompt-icon-wrap {
  display: flex;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  transition: all 0.25s ease;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.prompt-icon-wrap svg {
  width: 18px;
  height: 18px;
}

.prompt-icon--spark {
  color: #0ea5e9;
  background: linear-gradient(135deg, rgb(14 165 233 / 10%), rgb(56 189 248 / 5%));
  border: 1px solid rgb(14 165 233 / 20%);
}

.prompt-icon--code {
  color: #0891b2;
  background: linear-gradient(135deg, rgb(34 211 238 / 10%), rgb(103 232 249 / 5%));
  border: 1px solid rgb(34 211 238 / 20%);
}

.prompt-icon--doc {
  color: #059669;
  background: linear-gradient(135deg, rgb(16 185 129 / 10%), rgb(52 211 153 / 5%));
  border: 1px solid rgb(16 185 129 / 20%);
}

.prompt-icon--idea {
  color: #d97706;
  background: linear-gradient(135deg, rgb(245 158 11 / 10%), rgb(251 191 36 / 5%));
  border: 1px solid rgb(245 158 11 / 20%);
}

.prompt-card:hover .prompt-icon-wrap {
  transform: scale(1.05);
}

.prompt-body {
  flex: 1;
  min-width: 0;
}

.prompt-title {
  margin-bottom: 2px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #0f172a;
}

.prompt-desc {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.prompt-arrow {
  width: 16px;
  height: 16px;
  color: #cbd5e1;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.prompt-card:hover .prompt-arrow {
  color: #0ea5e9;
  transform: translateX(3px);
}

/* 底部说明 */
.welcome-hint {
  display: inline-flex;
  padding: 8px 14px;
  font-size: 12px;
  color: #64748b;
  background: rgb(14 165 233 / 4%);
  border: 1px solid rgb(14 165 233 / 12%);
  border-radius: 999px;
  align-items: center;
  gap: 8px;
}

.welcome-hint svg {
  width: 14px;
  height: 14px;
  color: #0ea5e9;
}

/* ═══════════════════════════════════════════════════
 * Message Panel
 * ═══════════════════════════════════════════════════ */
.message-panel {
  flex: 1;
  min-height: 0;
}

.message-scroll {
  width: 100%;
  height: 100%;
}

.message-scroll-inner {
  min-height: 100%;
}

.message-list {
  display: flex;
  max-width: 960px;
  padding: 24px 24px 8px;
  margin: 0 auto;
  flex-direction: column;
  gap: 20px;
}

/* ═══════════════════════════════════════════════════
 * Message Row
 * ═══════════════════════════════════════════════════ */
.message-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  max-width: 82%;
}

.message-row.role-user {
  flex-direction: row-reverse;
  margin-left: auto;
}

.message-row.role-assistant,
.message-row.role-system {
  margin-right: auto;
}

.message-main {
  flex: 1;
  min-width: 0;
}

/* ── Avatars ── */
.message-avatar {
  display: flex;
  width: 34px;
  height: 34px;
  margin-top: 22px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border-radius: 9px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-ai {
  color: #38bdf8;
  background: linear-gradient(135deg, #0c1628 0%, #0f172a 50%, #1e293b 100%);
  border: 1px solid rgb(56 189 248 / 30%);
  box-shadow: 0 2px 8px rgb(15 23 42 / 20%);
}

.avatar-ai svg {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 0 4px rgb(56 189 248 / 40%));
}

.avatar-user {
  color: #fff;
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%);
  box-shadow: 0 2px 8px rgb(14 165 233 / 35%);
}

/* ── Message Meta ── */
.message-meta {
  display: flex;
  margin-bottom: 6px;
  font-size: 11px;
  line-height: 1;
  color: #94a3b8;
  white-space: nowrap;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
}

.message-meta-role,
.message-meta-time {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.message-meta-role {
  font-weight: 600;
  color: #64748b;
}

.message-row.role-user .message-meta {
  justify-content: flex-end;
  text-align: right;
}

/* ── Message Bubble ── */
.message-bubble {
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.7;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 3%);
}

.role-user .message-bubble {
  color: #fff;
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
  border-color: transparent;
  box-shadow: 0 2px 10px rgb(14 165 233 / 30%);
}

.plain-content {
  white-space: pre-wrap;
}

/* ── File references ── */
.user-file-reference-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.role-user .user-file-reference-list {
  justify-content: flex-end;
}

.user-file-reference-chip {
  display: inline-flex;
  max-width: 240px;
  min-height: 24px;
  padding: 2px 8px 2px 6px;
  background: rgb(255 255 255 / 15%);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 999px;
  align-items: center;
  gap: 4px;
}

.user-file-reference-chip::before {
  width: 5px;
  height: 5px;
  background: rgb(255 255 255 / 80%);
  border-radius: 50%;
  content: '';
  flex-shrink: 0;
}

.user-file-reference-name {
  max-width: 164px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  color: rgb(255 255 255 / 95%);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-file-reference-ext {
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: rgb(255 255 255 / 75%);
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════
 * Thought Panel - 思考过程面板（科技蓝）
 * ═══════════════════════════════════════════════════ */
.thought-panel {
  margin-bottom: 10px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid rgb(14 165 233 / 20%);
  border-radius: 8px;
}

.thought-summary {
  display: inline-flex;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #0284c7;
  list-style: none;
  cursor: pointer;
  user-select: none;
  align-items: center;
  gap: 8px;
}

.thought-summary::-webkit-details-marker {
  display: none;
}

.thought-content {
  padding: 10px 12px 10px 16px;
  margin: 0 12px 10px;
  font-size: 13px;
  color: #475569;
  word-break: break-all;
  background: #fff;
  border-left: 3px solid #0ea5e9;
  border-radius: 6px;
  animation: fadeIn 0.26s ease;
  overflow-wrap: anywhere;
}

/* ── Thinking Icon - 青色系思考中动画 ── */
.thinking-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  background: radial-gradient(circle at 30% 30%, #fff 0%, #f0f9ff 72%, #e0f2fe 100%);
  border-radius: 50%;
  align-items: center;
  justify-content: center;
}

.thinking-icon svg {
  width: 18px;
  height: 18px;
  animation: orbit 5s linear infinite;
}

.thinking-icon.active svg {
  animation-duration: 1.8s;
}

.ring {
  fill: none;
  stroke-width: 2.7;
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
  fill: #fff;
  filter: drop-shadow(0 0 4px rgb(14 165 233 / 60%));
  animation: breathe 1.3s ease-in-out infinite;
  transform-origin: 24px 24px;
}

.thinking-icon.active .star-core {
  animation-duration: 0.9s;
}

.thought-summary-text {
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════
 * Assistant content
 * ═══════════════════════════════════════════════════ */
.assistant-content {
  color: #1e293b;
  word-break: break-word;
  white-space: normal;
  overflow-wrap: anywhere;
}

.assistant-content :deep(p) {
  margin: 0;
}

.assistant-content :deep(p + p) {
  margin-top: 10px;
}

.assistant-content :deep(pre) {
  margin: 10px 0;
  overflow: auto;
  border-radius: 8px;
}

.assistant-content :deep(.hljs) {
  padding: 14px 16px;
  color: #e2e8f0;
  background: #0f172a;
  border-radius: 8px;
}

.assistant-content :deep(code) {
  font-family: 'SF Mono', Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 13px;
}

.assistant-content :deep(:not(pre) > code) {
  padding: 1px 6px;
  font-size: 13px;
  color: #0369a1;
  background: rgb(14 165 233 / 8%);
  border: 1px solid rgb(14 165 233 / 15%);
  border-radius: 4px;
}

.assistant-content :deep(a) {
  color: #0ea5e9;
  text-decoration: none;
}

.assistant-content :deep(a:hover) {
  text-decoration: underline;
}

.assistant-content :deep(ul),
.assistant-content :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}

.assistant-content :deep(li) {
  margin: 3px 0;
}

.assistant-content :deep(blockquote) {
  padding: 8px 14px;
  margin: 8px 0;
  color: #64748b;
  background: rgb(14 165 233 / 4%);
  border-left: 3px solid #0ea5e9;
  border-radius: 0 6px 6px 0;
}

.assistant-action-row {
  margin-top: 10px;
}

/* --- 1. 点赞，点踩 --- */

/* 容器布局 */
.feedback-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px; /* 间距拉开一点更舒服 */
  margin-top: 10px;
}

/* 按钮基础样式 */
.feedback-btn {
  display: flex;
  padding: 6px 10px !important;
  color: #64748b !important; /* 默认深灰色 */
  border: 1px solid transparent !important;
  border-radius: 6px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  align-items: center;
}

/* 按钮内文字样式 */
.btn-text {
  margin-left: 6px;
  font-size: 13px;
}

/* 鼠标悬停时的微交互 */
.feedback-btn:hover {
  background-color: #f1f5f9 !important;
  transform: translateY(-1px);
}

/* --- 激活态样式 --- */

/* 点赞激活：使用经典的蓝绿色调 */
.feedback-btn.like.active {
  color: #10b981 !important; /* 翠绿色，比纯蓝更显积极 */
  background-color: #ecfdf5 !important;
  border-color: #a7f3d0 !important;
}

/* 踩激活：使用温和的红色调 */
.feedback-btn.dislike.active {
  color: #f43f5e !important;
  background-color: #fff1f2 !important;
  border-color: #fecdd3 !important;
}

/* 点击时的波纹/缩小反馈 */
.feedback-btn:active {
  transform: scale(0.92);
}

/* 激活时图标的动画 */
.feedback-btn.active .el-icon {
  animation: thumbs-up-pop 0.3s ease;
}

.suggested-question-list {
  display: flex;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 6px;
}

.suggested-question-chip {
  padding: 4px 10px;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  transition: all 0.2s;
}

.suggested-question-chip:hover {
  color: #0369a1;
  background: rgb(14 165 233 / 8%);
  border-color: #0ea5e9;
}

/* ═══════════════════════════════════════════════════
 * Input Panel
 * ═══════════════════════════════════════════════════ */
.input-panel {
  position: relative;
  padding: 14px 24px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.hidden-file-input {
  display: none;
}

.uploaded-file-list {
  display: flex;
  max-width: 960px;
  margin-right: auto;
  margin-bottom: 10px;
  margin-left: auto;
  flex-wrap: wrap;
  gap: 8px;
}

.file-chip {
  display: inline-flex;
  height: 28px;
  max-width: 320px;
  padding: 0 4px 0 10px;
  background: rgb(14 165 233 / 6%);
  border: 1px solid rgb(14 165 233 / 20%);
  border-radius: 14px;
  align-items: center;
  gap: 6px;
}

.file-chip-icon {
  width: 12px;
  height: 12px;
  color: #0369a1;
  flex-shrink: 0;
}

.file-chip-name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  color: #0369a1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip-remove {
  padding: 2px;
  margin-left: 4px;
}

.input-wrapper {
  max-width: 960px;
  margin: 0 auto;
}

/* Input textarea */
.input-panel :deep(.el-textarea__inner) {
  padding: 12px 14px;
  font-size: 14px;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: none;
  transition: all 0.2s;
  resize: none;
}

.input-panel :deep(.el-textarea__inner::placeholder) {
  color: #94a3b8;
}

.input-panel :deep(.el-textarea__inner:hover) {
  background: #fff;
  border-color: #cbd5e1;
}

.input-panel :deep(.el-textarea__inner:focus) {
  background: #fff;
  border-color: #0ea5e9;
  box-shadow: 0 0 0 3px rgb(14 165 233 / 12%);
}

.input-actions {
  display: flex;
  max-width: 960px;
  margin-top: 10px;
  margin-right: auto;
  margin-left: auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.input-actions-left {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 0;
}

.input-actions-left :deep(.el-button) {
  margin-left: 0;
  font-size: 13px;
  color: #64748b;
}

.input-actions-left :deep(.el-button + .el-button) {
  margin-left: 0;
}

.input-actions-left :deep(.el-button.is-text:not(.is-disabled):hover) {
  color: #0ea5e9;
  background: rgb(14 165 233 / 8%);
}

.input-actions-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.input-hint-text {
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.02em;
  color: #cbd5e1;
}

.input-actions :deep(.el-icon) {
  margin-right: 4px;
}

.input-actions :deep(.el-button .el-icon:only-child) {
  margin-right: 0;
}

/* Send button - 对齐登录页主按钮 */
.send-btn,
.input-actions :deep(.el-button--primary) {
  position: relative;
  padding: 8px 24px !important;
  overflow: hidden;
  font-weight: 600 !important;
  letter-spacing: 0.05em;
  color: #f0f9ff !important;
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%) !important;
  background-size: 200% 200% !important;
  border: none !important;
  border-radius: 8px !important;
  box-shadow:
    0 4px 12px rgb(14 165 233 / 30%),
    inset 0 1px 0 rgb(255 255 255 / 20%) !important;
  transition: all 0.2s ease !important;
}

.stop-btn {
  padding: 8px 18px !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
}

.input-actions :deep(.el-button--primary:hover:not(.is-disabled)) {
  transform: translateY(-1px);
  box-shadow:
    0 6px 18px rgb(14 165 233 / 40%),
    inset 0 1px 0 rgb(255 255 255 / 30%) !important;
}

.input-actions :deep(.el-button--primary.is-disabled) {
  opacity: 0.5;
  box-shadow: none !important;
}

/* ═══════════════════════════════════════════════════
 * Tip text
 * ═══════════════════════════════════════════════════ */
.tip-text {
  padding: 24px 12px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}

/* ═══════════════════════════════════════════════════
 * Page Shell
 * ═══════════════════════════════════════════════════ */
</style>
