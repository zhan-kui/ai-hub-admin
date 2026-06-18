<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type UploadFile, type UploadFiles, type UploadInstance } from 'element-plus'
import { CircleClose, Document, UploadFilled } from '@element-plus/icons-vue'
import { knowledgeDocApi } from '@/api/knowledge'
import type { CreateDocByFileData, IndexingTechnique } from '@/api/knowledge/types'
import { SEPARATOR_PRESETS } from '../constants'

const props = defineProps<{
  modelValue: boolean
  datasetId: string
  indexingTechnique: IndexingTechnique
  embeddingModel?: string | null
  embeddingModelProvider?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  uploaded: [{ batch: string; documentId: string; documentName: string }]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const submitting = ref(false)
const file = ref<File | null>(null)
const uploadRef = ref<UploadInstance>()
const uploadPercent = ref(0)
const uploadState = ref<'idle' | 'ready' | 'uploading' | 'done' | 'error'>('idle')

const form = reactive({
  separatorPreset: '\n\n',
  separator: '\n\n',
  maxTokens: 1024,
  chunkOverlap: 0,
  preRules: ['remove_extra_spaces'] as Array<'remove_extra_spaces' | 'remove_urls_emails'>,
  parentChild: false,
  subSeparator: '\n',
  subMaxTokens: 512,
  subChunkOverlap: 0
})

const isHighQuality = computed(() => props.indexingTechnique === 'high_quality')

function resetForm() {
  if (isHighQuality.value) {
    form.separatorPreset = '\n\n'
    form.separator = '\n\n'
    form.maxTokens = 1024
    form.chunkOverlap = 0
    form.preRules = ['remove_extra_spaces']
    form.parentChild = false
  } else {
    form.separatorPreset = '\n'
    form.separator = '\n'
    form.maxTokens = 500
    form.chunkOverlap = 50
    form.preRules = ['remove_extra_spaces', 'remove_urls_emails']
    form.parentChild = false
  }
  form.subSeparator = '\n'
  form.subMaxTokens = 512
  form.subChunkOverlap = 0
  file.value = null
  uploadRef.value?.clearFiles()
  uploadPercent.value = 0
  uploadState.value = 'idle'
}

function handleSeparatorChange(value: string) {
  if (value !== '__custom__') {
    form.separator = value
  }
}

function beforeChange(uploadFile: UploadFile, uploadFiles: UploadFiles) {
  const raw = uploadFile.raw
  if (!raw) return
  if (raw.size > 15 * 1024 * 1024) {
    ElMessage.warning('单文件不能超过 15MB')
    uploadFiles.splice(0, uploadFiles.length)
    file.value = null
    uploadPercent.value = 0
    uploadState.value = 'idle'
    return
  }
  file.value = raw
  uploadPercent.value = 0
  uploadState.value = 'ready'
}

const fileSizeText = computed(() => {
  if (!file.value) return ''
  const size = file.value.size
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
})

const uploadStateText = computed(() => {
  if (uploadState.value === 'ready') return '已就绪'
  if (uploadState.value === 'uploading') return `上传中 ${uploadPercent.value}%`
  if (uploadState.value === 'done') return '上传完成'
  if (uploadState.value === 'error') return '上传失败'
  return ''
})

function removeSelectedFile() {
  if (submitting.value) return
  file.value = null
  uploadRef.value?.clearFiles()
  uploadPercent.value = 0
  uploadState.value = 'idle'
}

function buildData(): CreateDocByFileData {
  const data: CreateDocByFileData = {
    indexing_technique: props.indexingTechnique,
    doc_form: 'text_model',
    doc_language: 'Chinese Simplified',
    process_rule: {
      mode: 'custom',
      rules: {
        pre_processing_rules: form.preRules.map((id) => ({ id, enabled: true })),
        segmentation: {
          separator: form.separator,
          max_tokens: Number(form.maxTokens || 1),
          chunk_overlap: Number(form.chunkOverlap || 0)
        }
      }
    }
  }

  if (isHighQuality.value) {
    if (props.embeddingModel) data.embedding_model = props.embeddingModel
    if (props.embeddingModelProvider) data.embedding_model_provider = props.embeddingModelProvider
    if (form.parentChild) {
      data.process_rule!.rules!.parent_mode = 'paragraph'
      data.process_rule!.rules!.subchunk_segmentation = {
        separator: form.subSeparator,
        max_tokens: Number(form.subMaxTokens || 1),
        chunk_overlap: Number(form.subChunkOverlap || 0)
      }
    }
  }

  return data
}

async function submit() {
  const rawFile = file.value
  if (!(rawFile instanceof File)) {
    ElMessage.warning('请先选择文件')
    return
  }
  submitting.value = true
  uploadState.value = 'uploading'
  uploadPercent.value = 0
  try {
    const res = await knowledgeDocApi.createByFile(
      props.datasetId,
      rawFile,
      buildData(),
      (event) => {
        if (!event.total) return
        uploadPercent.value = Math.min(99, Math.round((event.loaded / event.total) * 100))
      }
    )
    uploadPercent.value = 100
    uploadState.value = 'done'
    ElMessage.success('上传成功，开始建立索引')
    emit('uploaded', {
      batch: res.batch,
      documentId: res.document.id,
      documentName: res.document.name
    })
    visible.value = false
  } catch (error: any) {
    uploadState.value = 'error'
    ElMessage.error(error?.message || '上传失败')
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) resetForm()
  }
)
</script>

