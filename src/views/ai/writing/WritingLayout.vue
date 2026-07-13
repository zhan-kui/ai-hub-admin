<template>
  <div class="writing-page">
    <!-- 左侧历史文档列表 -->
    <aside class="writing-page__sidebar" :class="{ 'is-collapsed': sidebarCollapsed }">
      <!-- 折叠状态：只显示一个浮动按钮 -->
      <button
        v-if="sidebarCollapsed"
        class="writing-page__sidebar-collapsed-btn"
        @click="sidebarCollapsed = false"
        title="展开文档列表"
      >
        <el-icon><Expand /></el-icon>
      </button>

      <!-- 展开状态：白色卡片 + 列表 -->
      <div v-else class="writing-page__sidebar-card">
        <div class="writing-page__sidebar-head">
          <div class="writing-page__sidebar-title">
            <span class="writing-page__sidebar-icon">
              <el-icon><Document /></el-icon>
            </span>
            <span class="writing-page__sidebar-title-text">我的文档</span>
          </div>
          <el-button
            class="writing-page__sidebar-toggle"
            text
            :icon="Fold"
            @click="sidebarCollapsed = true"
          />
        </div>

        <div class="writing-page__sidebar-actions">
          <el-button
            type="primary"
            class="writing-page__new-btn"
            :icon="Plus"
            @click="handleNewDoc"
          >
            新建文档
          </el-button>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索文档"
            clearable
            size="default"
            class="writing-page__search"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="writing-page__doc-list">
          <div
            v-for="group in filteredDocGroups"
            :key="group.label"
            class="writing-page__doc-group"
          >
            <div class="writing-page__doc-group-label">{{ group.label }}</div>
            <div
              v-for="item in group.items"
              :key="item.id"
              class="writing-page__doc-item"
              :class="{ 'is-active': item.id === currentDocId }"
              @click="handleSwitchDoc(item)"
            >
              <div class="writing-page__doc-item-title">
                {{ item.title || '无标题文档' }}
              </div>
              <div class="writing-page__doc-item-meta">
                <span>{{ formatRelativeTime(item.updateTime) }}</span>
                <span class="writing-page__doc-item-dot">·</span>
                <span>{{ item.wordCount }} 字</span>
              </div>
              <el-dropdown
                trigger="click"
                class="writing-page__doc-item-more"
                @click.stop
                @command="(cmd: string) => handleDocCommand(cmd, item)"
              >
                <el-icon @click.stop><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="duplicate">创建副本</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <span style="color: #f56c6c">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <el-empty
            v-if="filteredDocGroups.length === 0"
            description="暂无文档"
            :image-size="80"
            class="writing-page__empty"
          />
        </div>
      </div>
    </aside>

    <!-- 右侧主编辑区 -->
    <main class="writing-page__main">
      <header class="writing-page__header">
        <div class="writing-page__header-top">
          <input v-model="docTitle" class="writing-page__title-input" placeholder="无标题文档" />
          <div class="writing-page__header-actions">
            <input
              ref="importInputRef"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              class="writing-page__file-input"
              @change="handleImportWordChange"
            />
            <el-button :icon="Upload" :loading="importingDoc" @click="triggerImportWord">
              导入 Word
            </el-button>
            <el-button
              :icon="Download"
              :loading="exportingDoc"
              :disabled="isEditorEmpty && !currentDocId"
              @click="handleExportWord"
            >
              导出 Word
            </el-button>
            <el-button :icon="Delete" :disabled="isEditorEmpty" @click="handleClear">
              清空
            </el-button>
            <el-button type="primary" :icon="Promotion" @click="() => handleSave()">
              保存
            </el-button>
          </div>
        </div>

        <div class="writing-page__header-meta">
          <div class="writing-page__meta-left">
            <span class="writing-page__meta-item">
              <el-icon><Calendar /></el-icon>
              最后更新：{{ lastSaveTime }}
            </span>
            <span class="writing-page__meta-item">
              <el-icon><EditPen /></el-icon>
              {{ wordCount }} 字
            </span>
            <span class="writing-page__meta-status" :class="saveStatusClass">
              <span class="writing-page__meta-status-dot"></span>
              {{ saveStatusText }}
            </span>
          </div>
          <div class="writing-page__meta-right">
            <span class="writing-page__hint">
              <el-icon><InfoFilled /></el-icon>
              选中文本右键调用 AI 续写或润色，AI 片段按回车确认
            </span>
          </div>
        </div>
      </header>

      <div class="writing-page__doc-wrap">
        <div
          ref="editorContainerRef"
          v-loading="switchingDocLoading"
          class="writing-page__doc"
          @contextmenu="handleContextMenu"
        >
          <Editor
            ref="editorComponentRef"
            v-model="docContent"
            :editor-config="editorConfig"
            class="writing-page__editor"
            @change="handleEditorChange"
          />
        </div>
      </div>
    </main>

    <ContextMenu
      v-model:visible="ctxVisible"
      :x="ctxPos.x"
      :y="ctxPos.y"
      @continue="handleContinueAction"
      @polish="handlePolishAction"
    />

    <AIResultDialog
      v-model:visible="dialogVisible"
      :action="currentAction"
      :snapshot="currentSnapshot"
      :default-length="defaultLength"
      :default-style="defaultStyle"
      @insert="handleInsert"
      @replace="handleReplace"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { debounce } from 'lodash-es'
