<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Close,
  Delete,
  Microphone,
  Paperclip,
  Plus,
  Refresh
} from '@element-plus/icons-vue'
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

const router = useRouter()
const chatStore = useChatStore()
const userStore = useUserStore()

const apps = ref<AppConfigVO[]>([])
const conversations = ref<ConversationItem[]>([])
const inputValue = ref('')

const appLoading = ref(false)
const conversationLoading = ref(false)
const messageLoading = ref(false)
const deletingConversationId = ref<string | null>(null)
const uploadLoading = ref(false)
const audioRecognizing = ref(false)
const isRecording = ref(false)

const streamController = ref<AbortController | null>(null)
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
        createdAt
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

  return [
    {
      id: extractStringByKeys(record, ['id', 'messageId']) || `message-${index}`,
      role: parseMessageRole(extractStringByKeys(record, ['role', 'type'])),
      thought: thoughtText,
      content,
      isThinking: false,
      createdAt
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
    const recorder = new MediaRecorder(stream)

    mediaStreamRef.value = stream
    mediaRecorderRef.value = recorder
    audioChunksRef.value = []

    recorder.ondataavailable = (recorderEvent: BlobEvent) => {
      if (recorderEvent.data?.size) {
        audioChunksRef.value.push(recorderEvent.data)
      }
    }

    recorder.onstop = async () => {
      isRecording.value = false

      const chunks = [...audioChunksRef.value]
      audioChunksRef.value = []

      if (mediaStreamRef.value) {
        mediaStreamRef.value.getTracks().forEach((track) => track.stop())
        mediaStreamRef.value = null
      }
      mediaRecorderRef.value = null

      if (!currentAppId.value || chunks.length === 0) {
        return
      }

      const mimeType = recorder.mimeType || 'audio/webm'
      const audioBlob = new Blob(chunks, { type: mimeType })
      if (!audioBlob.size) {
        return
      }

      const extension = mimeType.includes('webm')
        ? 'webm'
        : mimeType.includes('mp4')
          ? 'mp4'
          : mimeType.includes('wav')
            ? 'wav'
            : 'webm'
      const audioFile = new File([audioBlob], `recording-${Date.now()}.${extension}`, {
        type: mimeType
      })

      audioRecognizing.value = true
      try {
        const response = await chatApi.audioToText(currentAppId.value, audioBlob)
        const recognizedText = parseAudioToTextResult(response)
        if (recognizedText) {
          appendTextToInput(recognizedText)
          ElMessage.success('语音识别完成')
        } else {
          ElMessage.warning('语音识别结果为空')
        }
      } catch (error: unknown) {
        ElMessage.error(extractErrorMessage(error) || '语音识别失败')
      } finally {
        audioRecognizing.value = false
      }
    }

    recorder.start()
    isRecording.value = true
  } catch (error: unknown) {
    releaseAudioResources()
    ElMessage.error(extractErrorMessage(error) || '无法启动录音')
  }
}

function stopVoiceInput() {
  const recorder = mediaRecorderRef.value
  if (!recorder || recorder.state === 'inactive') {
    return
  }
  recorder.stop()
}

