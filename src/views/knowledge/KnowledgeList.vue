<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
  type UploadFile,
  type UploadUserFile
} from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import {
  knowledgeApi,
  type CreateKnowledgeBaseRequest,
  type CreateKnowledgeDocumentByFileRequest,
  type CreateKnowledgeDocumentByTextRequest,
  type IndexingTechnique,
  type KnowledgeBaseVO,
  type KnowledgeChildChunkVO,
  type KnowledgeDocForm,
  type KnowledgeDocumentVO,
  type KnowledgeId,
  type KnowledgeSegmentVO,
  type ProcessRulePayload
} from '@/api/frontend-api'

type KbRow = KnowledgeBaseVO & Record<string, any>
type DocRow = KnowledgeDocumentVO & Record<string, any>
type SegmentRow = KnowledgeSegmentVO & Record<string, any>
type ChildChunkRow = KnowledgeChildChunkVO & Record<string, any>

const kbLoading = ref(false)
const kbSubmitting = ref(false)
const docsLoading = ref(false)
const textSubmitting = ref(false)
const fileSubmitting = ref(false)
const indexLoading = ref(false)
const segmentsLoading = ref(false)
const segmentSubmitting = ref(false)
const chunkSubmitting = ref(false)
const retrieveLoading = ref(false)
const zipDownloading = ref(false)

const kbKeyword = ref('')
const kbList = ref<KbRow[]>([])
const selectedKbId = ref<KnowledgeId | null>(null)

const activeTab = ref<'documents' | 'segments' | 'retrieve'>('documents')

const kbDialogVisible = ref(false)
const kbFormRef = ref<FormInstance>()
const kbForm = reactive({
  kbName: '',
  kbCode: '',
  difyApiKey: '',
  difyDatasetId: '',
  difyBaseUrl: '',
  description: '',
  icon: '',
  indexingTechnique: 'high_quality',
  embeddingModel: '',
  sort: 1
})

const kbRules: FormRules = {
  kbName: [{ required: true, message: '请输入知识库名称', trigger: 'blur' }],
  kbCode: [{ required: true, message: '请输入知识库编码', trigger: 'blur' }],
  difyApiKey: [{ required: true, message: '请输入 Dify API Key', trigger: 'blur' }],
  difyDatasetId: [{ required: true, message: '请输入 Dify Dataset ID', trigger: 'blur' }]
}

const docKeyword = ref('')
const docStatus = ref('')
const docs = ref<DocRow[]>([])
const selectedDocumentIds = ref<string[]>([])
const docPager = reactive({
  page: 1,
  limit: 10,
  total: 0
})

const textDialogVisible = ref(false)
const textFormRef = ref<FormInstance>()
const textForm = reactive({
  name: '',
  text: '',
  indexing_technique: 'high_quality' as IndexingTechnique,
  doc_form: 'text_model' as KnowledgeDocForm,
  processMode: 'automatic' as 'automatic' | 'custom',
  customProcessRule: ''
})

const textRules: FormRules = {
  name: [{ required: true, message: '请输入文档名称', trigger: 'blur' }],
  text: [{ required: true, message: '请输入文档内容', trigger: 'blur' }]
}

const fileDialogVisible = ref(false)
const fileFormRef = ref<FormInstance>()
const fileForm = reactive({
  indexing_technique: 'high_quality' as IndexingTechnique,
  doc_form: 'text_model' as KnowledgeDocForm,
  doc_language: '',
  processMode: 'automatic' as 'automatic' | 'custom',
  customProcessRule: '',
  fileList: [] as UploadUserFile[]
})

