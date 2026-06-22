<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, EditPen } from '@element-plus/icons-vue'
import { knowledgeSegmentApi } from '@/api/knowledge/segment'
import type { DifyDocForm, DifySegment } from '@/api/knowledge/segment'
import {
  fmtTime,
  isSegmentNotFound,
  isSegmentWarning,
  segmentErrorText,
  statusLabel
} from '../segment-utils'

type DialogMode = 'create' | 'edit' | 'view'

const props = defineProps<{
  modelValue: boolean
  mode: DialogMode
  docForm: DifyDocForm
  datasetId: string
  documentId: string
  segment: DifySegment | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
  'request-edit': [DifySegment]
  'request-delete': [DifySegment]
  'request-child': [DifySegment]
}>()

const submitting = ref(false)
const detailLoading = ref(false)
const detail = ref<DifySegment | null>(null)
const contentError = ref('')
const form = reactive({
  content: '',
  answer: '',
  keywords: [] as string[],
  enabled: true,
  summary: '',
  regenerateChildChunks: false
})

const title = computed(() => {
  if (props.mode === 'create') return '新增分段'
  if (props.mode === 'edit') return '编辑分段'
  return '分段详情'
})

function close() {
  emit('update:modelValue', false)
}

function hydrate(segment?: DifySegment | null) {
  detail.value = segment || null
  form.content = segment?.content || ''
  form.answer = segment?.answer || ''
  form.keywords = [...(segment?.keywords || [])]
  form.enabled = segment?.enabled !== false
  form.summary = segment?.summary || ''
  form.regenerateChildChunks = false
  contentError.value = ''
}

function showError(error: unknown, fallback: string) {
  const text = segmentErrorText(error, fallback)
  if (isSegmentWarning(error)) ElMessage.warning(text)
  else ElMessage.error(text)
}

async function loadDetail() {
  if (!props.segment?.id || props.mode === 'create') {
    hydrate(props.segment)
    return
  }
  detailLoading.value = true
  try {
    const response = await knowledgeSegmentApi.getSegmentDetail(
      props.datasetId,
      props.documentId,
      props.segment.id
    )
    hydrate(response.data || props.segment)
  } catch (error: unknown) {
    showError(error, '分段详情加载失败')
    hydrate(props.segment)
    if (isSegmentNotFound(error)) {
      close()
      emit('saved')
    }
  } finally {
    detailLoading.value = false
  }
}

async function submit() {
  const content = form.content.trim()
  if (!content) {
    contentError.value = '请输入分段内容'
    return
  }
  contentError.value = ''
  submitting.value = true
  try {
    if (props.mode === 'create') {
      await knowledgeSegmentApi.createSegments(props.datasetId, props.documentId, {
        segments: [
          {
            content,
            answer: props.docForm === 'qa_model' ? form.answer.trim() || null : undefined,
            keywords: form.keywords
          }
        ]
      })
      ElMessage.success('新增成功')
    } else if (detail.value) {
      await knowledgeSegmentApi.updateSegment(props.datasetId, props.documentId, detail.value.id, {
        segment: {
          content,
          answer: props.docForm === 'qa_model' ? form.answer.trim() || null : undefined,
          keywords: form.keywords,
          enabled: form.enabled,
          summary: form.summary.trim() || null,
          regenerate_child_chunks:
            props.docForm === 'hierarchical_model' ? form.regenerateChildChunks : undefined
        }
      })
      ElMessage.success('已保存，正在重新索引')
    }
    close()
    emit('saved')
  } catch (error: unknown) {
    showError(error, props.mode === 'create' ? '新增分段失败' : '保存分段失败')
    if (isSegmentNotFound(error)) emit('saved')
  } finally {
    submitting.value = false
  }
}

function requestEdit() {
  if (detail.value) emit('request-edit', detail.value)
}

function requestDelete() {
  if (detail.value) emit('request-delete', detail.value)
}