async function handleSelectApp(appId: number, forceReload = false) {
  if (!forceReload && appId === currentAppId.value) {
    return
  }

  chatStore.setCurrentAppId(appId)
  chatStore.resetConversationState()
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

// ★ 关键改动：默认不自动选中第一个会话，传 selectFirst 控制
async function loadConversations(preferredId?: string, selectFirst = false) {
  if (!currentAppId.value) {
    conversations.value = []
    return
  }

  conversationLoading.value = true
  try {
    const response = await conversationApi.list({
      appId: currentAppId.value,
      page: 1,
      limit: 100
    })

    const list = pickList(response)
    conversations.value = list
      .map((item, index) => parseConversation(item, index))
      .filter((item): item is ConversationItem => Boolean(item))

    if (conversations.value.length === 0) {
      chatStore.setCurrentConversationId(null)
      chatStore.setMessages([])
      return
    }

    // 只有明确传了 preferredId（例如刚刚发送完消息拿到新的会话 id）才选中
    if (preferredId && conversations.value.some((item) => item.id === preferredId)) {
      chatStore.setCurrentConversationId(preferredId)
      await loadMessages(preferredId)
      return
    }

    // 或者显式要求选中第一条
    if (selectFirst) {
      const first = conversations.value[0].id
      chatStore.setCurrentConversationId(first)
      await loadMessages(first)
      return
    }

    // 默认：保持新对话状态（不选中任何一条历史）
    // 如果之前已经选中了一条且仍然存在，则保留；否则置空
    if (
      currentConversationId.value &&
      conversations.value.some((item) => item.id === currentConversationId.value)
    ) {
      // 保留当前选中
      return
    }

    chatStore.setCurrentConversationId(null)
    chatStore.setMessages([])
  } catch (error: unknown) {
    ElMessage.error(extractErrorMessage(error) || '对话列表加载失败')
  } finally {
    conversationLoading.value = false
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
    const removedIndex = previous.findIndex((item) => item.id === conversationId)
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

function handleBackToAdmin() {
  router.push('/')
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
    createdAt: new Date().toISOString()
  })

  requestStickBottom('smooth')

  const previousConversationId = currentConversationId.value
  const controller = new AbortController()

  streamController.value = controller
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

              const chunkType = extractChunkType(payload)

              if (chunkType === 'thought_start') {
                const thoughtDelta = extractThoughtText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  thought: `${msg.thought}${thoughtDelta}`,
                  isThinking: true
                }))
              } else if (chunkType === 'thought') {
                const thoughtDelta = extractThoughtText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  thought: `${msg.thought}${thoughtDelta}`,
                  isThinking: true
                }))
              } else if (chunkType === 'thought_end') {
                const thoughtDelta = extractThoughtText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  thought: `${msg.thought}${thoughtDelta}`,
                  isThinking: false
                }))
              } else if (chunkType === 'text') {
                const textDelta = extractContentText(payload)
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  content: `${msg.content}${textDelta}`,
                  isThinking: false
                }))
              } else {
                const fallbackText = extractContentText(payload)
                if (fallbackText) {
                  updateMessageById(assistantMessageId, (msg) => ({
                    ...msg,
                    content: `${msg.content}${fallbackText}`,
                    isThinking: false
                  }))
                }
              }
            } else if (event.event === 'message_replace') {
              const payload = normalizeStreamPayload(event.data)
              updateStreamMeta(payload)
              const content = extractContentText(payload)
              if (content) {
                updateMessageById(assistantMessageId, (msg) => ({
                  ...msg,
                  content,
                  isThinking: false
                }))
              }
            } else if (event.event === 'message_end') {
              const payload = normalizeStreamPayload(event.data)
              updateStreamMeta(payload)
              const finalText = extractContentText(payload)
              updateMessageById(assistantMessageId, (msg) => ({
                ...msg,
                content: msg.content || finalText,
                isThinking: false
              }))
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
      // ★ 新会话发送成功后，刷新侧边栏列表（不切换）
      await loadConversations(latestConversationId, false)
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
  inputValue.value = ''

  await loadApps()
  requestStickBottom('auto')
})

onBeforeUnmount(() => {
  if (streamController.value) {
    streamController.value.abort()
    streamController.value = null
  }
  releaseAudioResources()
  chatStore.setGenerating(false)
})
</script>

<template>
  <div class="chat-page">
    <!-- ═══ Top Header ═══ -->
    <header class="chat-header">
      <div class="header-accent-line"></div>
      <div class="header-left">
        <button class="back-button" type="button" @click="handleBackToAdmin">
          <span class="back-button-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </span>
          <span class="back-button-text">
            <span class="back-button-label">返回管理后台</span>
            <span class="back-button-sub">Back to Console</span>
          </span>
        </button>
      </div>
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
      <div class="header-right">
        <div class="header-user">
          <span class="user-online-dot"></span>
          <span class="user-display-name">{{ displayName }}</span>
        </div>
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
                type="primary"
                class="send-btn"
                :loading="isGenerating"
                :disabled="!canSend"
                @click="handleSend"
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
/* ═══════════════════════════════════════════════════
 * Page Shell
 * ═══════════════════════════════════════════════════ */
.chat-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
}

/* ═══════════════════════════════════════════════════
 * Top Header - 科技感极简顶栏
 * ═══════════════════════════════════════════════════ */
.chat-header {
  position: relative;
  height: 56px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  flex-shrink: 0;
}

/* 顶部青色装饰细线 */
.header-accent-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(14, 165, 233, 0.3) 30%,
    rgba(14, 165, 233, 0.5) 50%,
    rgba(14, 165, 233, 0.3) 70%,
    transparent 100%
  );
}

/* ═══════════════════════════════════════════════════
 * Back Button - 显眼的返回管理后台按钮
 * ═══════════════════════════════════════════════════ */
.back-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px 6px 12px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(56, 189, 248, 0.04) 100%);
  border: 1px solid rgba(14, 165, 233, 0.25);
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  outline: none;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* 左侧青色指示条 */
.back-button::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  background: #0ea5e9;
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 6px rgba(14, 165, 233, 0.6);
  transition: all 0.22s ease;
}

