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

const currentConversation = computed(() =>
  conversations.value.find((item) => item.id === currentConversationId.value)
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

      // 关键改动：使用 recorder 实际的 mimeType，并且用 File 而不是 Blob
      const mimeType = recorder.mimeType || 'audio/webm'
      const audioBlob = new Blob(chunks, { type: mimeType })
      if (!audioBlob.size) {
        return
      }

      // 包装成 File，提供明确的文件名和扩展名
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

  await loadConversations()
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

async function loadConversations(preferredId?: string, autoLoadMessages = true) {
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

    const candidate =
      (preferredId && conversations.value.some((item) => item.id === preferredId) && preferredId) ||
      (currentConversationId.value &&
        conversations.value.some((item) => item.id === currentConversationId.value) &&
        currentConversationId.value) ||
      conversations.value[0].id

    chatStore.setCurrentConversationId(candidate)

    if (autoLoadMessages) {
      await loadMessages(candidate)
    }
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
      const candidate =
        conversations.value[removedIndex] ||
        conversations.value[removedIndex - 1] ||
        conversations.value[0] ||
        null

      if (!candidate) {
        chatStore.setCurrentConversationId(null)
        chatStore.setMessages([])
        chatStore.setTaskId(null)
      } else {
        chatStore.setCurrentConversationId(candidate.id)
        await loadMessages(candidate.id)
      }
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

              // 1) thought_start 2) thought 3) thought_end 4) text
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
    <header class="chat-header">
      <div class="header-left">
        <el-button text @click="handleBackToAdmin">
          <el-icon><ArrowLeft /></el-icon>
          返回管理后台
        </el-button>
      </div>
      <div class="header-center">AI Hub Chat</div>
      <div class="header-right">{{ displayName }}</div>
    </header>

    <div class="chat-body">
      <aside class="chat-sidebar">
        <section class="sidebar-section app-section">
          <div class="section-header">
            <span>应用列表</span>
            <el-button text @click="loadApps">
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
                <div class="item-title">{{ app.appName }}</div>
                <div class="item-sub">{{ app.appCode }}</div>
              </div>
              <el-empty v-if="apps.length === 0" description="暂无可用应用" :image-size="72" />
            </template>
          </el-scrollbar>
        </section>

        <section class="sidebar-section conversation-section">
          <div class="section-header">
            <span>对话列表</span>
            <el-button text @click="handleNewConversation">
              <el-icon><Plus /></el-icon>
              新对话
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
                <div class="item-title">{{ conversation.name }}</div>
                <div class="item-sub">{{ formatTime(conversation.updatedAt) }}</div>
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
                :image-size="72"
              />
            </template>
          </el-scrollbar>
        </section>
      </aside>

      <main class="chat-main">
        <div class="chat-main-header">
          {{ currentConversation?.name || '新对话' }}
        </div>

        <div class="message-panel">
          <el-scrollbar
            ref="messageScrollbarRef"
            class="message-scroll"
            @scroll="handleMessageScroll"
          >
            <div ref="messageListRef">
              <div v-if="messageLoading" class="tip-text">正在加载消息...</div>
              <template v-else>
                <el-empty v-if="!currentAppId" description="请先在左侧选择应用" :image-size="88" />
                <el-empty
                  v-else-if="!currentConversationId && messages.length === 0"
                  description="新对话已创建，请在下方输入消息"
                  :image-size="88"
                />
                <el-empty
                  v-else-if="messages.length === 0"
                  description="当前对话暂无消息"
                  :image-size="88"
                />

                <div v-else class="message-list">
                  <div
                    v-for="message in messages"
                    :key="message.id"
                    class="message-row"
                    :class="`role-${message.role}`"
                  >
                    <div v-if="message.role !== 'user'" class="message-avatar avatar-ai">AI</div>
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
                                  <circle class="ring ring-blue" cx="24" cy="24" r="16" />
                                  <circle class="ring ring-red" cx="24" cy="24" r="16" />
                                  <circle class="ring ring-yellow" cx="24" cy="24" r="16" />
                                  <circle class="ring ring-green" cx="24" cy="24" r="16" />
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

                    <!-- <div v-if="message.role === 'user'" class="message-avatar avatar-user">
                      {{ displayName ? displayName.charAt(0).toUpperCase() : 'U' }}
                    </div> -->
                  </div>
                </div>
              </template>
            </div>
          </el-scrollbar>
        </div>

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
              <span class="file-chip-name">{{ file.fileName }}</span>
              <el-button text class="file-chip-remove" @click="removeUploadedFile(file.fileId)">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>

          <el-input
            v-model="inputValue"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            @keydown="handleInputKeydown"
          />
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

            <el-button
              type="primary"
              :loading="isGenerating"
              :disabled="!canSend"
              @click="handleSend"
            >
              {{ isGenerating ? '生成中...' : '发送' }}
            </el-button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── Page Shell ─────────────────────────────── */
.chat-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f4f8;
}

/* ── Top Header ─────────────────────────────── */
.chat-header {
  height: 56px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.header-center {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  letter-spacing: 0.2px;
}

.header-right {
  justify-self: end;
  font-size: 13px;
  color: #6b7280;
}

/* ── Body ───────────────────────────────────── */
.chat-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* ── Sidebar ────────────────────────────────── */
.chat-sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.sidebar-section {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-section {
  height: 42%;
  border-bottom: 1px solid #e5e7eb;
}

.conversation-section {
  flex: 1;
}

.section-header {
  height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: #9ca3af;
  background: #fafafa;
  border-bottom: 1px solid #f1f3f5;
  flex-shrink: 0;
}

.section-scroll {
  flex: 1;
  min-height: 0;
  padding: 8px;
}

.app-item,
.conversation-item {
  position: relative;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.18s ease;
  background: transparent;
}

.app-item:hover,
.conversation-item:hover {
  background: #f3f4f8;
  border-color: #e5e7eb;
}

.app-item.active,
.conversation-item.active {
  background: rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.25);
}

.conversation-item {
  padding-right: 40px;
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
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-item.active .item-title,
.conversation-item.active .item-title {
  color: #6366f1;
}

.item-sub {
  margin-top: 3px;
  font-size: 11px;
  color: #9ca3af;
  word-break: break-all;
}

/* ── Chat Main ──────────────────────────────── */
.chat-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f3f4f8;
}

.chat-main-header {
  height: 46px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  flex-shrink: 0;
}

/* ── Message Panel ──────────────────────────── */
.message-panel {
  flex: 1;
  min-height: 0;
  padding: 20px;
}

.message-scroll {
  width: 100%;
  height: 100%;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 8px;
}

/* ── Message Row ────────────────────────────── */
.message-row {
  display: flex;
  gap: 10px;
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

/* ── Avatars ────────────────────────────────── */
.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  flex-shrink: 0;
  margin-top: 22px;
}

.avatar-ai {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
}

.avatar-user {
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(14, 165, 233, 0.3);
}

/* ── Message Meta ───────────────────────────── */
.message-meta {
  font-size: 11px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  white-space: nowrap;
  line-height: 1;
  gap: 6px;
  margin-bottom: 5px;
}

.message-meta-role,
.message-meta-time {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.message-row.role-user .message-meta {
  justify-content: flex-end;
  text-align: right;
}

/* ── Message Bubble ─────────────────────────── */
.message-bubble {
  line-height: 1.65;
  font-size: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.role-user .message-bubble {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

.plain-content {
  white-space: pre-wrap;
}

/* ── File references ────────────────────────── */
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
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.user-file-reference-ext {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  white-space: nowrap;
}

/* ── Thought Panel ──────────────────────────── */
.thought-panel {
  margin-bottom: 10px;
  border-radius: 8px;
  background: #f8f9ff;
  border: 1px solid #e0e4ff;
}

.thought-summary {
  list-style: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: #6366f1;
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
  border-left: 3px solid #818cf8;
  background: #eef0ff;
  border-radius: 6px;
  animation: fadeIn 0.26s ease;
  overflow-wrap: anywhere;
  word-break: break-all;
  font-size: 13px;
  color: #4b5563;
}

/* ── Thinking Icon ──────────────────────────── */
.thinking-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff 0%, #eef3ff 72%, #dfe8ff 100%);
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

.ring-blue {
  stroke: #6366f1;
  transform: rotate(0deg);
}

.ring-red {
  stroke: #8b5cf6;
  transform: rotate(90deg);
}

.ring-yellow {
  stroke: #a78bfa;
  transform: rotate(180deg);
}

.ring-green {
  stroke: #c4b5fd;
  transform: rotate(270deg);
}

.star-core {
  fill: #ffffff;
  filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.55));
  animation: breathe 1.3s ease-in-out infinite;
  transform-origin: 24px 24px;
}

.thinking-icon.active .star-core {
  animation-duration: 0.9s;
}

.thought-summary-text {
  white-space: nowrap;
}

/* ── Assistant content ──────────────────────── */
.assistant-content {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: #1f2937;
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
  background: #1e1e2e;
  border-radius: 8px;
  padding: 12px 14px;
}

.assistant-content :deep(code) {
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 13px;
}

.assistant-content :deep(:not(pre) > code) {
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
}

.assistant-content :deep(a) {
  color: #6366f1;
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
  padding: 8px 12px;
  border-left: 3px solid #818cf8;
  background: rgba(99, 102, 241, 0.04);
  border-radius: 0 6px 6px 0;
  color: #6b7280;
}

/* ── Input Panel ────────────────────────────── */
.input-panel {
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 14px 20px;
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
}

.file-chip {
  height: 28px;
  max-width: 360px;
  padding: 0 4px 0 10px;
  display: inline-flex;
  align-items: center;
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.file-chip-name {
  font-size: 12px;
  color: #4338ca;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip-remove {
  margin-left: 4px;
  padding: 2px;
}

.input-actions {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.input-actions-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.input-actions-left :deep(.el-button) {
  margin-left: 0;
  color: #6b7280;
}

.input-actions-left :deep(.el-button + .el-button) {
  margin-left: 0;
}

.input-actions-left :deep(.el-button.is-text:not(.is-disabled):hover) {
  background: rgba(99, 102, 241, 0.06);
  color: #6366f1;
}

.input-actions > .el-button {
  margin-left: auto;
}

@media (max-width: 960px) {
  .input-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .input-actions-left {
    justify-content: flex-start;
  }

  .input-actions > .el-button {
    width: 100%;
    margin-left: 0;
  }
}

.input-actions :deep(.el-icon) {
  margin-right: 4px;
}

.input-actions :deep(.el-button .el-icon:only-child) {
  margin-right: 0;
}

/* Input textarea */
.input-panel :deep(.el-textarea__inner) {
  border-radius: 10px;
  border-color: #e5e7eb;
  background: #fafafa;
  font-size: 14px;
  resize: none;
  transition: border-color 0.18s;
}

.input-panel :deep(.el-textarea__inner:focus) {
  border-color: #6366f1;
  background: #ffffff;
}

/* Send button */
.input-actions :deep(.el-button--primary) {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
  transition: all 0.18s ease;
}

.input-actions :deep(.el-button--primary:hover:not(.is-disabled)) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.input-actions :deep(.el-button--primary.is-disabled) {
  opacity: 0.5;
  box-shadow: none;
}

/* ── Tip text ───────────────────────────────── */
.tip-text {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}

/* ── Keyframes ──────────────────────────────── */
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