import { onBeforeRouteLeave } from 'vue-router'
import { Editor, type EditorExpose } from '@/components/Editor'
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox
} from 'element-plus'
import {
  Calendar,
  Delete,
  Download,
  Document,
  EditPen,
  Expand,
  Fold,
  InfoFilled,
  MoreFilled,
  Plus,
  Promotion,
  Search,
  Upload
} from '@element-plus/icons-vue'
import {
  SlateEditor,
  SlateRange,
  SlateText,
  SlateTransforms,
  type IEditorConfig,
  type IDomEditor
} from '@wangeditor/editor'
import AIResultDialog from './components/AIResultDialog.vue'
import ContextMenu from './components/ContextMenu.vue'
import { useTextSelection } from './composables/useTextSelection'
import {
  deleteDoc,
  duplicateDoc,
  exportDocx,
  getDocDetail,
  getDocList,
  importDocx,
  renameDoc,
  saveDoc
} from '@/api/ai/writing'
import type { ContinueLength, PolishStyle, SelectionSnapshot, WritingAction } from './types'

defineOptions({ name: 'WritingLayout' })

const AI_MARK_BG = 'rgb(240, 249, 255)'
const AI_MARK_TEXT = 'rgb(71, 85, 105)'
const AI_MARK_BG_MATCHER = /240,\s*249,\s*255/

// ============= 文档基础数据 =============
const docTitle = ref('')
const docContent = ref('')
const currentDocId = ref<string | number>('')
const lastSaveTime = ref('刚刚')
const saveStatus = ref<'saved' | 'unsaved' | 'saving'>('unsaved')

const saveStatusText = computed(() => {
  const map = { saved: '已保存', unsaved: '未保存', saving: '保存中...' }
  return map[saveStatus.value]
})

const saveStatusClass = computed(() => `is-${saveStatus.value}`)
const lastSavedFingerprint = ref('')
const pauseStatusSync = ref(false)

const buildFingerprint = () => `${docTitle.value.trim()}\n${docContent.value}`

const syncSavedBaseline = () => {
  lastSavedFingerprint.value = buildFingerprint()
  saveStatus.value = 'saved'
}

const runWithoutStatusSync = (fn: () => void) => {
  pauseStatusSync.value = true
  try {
    fn()
  } finally {
    pauseStatusSync.value = false
  }
}

interface DocItem {
  id: string | number
  title: string
  updateTime: string
  wordCount: number
}

type DocGroupKey = 'today' | 'week' | 'earlier'

const sidebarCollapsed = ref(false)
const searchKeyword = ref('')
const switchingDocLoading = ref(false)
const savingInProgress = ref(false)
const importingDoc = ref(false)
const exportingDoc = ref(false)
const importInputRef = ref<HTMLInputElement | null>(null)
const docList = ref<DocItem[]>([])

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const toDate = (value: unknown): Date | null => {
  if (typeof value === 'number') {
    const ts = value > 1e12 ? value : value * 1000
    const date = new Date(ts)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

const toIsoString = (value: unknown) => {
  const date = toDate(value)
  return date ? date.toISOString() : new Date().toISOString()
}

const getDocGroup = (updateTime: string): DocGroupKey => {
  const date = toDate(updateTime)
  if (!date) return 'earlier'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (date >= startOfToday) return 'today'

  const startOfWeek = new Date(startOfToday)
  const weekday = startOfWeek.getDay()
  const diffToMonday = weekday === 0 ? 6 : weekday - 1
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday)
  return date >= startOfWeek ? 'week' : 'earlier'
}

const padZero = (value: number) => String(value).padStart(2, '0')

const formatRelativeTime = (iso: string): string => {
  const date = toDate(iso)
  if (!date) return '-'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((startOfToday.getTime() - startOfTarget.getTime()) / 86400000)
  const clock = `${padZero(date.getHours())}:${padZero(date.getMinutes())}`

  if (diffDays <= 0) return `今天 ${clock}`
  if (diffDays === 1) return `昨天 ${clock}`
  if (diffDays < 7) return `${diffDays}天前`

  const diffWeeks = Math.max(1, Math.floor(diffDays / 7))
  return `${diffWeeks}周前`
}

const extractDocId = (payload: unknown): string | number | '' => {
  if (!payload || typeof payload !== 'object') return ''
  const source = payload as Record<string, unknown>
  const directId = source.id ?? source.docId ?? source.documentId
  if (directId !== undefined && directId !== null && directId !== '') {
    return directId as string | number
  }

  const nested = source.data
  if (!nested || typeof nested !== 'object') return ''
  const nestedSource = nested as Record<string, unknown>
  const nestedId = nestedSource.id ?? nestedSource.docId ?? nestedSource.documentId
  return nestedId !== undefined && nestedId !== null && nestedId !== ''
    ? (nestedId as string | number)
    : ''
}

const extractDocListRows = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (!payload || typeof payload !== 'object') return []

  const source = payload as Record<string, unknown>
  const keys = ['list', 'records', 'items', 'rows']
  for (const key of keys) {
    if (Array.isArray(source[key])) {
      return source[key] as Record<string, unknown>[]
    }
  }

  const nested = source.data
  if (!nested || typeof nested !== 'object') return []
  const nestedSource = nested as Record<string, unknown>
  for (const key of keys) {
    if (Array.isArray(nestedSource[key])) {
      return nestedSource[key] as Record<string, unknown>[]
    }
  }
  return []
}