/* 内部流光条（hover 时出现） */
.back-button::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.15), transparent);
  transform: skewX(-20deg);
  transition: left 0.6s ease;
  pointer-events: none;
}

.back-button:hover {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.14) 0%, rgba(56, 189, 248, 0.08) 100%);
  border-color: rgba(14, 165, 233, 0.5);
  box-shadow:
    0 4px 14px rgba(14, 165, 233, 0.18),
    0 0 0 3px rgba(14, 165, 233, 0.08);
  transform: translateX(-2px);
}

.back-button:hover::before {
  top: 10%;
  bottom: 10%;
  background: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
}

.back-button:hover::after {
  left: 120%;
}

.back-button:active {
  transform: translateX(-2px) scale(0.98);
}

.back-button:focus-visible {
  box-shadow:
    0 0 0 3px rgba(14, 165, 233, 0.25),
    0 4px 14px rgba(14, 165, 233, 0.2);
}

/* 箭头图标 */
.back-button-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid rgba(14, 165, 233, 0.3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #0ea5e9;
  flex-shrink: 0;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-button-icon svg {
  width: 14px;
  height: 14px;
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-button:hover .back-button-icon {
  background: linear-gradient(135deg, #0ea5e9, #38bdf8);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.4);
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
  color: #0369a1;
  letter-spacing: 0.01em;
}

.back-button-sub {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 9px;
  color: #0ea5e9;
  letter-spacing: 0.1em;
  opacity: 0.7;
}

/* 窄屏下隐藏副标题 */
@media (max-width: 720px) {
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
@media (max-width: 520px) {
  .back-button-text {
    display: none;
  }
  .back-button {
    padding: 6px;
  }
}

.header-center {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-self: center;
}

.header-icon {
  filter: drop-shadow(0 0 6px rgba(14, 165, 233, 0.4));
}

.header-title-text {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
}

.header-right {
  justify-self: end;
}

.header-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  background: rgba(14, 165, 233, 0.06);
  border: 1px solid rgba(14, 165, 233, 0.15);
  border-radius: 999px;
}

.user-online-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 5px rgba(16, 185, 129, 0.6);
  animation: onlinePulse 2.5s ease-in-out infinite;
}

@keyframes onlinePulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.user-display-name {
  font-size: 12px;
  color: #0369a1;
  font-weight: 500;
}

/* ═══════════════════════════════════════════════════
 * Body
 * ═══════════════════════════════════════════════════ */
.chat-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* ═══════════════════════════════════════════════════
 * Sidebar - 浅色但带品牌感
 * ═══════════════════════════════════════════════════ */
.chat-sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.sidebar-section {
  min-height: 0;
  display: flex;
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
  height: 44px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.section-title {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #64748b;
}

.section-action {
  color: #64748b !important;
  font-size: 12px;
}

.section-action :deep(.el-icon) {
  margin-right: 2px;
}

.section-action.new-btn :deep(span + span) {
  margin-left: 2px;
}

:deep(.section-action.is-text:not(.is-disabled):hover) {
  color: #0ea5e9 !important;
  background: rgba(14, 165, 233, 0.08) !important;
}

.section-scroll {
  flex: 1;
  min-height: 0;
  padding: 6px 8px;
}

/* ── App Item ── */
.app-item {
  position: relative;
  padding: 10px 12px;
  margin-bottom: 3px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-item-indicator {
  width: 3px;
  height: 26px;
  border-radius: 2px;
  background: #cbd5e1;
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
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.1), rgba(14, 165, 233, 0.02));
  border-color: rgba(14, 165, 233, 0.25);
}

.app-item.active .app-item-indicator {
  background: #0ea5e9;
  box-shadow: 0 0 6px rgba(14, 165, 233, 0.5);
}

.app-item-body {
  flex: 1;
  min-width: 0;
}

/* ── Conversation Item ── */
.conversation-item {
  position: relative;
  padding: 10px 12px;
  margin-bottom: 3px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-right: 36px;
}

.conv-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.conv-icon svg {
  width: 14px;
  height: 14px;
}

.conversation-item:hover {
  background: #f1f5f9;
}

.conversation-item:hover .conv-icon {
  background: rgba(14, 165, 233, 0.08);
  border-color: rgba(14, 165, 233, 0.2);
  color: #0ea5e9;
}

.conversation-item.active {
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.1), rgba(14, 165, 233, 0.02));
  border-color: rgba(14, 165, 233, 0.25);
}

