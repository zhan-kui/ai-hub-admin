import { defineStore } from 'pinia'
import { store } from '../index'

export type ChatMode = 'dify' | 'agent'
export type UploadedFileType = 'document' | 'image' | 'audio' | 'video' | 'custom'
export type UploadedFileTransferMethod = 'local_file' | 'remote_url'

export interface UploadedFile {
  fileId: string
  fileName: string
  fileSize?: number
  fileType?: string
  type?: UploadedFileType
  transferMethod?: UploadedFileTransferMethod
  uploadFileId?: string
  url?: string
}

export interface ChatMessageFileReference {
  id: string
  name: string
  extension?: string
  transferMethod?: UploadedFileTransferMethod
}

export interface ToolSource {
  title: string
  url: string
  snippet?: string
  position?: number
}

export interface ToolCallError {
  code: string
  message: string
  retryable?: boolean
}

export interface ToolCallItem {
  callId: string
  seq?: number
  toolCode: string
  toolName?: string
  providerType?: string
  status: 'calling' | 'success' | 'error'
  arguments?: unknown
  durationMs?: number
  sources?: ToolSource[]
  error?: ToolCallError
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  thought: string
  content: string
  isThinking: boolean
  createdAt?: string
  fileReferences?: ChatMessageFileReference[]
  backendMessageId?: string
  toolCalls?: ToolCallItem[]
}

interface ChatState {
  chatMode: ChatMode
  currentAppId: number | null
  currentAgentId: string | null
  currentConversationId: string | null
  messages: ChatMessage[]
  isGenerating: boolean
  taskId: string | null
  uploadedFiles: UploadedFile[]
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    chatMode: 'dify',
    currentAppId: null,
    currentAgentId: null,
    currentConversationId: null,
    messages: [],
    isGenerating: false,
    taskId: null,
    uploadedFiles: []
  }),
  getters: {
    getChatMode: (state): ChatMode => state.chatMode,
    getCurrentAppId: (state): number | null => state.currentAppId,
    getCurrentAgentId: (state): string | null => state.currentAgentId,
    getCurrentConversationId: (state): string | null => state.currentConversationId,
    getMessages: (state): ChatMessage[] => state.messages,
    getIsGenerating: (state): boolean => state.isGenerating,
    getTaskId: (state): string | null => state.taskId,
    getUploadedFiles: (state): UploadedFile[] => state.uploadedFiles
  },
  actions: {
    setChatMode(mode: ChatMode) {
      this.chatMode = mode
    },
    setCurrentAppId(appId: number | null) {
      this.currentAppId = appId
    },
    setCurrentAgentId(agentId: string | null) {
      this.currentAgentId = agentId
    },
    setCurrentConversationId(conversationId: string | null) {
      this.currentConversationId = conversationId
    },
    setMessages(messages: ChatMessage[]) {
      this.messages = messages
    },
    appendMessage(message: ChatMessage) {
      this.messages.push(message)
    },
    setGenerating(isGenerating: boolean) {
      this.isGenerating = isGenerating
    },
    setTaskId(taskId: string | null) {
      this.taskId = taskId
    },
    setUploadedFiles(files: UploadedFile[]) {
      this.uploadedFiles = files
    },
    resetConversationState() {
      this.currentConversationId = null
      this.messages = []
      this.isGenerating = false
      this.taskId = null
      this.uploadedFiles = []
    },
    resetAllState() {
      this.chatMode = 'dify'
      this.currentAppId = null
      this.currentAgentId = null
      this.resetConversationState()
    }
  }
})

export const useChatStoreWithOut = () => useChatStore(store)