<template>
  <el-dialog v-model="visible" width="820px" class="kb-upload-dialog" destroy-on-close align-center>
    <template #header>
      <div class="dialog-head">
        <span>UPLOAD DOCUMENT</span>
        <h3>上传文档</h3>
        <p>按当前知识库模式设置分块参数，上传后自动建立索引。</p>
      </div>
    </template>

    <el-upload
      ref="uploadRef"
      drag
      :auto-upload="false"
      :limit="1"
      :show-file-list="false"
      :on-change="beforeChange"
      :on-exceed="() => ElMessage.warning('一次只能上传一个文件')"
      accept=".txt,.md,.pdf,.docx,.doc,.html,.htm,.csv"
      class="upload-drop"
    >
      <el-icon class="upload-icon"><UploadFilled /></el-icon>
      <div class="upload-text">拖拽文件到此，或 <em>点击选择</em></div>
      <div class="upload-tip">支持 TXT / MD / PDF / DOCX / HTML，单文件 ≤ 15MB</div>
    </el-upload>

    <div v-if="file" class="selected-file" :class="`is-${uploadState}`">
      <div class="file-icon">
        <el-icon><Document /></el-icon>
      </div>
      <div class="file-info">
        <strong>{{ file.name }}</strong>
        <span>{{ fileSizeText }}</span>
        <el-progress
          v-if="uploadState === 'uploading' || uploadState === 'done'"
          :percentage="uploadPercent"
          :stroke-width="6"
          :show-text="false"
        />
      </div>
      <div class="file-state">{{ uploadStateText }}</div>
      <button type="button" class="file-remove" :disabled="submitting" @click="removeSelectedFile">
        <el-icon><CircleClose /></el-icon>
      </button>
    </div>

    <div class="chunk-panel">
      <div class="panel-title">分段设置</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <label class="field-label">分段标识符</label>
          <el-select v-model="form.separatorPreset" class="w-full" @change="handleSeparatorChange">
            <el-option
              v-for="item in SEPARATOR_PRESETS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-col>
        <el-col v-if="form.separatorPreset === '__custom__'" :span="12">
          <label class="field-label">自定义标识符</label>
          <el-input v-model="form.separator" placeholder="例如 ###" />
        </el-col>
        <el-col :span="12">
          <label class="field-label">最大分段长度</label>
          <el-input-number v-model="form.maxTokens" :min="100" :max="4000" :step="50" />
        </el-col>
        <el-col :span="12">
          <label class="field-label">分段重叠</label>
          <el-input-number v-model="form.chunkOverlap" :min="0" :max="1000" :step="10" />
        </el-col>
      </el-row>

      <el-checkbox-group v-model="form.preRules" class="pre-rules">
        <el-checkbox label="remove_extra_spaces">去除多余空格</el-checkbox>
        <el-checkbox label="remove_urls_emails">去除 URL / 邮箱</el-checkbox>
      </el-checkbox-group>
    </div>

    <div v-if="isHighQuality" class="chunk-panel">
      <div class="parent-line">
        <div>
          <strong>父子分段</strong>
          <p>用于高质量知识库的细粒度召回。</p>
        </div>
        <el-switch v-model="form.parentChild" />
      </div>
      <el-row v-if="form.parentChild" :gutter="16">
        <el-col :span="8">
          <label class="field-label">子段标识符</label>
          <el-input v-model="form.subSeparator" />
        </el-col>
        <el-col :span="8">
          <label class="field-label">子段长度</label>
          <el-input-number v-model="form.subMaxTokens" :min="100" :max="2000" :step="50" />
        </el-col>
        <el-col :span="8">
          <label class="field-label">子段重叠</label>
          <el-input-number v-model="form.subChunkOverlap" :min="0" :max="500" :step="10" />
        </el-col>
      </el-row>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">上传并索引</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="less">