.conversation-item.active .conv-icon {
  background: rgba(14, 165, 233, 0.12);
  border-color: rgba(14, 165, 233, 0.3);
  color: #0ea5e9;
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
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.app-item.active .item-title,
.conversation-item.active .item-title {
  color: #0369a1;
}

.item-sub {
  margin-top: 3px;
  font-size: 11px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════
 * Chat Main
 * ═══════════════════════════════════════════════════ */
.chat-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.chat-main-header {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
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
  border-radius: 50%;
  background: #0ea5e9;
  box-shadow: 0 0 6px rgba(14, 165, 233, 0.5);
  flex-shrink: 0;
}

.main-header-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-header-app {
  font-size: 12px;
  color: #94a3b8;
}

.status-badge {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  color: #0ea5e9;
  letter-spacing: 0.15em;
  padding: 3px 10px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 4px;
}

/* ═══════════════════════════════════════════════════
 * Welcome Screen - 新对话空状态欢迎屏
 * ═══════════════════════════════════════════════════ */
.welcome-screen {
  position: relative;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  overflow: hidden;
}

/* 超大浅色网格背景 */
.welcome-bg-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
  pointer-events: none;
}

.welcome-bg-glow {
  position: absolute;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  filter: blur(40px);
  pointer-events: none;
}

.welcome-content {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 720px;
  text-align: center;
  animation: welcomeFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
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

.welcome-logo {
  position: relative;
  width: 64px;
  height: 64px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-logo svg {
  width: 48px;
  height: 48px;
  filter: drop-shadow(0 0 12px rgba(14, 165, 233, 0.5));
  position: relative;
  z-index: 1;
  animation: logoFloat 4s ease-in-out infinite;
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

.welcome-logo-pulse {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%);
  animation: logoPulse 3s ease-in-out infinite;
}

@keyframes logoPulse {
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.welcome-title {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.welcome-title-accent {
  background: linear-gradient(135deg, #0ea5e9 0%, #22d3ee 50%, #38bdf8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-subtitle {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 32px;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
}

/* ── 提示词网格 ── */
.prompt-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 28px;
  text-align: left;
}

@media (max-width: 720px) {
  .prompt-grid {
    grid-template-columns: 1fr;
  }
}

.prompt-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  opacity: 0;
  animation: cardFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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

.prompt-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #0ea5e9, transparent);
  opacity: 0;
  transition: opacity 0.25s;
  border-radius: 12px 12px 0 0;
}

.prompt-card:hover {
  border-color: #0ea5e9;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.12);
}

.prompt-card:hover::before {
  opacity: 1;
}

.prompt-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.prompt-icon-wrap svg {
  width: 18px;
  height: 18px;
}

.prompt-icon--spark {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(56, 189, 248, 0.05));
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.prompt-icon--code {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.1), rgba(103, 232, 249, 0.05));
  color: #0891b2;
  border: 1px solid rgba(34, 211, 238, 0.2);
}

.prompt-icon--doc {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(52, 211, 153, 0.05));
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.prompt-icon--idea {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.05));
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.prompt-card:hover .prompt-icon-wrap {
  transform: scale(1.05);
}

.prompt-body {
  flex: 1;
  min-width: 0;
}

.prompt-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 2px;
  letter-spacing: -0.01em;
}

.prompt-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
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
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(14, 165, 233, 0.04);
  border: 1px solid rgba(14, 165, 233, 0.12);
  border-radius: 999px;
  font-size: 12px;
  color: #64748b;
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
  flex-direction: column;
  gap: 20px;
  padding: 24px 24px 8px;
  max-width: 960px;
  margin: 0 auto;
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
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
  margin-top: 22px;
}

.avatar-ai {
  background: linear-gradient(135deg, #0c1628 0%, #0f172a 50%, #1e293b 100%);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
}

.avatar-ai svg {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.4));
}

.avatar-user {
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
}

/* ── Message Meta ── */
.message-meta {
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  white-space: nowrap;
  line-height: 1;
  gap: 8px;
  margin-bottom: 6px;
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
  line-height: 1.7;
  font-size: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.role-user .message-bubble {
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(14, 165, 233, 0.3);
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
  max-width: 240px;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.15);
}