const fileRules: FormRules = {
  fileList: [
    {
      validator: (_rule, _value, callback) => {
        if (!fileForm.fileList.length) {
          callback(new Error('请先选择文件'))
          return
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}

const indexBatch = ref('')
const indexResultText = ref('')

const segmentDocId = ref('')
const segmentKeyword = ref('')
const segmentStatus = ref('')
const segments = ref<SegmentRow[]>([])
const segmentPager = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const segmentDialogVisible = ref(false)
const segmentDialogMode = ref<'create' | 'edit'>('create')
const segmentFormRef = ref<FormInstance>()
const segmentForm = reactive({
  id: '',
  content: '',
  answer: '',
  keywordsText: '',
  enabled: true,
  regenerate_child_chunks: false
})

const segmentRules: FormRules = {
  content: [{ required: true, message: '请输入分段内容', trigger: 'blur' }]
}

const chunkDrawerVisible = ref(false)
const currentSegment = ref<SegmentRow | null>(null)

const chunkDialogVisible = ref(false)
const chunkDialogMode = ref<'create' | 'edit'>('create')
const chunkForm = reactive({
  segmentId: '',
  chunkId: '',
  content: ''
})

const chunkRules: FormRules = {
  content: [{ required: true, message: '请输入子分段内容', trigger: 'blur' }]
}
const chunkFormRef = ref<FormInstance>()

const retrieveForm = reactive({
  query: '',
  search_method: 'semantic_search' as
    | 'semantic_search'
    | 'keyword_search'
    | 'full_text_search'
    | 'hybrid_search',
  reranking_enable: false,
  top_k: 5,
  score_threshold_enabled: true,
  score_threshold: 0.2
})
const retrieveResult = ref<any[]>([])

const filteredKbList = computed(() => {
  const text = kbKeyword.value.trim().toLowerCase()
  if (!text) return kbList.value
  return kbList.value.filter((item) => {
    const source = `${resolveKbName(item)}|${item.kbCode || ''}|${item.description || ''}|${item.id || ''}`
    return source.toLowerCase().includes(text)
  })
})

const selectedKb = computed(
  () => kbList.value.find((item) => String(item.id) === String(selectedKbId.value)) || null
)

const docOptions = computed(() =>
  docs.value.map((doc) => ({
    label: doc.name || String(doc.id),
    value: String(doc.id)
  }))
)

const currentChildChunks = computed(() => {
  if (!currentSegment.value) return []
  return Array.isArray(currentSegment.value.child_chunks)
    ? (currentSegment.value.child_chunks as ChildChunkRow[])
    : []
})

function resolveKbName(row: KbRow): string {
  return row.kbName || row.name || String(row.id)
}

function resolveDocStatus(row: DocRow): string {
  return row.display_status || row.indexing_status || row.status || '-'
}

function resolveDocStatusType(
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (!status) return 'info'
  const value = status.toLowerCase()
  if (value === 'available' || value === 'completed') return 'success'
  if (value === 'indexing' || value === 'queuing') return 'warning'
  if (value === 'error' || value === 'failed') return 'danger'
  return 'info'
}

function formatUnixTime(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  const ms = num > 1e12 ? num : num * 1000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function parseKeywords(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toPrettyText(payload: unknown): string {
  try {
    return JSON.stringify(payload ?? {}, null, 2)
  } catch {
    return String(payload ?? '')
  }
}

function buildProcessRule(
  mode: 'automatic' | 'custom',
  customText: string
): ProcessRulePayload | null {
  if (mode === 'automatic') {
    return { mode: 'automatic' }
  }
  const source = customText.trim()
  if (!source) return null
  try {
    const parsed = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object') return null
    return { mode: 'custom', rules: parsed as Record<string, any> }
  } catch {
    return null
  }
}

function resetKbForm() {
  kbForm.kbName = ''
  kbForm.kbCode = ''
  kbForm.difyApiKey = ''
  kbForm.difyDatasetId = ''
  kbForm.difyBaseUrl = ''
  kbForm.description = ''
  kbForm.icon = ''
  kbForm.indexingTechnique = 'high_quality'
  kbForm.embeddingModel = ''
  kbForm.sort = 1
}

function resetDocumentState() {
  docs.value = []
  selectedDocumentIds.value = []
  docPager.page = 1
  docPager.total = 0
  docKeyword.value = ''
  docStatus.value = ''
  indexBatch.value = ''
  indexResultText.value = ''
  segmentDocId.value = ''
  segments.value = []
  segmentPager.page = 1
  segmentPager.total = 0
  retrieveResult.value = []
}

function resetTextForm() {
  textForm.name = ''
  textForm.text = ''
  textForm.indexing_technique = 'high_quality'
  textForm.doc_form = 'text_model'
  textForm.processMode = 'automatic'
  textForm.customProcessRule = ''
}

function resetFileForm() {
  fileForm.indexing_technique = 'high_quality'
  fileForm.doc_form = 'text_model'
  fileForm.doc_language = ''
  fileForm.processMode = 'automatic'
  fileForm.customProcessRule = ''
  fileForm.fileList = []
}

function resetSegmentForm() {
  segmentForm.id = ''
  segmentForm.content = ''
  segmentForm.answer = ''
  segmentForm.keywordsText = ''
  segmentForm.enabled = true
  segmentForm.regenerate_child_chunks = false
}

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  if (Array.isArray(payload.data)) return payload.data
  return []
}

function pickTotal(payload: any, fallback = 0): number {
  if (!payload || typeof payload !== 'object') return fallback
  const value = Number(payload.total)
  if (Number.isFinite(value)) return value
  return fallback
}

async function loadKnowledgeBases() {
  kbLoading.value = true
  try {
    const response = await knowledgeApi.list()
    kbList.value = pickArray(response) as KbRow[]
    if (!kbList.value.length) {
      selectedKbId.value = null
      resetDocumentState()
      return
    }
    const exists = kbList.value.some((item) => String(item.id) === String(selectedKbId.value))
    if (!exists) {
      selectedKbId.value = kbList.value[0].id
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库列表加载失败')
  } finally {
    kbLoading.value = false
  }
}

async function loadDocuments() {
  if (!selectedKbId.value) {
    docs.value = []
    return
  }

  docsLoading.value = true
  try {
    const response = await knowledgeApi.listDocuments(selectedKbId.value, {
      page: docPager.page,
      limit: docPager.limit,
      keyword: docKeyword.value.trim() || undefined,
      status: docStatus.value || undefined
    })
    const list = pickArray(response) as DocRow[]
    docs.value = list
    docPager.total = pickTotal(response, list.length)
    selectedDocumentIds.value = []

    if (segmentDocId.value) {
      const exists = list.some((item) => String(item.id) === String(segmentDocId.value))
      if (!exists) {
        segmentDocId.value = ''
        segments.value = []
      }
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '文档列表加载失败')
  } finally {
    docsLoading.value = false
  }
}

async function submitKb() {
  if (!kbFormRef.value) return
  await kbFormRef.value.validate()

  kbSubmitting.value = true
  try {
    const payload: CreateKnowledgeBaseRequest = {
      kbName: kbForm.kbName.trim(),
      kbCode: kbForm.kbCode.trim(),
      difyApiKey: kbForm.difyApiKey.trim(),
      difyDatasetId: kbForm.difyDatasetId.trim(),
      difyBaseUrl: kbForm.difyBaseUrl.trim() || undefined,
      description: kbForm.description.trim() || undefined,
      icon: kbForm.icon.trim() || undefined,
      indexingTechnique: kbForm.indexingTechnique.trim() || undefined,
      embeddingModel: kbForm.embeddingModel.trim() || undefined,
      sort: Number(kbForm.sort || 1)
    }
    const created = await knowledgeApi.create(payload)
    ElMessage.success('知识库创建成功')
    selectedKbId.value = created.id
    kbDialogVisible.value = false
    await loadKnowledgeBases()
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库创建失败')
  } finally {
    kbSubmitting.value = false
  }
}

async function removeKb(row: KbRow) {
  try {
    await ElMessageBox.confirm(`确认删除知识库「${resolveKbName(row)}」吗？`, '删除确认', {
      type: 'warning'
    })
    await knowledgeApi.delete(row.id)
    ElMessage.success('知识库删除成功')
    if (String(selectedKbId.value) === String(row.id)) {
      selectedKbId.value = null
      resetDocumentState()
    }
    await loadKnowledgeBases()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '知识库删除失败')
    }
  }
}

function openCreateKb() {
  resetKbForm()
  kbDialogVisible.value = true
}

function openCreateTextDoc() {
  if (!selectedKbId.value) return
  resetTextForm()
  textDialogVisible.value = true
}

async function submitTextDoc() {
  if (!selectedKbId.value || !textFormRef.value) return
  await textFormRef.value.validate()

  const processRule = buildProcessRule(textForm.processMode, textForm.customProcessRule)
  if (!processRule) {
    ElMessage.warning('请检查 process rule JSON 格式')
    return
  }

  textSubmitting.value = true
  try {
    const payload: CreateKnowledgeDocumentByTextRequest = {
      name: textForm.name.trim(),
      text: textForm.text,
      indexing_technique: textForm.indexing_technique,
      process_rule: processRule,
      doc_form: textForm.doc_form
    }
    const response = await knowledgeApi.createDocumentByText(selectedKbId.value, payload)
    const batch = (response as any)?.batch || (response as any)?.data?.batch
    if (batch) {
      indexBatch.value = String(batch)
      ElMessage.success(`文档创建成功，批次：${batch}`)
    } else {
      ElMessage.success('文档创建成功')
    }
    textDialogVisible.value = false
    await loadDocuments()
  } catch (error: any) {
    ElMessage.error(error?.message || '文档创建失败')
  } finally {
    textSubmitting.value = false
  }
}

function openCreateFileDoc() {
  if (!selectedKbId.value) return
  resetFileForm()
  fileDialogVisible.value = true
}

function handleFileChange(_file: UploadFile, files: UploadUserFile[]) {
  fileForm.fileList = files.slice(-1)
}

function removeSelectedFile() {
  fileForm.fileList = []
}

async function submitFileDoc() {
  if (!selectedKbId.value || !fileFormRef.value) return
  await fileFormRef.value.validate()

  const rawFile = fileForm.fileList[0]?.raw
  if (!rawFile) {
    ElMessage.error('请先选择文件')
    return
  }

  const processRule = buildProcessRule(fileForm.processMode, fileForm.customProcessRule)
  if (!processRule) {
    ElMessage.warning('请检查 process rule JSON 格式')
    return
  }

  fileSubmitting.value = true
  try {
    const options: CreateKnowledgeDocumentByFileRequest = {
      indexing_technique: fileForm.indexing_technique,
      doc_form: fileForm.doc_form,
      doc_language: fileForm.doc_language.trim() || undefined,
      processRule: JSON.stringify(processRule)
    }
    const response = await knowledgeApi.createDocumentByFile(selectedKbId.value, rawFile, options)
    const batch = (response as any)?.batch || (response as any)?.data?.batch
    if (batch) {
      indexBatch.value = String(batch)
      ElMessage.success(`文件文档创建成功，批次：${batch}`)
    } else {
      ElMessage.success('文件文档创建成功')
    }
    fileDialogVisible.value = false
    resetFileForm()
    await loadDocuments()
  } catch (error: any) {
    ElMessage.error(error?.message || '文件文档创建失败')
  } finally {
    fileSubmitting.value = false
  }
}

async function removeDocument(row: DocRow) {
  if (!selectedKbId.value) return
  const docId = String(row.id || '')
  if (!docId) return

  try {
    await ElMessageBox.confirm(`确认删除文档「${row.name || docId}」吗？`, '删除确认', {
      type: 'warning'
    })
    await knowledgeApi.deleteDocument(selectedKbId.value, docId)
    ElMessage.success('文档删除成功')
    await loadDocuments()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '文档删除失败')
    }
  }
}

function handleDocSelectionChange(rows: DocRow[]) {
  selectedDocumentIds.value = rows.map((item) => String(item.id)).filter(Boolean)
}

async function downloadSelectedDocuments() {
  if (!selectedKbId.value) return
  if (!selectedDocumentIds.value.length) {
    ElMessage.warning('请先选择需要下载的文档')
    return
  }

  zipDownloading.value = true
  try {
    const { blob, headers } = await knowledgeApi.downloadDocumentsZip(
      selectedKbId.value,
      selectedDocumentIds.value
    )
    const contentDisposition = String(headers?.['content-disposition'] || '')
    const fileNameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition)
    const fileName = fileNameMatch?.[1] || 'documents.zip'

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = decodeURIComponent(fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('ZIP 下载已开始')
  } catch (error: any) {
    ElMessage.error(error?.message || 'ZIP 下载失败')
  } finally {
    zipDownloading.value = false
  }
}

function pickBatch(row: DocRow): string {
  return String(row.batch || row.batch_id || row.dataset_process_rule_id || '')
}

async function queryIndexStatus() {
  if (!selectedKbId.value || !indexBatch.value.trim()) {
    ElMessage.warning('请先输入批次 ID')
    return
  }

  indexLoading.value = true
  try {
    const response = await knowledgeApi.indexingStatus(selectedKbId.value, indexBatch.value.trim())
    indexResultText.value = toPrettyText(response)
  } catch (error: any) {
    indexResultText.value = toPrettyText({ error: error?.message || '请求失败' })
  } finally {
    indexLoading.value = false
  }
}

function bindSegmentDoc(row: DocRow) {
  const docId = String(row.id || '')
  if (!docId) return
  segmentDocId.value = docId
  activeTab.value = 'segments'
  void loadSegments()
}

async function loadSegments() {
  if (!selectedKbId.value || !segmentDocId.value) {
    segments.value = []
    segmentPager.total = 0
    return
  }
  segmentsLoading.value = true
  try {
    const response = await knowledgeApi.listSegments(selectedKbId.value, segmentDocId.value, {
      page: segmentPager.page,
      limit: segmentPager.limit,
      keyword: segmentKeyword.value.trim() || undefined,
      status: segmentStatus.value || undefined
    })
    const list = pickArray(response) as SegmentRow[]
    segments.value = list
    segmentPager.total = pickTotal(response, list.length)
    syncCurrentSegment()
  } catch (error: any) {
    ElMessage.error(error?.message || '分段列表加载失败')
  } finally {
    segmentsLoading.value = false
  }
}

function openCreateSegment() {
  if (!segmentDocId.value) {
    ElMessage.warning('请先选择文档')
    return
  }
  segmentDialogMode.value = 'create'
  resetSegmentForm()
  segmentDialogVisible.value = true
}

function openEditSegment(row: SegmentRow) {
  segmentDialogMode.value = 'edit'
  segmentForm.id = String(row.id)
  segmentForm.content = row.content || ''
  segmentForm.answer = row.answer || ''
  segmentForm.keywordsText = Array.isArray(row.keywords) ? row.keywords.join(', ') : ''
  segmentForm.enabled = row.enabled !== false
  segmentForm.regenerate_child_chunks = false
  segmentDialogVisible.value = true
}

async function submitSegment() {
  if (!selectedKbId.value || !segmentDocId.value || !segmentFormRef.value) return
  await segmentFormRef.value.validate()

  segmentSubmitting.value = true
  try {
    const keywords = parseKeywords(segmentForm.keywordsText)
    if (segmentDialogMode.value === 'create') {
      await knowledgeApi.createSegments(selectedKbId.value, segmentDocId.value, [
        {
          content: segmentForm.content,
          answer: segmentForm.answer.trim() || undefined,
          keywords: keywords.length ? keywords : undefined
        }
      ])
      ElMessage.success('分段创建成功')
    } else {
      await knowledgeApi.updateSegment(selectedKbId.value, segmentDocId.value, segmentForm.id, {
        content: segmentForm.content,
        answer: segmentForm.answer.trim() || undefined,
        keywords: keywords.length ? keywords : undefined,
        enabled: segmentForm.enabled,
        regenerate_child_chunks: segmentForm.regenerate_child_chunks
      })
      ElMessage.success('分段更新成功')
    }
    segmentDialogVisible.value = false
    await loadSegments()
  } catch (error: any) {
    ElMessage.error(error?.message || '分段保存失败')
  } finally {
    segmentSubmitting.value = false
  }
}

async function removeSegment(row: SegmentRow) {
  if (!selectedKbId.value || !segmentDocId.value) return
  try {
    await ElMessageBox.confirm('确认删除当前分段吗？', '删除确认', { type: 'warning' })
    await knowledgeApi.deleteSegment(selectedKbId.value, segmentDocId.value, String(row.id))
    ElMessage.success('分段删除成功')
    await loadSegments()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '分段删除失败')
    }
  }
}

