<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Plus, Refresh } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import { appApi, chatApi, conversationApi, type AppConfigVO } from '@/api/frontend-api'
import { useChatStore, type ChatMessage } from '@/store/modules/chat'
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

const streamController = ref<AbortController | null>(null)

const messageScrollbarRef = ref<any>(null)
const messageListRef = ref<HTMLElement | null>(null)
const shouldStickToBottom = ref(true)

const currentAppId = computed(() => chatStore.getCurrentAppId)
const currentConversationId = computed(() => chatStore.getCurrentConversationId)
const messages = computed(() => chatStore.getMessages)
const isGenerating = computed(() => chatStore.getIsGenerating)
const displayName = computed(() => userStore.getDisplayName)
const canSend = computed(() =>
  Boolean(currentAppId.value && inputValue.value.trim() && !isGenerating.value)
)

const currentConversation = computed(() =>
  conversations.value.find((item) => item.id === currentConversationId.value)
)

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

function handleNewConversation() {
  chatStore.setCurrentConversationId(null)
  chatStore.setMessages([])
  chatStore.setTaskId(null)
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

  const now = Date.now()
  const userMessageId = `local-user-${now}`
  const assistantMessageId = `local-assistant-${now}`

  chatStore.appendMessage({
    id: userMessageId,
    role: 'user',
    thought: '',
    content: question,
    isThinking: false,
    createdAt: new Date().toISOString()
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

  try {
    await chatApi.streamChat(
      currentAppId.value,
      {
        query: question,
        conversationId: previousConversationId || undefined
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
                    <div class="message-meta">
                      {{ roleLabel(message.role) }}
                      <span>{{ formatTime(message.createdAt) }}</span>
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
                        <div class="plain-content">{{ message.content }}</div>
                      </template>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </el-scrollbar>
        </div>

        <div class="input-panel">
          <el-input
            v-model="inputValue"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            @keydown="handleInputKeydown"
          />
          <div class="input-actions">
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
.chat-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f5f9;
}

.chat-header {
  height: 56px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-center {
  font-size: 16px;
  font-weight: 600;
}

.header-right {
  justify-self: end;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.chat-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.chat-sidebar {
  width: 320px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid var(--el-border-color-light);
}

.sidebar-section {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-section {
  height: 45%;
  border-bottom: 1px solid var(--el-border-color-light);
}

.conversation-section {
  flex: 1;
}

.section-header {
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
}

.section-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 8px 8px;
}

.app-item,
.conversation-item {
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  cursor: pointer;
  transition: all 0.2s ease;
}

.app-item:hover,
.conversation-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.app-item.active,
.conversation-item.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.item-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.chat-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chat-main-header {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: #ffffff;
  font-weight: 600;
}

.message-panel {
  flex: 1;
  min-height: 0;
  padding: 16px;
}

.message-scroll {
  width: 100%;
  height: 100%;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-row {
  max-width: 76%;
}

.message-row.role-user {
  margin-left: auto;
}

.message-row.role-assistant,
.message-row.role-system {
  margin-right: auto;
}

.message-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.message-bubble {
  line-height: 1.6;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid var(--el-border-color-light);
}

.plain-content {
  white-space: pre-wrap;
}

.role-user .message-bubble {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}

.thought-panel {
  margin-bottom: 8px;
  border-radius: 8px;
  background: #f6f7fa;
  border: 1px solid #e8ebf0;
}

.thought-summary {
  list-style: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: #4d5b76;
  font-size: 13px;
  user-select: none;
}

.thought-summary::-webkit-details-marker {
  display: none;
}

.thought-content {
  margin: 0 10px 10px;
  padding: 10px 10px 10px 18px;
  border-left: 3px solid #d0d7e6;
  background: #eef2f9;
  border-radius: 6px;
  animation: fadeIn 0.26s ease;
  overflow-wrap: anywhere;
  word-break: break-all;
}

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
  stroke: #4285f4;
  transform: rotate(0deg);
}

.ring-red {
  stroke: #ea4335;
  transform: rotate(90deg);
}

.ring-yellow {
  stroke: #fbbc04;
  transform: rotate(180deg);
}

.ring-green {
  stroke: #34a853;
  transform: rotate(270deg);
}

.star-core {
  fill: #ffffff;
  filter: drop-shadow(0 0 4px rgba(66, 133, 244, 0.55));
  animation: breathe 1.3s ease-in-out infinite;
  transform-origin: 24px 24px;
}

.thinking-icon.active .star-core {
  animation-duration: 0.9s;
}

.thought-summary-text {
  white-space: nowrap;
}

.assistant-content {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.assistant-content :deep(p) {
  margin: 0;
}

.assistant-content :deep(p + p) {
  margin-top: 10px;
}

.assistant-content :deep(pre) {
  margin: 8px 0;
  border-radius: 8px;
  overflow: auto;
}

.assistant-content :deep(code) {
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
}

.assistant-content :deep(a) {
  color: var(--el-color-primary);
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

.input-panel {
  border-top: 1px solid var(--el-border-color-light);
  background: #ffffff;
  padding: 12px 16px;
}

.input-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.tip-text {
  padding: 10px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

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
