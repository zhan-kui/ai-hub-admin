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

const pageMode = ref<'list' | 'detail' | 'create'>('list')
const createStep = ref(1)
const createSteps = [
  { title: '基本信息', description: '命名并说明用途' },
  { title: '连接数据集', description: '配置 Dify 凭据' },
  { title: '索引设置', description: '选择检索质量' },
  { title: '确认创建', description: '检查配置并完成' }
]

const totalDocuments = computed(() =>
  kbList.value.reduce(
    (sum, item) => sum + Number(item.documentCount ?? item.document_count ?? 0),
    0
  )
)

const totalWords = computed(() =>
  kbList.value.reduce((sum, item) => sum + Number(item.wordCount ?? item.word_count ?? 0), 0)
)

const availableDocCount = computed(
  () => docs.value.filter((item) => resolveDocStatus(item).toLowerCase() === 'available').length
)

const selectedKbDocumentCount = computed(() =>
  selectedKb.value
    ? Number(selectedKb.value.documentCount ?? selectedKb.value.document_count ?? 0)
    : 0
)

const selectedKbWordCount = computed(() =>
  selectedKb.value ? Number(selectedKb.value.wordCount ?? selectedKb.value.word_count ?? 0) : 0
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

function resolveKbDocumentCount(row: KbRow): number {
  return Number(row.documentCount ?? row.document_count ?? 0)
}

function resolveKbWordCount(row: KbRow): number {
  return Number(row.wordCount ?? row.word_count ?? 0)
}

function formatCompactNumber(value: unknown): string {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return '0'
  if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 0 : 1)}w`
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`
  return String(num)
}

function kbInitial(row: KbRow): string {
  const name = resolveKbName(row).trim()
  return name ? name.charAt(0).toUpperCase() : 'K'
}

function isDocSelected(row: DocRow): boolean {
  return selectedDocumentIds.value.includes(String(row.id))
}

function toggleDocumentSelection(row: DocRow, checked: boolean) {
  const id = String(row.id || '')
  if (!id) return
  if (checked) {
    if (!selectedDocumentIds.value.includes(id)) {
      selectedDocumentIds.value = [...selectedDocumentIds.value, id]
    }
    return
  }
  selectedDocumentIds.value = selectedDocumentIds.value.filter((item) => item !== id)
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
      selectedKbId.value = null
      if (pageMode.value === 'detail') {
        pageMode.value = 'list'
      }
      resetDocumentState()
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
    await loadKnowledgeBases()
    pageMode.value = 'detail'
    createStep.value = 1
    activeTab.value = 'documents'
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
      pageMode.value = 'list'
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
  selectedKbId.value = null
  resetDocumentState()
  createStep.value = 1
  pageMode.value = 'create'
}

function openKnowledgeDetail(row: KbRow) {
  selectedKbId.value = row.id
  activeTab.value = 'documents'
  pageMode.value = 'detail'
}

function backToKnowledgeList() {
  pageMode.value = 'list'
  selectedKbId.value = null
  resetDocumentState()
}

function cancelCreateKb() {
  resetKbForm()
  createStep.value = 1
  pageMode.value = 'list'
}

function validateCreateStep(step = createStep.value): boolean {
  if (step === 1) {
    if (!kbForm.kbName.trim()) {
      ElMessage.warning('请输入知识库名称')
      return false
    }
    if (!kbForm.kbCode.trim()) {
      ElMessage.warning('请输入知识库编码')
      return false
    }
  }
  if (step === 2) {
    if (!kbForm.difyApiKey.trim()) {
      ElMessage.warning('请输入 Dify API Key')
      return false
    }
    if (!kbForm.difyDatasetId.trim()) {
      ElMessage.warning('请输入 Dify Dataset ID')
      return false
    }
  }
  return true
}

function nextCreateStep() {
  if (!validateCreateStep()) return
  createStep.value = Math.min(4, createStep.value + 1)
}