function openChunkDrawer(row: SegmentRow) {
  currentSegment.value = row
  chunkDrawerVisible.value = true
}

function syncCurrentSegment() {
  if (!currentSegment.value) return
  const next = segments.value.find((item) => String(item.id) === String(currentSegment.value?.id))
  if (next) {
    currentSegment.value = next
  } else {
    currentSegment.value = null
    chunkDrawerVisible.value = false
  }
}

function openCreateChildChunk() {
  if (!currentSegment.value) return
  chunkDialogMode.value = 'create'
  chunkForm.segmentId = String(currentSegment.value.id)
  chunkForm.chunkId = ''
  chunkForm.content = ''
  chunkDialogVisible.value = true
}

function openEditChildChunk(row: ChildChunkRow) {
  if (!currentSegment.value) return
  chunkDialogMode.value = 'edit'
  chunkForm.segmentId = String(currentSegment.value.id)
  chunkForm.chunkId = String(row.id)
  chunkForm.content = row.content || ''
  chunkDialogVisible.value = true
}

async function submitChildChunk() {
  if (!selectedKbId.value || !segmentDocId.value || !chunkFormRef.value) return
  await chunkFormRef.value.validate()
  if (!chunkForm.segmentId) return

  chunkSubmitting.value = true
  try {
    if (chunkDialogMode.value === 'create') {
      await knowledgeApi.createChildChunk(
        selectedKbId.value,
        segmentDocId.value,
        chunkForm.segmentId,
        {
          content: chunkForm.content
        }
      )
      ElMessage.success('子分段创建成功')
    } else {
      await knowledgeApi.updateChildChunk(
        selectedKbId.value,
        segmentDocId.value,
        chunkForm.segmentId,
        chunkForm.chunkId,
        {
          content: chunkForm.content
        }
      )
      ElMessage.success('子分段更新成功')
    }
    chunkDialogVisible.value = false
    await loadSegments()
  } catch (error: any) {
    ElMessage.error(error?.message || '子分段保存失败')
  } finally {
    chunkSubmitting.value = false
  }
}

