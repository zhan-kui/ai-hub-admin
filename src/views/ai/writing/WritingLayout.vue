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
  Document,
  EditPen,
  Expand,
  Fold,
  InfoFilled,
  MoreFilled,
  Plus,
  Promotion,
  Search
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
  getDocDetail,
  getDocList,
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
/* ============ 最外层 ============ */
.writing-page {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(180deg, #f5f7fa 0%, #eef2f7 100%);
}

/* ============ 左侧边栏：作为容器，自身无背景 ============ */
.writing-page__sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 280px;
  height: 100%;
  /* 上下 padding 与右侧 doc-wrap 一致，让卡片顶/底对齐 */
  padding: 0 0 28px 16px;
  /* 顶部 padding 用 header 高度 + doc-wrap 顶部 padding，让卡片顶部和编辑器卡片对齐 */
  /* header 高度: 56px(top行) + 10px(margin) + 22px(meta行) + 18+14 padding = ~120px */
  /* 但因为我们把卡片的顶部从最顶端开始，更简单的做法：让 sidebar 自己管理内边距 */
  padding-top: 24px;
  transition:
    width 0.25s ease,
    padding 0.25s ease;
}

/* 折叠状态：宽度收成一个按钮 */
.writing-page__sidebar.is-collapsed {
  width: 56px;
  padding: 24px 0 28px 12px;
}

/* 折叠时的浮动按钮 */
.writing-page__sidebar-collapsed-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  font-size: 18px;
  color: #475569;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e4e9f0;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  transition: all 0.2s ease;

  &:hover {
    color: #0ea5e9;
    background: #fff;
    box-shadow: 0 6px 16px rgba(14, 165, 233, 0.18);
    transform: translateY(-1px);
  }
}

/* ============ 卡片化的 sidebar 内容 ============ */
.writing-page__sidebar-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  /* 与右侧编辑器卡片样式完全一致 */
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 16px;
  box-shadow:
    0 12px 36px rgba(15, 23, 42, 0.05),
    0 2px 6px rgba(15, 23, 42, 0.03);
  overflow: hidden;
}

.writing-page__sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  height: 52px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid #eef0f4;
  background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
}

.writing-page__sidebar-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.writing-page__sidebar-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.writing-page__sidebar-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 14px;
  color: #fff;
  background: linear-gradient(135deg, #0ea5e9, #38bdf8);
  border-radius: 7px;
  box-shadow: 0 4px 10px rgba(14, 165, 233, 0.25);
}

.writing-page__sidebar-toggle {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  font-size: 15px;
  color: #64748b;
  border-radius: 8px;
}

.writing-page__sidebar-actions {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 10px;
  padding: 14px 14px 8px;
}

.writing-page__new-btn {
  width: 100%;
  height: 36px;
  font-weight: 500;
  background: linear-gradient(135deg, #0ea5e9, #38bdf8);
  border: none;
  box-shadow: 0 6px 14px rgba(14, 165, 233, 0.28);

  &:hover {
    background: linear-gradient(135deg, #0284c7, #0ea5e9);
    box-shadow: 0 8px 18px rgba(14, 165, 233, 0.35);
  }
}

.writing-page__search :deep(.el-input__wrapper) {
  background: #f1f5f9;
  border-radius: 10px;
  box-shadow: none;

  &:hover,
  &.is-focus {
    background: #fff;
    box-shadow: 0 0 0 1px #0ea5e9;
  }
}

/* ============ 文档列表 ============ */
.writing-page__doc-list {
  flex: 1;
  min-height: 0;
  padding: 4px 8px 14px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.35);
    border-radius: 3px;
  }
}

.writing-page__doc-group {
  margin-bottom: 12px;
}

.writing-page__doc-group-label {
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.writing-page__doc-item {
  position: relative;
  padding: 9px 12px;
  margin-bottom: 3px;
  cursor: pointer;
  border-radius: 9px;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(14, 165, 233, 0.06);

    .writing-page__doc-item-more {
      opacity: 1;
    }
  }

  &.is-active {
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(56, 189, 248, 0.08));
    box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.25);

    .writing-page__doc-item-title {
      color: #0369a1;
    }
  }
}

.writing-page__doc-item-title {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
  padding-right: 20px;
}

.writing-page__doc-item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.writing-page__doc-item-dot {
  color: #cbd5e1;
}

.writing-page__doc-item-more {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 14px;
  color: #94a3b8;
  border-radius: 6px;
  opacity: 0;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(148, 163, 184, 0.18);
    color: #475569;
  }
}

.writing-page__empty {
  padding-top: 30px;
}

/* ============ 右侧主区域 ============ */
.writing-page__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.writing-page__header {
  flex-shrink: 0;
  padding: 18px 32px 14px;
  background: transparent;
  /* 去掉边框和模糊，让头部融入背景，整体更干净 */
}

.writing-page__header-top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.writing-page__title-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.01em;
  background: transparent;
  border: none;
  outline: none;

  &::placeholder {
    color: #cbd5e1;
    font-weight: 600;
  }
}