function prevCreateStep() {
  createStep.value = Math.max(1, createStep.value - 1)
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
  <div class="knowledge-page" :class="`mode-${pageMode}`">
    <template v-if="pageMode === 'list'">
      <section class="knowledge-hero list-hero">
        <div class="hero-copy">
          <div class="eyebrow">KNOWLEDGE BASE</div>
          <h1>知识库</h1>
          <p>像管理智能体一样管理企业知识。这里仅展示知识库卡片，进入后再维护文档、分段和检索。</p>
        </div>
        <div class="hero-actions">
          <el-input
            v-model="kbKeyword"
            class="hero-search"
            placeholder="搜索知识库名称 / 编码"
            clearable
          />
          <el-button @click="loadKnowledgeBases">刷新</el-button>
        </div>
      </section>

      <section class="kb-gallery" v-loading="kbLoading">
        <button type="button" class="kb-tile create-tile" @click="openCreateKb">
          <span class="tile-plus">+</span>
          <span class="tile-title">创建知识库</span>
          <span class="tile-desc">通过分步向导连接数据集、设置索引并完成创建</span>
          <span class="tile-link">开始创建 →</span>
        </button>

        <button
          v-for="item in filteredKbList"
          :key="item.id"
          type="button"
          class="kb-tile"
          @click="openKnowledgeDetail(item)"
        >
          <div class="tile-head">
            <div class="kb-avatar">{{ kbInitial(item) }}</div>
            <div class="tile-title-area">
              <div class="tile-title">{{ resolveKbName(item) }}</div>
              <div class="tile-code">{{ item.kbCode || '未设置编码' }}</div>
            </div>
          </div>
          <p class="tile-desc">{{
            item.description || '暂无描述。建议补充知识库用途、覆盖范围和维护规则。'
          }}</p>
          <div class="tile-meta">
            <span>{{ resolveKbDocumentCount(item) }} 文档</span>
            <span>{{ formatCompactNumber(resolveKbWordCount(item)) }} 词</span>
            <span>{{ item.indexingTechnique || 'high_quality' }}</span>
          </div>
          <div class="tile-footer">
            <span>进入知识库</span>
            <el-button link type="danger" @click.stop="removeKb(item)">删除</el-button>
          </div>
        </button>

        <div v-if="filteredKbList.length === 0 && !kbLoading" class="empty-gallery-card">
          <div class="empty-illustration">KB</div>
          <h3>暂无知识库</h3>
          <p>创建一个知识库后，可以进入详情页上传文档、维护分段并做检索测试。</p>
          <el-button type="primary" @click="openCreateKb">创建知识库</el-button>
        </div>
      </section>
    </template>

    <template v-else-if="pageMode === 'create'">
      <section class="create-shell">
        <div class="create-aside">
          <button type="button" class="back-link" @click="cancelCreateKb">← 返回知识库</button>
          <div class="create-title-block">
            <div class="eyebrow">CREATE KNOWLEDGE</div>
            <h1>创建知识库</h1>
            <p>按照 Dify 类似的流程逐步完成知识库配置。每一步只处理一类信息，减少表单压力。</p>
          </div>
          <div class="create-step-list">
            <button
              v-for="(step, index) in createSteps"
              :key="step.title"
              type="button"
              class="create-step-item"
              :class="{ active: createStep === index + 1, done: createStep > index + 1 }"
              @click="createStep > index + 1 ? (createStep = index + 1) : undefined"
            >
              <span class="step-index">{{ index + 1 }}</span>
              <span>
                <strong>{{ step.title }}</strong>
                <em>{{ step.description }}</em>
              </span>
            </button>
          </div>
        </div>

        <main class="create-main-card">
          <el-form ref="kbFormRef" :model="kbForm" :rules="kbRules" label-position="top">
            <section v-if="createStep === 1" class="step-panel">
              <div class="step-panel-head">
                <span>Step 1</span>
                <h2>先定义知识库的身份</h2>
                <p>这部分信息会展示在知识库卡片上，帮助团队快速识别用途。</p>
              </div>
              <div class="form-grid two">
                <el-form-item label="知识库名称" prop="kbName">
                  <el-input
                    v-model="kbForm.kbName"
                    maxlength="100"
                    show-word-limit
                    placeholder="例如：产品帮助中心"
                  />
                </el-form-item>
                <el-form-item label="知识库编码" prop="kbCode">
                  <el-input
                    v-model="kbForm.kbCode"
                    maxlength="50"
                    show-word-limit
                    placeholder="例如：product_help"
                  />
                </el-form-item>
              </div>
              <el-form-item label="描述">
                <el-input
                  v-model="kbForm.description"
                  type="textarea"
                  :rows="5"
                  maxlength="400"
                  show-word-limit
                  placeholder="说明这个知识库覆盖的业务范围、适用场景和维护人。"
                />
              </el-form-item>
              <div class="form-grid two">
                <el-form-item label="图标标识">
                  <el-input v-model="kbForm.icon" placeholder="可选：图标 URL 或标识" />
                </el-form-item>
                <el-form-item label="排序">
                  <el-input-number v-model="kbForm.sort" class="w-full" :min="1" />
                </el-form-item>
              </div>
            </section>

            <section v-else-if="createStep === 2" class="step-panel">
              <div class="step-panel-head">
                <span>Step 2</span>
                <h2>连接 Dify 数据集</h2>
                <p>知识库创建后会基于这些连接信息维护文档和索引。</p>
              </div>
              <el-form-item label="Dify API Key" prop="difyApiKey">
                <el-input
                  v-model="kbForm.difyApiKey"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入 Dify 知识库 API Key"
                />
              </el-form-item>
              <div class="form-grid two">
                <el-form-item label="Dify Dataset ID" prop="difyDatasetId">
                  <el-input v-model="kbForm.difyDatasetId" placeholder="请输入数据集 ID" />
                </el-form-item>
                <el-form-item label="Dify Base URL">
                  <el-input
                    v-model="kbForm.difyBaseUrl"
                    placeholder="可选，例如：https://api.dify.ai"
                  />
                </el-form-item>
              </div>
            </section>

            <section v-else-if="createStep === 3" class="step-panel">
              <div class="step-panel-head">
                <span>Step 3</span>
                <h2>设置索引与嵌入模型</h2>
                <p>保持默认高质量策略即可，也可以根据业务场景调整。</p>
              </div>
              <div class="option-grid">
                <label
                  class="option-card"
                  :class="{ active: kbForm.indexingTechnique === 'high_quality' }"
                >
                  <input v-model="kbForm.indexingTechnique" type="radio" value="high_quality" />
                  <strong>高质量索引</strong>
                  <span>适合企业知识问答，召回质量更稳定。</span>
                </label>
                <label
                  class="option-card"
                  :class="{ active: kbForm.indexingTechnique === 'economy' }"
                >
                  <input v-model="kbForm.indexingTechnique" type="radio" value="economy" />
                  <strong>经济模式</strong>
                  <span>适合轻量测试或成本敏感场景。</span>
                </label>
              </div>
              <el-form-item label="嵌入模型">
                <el-input
                  v-model="kbForm.embeddingModel"
                  placeholder="可选：为空则使用默认嵌入模型"
                />
              </el-form-item>
            </section>

            <section v-else class="step-panel confirm-panel">
              <div class="step-panel-head">
                <span>Step 4</span>
                <h2>确认配置</h2>
                <p>确认无误后创建知识库，创建完成后会进入该知识库详情页。</p>
              </div>
              <div class="confirm-card">
                <div class="confirm-avatar">{{
                  kbForm.kbName ? kbForm.kbName.charAt(0).toUpperCase() : 'K'
                }}</div>
                <div>
                  <h3>{{ kbForm.kbName || '未命名知识库' }}</h3>
                  <p>{{ kbForm.description || '暂无描述' }}</p>
                  <div class="detail-tags">
                    <span>{{ kbForm.kbCode || '未设置编码' }}</span>
                    <span>{{ kbForm.indexingTechnique || 'high_quality' }}</span>
                    <span>{{ kbForm.embeddingModel || '默认嵌入模型' }}</span>
                  </div>
                </div>
              </div>
              <div class="confirm-list">
                <div
                  ><span>Dify Dataset ID</span
                  ><strong>{{ kbForm.difyDatasetId || '-' }}</strong></div
                >
                <div
                  ><span>Dify Base URL</span
                  ><strong>{{ kbForm.difyBaseUrl || '默认' }}</strong></div
                >
                <div
                  ><span>排序</span><strong>{{ kbForm.sort }}</strong></div
                >
              </div>
            </section>
          </el-form>

          <div class="create-footer">
            <el-button @click="createStep === 1 ? cancelCreateKb() : prevCreateStep()">
              {{ createStep === 1 ? '取消' : '上一步' }}
            </el-button>
            <el-button v-if="createStep < 4" type="primary" @click="nextCreateStep"
              >下一步</el-button
            >
            <el-button v-else type="primary" :loading="kbSubmitting" @click="submitKb"
              >完成创建</el-button
            >
          </div>
        </main>
      </section>
    </template>

    <template v-else>
      <section class="detail-page-shell">
        <button type="button" class="back-link" @click="backToKnowledgeList">← 返回知识库</button>

        <div class="detail-hero">
          <div class="detail-avatar">{{ selectedKb ? kbInitial(selectedKb) : 'K' }}</div>
          <div class="detail-copy">
            <div class="detail-kicker">KNOWLEDGE DETAIL</div>
            <h1>{{ selectedKb ? resolveKbName(selectedKb) : '当前知识库' }}</h1>
            <p>{{
              selectedKb?.description || '暂无描述。可以补充业务范围、适用应用和维护规则。'
            }}</p>
            <div class="detail-tags">
              <span>{{ selectedKb?.kbCode || '未设置编码' }}</span>
              <span>{{ selectedKb?.indexingTechnique || 'high_quality' }}</span>
              <span>{{ selectedKb?.embeddingModel || '默认嵌入模型' }}</span>
            </div>
          </div>
          <div class="detail-metrics">
            <div
              ><strong>{{ selectedKbDocumentCount }}</strong
              ><span>文档</span></div
            >
            <div
              ><strong>{{ formatCompactNumber(selectedKbWordCount) }}</strong
              ><span>词数</span></div
            >
            <div
              ><strong>{{ availableDocCount }}</strong
              ><span>可用</span></div
            >
          </div>
        </div>

        <div class="detail-tabs-shell">
          <el-tabs v-model="activeTab" class="knowledge-tabs">
            <el-tab-pane label="文档" name="documents">
              <div class="toolbar-card">
                <div class="toolbar-left">
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
                </div>
                <div class="toolbar-actions">
                  <el-button
                    @click="
                      () => {
                        docPager.page = 1
                        loadDocuments()
                      }
                    "
                    >查询</el-button
                  >
                  <el-button type="primary" @click="openCreateTextDoc">新增文本</el-button>
                  <el-button type="primary" plain @click="openCreateFileDoc">上传文件</el-button>
                  <el-button :loading="zipDownloading" @click="downloadSelectedDocuments"
                    >下载 ZIP</el-button
                  >
                </div>
              </div>

              <div v-loading="docsLoading" class="doc-card-grid">
                <div v-if="!docs.length" class="empty-card">
                  <div class="empty-illustration">DOC</div>
                  <h3>暂无文档</h3>
                  <p>上传文件或新增文本后，这里会展示文档卡片。</p>
                </div>
                <article
                  v-for="doc in docs"
                  :key="doc.id"
                  class="doc-card"
                  :class="{ selected: isDocSelected(doc) }"
                >
                  <div class="doc-card-head">
                    <el-checkbox
                      :model-value="isDocSelected(doc)"
                      @change="(checked) => toggleDocumentSelection(doc, Boolean(checked))"
                    />
                    <div class="doc-icon">DOC</div>
                    <div class="doc-title-area">
                      <div class="doc-name">{{ doc.name || String(doc.id) }}</div>
                      <div class="doc-source">{{ doc.data_source_type || 'local' }}</div>
                    </div>
                    <el-tag :type="resolveDocStatusType(resolveDocStatus(doc))" effect="light">{{
                      resolveDocStatus(doc)
                    }}</el-tag>
                  </div>
                  <div class="doc-info-row">
                    <span>{{ doc.word_count || 0 }} 词</span>
                    <span>{{ formatUnixTime(doc.created_at) }}</span>
                  </div>
                  <div class="doc-actions">
                    <el-button type="primary" link @click="bindSegmentDoc(doc)">分段</el-button>
                    <el-button
                      type="info"
                      link
                      @click="
                        () => {
                          indexBatch = pickBatch(doc)
                          if (indexBatch) queryIndexStatus()
                        }
                      "
                      >索引状态</el-button
                    >
                    <el-button type="danger" link @click="removeDocument(doc)">删除</el-button>
                  </div>
                </article>
              </div>

              <div class="pager soft-pager">
                <span class="selected-count">已选 {{ selectedDocumentIds.length }} 个文档</span>
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

              <section class="index-card">
                <div class="index-card-head">
                  <div>
                    <div class="section-title">索引状态查询</div>
                    <div class="section-subtitle">通过批次 ID 查看文档索引进度。</div>
                  </div>
                  <div class="index-toolbar">
                    <el-input v-model="indexBatch" placeholder="输入批次 ID" />
                    <el-button type="primary" :loading="indexLoading" @click="queryIndexStatus"
                      >查询</el-button
                    >
                  </div>
                </div>
                <pre class="json-box">{{ indexResultText || '{}' }}</pre>
              </section>
            </el-tab-pane>

            <el-tab-pane label="分段" name="segments">
              <div class="toolbar-card">
                <div class="toolbar-left wide">
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
                </div>
                <div class="toolbar-actions">
                  <el-button
                    @click="
                      () => {
                        segmentPager.page = 1
                        loadSegments()
                      }
                    "
                    >查询</el-button
                  >
                  <el-button type="primary" @click="openCreateSegment">新增分段</el-button>
                </div>
              </div>

              <el-empty v-if="!segmentDocId" description="请先选择文档" />
              <template v-else>
                <div v-loading="segmentsLoading" class="segment-list">
                  <article v-for="segment in segments" :key="segment.id" class="segment-card">
                    <div class="segment-main">
                      <div class="segment-content">{{ segment.content }}</div>
                      <div class="segment-answer">{{ segment.answer || '暂无答案' }}</div>
                      <div class="segment-keywords">
                        <span
                          v-for="keyword in Array.isArray(segment.keywords) ? segment.keywords : []"
                          :key="keyword"
                          >{{ keyword }}</span
                        >
                      </div>
                    </div>
                    <div class="segment-side">
                      <el-tag :type="segment.enabled === false ? 'info' : 'success'">{{
                        segment.enabled === false ? '禁用' : '启用'
                      }}</el-tag>
                      <div class="child-count"
                        >{{
                          Array.isArray(segment.child_chunks) ? segment.child_chunks.length : 0
                        }}
                        子分段</div
                      >
                      <div class="segment-actions">
                        <el-button type="primary" link @click="openEditSegment(segment)"
                          >编辑</el-button
                        >
                        <el-button type="success" link @click="openChunkDrawer(segment)"
                          >子分段</el-button
                        >
                        <el-button type="danger" link @click="removeSegment(segment)"
                          >删除</el-button
                        >
                      </div>
                    </div>
                  </article>
                </div>
                <div class="pager soft-pager">
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
              <section class="retrieve-card">
                <el-form label-width="120px" class="retrieve-form">
                  <el-form-item label="问题">
                    <el-input
                      v-model="retrieveForm.query"
                      type="textarea"
                      :rows="3"
                      placeholder="输入检索问题"
                    />
                  </el-form-item>
                  <el-row :gutter="16">
                    <el-col :span="8"
                      ><el-form-item label="检索方式"
                        ><el-select v-model="retrieveForm.search_method" class="w-full"
                          ><el-option label="语义检索" value="semantic_search" /><el-option
                            label="关键词检索"
                            value="keyword_search" /><el-option
                            label="全文检索"
                            value="full_text_search" /><el-option
                            label="混合检索"
                            value="hybrid_search" /></el-select></el-form-item
                    ></el-col>
                    <el-col :span="8"
                      ><el-form-item label="返回条数"
                        ><el-input-number
                          v-model="retrieveForm.top_k"
                          class="w-full"
                          :min="1"
                          :max="30" /></el-form-item
                    ></el-col>
                    <el-col :span="8"
                      ><el-form-item label="重排"
                        ><el-switch v-model="retrieveForm.reranking_enable" /></el-form-item
                    ></el-col>
                  </el-row>
                  <el-row :gutter="16">
                    <el-col :span="8"
                      ><el-form-item label="阈值开关"
                        ><el-switch v-model="retrieveForm.score_threshold_enabled" /></el-form-item
                    ></el-col>
                    <el-col :span="8"
                      ><el-form-item label="阈值"
                        ><el-input-number
                          v-model="retrieveForm.score_threshold"
                          class="w-full"
                          :min="0"
                          :max="1"
                          :step="0.05"
                          :disabled="!retrieveForm.score_threshold_enabled" /></el-form-item
                    ></el-col>
                    <el-col :span="8" class="retrieve-action-col"
                      ><el-button type="primary" :loading="retrieveLoading" @click="runRetrieveTest"
                        >执行测试</el-button
                      ></el-col
                    >
                  </el-row>
                </el-form>
              </section>
              <div class="retrieve-result">
                <el-empty v-if="!retrieveResult.length" description="暂无检索结果" />
                <article v-for="(item, idx) in retrieveResult" :key="idx" class="retrieve-item">
                  <div class="retrieve-item-head"
                    ><span>结果 {{ idx + 1 }}</span
                    ><strong>得分：{{ item.score ?? '-' }}</strong></div
                  >
                  <div class="retrieve-item-content">{{
                    item.segment?.content || item.content || item.segment?.answer || '无内容'
                  }}</div>
                  <pre class="json-box">{{ toPrettyText(item) }}</pre>
                </article>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </section>
    </template>
  </div>

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
:global(.layout-main) {
  padding: 0 !important;
  background: #f5f7fb !important;
}

.knowledge-page {
  --page-bg: #f5f7fb;
  --panel-bg: #fff;
  --panel-soft: #f8faff;
  --border: #e4eaf3;
  --border-strong: #d5dfef;
  --primary: #2563eb;
  --primary-soft: #eaf1ff;
  --primary-soft-2: #dbeafe;
  --text-main: #1f2937;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --font-sans: 'Inter', -apple-system, blinkmacsystemfont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', menlo, monospace;

  min-height: 100%;
  padding: 24px;
  font-family: var(--font-sans);
  color: var(--text-main);
  background: linear-gradient(180deg, #f8fbff 0%, var(--page-bg) 44%, #f5f7fb 100%);
}

.knowledge-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.eyebrow,
.detail-kicker {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--primary);
}

.hero-copy h1,
.create-title-block h1,
.detail-copy h1 {
  margin: 8px 0 6px;
  font-size: 28px;
  font-weight: 750;
  letter-spacing: -0.025em;
}

.hero-copy p,
.create-title-block p,
.detail-copy p {
  max-width: 760px;
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.hero-search {
  width: 300px;
}

.kb-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
}

.kb-tile,
.empty-gallery-card {
  min-height: 214px;
  padding: 18px;
  text-align: left;
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgb(15 23 42 / 4%);
}

.kb-tile {
  cursor: pointer;
  transition: all 0.18s ease;
}

.kb-tile:hover {
  border-color: #9dbcfb;
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgb(15 23 42 / 7%);
}

.create-tile {
  display: flex;
  color: var(--primary);
  background: linear-gradient(180deg, #f9fbff 0%, #eef5ff 100%);
  border-color: #b8ccf8;
  border-style: dashed;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
}

.tile-plus {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: 14px;
  font-size: 26px;
  font-weight: 500;
  background: #fff;
  border: 1px solid #c8d8fb;
  border-radius: 14px;
  place-items: center;
}

.tile-head {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.kb-avatar,
.detail-avatar,
.doc-icon,
.confirm-avatar,
.empty-illustration {
  display: grid;
  color: #fff;
  background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%);
  place-items: center;
  flex-shrink: 0;
}

.kb-avatar {
  width: 42px;
  height: 42px;
  font-weight: 750;
  border-radius: 14px;
}

.tile-title-area,
.doc-title-area {
  min-width: 0;
  flex: 1;
}

.tile-title,
.doc-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-code,
.doc-source {
  margin-top: 4px;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-desc {
  display: -webkit-box;
  min-height: 44px;
  margin: 14px 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tile-meta,
.detail-tags,
.segment-keywords {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tile-meta span,
.detail-tags span,
.segment-keywords span {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 999px;
}

.tile-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  margin-top: 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  border-top: 1px solid var(--border);
}

.tile-link {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
}

.empty-gallery-card {
  display: grid;
  min-height: 250px;
  color: var(--text-secondary);
  text-align: center;
  grid-column: 1 / -1;
  place-items: center;
}

.empty-illustration {
  width: 54px;
  height: 54px;
  font-family: var(--font-mono);
  border-radius: 16px;
}

.create-shell {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  min-height: calc(100vh - 48px);
}

.create-aside,
.create-main-card,
.detail-page-shell {
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 16px 36px rgb(15 23 42 / 5%);
}

.create-aside {
  padding: 20px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  padding: 0;
  margin-bottom: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.create-step-list {
  display: grid;
  gap: 10px;
  margin-top: 28px;
}

.create-step-item {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 12px;
  text-align: left;
  cursor: default;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 14px;
  transition: all 0.18s ease;
}

.create-step-item.done {
  cursor: pointer;
}

.create-step-item.active {
  background: #fff;
  border-color: #9dbcfb;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 8%);
}

.step-index {
  display: grid;
  width: 30px;
  height: 30px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 10px;
  place-items: center;
  flex-shrink: 0;
}

.create-step-item.active .step-index,
.create-step-item.done .step-index {
  color: #fff;
  background: var(--primary);
}

.create-step-item strong,
.create-step-item em {
  display: block;
}

.create-step-item strong {
  font-size: 13px;
  color: var(--text-main);
}

.create-step-item em {
  margin-top: 2px;
  font-size: 12px;
  font-style: normal;
  color: var(--text-secondary);
}

.create-main-card {
  display: flex;
  min-width: 0;
  padding: 28px;
  flex-direction: column;
}

.step-panel {
  max-width: 860px;
}

.step-panel-head {
  margin-bottom: 22px;
}

.step-panel-head span {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
}

.step-panel-head h2 {
  margin: 8px 0 6px;
  font-size: 24px;
  letter-spacing: -0.02em;
}

.step-panel-head p {
  margin: 0;
  color: var(--text-secondary);
}

.form-grid.two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.option-card {
  display: block;
  padding: 18px;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 16px;
}

.option-card.active {
  border-color: #9dbcfb;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 10%);
}

.option-card input {
  display: none;
}

.option-card strong,
.option-card span {
  display: block;
}

.option-card strong {
  font-size: 15px;
  color: var(--text-main);
}

.option-card span {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.confirm-card {
  display: flex;
  gap: 16px;
  padding: 18px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 18px;
}

.confirm-avatar {
  width: 56px;
  height: 56px;
  font-size: 22px;
  font-weight: 800;
  border-radius: 16px;
}

.confirm-card h3 {
  margin: 0 0 4px;
  font-size: 20px;
}

.confirm-card p {
  margin: 0 0 10px;
  color: var(--text-secondary);
}

.confirm-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.confirm-list div {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.confirm-list span {
  color: var(--text-secondary);
}

.confirm-list strong {
  font-family: var(--font-mono);
}

.create-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 20px;
  margin-top: auto;
  border-top: 1px solid var(--border);
}

.detail-page-shell {
  min-height: calc(100vh - 48px);
  padding: 20px;
}

.detail-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px;
  margin-bottom: 18px;
  background: linear-gradient(135deg, #fff 0%, #f3f8ff 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
}

.detail-avatar {
  width: 68px;
  height: 68px;
  font-size: 26px;
  font-weight: 800;
  border-radius: 20px;
}

.detail-copy {
  min-width: 0;
  flex: 1;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(3, 80px);
  gap: 8px;
}

.detail-metrics div {
  padding: 11px;
  text-align: center;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.detail-metrics strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 18px;
}

.detail-metrics span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-secondary);
}

.knowledge-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}

.knowledge-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--border);
}

.knowledge-tabs :deep(.el-tabs__item) {
  font-weight: 600;
  color: var(--text-secondary);
}

.knowledge-tabs :deep(.el-tabs__item.is-active) {
  color: var(--primary);
}

.knowledge-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--primary);
}