watch(
  () => [props.modelValue, props.mode, props.segment?.id] as const,
  ([visible]) => {
    if (!visible) return
    if (props.mode === 'create') hydrate(null)
    else void loadDetail()
  },
  { immediate: true }
)
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    size="min(560px, 100%)"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="detailLoading" class="segment-drawer">
      <template v-if="mode === 'view' && detail">
        <div class="detail-section">
          <span class="section-label">分段内容</span>
          <div class="readonly-content">{{ detail.content || '暂无内容' }}</div>
        </div>

        <div v-if="docForm === 'qa_model'" class="detail-section">
          <span class="section-label">回答</span>
          <div class="readonly-content">{{ detail.answer || '暂无回答' }}</div>
        </div>

        <div v-if="detail.summary" class="detail-section">
          <span class="section-label">摘要</span>
          <div class="readonly-content">{{ detail.summary }}</div>
        </div>

        <div v-if="detail.keywords?.length" class="keyword-list">
          <span v-for="keyword in detail.keywords" :key="keyword">#{{ keyword }}</span>
        </div>

        <div class="detail-grid">
          <div
            ><span>状态</span><strong>{{ statusLabel(detail.status) }}</strong></div
          >
          <div
            ><span>是否启用</span><strong>{{ detail.enabled === false ? '否' : '是' }}</strong></div
          >
          <div
            ><span>字数</span><strong>{{ detail.word_count || 0 }}</strong></div
          >
          <div
            ><span>Tokens</span><strong>{{ detail.tokens || 0 }}</strong></div
          >
          <div
            ><span>命中</span><strong>{{ detail.hit_count || 0 }}</strong></div
          >
          <div
            ><span>创建时间</span><strong>{{ fmtTime(detail.created_at) }}</strong></div
          >
          <div
            ><span>更新时间</span><strong>{{ fmtTime(detail.updated_at) }}</strong></div
          >
        </div>

        <el-alert
          v-if="detail.error"
          class="error-alert"
          type="error"
          :title="detail.error"
          :closable="false"
          show-icon
        />

        <button
          v-if="docForm === 'hierarchical_model'"
          type="button"
          class="child-manage-btn"
          :disabled="detail.status === 'indexing'"
          @click="emit('request-child', detail)"
        >
          管理子分段（{{ detail.child_chunks?.length || 0 }}）
        </button>
      </template>

      <el-form v-else label-position="top" class="segment-form">
        <el-form-item label="分段内容" required :error="contentError">
          <el-input
            v-model="form.content"
            type="textarea"
            :autosize="{ minRows: 8, maxRows: 18 }"
            placeholder="请输入分段内容"
            @input="contentError = ''"
          />
        </el-form-item>

        <el-form-item v-if="docForm === 'qa_model'" label="回答">
          <el-input
            v-model="form.answer"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 12 }"
            placeholder="请输入回答内容"
          />
        </el-form-item>

        <el-form-item label="关键词">
          <el-select
            v-model="form.keywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入关键词后按回车添加"
          >
            <el-option
              v-for="keyword in form.keywords"
              :key="keyword"
              :label="keyword"
              :value="keyword"
            />
          </el-select>
        </el-form-item>

        <template v-if="mode === 'edit'">
          <el-form-item label="摘要（可选）">
            <el-input
              v-model="form.summary"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
              placeholder="请输入分段摘要"
            />
          </el-form-item>
          <el-form-item label="检索状态">
            <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
          </el-form-item>
          <el-checkbox
            v-if="docForm === 'hierarchical_model'"
            v-model="form.regenerateChildChunks"
            class="regenerate-check"
          >
            重建子分段（保存后原子分段将被重新生成）
          </el-checkbox>
        </template>
      </el-form>
    </div>

    <template #footer>
      <div v-if="mode === 'view'" class="drawer-footer">
        <el-button @click="close">关闭</el-button>
        <el-button
          type="danger"
          plain
          :icon="Delete"
          :disabled="detail?.status === 'indexing'"
          @click="requestDelete"
        >
          删除
        </el-button>
        <el-button
          type="primary"
          :icon="EditPen"
          :disabled="detail?.status === 'indexing'"
          @click="requestEdit"
        >
          编辑
        </el-button>
      </div>
      <div v-else class="drawer-footer">
        <el-button @click="close">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ mode === 'create' ? '新增分段' : '保存修改' }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="less">
.segment-drawer {
  min-height: 240px;
}

.segment-form :deep(.el-select) {
  width: 100%;
}

.regenerate-check {
  height: auto;
  white-space: normal;
}

.detail-section + .detail-section {
  margin-top: 20px;
}

.section-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.readonly-content {
  padding: 14px;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.75;
  color: #334155;
  white-space: pre-wrap;
  background: #f8faff;
  border: 1px solid #e4eaf3;
  border-radius: 12px;
}

.keyword-list {
  display: flex;
  margin-top: 18px;
  flex-wrap: wrap;
  gap: 7px;
}

.keyword-list span {
  padding: 4px 9px;
  font-size: 11px;
  color: #475569;
  background: #f1f5f9;
  border-radius: 999px;
}

.detail-grid {
  display: grid;
  margin-top: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid div {
  padding: 12px;
  background: #f8faff;
  border: 1px solid #e4eaf3;
  border-radius: 12px;
}

.detail-grid span,
.detail-grid strong {
  display: block;
}

.detail-grid span {
  margin-bottom: 5px;
  font-size: 11px;
  color: #94a3b8;
}

.detail-grid strong {
  overflow-wrap: anywhere;
  font-size: 13px;
  color: #334155;
}

.error-alert,
.child-manage-btn {
  margin-top: 18px;
}

.child-manage-btn {
  padding: 8px 13px;
  font-weight: 600;
  color: var(--brand-primary, #2563eb);
  cursor: pointer;
  background: #eaf1ff;
  border: 0;
  border-radius: 999px;
}

.child-manage-btn:disabled {
  color: #94a3b8;
  cursor: not-allowed;
  background: #f1f5f9;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (width <= 520px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