async function runRetrieveTest() {
  if (!selectedKbId.value) {
    ElMessage.warning('请先选择知识库')
    return
  }
  if (!retrieveForm.query.trim()) {
    ElMessage.warning('请输入检索问题')
    return
  }
  retrieveLoading.value = true
  try {
    const response = await knowledgeApi.retrieve(selectedKbId.value, {
      query: retrieveForm.query.trim(),
      retrieval_model: {
        search_method: retrieveForm.search_method,
        reranking_enable: retrieveForm.reranking_enable,
        top_k: retrieveForm.top_k,
        score_threshold_enabled: retrieveForm.score_threshold_enabled,
        score_threshold: retrieveForm.score_threshold_enabled
          ? retrieveForm.score_threshold
          : undefined
      }
    })
    retrieveResult.value = Array.isArray((response as any)?.records)
      ? (response as any).records
      : pickArray(response)
  } catch (error: any) {
    ElMessage.error(error?.message || '检索测试失败')
  } finally {
    retrieveLoading.value = false
  }
}

watch(
  () => selectedKbId.value,
  () => {
    resetDocumentState()
    if (selectedKbId.value) {
      void loadDocuments()
    }
  }
)

watch(
  () => docPager.limit,
  () => {
    docPager.page = 1
  }
)

watch(
  () => segmentPager.limit,
  () => {
    segmentPager.page = 1
  }
)