.toolbar-card,
.index-card,
.retrieve-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  margin-bottom: 14px;
  background: var(--panel-soft);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.index-card,
.retrieve-card {
  display: block;
}

.toolbar-left {
  display: grid;
  grid-template-columns: minmax(220px, 320px) 150px;
  gap: 10px;
  flex: 1;
}

.toolbar-left.wide {
  grid-template-columns: minmax(180px, 280px) minmax(180px, 1fr) 140px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.status-select {
  width: 150px;
}

.doc-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  min-height: 140px;
}

.doc-card,
.segment-card,
.retrieve-item,
.empty-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 16px;
}

.doc-card {
  padding: 14px;
  transition: all 0.18s ease;
}

.doc-card:hover,
.segment-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgb(15 23 42 / 5%);
}

.doc-card.selected {
  border-color: #9dbcfb;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 10%);
}

.doc-card-head {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.doc-icon {
  width: 36px;
  height: 36px;
  font-family: var(--font-mono);
  font-size: 10px;
  border-radius: 10px;
}

.doc-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
}

.doc-actions,
.segment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.empty-card {
  display: grid;
  min-height: 180px;
  color: var(--text-secondary);
  text-align: center;
  grid-column: 1 / -1;
  place-items: center;
}

.empty-card h3 {
  margin: 8px 0 2px;
}