.dialog-head span {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--primary, #2563eb);
}

.dialog-head h3 {
  margin: 6px 0 4px;
  font-size: 22px;
  color: var(--text-main, #172033);
}

.dialog-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.upload-icon {
  margin-top: 2px;
  font-size: 34px;
  color: var(--primary, #2563eb);
}

.upload-drop :deep(.el-upload-dragger) {
  padding: 18px;
  border-radius: 16px;
}

.upload-text {
  margin-top: 6px;
  color: var(--text-main, #172033);
}

.upload-text em {
  font-style: normal;
  font-weight: 700;
  color: var(--primary, #2563eb);
}

.upload-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.selected-file {
  display: grid;
  min-height: 76px;
  padding: 14px;
  margin-top: 14px;
  background: linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
  border: 1px solid #c7d8f6;
  border-radius: 16px;
  grid-template-columns: 44px minmax(0, 1fr) auto 30px;
  align-items: center;
  gap: 12px;
}

.selected-file.is-uploading {
  border-color: var(--primary, #2563eb);
  box-shadow: 0 0 0 3px rgb(37 99 235 / 8%);
}

.selected-file.is-done {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.selected-file.is-error {
  background: #fff1f2;
  border-color: #fecdd3;
}

.file-icon {
  display: grid;
  width: 44px;
  height: 44px;
  font-size: 22px;
  color: var(--primary, #2563eb);
  background: #fff;
  border: 1px solid #d8e3f5;
  border-radius: 14px;
  place-items: center;
}

.file-info {
  min-width: 0;
}

.file-info strong {
  display: block;
  overflow: hidden;
  font-size: 14px;
  color: var(--text-main, #172033);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-info span {
  display: block;
  margin: 4px 0 6px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.file-state {
  min-width: 86px;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary, #2563eb);
  text-align: right;
}

.is-done .file-state {
  color: #15803d;
}

.is-error .file-state {
  color: #b91c1c;
}

.file-remove {
  display: grid;
  width: 28px;
  height: 28px;
  color: #94a3b8;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 999px;
  place-items: center;
}

.file-remove:hover:not(:disabled) {
  color: #dc2626;
  background: #fff;
}

.file-remove:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.chunk-panel {
  padding: 14px;
  margin-top: 14px;
  background: var(--panel-soft, #f8faff);
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 16px;
}

.panel-title {
  margin-bottom: 12px;
  font-weight: 700;
  color: var(--text-main, #172033);
}

.field-label {
  display: block;
  margin: 8px 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}

.pre-rules {
  margin-top: 12px;
}

.parent-line {
  display: flex;
  margin-bottom: 12px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.parent-line strong {
  color: var(--text-main, #172033);
}

.parent-line p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.w-full {
  width: 100%;
}

@media (width <= 760px) {
  .selected-file {
    grid-template-columns: 44px minmax(0, 1fr) 30px;
  }

  .file-state {
    grid-column: 2 / -1;
    text-align: left;
  }
}

:deep(.el-input-number) {
  width: 100%;
}
</style>