const normalizeDocItem = (row: Record<string, unknown>): DocItem | null => {
  const id = row.id ?? row.docId ?? row.documentId
  if (id === undefined || id === null || id === '') return null

  const titleValue = row.title ?? row.name ?? row.docTitle ?? ''
  const contentValue = row.content ?? row.docContent
  const updateTimeValue =
    row.updateTime ?? row.updatedAt ?? row.update_at ?? row.gmtModified ?? row.createTime
  const wordCountValue =
    row.wordCount ?? row.word_count ?? row.words ?? row.contentLength ?? row.tokenCount
  const contentText = typeof contentValue === 'string' ? extractPlainTextFromHtml(contentValue) : ''

  return {
    id: id as string | number,
    title: String(titleValue || ''),
    updateTime: toIsoString(updateTimeValue),
    wordCount: Number(wordCountValue || 0) || contentText.length
  }
}

const normalizeDocDetail = (payload: unknown, fallback: DocItem) => {
  if (!payload || typeof payload !== 'object') {
    return {
      id: fallback.id,
      title: fallback.title,
      content: '',
      updateTime: fallback.updateTime
    }
  }

  const source = payload as Record<string, unknown>
  const nested = source.data && typeof source.data === 'object' ? source.data : source
  const detail = nested as Record<string, unknown>

  const id = (detail.id ?? detail.docId ?? detail.documentId ?? fallback.id) as string | number
  const title = String(detail.title ?? detail.name ?? detail.docTitle ?? fallback.title ?? '')
  const content = String(detail.content ?? detail.docContent ?? detail.text ?? '')
  const updateTime = toIsoString(
    detail.updateTime ??
      detail.updatedAt ??
      detail.update_at ??
      detail.gmtModified ??
      fallback.updateTime
  )
  return { id, title, content, updateTime }
}

const refreshDocList = async () => {
  try {
    const result = await getDocList({
      page: 1,
      size: 50,
      keyword: searchKeyword.value.trim() || undefined
    })
    const rows = extractDocListRows(result)
    const normalized = rows.map((row) => normalizeDocItem(row)).filter(Boolean) as DocItem[]
    docList.value = normalized
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载文档列表失败'))
  }
}

const debouncedRefreshDocList = debounce(() => {
  void refreshDocList()
}, 300)

watch(searchKeyword, () => {
  debouncedRefreshDocList()
})

const filteredDocGroups = computed(() => {
  const groupMap: Record<DocGroupKey, { label: string; items: DocItem[] }> = {
    today: { label: '今天', items: [] },
    week: { label: '本周', items: [] },
    earlier: { label: '更早', items: [] }
  }

  docList.value.forEach((item) => {
    groupMap[getDocGroup(item.updateTime)].items.push(item)
  })
  return Object.values(groupMap).filter((group) => group.items.length > 0)
})

const handleNewDoc = () => {
  ;(debouncedAutoSave as { cancel?: () => void }).cancel?.()
  runWithoutStatusSync(() => {
    docTitle.value = ''
    docContent.value = ''
    currentDocId.value = ''
  })
  lastSaveTime.value = '保存时间'
  lastSavedFingerprint.value = buildFingerprint()
  saveStatus.value = 'unsaved'
}

const doSwitch = async (item: DocItem) => {
  if (switchingDocLoading.value) return
  switchingDocLoading.value = true
  try {
    const detail = await getDocDetail(item.id)
    const normalized = normalizeDocDetail(detail, item)
    runWithoutStatusSync(() => {
      currentDocId.value = normalized.id
      docTitle.value = normalized.title
      docContent.value = normalized.content
    })
    lastSaveTime.value = formatRelativeTime(normalized.updateTime)
    syncSavedBaseline()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '出错了'))
  } finally {
    switchingDocLoading.value = false
  }
}