.writing-page__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
  gap: 16px;
}

.writing-page__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: #64748b;

  .el-icon {
    font-size: 13px;
    color: #94a3b8;
  }
}

.writing-page__meta-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;

  &.is-saved {
    color: #059669;
    background: rgba(16, 185, 129, 0.1);
    .writing-page__meta-status-dot {
      background: #10b981;
    }
  }

  &.is-unsaved {
    color: #d97706;
    background: rgba(245, 158, 11, 0.1);
    .writing-page__meta-status-dot {
      background: #f59e0b;
    }
  }

  &.is-saving {
    color: #0284c7;
    background: rgba(14, 165, 233, 0.1);
    .writing-page__meta-status-dot {
      background: #0ea5e9;
      animation: pulse 1.4s ease-in-out infinite;
    }
  }
}

.writing-page__meta-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.writing-page__hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #94a3b8;

  .el-icon {
    font-size: 13px;
  }
}

/* ============ 编辑器容器 ============ */
.writing-page__doc-wrap {
  display: flex;
  flex: 1;
  min-height: 0;
  justify-content: center;
  /* 与左侧 sidebar 的底部 padding 保持一致，让两侧底部对齐 */
  padding: 4px 32px 28px;
  overflow: hidden;
}

.writing-page__doc {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 960px;
  height: 100%;
  min-height: 0;
  background: #fff;
  border: 1px solid #e4e9f0;
  border-radius: 16px;
  box-shadow:
    0 12px 36px rgba(15, 23, 42, 0.05),
    0 2px 6px rgba(15, 23, 42, 0.03);
  overflow: hidden;
}

.writing-page__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
}

.writing-page__editor :deep([data-w-e-textarea='true']) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  height: auto !important;
}

/* wangEditor 内部：让它撑满外层，并保留内部滚动条 */
.writing-page__editor :deep(.w-e-toolbar),
.writing-page__editor :deep(.w-e-bar) {
  flex-shrink: 0;
  padding: 8px 14px;
  background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
  border-bottom: 1px solid #eef0f4;
}

.writing-page__editor :deep(.w-e-bar-item button:hover),
.writing-page__editor :deep(.w-e-bar-item > div:hover) {
  background: rgba(14, 165, 233, 0.08);
  border-radius: 8px;
}

.writing-page__editor :deep(.w-e-text-container) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0 !important;
  height: 100% !important;
  background: #fff;
  overflow: hidden;
}

.writing-page__editor :deep(.w-e-scroll) {
  flex: 1 1 auto;
  min-height: 0;
  height: auto !important;
  max-height: none;
  padding: 32px 48px 64px;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto !important;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.35);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(148, 163, 184, 0.55);
  }
}

.writing-page__editor :deep(.w-e-text-placeholder) {
  top: 32px;
  left: 48px;
  color: #cbd5e1;
  font-style: normal;
}

.writing-page__editor :deep(.w-e-hover-bar) {
  display: none !important;
}

.writing-page__editor :deep(.w-e-text-container [data-slate-editor]),
.writing-page__editor :deep(.w-e-text-container [contenteditable='true']) {
  min-height: 100% !important;
  box-sizing: border-box;
  padding: 0;
  font-size: 16px;
  line-height: 2;
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.writing-page__editor :deep(p) {
  margin: 0 0 0.55em;
}

.writing-page__editor :deep(span[style*='240, 249, 255']),
.writing-page__editor :deep(span[style*='240,249,255']),
.writing-page__editor :deep(span[style*='#f0f9ff']) {
  padding: 0.08em 0.24em;
  color: #475569 !important;
  background: linear-gradient(
    180deg,
    rgba(240, 249, 255, 0.96),
    rgba(237, 246, 255, 0.96)
  ) !important;
  border-radius: 0.42em;
  box-shadow:
    inset 0 0 0 1px rgba(148, 163, 184, 0.22),
    inset 0 -1px 0 rgba(148, 163, 184, 0.45);
  text-decoration-line: underline;
  text-decoration-style: dashed;
  text-decoration-color: rgba(100, 116, 139, 0.72);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

/* ============ 响应式 ============ */
@media (max-width: 1024px) {
  .writing-page__sidebar {
    width: 240px;
  }
  .writing-page__doc-wrap {
    padding: 4px 20px 22px;
  }
  .writing-page__editor :deep(.w-e-scroll) {
    padding: 24px 28px 36px;
  }
}

@media (max-width: 768px) {
  .writing-page__sidebar {
    position: absolute;
    z-index: 10;
    height: 100%;
  }
  .writing-page__header {
    padding: 14px 16px 10px;
  }
  .writing-page__title-input {
    font-size: 18px;
  }
  .writing-page__header-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .writing-page__meta-right {
    display: none;
  }
  .writing-page__doc-wrap {
    padding: 4px 12px 16px;
  }
  .writing-page__editor :deep(.w-e-scroll) {
    padding: 18px 16px 28px;
  }
  .writing-page__editor :deep(.w-e-text-placeholder) {
    top: 18px;
    left: 16px;
  }
}
</style>