.empty-card p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 14px;
}

.selected-count {
  margin-right: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

.index-card {
  margin-top: 14px;
}

.index-card-head,
.retrieve-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
}

.section-subtitle {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-secondary);
}

.index-toolbar {
  display: grid;
  grid-template-columns: 240px auto;
  gap: 8px;
}

.json-box {
  min-height: 96px;
  padding: 12px;
  margin: 12px 0 0;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: #dbeafe;
  word-break: break-all;
  white-space: pre-wrap;
  background: #0f172a;
  border-radius: 12px;
}

.segment-list {
  display: grid;
  gap: 12px;
}

.segment-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 14px;
  padding: 16px;
  transition: all 0.18s ease;
}

.segment-content {
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-main);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.segment-answer {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.segment-keywords {
  margin-top: 10px;
}

.segment-side {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-direction: column;
}

.child-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.retrieve-form {
  padding-top: 4px;
}

.retrieve-action-col {
  display: flex;
  align-items: center;
}

.retrieve-result {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.retrieve-item {
  padding: 14px;
}

.retrieve-item-head strong {
  font-family: var(--font-mono);
  color: var(--primary);
}

.retrieve-item-content {
  margin-top: 10px;
  line-height: 1.7;
  color: var(--text-main);
}

.chunk-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-textarea__inner) {
  border-radius: 10px !important;
  box-shadow: 0 0 0 1px var(--border) inset !important;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-select__wrapper.is-focused),
:deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px var(--primary) inset !important;
}

:deep(.el-button--primary) {
  --el-button-bg-color: var(--primary);
  --el-button-border-color: var(--primary);
  --el-button-hover-bg-color: #1d4ed8;
  --el-button-hover-border-color: #1d4ed8;

  border-radius: 10px;
}

@media (width <= 1180px) {
  .create-shell {
    grid-template-columns: 1fr;
  }

  .create-step-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .detail-hero,
  .toolbar-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-metrics {
    width: 100%;
  }
}

@media (width <= 860px) {
  .knowledge-page {
    padding: 16px;
  }

  .knowledge-hero,
  .hero-actions,
  .toolbar-card,
  .index-card-head {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-search,
  .toolbar-left,
  .toolbar-left.wide,
  .index-toolbar,
  .form-grid.two,
  .option-grid {
    width: 100%;
    grid-template-columns: 1fr;
  }

  .create-step-list {
    grid-template-columns: 1fr;
  }

  .segment-card {
    grid-template-columns: 1fr;
  }

  .segment-side {
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