const handleSwitchDoc = (item: DocItem) => {
  if (shouldPromptUnsaved.value) {
    ElMessageBox.confirm('当前文档未保存，需手动保存后再切换，是否继续切换？', '提示', {
      confirmButtonText: '切换',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => {
        void doSwitch(item)
      })
      .catch(() => {})
    return
  }
  void doSwitch(item)
}

const handleDocCommand = async (cmd: string, item: DocItem) => {
  if (cmd === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('请输入新名称', '重命名', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: item.title
      })
      const nextTitle = value.trim()
      if (!nextTitle || nextTitle === item.title) return

      await renameDoc({ id: item.id, title: nextTitle })
      const idx = docList.value.findIndex((doc) => String(doc.id) === String(item.id))
      if (idx > -1) {
        docList.value[idx] = { ...docList.value[idx], title: nextTitle }
      }
      if (String(currentDocId.value) === String(item.id)) {
        const wasUnsaved = saveStatus.value === 'unsaved'
        docTitle.value = nextTitle
        if (wasUnsaved) {
          refreshSaveStatusByDiff()
        } else {
          syncSavedBaseline()
        }
      }
      ElMessage.success('已重命名')
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(getErrorMessage(error, '重命名失败'))
      }
    }
    return
  }

  if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除「${item.title || '无标题文档'}」吗？`, '提示', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      })

      await deleteDoc(item.id)
      const isCurrentDoc = String(currentDocId.value) === String(item.id)
      const idx = docList.value.findIndex((doc) => String(doc.id) === String(item.id))
      if (idx > -1) {
        docList.value.splice(idx, 1)
      }
      if (isCurrentDoc) {
        handleNewDoc()
      }
      ElMessage.success('已删除')
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(getErrorMessage(error, '删除失败'))
      }
    }
    return
  }

  if (cmd === 'duplicate') {
    try {
      const result = await duplicateDoc(item.id)
      const duplicatedId = extractDocId(result)
      await refreshDocList()

      if (duplicatedId !== '') {
        const duplicated = docList.value.find((doc) => String(doc.id) === String(duplicatedId))
        if (duplicated) {
          await doSwitch(duplicated)
        }
      }
      ElMessage.success('已创建副本')
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '创建副本失败'))
    }
  }
}

const handleSave = async (silent = false) => {
  if (savingInProgress.value) return false
  if (isTitleEmpty.value) {
    saveStatus.value = 'unsaved'
    if (!silent) {
      ElMessage.warning('标题为空，未保存文档需要手动保存')
    }
    return false
  }

  savingInProgress.value = true
  const prevStatus = saveStatus.value
  saveStatus.value = 'saving'

  try {
    const prevId = currentDocId.value
    const result = await saveDoc({
      id: currentDocId.value || undefined,
      title: docTitle.value,
      content: docContent.value
    })

    if (!prevId) {
      const newId = extractDocId(result)
      if (newId !== '') {
        currentDocId.value = newId
      }
    }

    syncSavedBaseline()
    lastSaveTime.value = '刚刚'
    await refreshDocList()
    if (!silent) {
      ElMessage.success('保存成功')
    }
    return true
  } catch (error) {
    saveStatus.value = prevStatus === 'saving' ? 'unsaved' : prevStatus
    if (saveStatus.value === 'saved') {
      saveStatus.value = 'unsaved'
    }
    ElMessage.error(getErrorMessage(error, '出错了'))
    return false
  } finally {
    savingInProgress.value = false
  }
}

const debouncedAutoSave = useDebounceFn(() => {
  if (saveStatus.value !== 'unsaved' || savingInProgress.value || isTitleEmpty.value) return
  void handleSave(true)
}, 3000)

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!shouldPromptUnsaved.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(async () => {
  if (!shouldPromptUnsaved.value) return true
  try {
    await ElMessageBox.confirm('当前文档未保存，需手动保存后再离开，是否继续离开？', '提示', {
      confirmButtonText: '离开',
      cancelButtonText: '取消',
      type: 'warning'
    })
    return true
  } catch {
    return false
  }
})

const editorComponentRef = ref<(typeof Editor & EditorExpose) | null>(null)
const editorContainerRef = ref<HTMLElement | null>(null)
const editableElementRef = ref<HTMLElement | null>(null)
const domEditorRef = shallowRef<IDomEditor | null>(null)

const editorConfig: IEditorConfig = {
  placeholder: '在这里开始写作，选中文本后右键可调用 AI 续写 或 AI 润色。',
  autoFocus: false,
  scroll: true,
  readOnly: false,
  hoverbarKeys: {},
  customAlert() {}
}

const getEditor = () => domEditorRef.value

const parseHtml = (html: string): Document | null => {
  if (!html || typeof window === 'undefined') return null
  return new DOMParser().parseFromString(html, 'text/html')
}

const extractPlainTextFromHtml = (html: string): string => {
  if (!html) return ''
  if (typeof window === 'undefined') {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim()
  }
  const doc = parseHtml(html)
  return (doc?.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}

const isEditorEmpty = computed(() => !extractPlainTextFromHtml(docContent.value))
const isTitleEmpty = computed(() => !docTitle.value.trim())
const wordCount = computed(() => extractPlainTextFromHtml(docContent.value).length)

const refreshSaveStatusByDiff = () => {
  if (pauseStatusSync.value || saveStatus.value === 'saving') return
  if (isTitleEmpty.value) {
    saveStatus.value = 'unsaved'
    return
  }
  saveStatus.value = buildFingerprint() === lastSavedFingerprint.value ? 'saved' : 'unsaved'
}

const shouldPromptUnsaved = computed(() => saveStatus.value === 'unsaved')

const resolveImportTitle = (fileName: string) => fileName.replace(/\.docx$/i, '') || '导入文档'

const triggerImportWord = () => {
  const openFilePicker = () => importInputRef.value?.click()
  if (shouldPromptUnsaved.value) {
    ElMessageBox.confirm('当前文档未保存，导入后会切换到新文档，是否继续导入？', '提示', {
      confirmButtonText: '导入',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(openFilePicker)
      .catch(() => {})
    return
  }
  openFilePicker()
}

const handleImportWordChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || importingDoc.value) return

  if (!file.name.toLowerCase().endsWith('.docx')) {
    ElMessage.warning('仅支持导入 .docx 格式的 Word 文档')
    return
  }

  importingDoc.value = true
  try {
    const result = await importDocx(file)
    const importedId = extractDocId(result)
    await refreshDocList()

    if (importedId !== '') {
      const imported = docList.value.find((doc) => String(doc.id) === String(importedId))
      await doSwitch(
        imported || {
          id: importedId,
          title: resolveImportTitle(file.name),
          updateTime: new Date().toISOString(),
          wordCount: 0
        }
      )
    }
    ElMessage.success('Word 文档导入成功')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, 'Word 文档导入失败'))
  } finally {
    importingDoc.value = false
  }
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'AI写作文档.docx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const handleExportWord = async () => {
  if (exportingDoc.value) return
  exportingDoc.value = true
  try {
    if (saveStatus.value === 'unsaved' || !currentDocId.value) {
      const saved = await handleSave(true)
      if (!saved) {
        ElMessage.warning('请先填写标题并保存后再导出')
        return
      }
    }

    if (!currentDocId.value) {
      ElMessage.warning('请先保存文档后再导出')
      return
    }

    const result = await exportDocx(currentDocId.value)
    downloadBlob(result.blob, result.fileName)
    ElMessage.success('Word 文档导出成功')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, 'Word 文档导出失败'))
  } finally {
    exportingDoc.value = false
  }
}

const handleClear = () => {
  if (isEditorEmpty.value) return
  ElMessageBox.confirm('确定清空当前文档内容？', '提示', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      docContent.value = ''
      refreshSaveStatusByDiff()
      debouncedAutoSave()
    })
    .catch(() => {})
}

const { snapshot, insertAfterSelection, replaceSelection } = useTextSelection(
  editorContainerRef,
  getEditor
)

const ctxVisible = ref(false)
const ctxPos = ref({ x: 0, y: 0 })
const currentSnapshot = ref<SelectionSnapshot | null>(null)

const dialogVisible = ref(false)
const currentAction = ref<WritingAction>('continue')
const defaultLength = ref<ContinueLength>('medium')
const defaultStyle = ref<PolishStyle>('default')

const handleEditorChange = (editor: IDomEditor) => {
  domEditorRef.value = editor
  refreshSaveStatusByDiff()
  if (saveStatus.value !== 'unsaved') return
  debouncedAutoSave()
}

watch(
  () => docTitle.value,
  () => {
    refreshSaveStatusByDiff()
    if (saveStatus.value !== 'unsaved') return
    debouncedAutoSave()
  }
)

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildAiMarkedHtml = (text: string): string => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '')
  const html = escapeHtml(normalized).replace(/\n/g, '<br>')
  return `<span style="background-color: ${AI_MARK_BG}; color: ${AI_MARK_TEXT};">${html}</span>`
}

const isAiColorValue = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  return AI_MARK_BG_MATCHER.test(value) || value.toLowerCase() === '#f0f9ff'
}

const findCurrentAiFragmentRange = (editor: IDomEditor) => {
  const selection = editor.selection
  if (!selection || !SlateRange.isCollapsed(selection)) return null

  const currentEntry = SlateEditor.leaf(editor, selection.anchor)
  if (!currentEntry) return null

  const [currentLeaf, currentPath] = currentEntry
  if (
    !SlateText.isText(currentLeaf) ||
    !isAiColorValue((currentLeaf as { bgColor?: string }).bgColor)
  ) {
    return null
  }

  let startEntry = currentEntry
  let previousEntry = SlateEditor.previous(editor, {
    at: currentPath,
    match: (node) => SlateText.isText(node)
  })

  while (
    previousEntry &&
    SlateText.isText(previousEntry[0]) &&
    isAiColorValue((previousEntry[0] as { bgColor?: string }).bgColor)
  ) {
    startEntry = previousEntry
    previousEntry = SlateEditor.previous(editor, {
      at: previousEntry[1],
      match: (node) => SlateText.isText(node)
    })
  }

  let endEntry = currentEntry
  let nextEntry = SlateEditor.next(editor, {
    at: currentPath,
    match: (node) => SlateText.isText(node)
  })

  while (
    nextEntry &&
    SlateText.isText(nextEntry[0]) &&
    isAiColorValue((nextEntry[0] as { bgColor?: string }).bgColor)
  ) {
    endEntry = nextEntry
    nextEntry = SlateEditor.next(editor, {
      at: nextEntry[1],
      match: (node) => SlateText.isText(node)
    })
  }

  const [startLeaf, startPath] = startEntry
  const [endLeaf, endPath] = endEntry

  return {
    anchor: { path: startPath, offset: 0 },
    focus: {
      path: endPath,
      offset: startLeaf === endLeaf ? endLeaf.text.length : endLeaf.text.length
    }
  }
}

const confirmAiFragmentAtCursor = (): boolean => {
  const editor = domEditorRef.value
  if (!editor) return false

  const fragmentRange = findCurrentAiFragmentRange(editor)
  if (!fragmentRange) return false

  const focusPoint = SlateRange.end(fragmentRange)
  editor.select(fragmentRange)
  SlateTransforms.unsetNodes(editor, ['bgColor', 'color'], {
    at: fragmentRange,
    match: (node) => SlateText.isText(node),
    split: true
  })
  editor.select({ anchor: focusPoint, focus: focusPoint })
  return true
}

const handleEditableKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return

  const confirmed = confirmAiFragmentAtCursor()
  if (!confirmed) return

  event.preventDefault()
  event.stopPropagation()
  ElMessage.success('已确认 AI 片段，样式已恢复为普通正文')
}

const bindEditableKeydown = () => {
  editableElementRef.value?.removeEventListener('keydown', handleEditableKeydown, true)

  const editable = editorContainerRef.value?.querySelector(
    ".w-e-text-container [contenteditable='true']"
  )

  if (!(editable instanceof HTMLElement)) {
    editableElementRef.value = null
    return
  }

  editable.addEventListener('keydown', handleEditableKeydown, true)
  editableElementRef.value = editable
}

const handleContextMenu = (event: MouseEvent) => {
  const selectedSnapshot = snapshot({ prefixChars: 500, suffixChars: 200 })
  if (!selectedSnapshot) return

  event.preventDefault()
  currentSnapshot.value = selectedSnapshot
  ctxPos.value = { x: event.clientX, y: event.clientY }
  ctxVisible.value = true
}

const handleContinueAction = (length: ContinueLength) => {
  if (!currentSnapshot.value) return
  currentAction.value = 'continue'
  defaultLength.value = length
  dialogVisible.value = true
}

const handlePolishAction = (style: PolishStyle) => {
  if (!currentSnapshot.value) return
  currentAction.value = 'polish'
  defaultStyle.value = style
  dialogVisible.value = true
}

const handleInsert = (text: string, selectedSnapshot: SelectionSnapshot) => {
  const success = insertAfterSelection(selectedSnapshot, buildAiMarkedHtml(text))
  if (!success) {
    ElMessage.error('插入失败，请重试')
    return
  }
  bindEditableKeydown()
  ElMessage.success('已插入 AI 内容，光标位于该片段内时按回车可确认')
}

const handleReplace = (text: string, selectedSnapshot: SelectionSnapshot) => {
  const success = replaceSelection(selectedSnapshot, buildAiMarkedHtml(text))
  if (!success) {
    ElMessage.error('替换失败，请重试')
    return
  }
  bindEditableKeydown()
  ElMessage.success('已替换为 AI 内容，光标位于该片段内时按回车可确认')
}

onMounted(async () => {
  await nextTick()
  const editor = await editorComponentRef.value?.getEditorRef()
  domEditorRef.value = editor ?? null
  domEditorRef.value?.focus(true)
  bindEditableKeydown()

  window.addEventListener('beforeunload', handleBeforeUnload)
  await refreshDocList()
  if (currentDocId.value) {
    syncSavedBaseline()
  } else {
    lastSavedFingerprint.value = buildFingerprint()
    saveStatus.value = 'unsaved'
  }
})

onBeforeUnmount(() => {
  editableElementRef.value?.removeEventListener('keydown', handleEditableKeydown, true)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  ;(debouncedAutoSave as { cancel?: () => void }).cancel?.()
  debouncedRefreshDocList.cancel()
  ctxVisible.value = false
  dialogVisible.value = false
})
</script>

<style lang="less" scoped>
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.38;
  }
}

/* ============ 响应式 ============ */
@media (width <= 1280px) {
  .writing-page__doc {
    width: 100%;
  }

  .writing-page__editor :deep(.w-e-scroll) {
    padding: 32px 44px 56px;
  }

  .writing-page__editor :deep(.w-e-text-placeholder) {
    top: 32px;
    left: 44px;
  }
}

@media (width <= 1024px) {
  .writing-page__sidebar {
    width: 248px;
  }

  .writing-page__header {
    padding: 16px 20px 12px;
  }

  .writing-page__doc-wrap {
    padding: 14px 20px 20px;
  }
}

@media (width <= 768px) {
  .writing-page__sidebar {
    position: absolute;
    z-index: 20;
    height: 100%;
    box-shadow: 12px 0 30px rgb(15 23 42 / 12%);
  }

  .writing-page__sidebar.is-collapsed {
    box-shadow: none;
  }

  .writing-page__header {
    padding: 14px 16px 10px 72px;
  }

  .writing-page__title-input {
    font-size: 19px;
  }

  .writing-page__header-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .writing-page__header-actions {
    width: 100%;
  }

  .writing-page__header-actions :deep(.el-button) {
    flex: 1;
  }

  .writing-page__header-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .writing-page__meta-right {
    display: none;
  }

  .writing-page__doc-wrap {
    padding: 12px 12px 16px 72px;
  }

  .writing-page__doc {
    border-radius: 14px;
  }

  .writing-page__editor :deep(.w-e-scroll) {
    padding: 20px 18px 32px;
  }

  .writing-page__editor :deep(.w-e-text-placeholder) {
    top: 20px;
    left: 18px;
  }
}

:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.writing-page {
  --page-bg: #f5f7fb;
  --panel-bg: #f8faff;
  --card-bg: #fff;
  --card-soft: #fbfdff;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-soft: #eaf1ff;
  --primary-subtle: #f1f5ff;
  --border: #e4eaf3;
  --border-soft: #edf2f8;
  --text-main: #1f2937;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --shadow-card: 0 10px 26px rgb(15 23 42 / 5%);
  --font-sans: inter, -apple-system, blinkmacsystemfont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;

  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  font-family: var(--font-sans);
  color: var(--text-main);
  background: linear-gradient(90deg, #f8faff 0 280px, transparent 280px),
    linear-gradient(180deg, #f5f7fb 0%, #f7f9fd 100%);
}

/* ============ 左侧文档工作区 ============ */
.writing-page__sidebar {
  position: relative;
  display: flex;
  width: 288px;
  height: 100%;
  min-height: 0;
  padding: 0;
  flex-direction: column;
  flex-shrink: 0;
  background: #f8faff;
  border-right: 1px solid var(--border);
  transition:
    width 0.22s ease,
    background-color 0.22s ease;
}

.writing-page__sidebar.is-collapsed {
  width: 56px;
  align-items: center;
  padding-top: 16px;
}

.writing-page__sidebar-collapsed-btn {
  display: inline-flex;
  width: 36px;
  height: 36px;
  padding: 0;
  margin: 0;
  font-size: 17px;
  color: var(--text-secondary);
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgb(15 23 42 / 5%);
  transition: all 0.16s ease;

  &:hover {
    color: var(--primary);
    background: var(--primary-soft);
    border-color: #bfdbfe;
  }
}

.writing-page__sidebar-card {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  flex-direction: column;
}

.writing-page__sidebar-head {
  display: flex;
  height: 64px;
  padding: 0 14px 0 18px;
  background: #f8faff;
  border-bottom: 1px solid var(--border-soft);
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.writing-page__sidebar-title {
  display: inline-flex;
  min-width: 0;
  overflow: hidden;
  align-items: center;
  gap: 10px;
}

.writing-page__sidebar-icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  font-size: 15px;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid #dbe7ff;
  border-radius: 10px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.writing-page__sidebar-title-text {
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.writing-page__sidebar-toggle {
  width: 30px;
  height: 30px;
  color: var(--text-muted) !important;
  border-radius: 8px;

  &:hover {
    color: var(--primary) !important;
    background: var(--primary-soft) !important;
  }
}

.writing-page__sidebar-actions {
  display: grid;
  padding: 14px 14px 12px;
  background: #f8faff;
  border-bottom: 1px solid var(--border-soft);
  gap: 10px;
  flex-shrink: 0;
}

.writing-page__new-btn {
  width: 100%;
  height: 38px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #fff !important;
  background: var(--primary) !important;
  border: 0 !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 18px rgb(37 99 235 / 18%);

  &:hover {
    background: var(--primary-hover) !important;
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgb(37 99 235 / 24%);
  }
}

.writing-page__search :deep(.el-input__wrapper) {
  height: 36px;
  background: #fff !important;
  border-radius: 10px !important;
  box-shadow: 0 0 0 1px var(--border) inset !important;
  transition: all 0.16s ease;

  &:hover {
    box-shadow: 0 0 0 1px #cbd8ea inset !important;
  }

  &.is-focus {
    background: #fff !important;
    box-shadow:
      0 0 0 1px var(--primary) inset,
      0 0 0 3px rgb(37 99 235 / 10%) !important;
  }
}

.writing-page__search :deep(.el-input__prefix) {
  color: var(--text-muted);
}

/* ============ 文档列表 ============ */
.writing-page__doc-list {
  flex: 1;
  min-height: 0;
  padding: 10px 10px 14px;
  overflow-y: auto;
  background: #f8faff;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(148 163 184 / 32%);
    border-radius: 999px;
  }
}

.writing-page__doc-group {
  margin-bottom: 14px;
}

.writing-page__doc-group-label {
  padding: 8px 8px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.writing-page__doc-item {
  position: relative;
  padding: 11px 12px;
  margin-bottom: 5px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;

  &::before {
    position: absolute;
    top: 12px;
    bottom: 12px;
    left: 0;
    width: 3px;
    background: transparent;
    border-radius: 999px;
    content: '';
  }

  &:hover {
    background: #fff;
    border-color: var(--border-soft);

    .writing-page__doc-item-more {
      opacity: 1;
    }
  }

  &.is-active {
    background: var(--primary-soft);
    border-color: #d6e4ff;
    box-shadow: 0 6px 14px rgb(37 99 235 / 7%);

    &::before {
      background: var(--primary);
    }

    .writing-page__doc-item-title {
      font-weight: 700;
      color: var(--primary);
    }
  }
}

.writing-page__doc-item-title {
  padding-right: 24px;
  margin-bottom: 5px;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.writing-page__doc-item-meta {
  display: flex;
  font-size: 11.5px;
  color: var(--text-muted);
  align-items: center;
  gap: 5px;
}

.writing-page__doc-item-dot {
  color: #cbd5e1;
}

.writing-page__doc-item-more {
  position: absolute;
  top: 9px;
  right: 8px;
  display: inline-flex;
  width: 24px;
  height: 24px;
  font-size: 14px;
  color: var(--text-muted);
  border-radius: 8px;
  opacity: 0;
  transition: all 0.16s ease;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--primary);
    background: #fff;
  }
}

.writing-page__empty {
  padding-top: 40px;
}

/* ============ 右侧编辑工作区 ============ */
.writing-page__main {
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--page-bg);
  flex: 1;
  flex-direction: column;
}

.writing-page__header {
  position: relative;
  z-index: 2;
  padding: 18px 28px 14px;
  background: var(--page-bg);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.writing-page__header-top {
  display: flex;
  margin-bottom: 10px;
  align-items: center;
  gap: 16px;
}

.writing-page__title-input {
  width: 100%;
  height: 42px;
  min-width: 0;
  padding: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 42px;
  letter-spacing: -0.02em;
  color: var(--text-main);
  background: transparent;
  border: 0;
  outline: none;
  flex: 1;

  &::placeholder {
    color: #b6c2d2;
  }
}

.writing-page__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.writing-page__file-input {
  display: none;
}

.writing-page__header-actions :deep(.el-button) {
  height: 34px;
  border-radius: 10px;
}

.writing-page__header-actions :deep(.el-button--primary) {
  background: var(--primary) !important;
  border-color: var(--primary) !important;
  box-shadow: 0 6px 14px rgb(37 99 235 / 16%);

  &:hover {
    background: var(--primary-hover) !important;
    border-color: var(--primary-hover) !important;
  }
}

.writing-page__header-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.writing-page__meta-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.writing-page__meta-item,
.writing-page__hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-secondary);

  .el-icon {
    font-size: 14px;
    color: var(--text-muted);
  }
}

.writing-page__hint {
  color: var(--text-muted);
}

.writing-page__meta-status {
  display: inline-flex;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  align-items: center;
  gap: 6px;

  &.is-saved {
    color: var(--success);
    background: rgb(22 163 74 / 9%);

    .writing-page__meta-status-dot {
      background: var(--success);
    }
  }

  &.is-unsaved {
    color: var(--warning);
    background: rgb(217 119 6 / 10%);

    .writing-page__meta-status-dot {
      background: var(--warning);
    }
  }

  &.is-saving {
    color: var(--primary);
    background: rgb(37 99 235 / 10%);

    .writing-page__meta-status-dot {
      background: var(--primary);
      animation: pulse 1.4s ease-in-out infinite;
    }
  }
}

.writing-page__meta-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
}

/* ============ 编辑器容器 ============ */
.writing-page__doc-wrap {
  display: flex;
  min-height: 0;
  padding: 18px 28px 24px;
  overflow: hidden;
  background: var(--page-bg);
  flex: 1;
  justify-content: center;
}

.writing-page__doc {
  display: flex;
  width: min(100%, 1080px);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  flex-direction: column;
}

.writing-page__editor {
  display: flex;
  min-height: 0;
  overflow: hidden;
  border-radius: 16px;
  flex: 1;
  flex-direction: column;
}

.writing-page__editor :deep([data-w-e-textarea='true']) {
  display: flex;
  height: auto !important;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.writing-page__editor :deep(.w-e-toolbar),
.writing-page__editor :deep(.w-e-bar) {
  padding: 8px 14px;
  background: #fbfdff;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.writing-page__editor :deep(.w-e-bar-item button),
.writing-page__editor :deep(.w-e-bar-item > div) {
  border-radius: 8px;
}

.writing-page__editor :deep(.w-e-bar-item button:hover),
.writing-page__editor :deep(.w-e-bar-item > div:hover) {
  background: var(--primary-soft);
}

.writing-page__editor :deep(.w-e-text-container) {
  display: flex;
  height: 100% !important;
  min-height: 0 !important;
  overflow: hidden;
  background: #fff;
  flex: 1 1 auto;
  flex-direction: column;
}

.writing-page__editor :deep(.w-e-scroll) {
  height: auto !important;
  max-height: none;
  min-height: 0;
  padding: 40px 64px 72px;
  overflow: hidden auto;
  box-sizing: border-box;
  scrollbar-gutter: stable;
  flex: 1 1 auto;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgb(148 163 184 / 34%);
    border-radius: 999px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgb(100 116 139 / 46%);
  }
}

.writing-page__editor :deep(.w-e-text-placeholder) {
  top: 40px;
  left: 64px;
  font-style: normal;
  color: #b6c2d2;
}

.writing-page__editor :deep(.w-e-hover-bar) {
  display: none !important;
}

.writing-page__editor :deep(.w-e-text-container [data-slate-editor]),
.writing-page__editor :deep(.w-e-text-container [contenteditable='true']) {
  min-height: 100% !important;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  line-height: 2;
  color: #1e293b;
  box-sizing: border-box;
}

.writing-page__editor :deep(p) {
  margin: 0 0 0.62em;
}

.writing-page__editor :deep(h1),
.writing-page__editor :deep(h2),
.writing-page__editor :deep(h3) {
  color: var(--text-main);
}

.writing-page__editor :deep(blockquote) {
  padding: 10px 14px;
  margin: 12px 0;
  color: var(--text-secondary);
  background: #f8faff;
  border-left: 3px solid #bfdbfe;
  border-radius: 8px;
}

/* AI 片段标记：保留提示性，但降低炫光感 */
.writing-page__editor :deep(span[style*='240, 249, 255']),
.writing-page__editor :deep(span[style*='240,249,255']),
.writing-page__editor :deep(span[style*='#f0f9ff']) {
  padding: 0.08em 0.24em;
  color: #475569 !important;
  text-decoration: underline dashed rgb(37 99 235 / 45%) 1px;
  background: #f0f7ff !important;
  border-radius: 0.38em;
  box-shadow: inset 0 0 0 1px rgb(37 99 235 / 15%);
  text-underline-offset: 0.18em;
  box-decoration-break: clone;
}

/* ============ 全局 Element 细节统一 ============ */
.writing-page :deep(.el-button) {
  font-weight: 500;
}

.writing-page :deep(.el-button:not(.el-button--primary)) {
  color: var(--text-secondary);
  background: #fff;
  border-color: var(--border);

  &:hover {
    color: var(--primary);
    background: var(--primary-soft);
    border-color: #bfdbfe;
  }
}

.writing-page :deep(.el-loading-mask) {
  background: rgb(248 250 255 / 78%);
  backdrop-filter: blur(2px);
}

/*
 * Writing 页面 - 企业 SaaS 蓝灰主题（方案 A）
 * 设计目标：与主菜单/智能体管理/知识库保持一致，降低卡片割裂感，突出编辑效率。
 */
</style>