onMounted(async () => {
  await loadKnowledgeBases()
  if (selectedKbId.value) {
    await loadDocuments()
  }
})
</script>

<template>
  <ContentWrap title="知识库管理" message="列表、文档维护、索引状态、分段与检索测试">
    <div class="layout-grid">
      <el-card shadow="never" class="left-panel" v-loading="kbLoading">
        <template #header>
          <div class="panel-header">
            <span>知识库列表</span>
            <el-space>
              <el-button text type="primary" @click="loadKnowledgeBases">刷新</el-button>
              <el-button size="small" type="primary" @click="openCreateKb">新建</el-button>
            </el-space>
          </div>
        </template>

        <el-input v-model="kbKeyword" class="mb-10px" placeholder="按名称/描述/ID 过滤" clearable />

        <el-table
          :data="filteredKbList"
          row-key="id"
          size="small"
          border
          max-height="600"
          highlight-current-row
          :current-row-key="selectedKbId || undefined"
          @row-click="(row: KbRow) => (selectedKbId = row.id)"
        >
          <el-table-column label="名称" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ resolveKbName(row) }}</template>
          </el-table-column>
          <el-table-column label="编码" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.kbCode || '-' }}</template>
          </el-table-column>
          <el-table-column label="文档数" width="90" align="center">
            <template #default="{ row }">{{
              row.documentCount ?? row.document_count ?? 0
            }}</template>
          </el-table-column>
          <el-table-column label="词数" width="110" align="center">
            <template #default="{ row }">{{ row.wordCount ?? row.word_count ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button type="danger" link @click.stop="removeKb(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never" class="right-panel">
        <template #header>
          <div class="panel-header">
            <span v-if="selectedKb">当前知识库：{{ resolveKbName(selectedKb) }}</span>
            <span v-else>请先在左侧选择知识库</span>
          </div>
        </template>

        <el-empty v-if="!selectedKbId" description="暂无已选知识库" />

        <template v-else>
          <el-tabs v-model="activeTab">
            <el-tab-pane label="文档管理" name="documents">
              <div class="doc-toolbar">
                <el-input
                  v-model="docKeyword"
                  placeholder="按文档名称搜索"
                  clearable
                  @keyup.enter="
                    () => {
                      docPager.page = 1
                      loadDocuments()
                    }
                  "
                />
                <el-select
                  v-model="docStatus"
                  class="status-select"
                  placeholder="状态"
                  clearable
                  @change="
                    () => {
                      docPager.page = 1
                      loadDocuments()
                    }
                  "
                >
                  <el-option label="可用" value="available" />
                  <el-option label="排队中" value="queuing" />
                  <el-option label="索引中" value="indexing" />
                  <el-option label="异常" value="error" />
                  <el-option label="已禁用" value="disabled" />
                  <el-option label="已归档" value="archived" />
                </el-select>
                <el-space wrap>
                  <el-button
                    @click="
                      () => {
                        docPager.page = 1
                        loadDocuments()
                      }
                    "
                  >
                    查询
                  </el-button>
                  <el-button type="primary" @click="openCreateTextDoc">新增文本</el-button>
                  <el-button type="success" @click="openCreateFileDoc">上传文件</el-button>
                  <el-button
                    type="warning"
                    :loading="zipDownloading"
                    @click="downloadSelectedDocuments"
                  >
                    下载 ZIP
                  </el-button>
                </el-space>
              </div>

              <el-table
                v-loading="docsLoading"
                :data="docs"
                row-key="id"
                border
                @selection-change="handleDocSelectionChange"
              >
                <el-table-column type="selection" width="48" />
                <el-table-column type="index" label="#" width="56" />
                <el-table-column
                  prop="name"
                  label="文档名称"
                  min-width="210"
                  show-overflow-tooltip
                />
                <el-table-column prop="data_source_type" label="来源" min-width="110" />
                <el-table-column label="状态" min-width="120">
                  <template #default="{ row }">
                    <el-tag :type="resolveDocStatusType(resolveDocStatus(row))">
                      {{ resolveDocStatus(row) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="word_count" label="词数" width="90" align="center" />
                <el-table-column label="创建时间" min-width="170">
                  <template #default="{ row }">{{ formatUnixTime(row.created_at) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="280" fixed="right">
                  <template #default="{ row }">
                    <el-space wrap>
                      <el-button type="primary" link @click="bindSegmentDoc(row)">分段</el-button>
                      <el-button
                        type="info"
                        link
                        @click="
                          () => {
                            indexBatch = pickBatch(row)
                            if (indexBatch) queryIndexStatus()
                          }
                        "
                      >
                        索引状态
                      </el-button>
                      <el-button type="danger" link @click="removeDocument(row)">删除</el-button>
                    </el-space>
                  </template>
                </el-table-column>
              </el-table>

              <div class="pager">
                <el-pagination
                  v-model:current-page="docPager.page"
                  v-model:page-size="docPager.limit"
                  :page-sizes="[10, 20, 50, 100]"
                  layout="total, sizes, prev, pager, next, jumper"
                  :total="docPager.total"
                  @current-change="loadDocuments"
                  @size-change="loadDocuments"
                />
              </div>

              <el-card shadow="never" class="index-box">
                <template #header>
                  <div class="panel-header">
                    <span>索引状态查询</span>
                  </div>
                </template>
                <div class="index-toolbar">
                  <el-input v-model="indexBatch" placeholder="输入批次 ID" />
                  <el-button type="primary" :loading="indexLoading" @click="queryIndexStatus">
                    查询
                  </el-button>
                </div>
                <pre class="json-box">{{ indexResultText || '{}' }}</pre>
              </el-card>
            </el-tab-pane>

            <el-tab-pane label="分段管理" name="segments">
              <div class="segment-toolbar">
                <el-select
                  v-model="segmentDocId"
                  placeholder="选择文档"
                  clearable
                  filterable
                  @change="
                    () => {
                      segmentPager.page = 1
                      loadSegments()
                    }
                  "
                >
                  <el-option
                    v-for="option in docOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
                <el-input
                  v-model="segmentKeyword"
                  placeholder="分段关键词"
                  clearable
                  @keyup.enter="
                    () => {
                      segmentPager.page = 1
                      loadSegments()
                    }
                  "
                />
                <el-select
                  v-model="segmentStatus"
                  placeholder="状态"
                  clearable
                  class="status-select"
                  @change="
                    () => {
                      segmentPager.page = 1
                      loadSegments()
                    }
                  "
                >
                  <el-option label="已完成" value="completed" />
                  <el-option label="索引中" value="indexing" />
                  <el-option label="异常" value="error" />
                </el-select>
                <el-space wrap>
                  <el-button
                    @click="
                      () => {
                        segmentPager.page = 1
                        loadSegments()
                      }
                    "
                  >
                    查询
                  </el-button>
                  <el-button type="primary" @click="openCreateSegment">新增分段</el-button>
                </el-space>
              </div>

              <el-empty v-if="!segmentDocId" description="请先选择文档" />

              <template v-else>
                <el-table
                  v-loading="segmentsLoading"
                  :data="segments"
                  row-key="id"
                  border
                  max-height="540"
                >
                  <el-table-column type="index" label="#" width="56" />
                  <el-table-column
                    prop="content"
                    label="内容"
                    min-width="280"
                    show-overflow-tooltip
                  />
                  <el-table-column
                    prop="answer"
                    label="答案"
                    min-width="140"
                    show-overflow-tooltip
                  />
                  <el-table-column label="关键词" min-width="140" show-overflow-tooltip>
                    <template #default="{ row }">{{
                      Array.isArray(row.keywords) ? row.keywords.join(', ') : '-'
                    }}</template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="100" />
                  <el-table-column label="启用" width="80" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.enabled === false ? 'info' : 'success'">{{
                        row.enabled === false ? '否' : '是'
                      }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="子分段" width="90" align="center">
                    <template #default="{ row }">{{
                      Array.isArray(row.child_chunks) ? row.child_chunks.length : 0
                    }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="260" fixed="right">
                    <template #default="{ row }">
                      <el-space wrap>
                        <el-button type="primary" link @click="openEditSegment(row)"
                          >编辑</el-button
                        >
                        <el-button type="success" link @click="openChunkDrawer(row)"
                          >子分段</el-button
                        >
                        <el-button type="danger" link @click="removeSegment(row)">删除</el-button>
                      </el-space>
                    </template>
                  </el-table-column>
                </el-table>

                <div class="pager">
                  <el-pagination
                    v-model:current-page="segmentPager.page"
                    v-model:page-size="segmentPager.limit"
                    :page-sizes="[10, 20, 50, 100]"
                    layout="total, sizes, prev, pager, next, jumper"
                    :total="segmentPager.total"
                    @current-change="loadSegments"
                    @size-change="loadSegments"
                  />
                </div>
              </template>
            </el-tab-pane>

            <el-tab-pane label="检索测试" name="retrieve">
              <el-form label-width="130px" class="retrieve-form">
                <el-form-item label="问题">
                  <el-input
                    v-model="retrieveForm.query"
                    type="textarea"
                    :rows="3"
                    placeholder="输入检索问题"
                  />
                </el-form-item>
                <el-row :gutter="16">
                  <el-col :span="8">
                    <el-form-item label="检索方式">
                      <el-select v-model="retrieveForm.search_method" class="w-full">
                        <el-option label="语义检索" value="semantic_search" />
                        <el-option label="关键词检索" value="keyword_search" />
                        <el-option label="全文检索" value="full_text_search" />
                        <el-option label="混合检索" value="hybrid_search" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="返回条数">
                      <el-input-number
                        v-model="retrieveForm.top_k"
                        class="w-full"
                        :min="1"
                        :max="30"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="重排">
                      <el-switch v-model="retrieveForm.reranking_enable" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-row :gutter="16">
                  <el-col :span="8">
                    <el-form-item label="阈值开关">
                      <el-switch v-model="retrieveForm.score_threshold_enabled" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="阈值">
                      <el-input-number
                        v-model="retrieveForm.score_threshold"
                        class="w-full"
                        :min="0"
                        :max="1"
                        :step="0.05"
                        :disabled="!retrieveForm.score_threshold_enabled"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8" class="retrieve-action-col">
                    <el-button type="primary" :loading="retrieveLoading" @click="runRetrieveTest">
                      执行测试
                    </el-button>
                  </el-col>
                </el-row>
              </el-form>

              <div class="retrieve-result">
                <el-empty v-if="!retrieveResult.length" description="暂无检索结果" />
                <el-card
                  v-for="(item, idx) in retrieveResult"
                  :key="idx"
                  shadow="never"
                  class="retrieve-item"
                >
                  <div class="retrieve-item-head">
                    <span>得分：{{ item.score ?? '-' }}</span>
                  </div>
                  <div class="retrieve-item-content">
                    {{ item.segment?.content || item.content || item.segment?.answer || '无内容' }}
                  </div>
                  <pre class="json-box">{{ toPrettyText(item) }}</pre>
                </el-card>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
      </el-card>
    </div>
  </ContentWrap>

  <el-dialog v-model="kbDialogVisible" title="新建知识库" width="700px" destroy-on-close>
    <el-form ref="kbFormRef" :model="kbForm" :rules="kbRules" label-width="130px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="知识库名称" prop="kbName">
            <el-input v-model="kbForm.kbName" maxlength="100" show-word-limit />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="知识库编码" prop="kbCode">
            <el-input v-model="kbForm.kbCode" maxlength="50" show-word-limit />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="Dify API 密钥" prop="difyApiKey">
        <el-input v-model="kbForm.difyApiKey" type="textarea" :rows="2" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="Dify 数据集 ID" prop="difyDatasetId">
            <el-input v-model="kbForm.difyDatasetId" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Dify 基础地址">
            <el-input v-model="kbForm.difyBaseUrl" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="索引策略">
            <el-input v-model="kbForm.indexingTechnique" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="嵌入模型">
            <el-input v-model="kbForm.embeddingModel" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="图标">
            <el-input v-model="kbForm.icon" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="排序">
            <el-input-number v-model="kbForm.sort" class="w-full" :min="1" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="描述">
        <el-input
          v-model="kbForm.description"
          type="textarea"
          :rows="3"
          maxlength="400"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="kbDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="kbSubmitting" @click="submitKb">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="textDialogVisible" title="新增文本文档" width="760px" destroy-on-close>
    <el-form ref="textFormRef" :model="textForm" :rules="textRules" label-width="140px">
      <el-form-item label="文档名称" prop="name">
        <el-input v-model="textForm.name" />
      </el-form-item>
      <el-form-item label="文档内容" prop="text">
        <el-input v-model="textForm.text" type="textarea" :rows="10" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="索引策略">
            <el-select v-model="textForm.indexing_technique" class="w-full">
              <el-option label="高质量（high_quality）" value="high_quality" />
              <el-option label="经济模式（economy）" value="economy" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="文档形态">
            <el-select v-model="textForm.doc_form" class="w-full">
              <el-option label="文本模型（text_model）" value="text_model" />
              <el-option label="层级模型（hierarchical_model）" value="hierarchical_model" />
              <el-option label="问答模型（qa_model）" value="qa_model" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="处理规则">
            <el-radio-group v-model="textForm.processMode">
              <el-radio-button label="automatic">自动</el-radio-button>
              <el-radio-button label="custom">自定义</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item v-if="textForm.processMode === 'custom'" label="自定义规则(JSON)">
        <el-input
          v-model="textForm.customProcessRule"
          type="textarea"
          :rows="5"
          placeholder='例如：{ "segmentation": { "separator": "\n", "max_tokens": 500 } }'
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="textDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="textSubmitting" @click="submitTextDoc">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="fileDialogVisible" title="上传文件文档" width="760px" destroy-on-close>
    <el-form ref="fileFormRef" :model="fileForm" :rules="fileRules" label-width="140px">
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="索引策略">
            <el-select v-model="fileForm.indexing_technique" class="w-full">
              <el-option label="高质量（high_quality）" value="high_quality" />
              <el-option label="经济模式（economy）" value="economy" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="文档形态">
            <el-select v-model="fileForm.doc_form" class="w-full">
              <el-option label="文本模型（text_model）" value="text_model" />
              <el-option label="层级模型（hierarchical_model）" value="hierarchical_model" />
              <el-option label="问答模型（qa_model）" value="qa_model" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="文档语言">
            <el-input v-model="fileForm.doc_language" placeholder="如：zh-Hans / en" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="处理规则">
        <el-radio-group v-model="fileForm.processMode">
          <el-radio-button label="automatic">自动</el-radio-button>
          <el-radio-button label="custom">自定义</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="fileForm.processMode === 'custom'" label="自定义规则(JSON)">
        <el-input
          v-model="fileForm.customProcessRule"
          type="textarea"
          :rows="5"
          placeholder='例如：{ "segmentation": { "separator": "\n", "max_tokens": 500 } }'
        />
      </el-form-item>
      <el-form-item label="上传文件" prop="fileList">
        <el-upload
          action="#"
          :auto-upload="false"
          :limit="1"
          :file-list="fileForm.fileList"
          :on-change="handleFileChange"
          :on-remove="removeSelectedFile"
        >
          <el-button type="primary">选择文件</el-button>
          <template #tip>
            <div class="el-upload__tip">单文件上传，支持任意 Dify 可接收格式</div>
          </template>
        </el-upload>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="fileDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="fileSubmitting" @click="submitFileDoc">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="segmentDialogVisible"
    :title="segmentDialogMode === 'create' ? '新增分段' : '编辑分段'"
    width="760px"
    destroy-on-close
  >
    <el-form ref="segmentFormRef" :model="segmentForm" :rules="segmentRules" label-width="120px">
      <el-form-item label="分段内容" prop="content">
        <el-input v-model="segmentForm.content" type="textarea" :rows="8" />
      </el-form-item>
      <el-form-item label="答案">
        <el-input v-model="segmentForm.answer" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="关键词">
        <el-input v-model="segmentForm.keywordsText" placeholder="多个关键词用逗号分隔" />
      </el-form-item>
      <el-row v-if="segmentDialogMode === 'edit'" :gutter="16">
        <el-col :span="12">
          <el-form-item label="启用">
            <el-switch v-model="segmentForm.enabled" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="重建子分段">
            <el-switch v-model="segmentForm.regenerate_child_chunks" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="segmentDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="segmentSubmitting" @click="submitSegment">保存</el-button>
    </template>
  </el-dialog>

  <el-drawer
    v-model="chunkDrawerVisible"
    size="680px"
    :title="`子分段管理 - ${currentSegment?.id || ''}`"
  >
    <div class="chunk-toolbar">
      <el-button type="primary" :disabled="!currentSegment" @click="openCreateChildChunk">
        新增子分段
      </el-button>
      <el-button @click="loadSegments">刷新</el-button>
    </div>
    <el-table :data="currentChildChunks" row-key="id" border max-height="520">
      <el-table-column type="index" label="#" width="56" />
      <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
      <el-table-column prop="position" label="位置" width="80" align="center" />
      <el-table-column prop="word_count" label="词数" width="90" align="center" />
      <el-table-column label="更新时间" min-width="160">
        <template #default="{ row }">{{ formatUnixTime(row.updated_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openEditChildChunk(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-drawer>

  <el-dialog
    v-model="chunkDialogVisible"
    :title="chunkDialogMode === 'create' ? '新增子分段' : '编辑子分段'"
    width="700px"
    destroy-on-close
  >
    <el-form ref="chunkFormRef" :model="chunkForm" :rules="chunkRules" label-width="120px">
      <el-form-item label="内容" prop="content">
        <el-input v-model="chunkForm.content" type="textarea" :rows="8" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="chunkDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="chunkSubmitting" @click="submitChildChunk"
        >保存</el-button
      >
    </template>
  </el-dialog>
</template>

<style scoped lang="less">
.layout-grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 14px;
}

.left-panel,
.right-panel {
  min-height: 760px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.doc-toolbar,
.segment-toolbar,
.index-toolbar,
.chunk-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.doc-toolbar > .el-input,
.segment-toolbar > .el-input,
.index-toolbar > .el-input {
  max-width: 320px;
}

.status-select {
  width: 140px;
}

.pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.index-box {
  margin-top: 14px;
}

.retrieve-form {
  padding-top: 6px;
}

.retrieve-action-col {
  display: flex;
  align-items: center;
}

.retrieve-result {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.retrieve-item {
  border: 1px solid var(--el-border-color-lighter);
}

.retrieve-item-head {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.retrieve-item-content {
  margin-bottom: 8px;
  line-height: 1.6;
}

.json-box {
  margin: 0;
  background: #0f172a;
  color: #dbeafe;
  border-radius: 8px;
  padding: 10px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1280px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .left-panel,
  .right-panel {
    min-height: 0;
  }

  .doc-toolbar,
  .segment-toolbar {
    flex-wrap: wrap;
    align-items: flex-start;
  }
}
</style>