.user-file-reference-chip::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.user-file-reference-name {
  max-width: 164px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

.user-file-reference-ext {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════
 * Thought Panel - 思考过程面板（科技蓝）
 * ═══════════════════════════════════════════════════ */
.thought-panel {
  margin-bottom: 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.thought-summary {
  list-style: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: #0284c7;
  font-size: 13px;
  font-weight: 500;
  user-select: none;
}

.thought-summary::-webkit-details-marker {
  display: none;
}

.thought-content {
  margin: 0 12px 10px;
  padding: 10px 12px 10px 16px;
  border-left: 3px solid #0ea5e9;
  background: #ffffff;
  border-radius: 6px;
  animation: fadeIn 0.26s ease;
  overflow-wrap: anywhere;
  word-break: break-all;
  font-size: 13px;
  color: #475569;
}

/* ── Thinking Icon - 青色系思考中动画 ── */
.thinking-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff 0%, #f0f9ff 72%, #e0f2fe 100%);
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
  fill: #ffffff;
  filter: drop-shadow(0 0 4px rgba(14, 165, 233, 0.6));
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
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: #1e293b;
}

.assistant-content :deep(p) {
  margin: 0;
}

.assistant-content :deep(p + p) {
  margin-top: 10px;
}

.assistant-content :deep(pre) {
  margin: 10px 0;
  border-radius: 8px;
  overflow: auto;
}

.assistant-content :deep(.hljs) {
  background: #0f172a;
  border-radius: 8px;
  padding: 14px 16px;
  color: #e2e8f0;
}

.assistant-content :deep(code) {
  font-family: 'SF Mono', Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 13px;
}

.assistant-content :deep(:not(pre) > code) {
  background: rgba(14, 165, 233, 0.08);
  color: #0369a1;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
  border: 1px solid rgba(14, 165, 233, 0.15);
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
  margin: 8px 0;
  padding: 8px 14px;
  border-left: 3px solid #0ea5e9;
  background: rgba(14, 165, 233, 0.04);
  border-radius: 0 6px 6px 0;
  color: #64748b;
}

/* ═══════════════════════════════════════════════════
 * Input Panel
 * ═══════════════════════════════════════════════════ */
.input-panel {
  position: relative;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 14px 24px 16px;
  flex-shrink: 0;
}

.hidden-file-input {
  display: none;
}

.uploaded-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  max-width: 960px;
  margin-left: auto;
  margin-right: auto;
}

.file-chip {
  height: 28px;
  max-width: 320px;
  padding: 0 4px 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 14px;
  background: rgba(14, 165, 233, 0.06);
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.file-chip-icon {
  width: 12px;
  height: 12px;
  color: #0369a1;
  flex-shrink: 0;
}

.file-chip-name {
  font-size: 12px;
  color: #0369a1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.file-chip-remove {
  margin-left: 4px;
  padding: 2px;
}

.input-wrapper {
  max-width: 960px;
  margin: 0 auto;
}

/* Input textarea */
.input-panel :deep(.el-textarea__inner) {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 14px;
  resize: none;
  transition: all 0.2s;
  padding: 12px 14px;
  color: #0f172a;
  box-shadow: none;
}

.input-panel :deep(.el-textarea__inner::placeholder) {
  color: #94a3b8;
}

.input-panel :deep(.el-textarea__inner:hover) {
  border-color: #cbd5e1;
  background: #ffffff;
}

.input-panel :deep(.el-textarea__inner:focus) {
  border-color: #0ea5e9;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.input-actions {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 960px;
  margin-left: auto;
  margin-right: auto;
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
  color: #64748b;
  font-size: 13px;
}

.input-actions-left :deep(.el-button + .el-button) {
  margin-left: 0;
}

.input-actions-left :deep(.el-button.is-text:not(.is-disabled):hover) {
  background: rgba(14, 165, 233, 0.08);
  color: #0ea5e9;
}

.input-actions-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.input-hint-text {
  font-size: 11px;
  color: #cbd5e1;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  letter-spacing: 0.02em;
}

@media (max-width: 960px) {
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

.input-actions :deep(.el-icon) {
  margin-right: 4px;
}

.input-actions :deep(.el-button .el-icon:only-child) {
  margin-right: 0;
}

/* Send button - 对齐登录页主按钮 */
.send-btn,
.input-actions :deep(.el-button--primary) {
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%) !important;
  background-size: 200% 200% !important;
  border: none !important;
  border-radius: 8px !important;
  padding: 8px 24px !important;
  font-weight: 600 !important;
  letter-spacing: 0.05em;
  color: #f0f9ff !important;
  box-shadow:
    0 4px 12px rgba(14, 165, 233, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
  transition: all 0.2s ease !important;
  position: relative;
  overflow: hidden;
}

.input-actions :deep(.el-button--primary:hover:not(.is-disabled)) {
  transform: translateY(-1px);
  box-shadow:
    0 6px 18px rgba(14, 165, 233, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
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
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
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
    transform: scale(0.85);
    opacity: 0.92;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
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
</style>
