<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, EditPen, Plus, Search } from '@element-plus/icons-vue'
import { knowledgeSegmentApi } from '@/api/knowledge/segment'
import type { DifyChildChunk, DifySegment } from '@/api/knowledge/segment'
import {
  isSegmentNotFound,
  isSegmentWarning,
  padPosition,
  segmentErrorText
} from '../segment-utils'

const props = defineProps<{
  modelValue: boolean
  datasetId: string
  documentId: string
  segment: DifySegment
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  changed: []
}>()

const loading = ref(false)
const list = ref<DifyChildChunk[]>([])
const keyword = ref('')
const pager = reactive({ page: 1, limit: 10, total: 0 })
const editVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editTarget = ref<DifyChildChunk | null>(null)
const editContent = ref('')
const contentError = ref('')
const submitting = ref(false)

function showError(error: unknown, fallback: string) {
  const text = segmentErrorText(error, fallback)
  if (isSegmentWarning(error)) ElMessage.warning(text)
  else ElMessage.error(text)
}

async function load() {
  if (!props.modelValue || !props.segment.id) return
  loading.value = true
  try {
    const response = await knowledgeSegmentApi.pageChildChunks(
      props.datasetId,
      props.documentId,
      props.segment.id,
      {
        page: pager.page,
        limit: pager.limit,
        keyword: keyword.value.trim() || undefined
      }
    )
    list.value = response.data || []
    pager.total = response.total || 0
  } catch (error: unknown) {
    showError(error, '子分段列表加载失败')
    if (isSegmentNotFound(error)) emit('changed')
  } finally {
    loading.value = false
  }
}

function search() {
  pager.page = 1
  void load()
}

function changePage(page: number) {
  pager.page = page
  void load()
}

function openCreate() {
  editMode.value = 'create'
  editTarget.value = null
  editContent.value = ''
  contentError.value = ''
  editVisible.value = true
}

function openEdit(chunk: DifyChildChunk) {
  editMode.value = 'edit'
  editTarget.value = chunk
  editContent.value = chunk.content || ''
  contentError.value = ''
  editVisible.value = true
}

async function saveChunk() {
  const content = editContent.value.trim()
  if (!content) {
    contentError.value = '请输入子分段内容'
    return
  }
  submitting.value = true
  try {
    if (editMode.value === 'create') {
      await knowledgeSegmentApi.createChildChunk(
        props.datasetId,
        props.documentId,
        props.segment.id,
        { content }
      )
      ElMessage.success('子分段新增成功')
    } else if (editTarget.value) {
      await knowledgeSegmentApi.updateChildChunk(
        props.datasetId,
        props.documentId,
        props.segment.id,
        editTarget.value.id,
        { content }
      )
      ElMessage.success('子分段已更新')
    }
    editVisible.value = false
    await load()
    emit('changed')
  } catch (error: unknown) {
    showError(error, editMode.value === 'create' ? '子分段新增失败' : '子分段更新失败')
    if (isSegmentNotFound(error)) emit('changed')
  } finally {
    submitting.value = false
  }
}

async function removeChunk(chunk: DifyChildChunk) {
  try {
    await ElMessageBox.confirm('确认删除该子分段？删除后不可恢复。', '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await knowledgeSegmentApi.deleteChildChunk(
      props.datasetId,
      props.documentId,
      props.segment.id,
      chunk.id
    )
    ElMessage.success('子分段已删除')
    if (list.value.length === 1 && pager.page > 1) pager.page -= 1
    await load()
    emit('changed')
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') return
    showError(error, '子分段删除失败')
    if (isSegmentNotFound(error)) emit('changed')
  }
}

watch(
  () => [props.modelValue, props.segment.id] as const,
  ([visible]) => {
    if (!visible) return
    pager.page = 1
    keyword.value = ''
    void load()
  },
  { immediate: true }
)
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="子分段管理"
    size="min(560px, 100%)"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="chunk-panel">
      <div class="parent-hint">
        <span>父分段 {{ padPosition(segment.position) }}</span>
        <strong>共 {{ pager.total }} 个子分段</strong>
      </div>

      <div class="chunk-toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索子分段内容"
          @clear="search"
          @keyup.enter="search"
        >
          <template #prefix
            ><el-icon><Search /></el-icon
          ></template>
        </el-input>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增子分段</el-button>
      </div>

      <div v-loading="loading" class="chunk-list">
        <article v-for="chunk in list" :key="chunk.id" class="chunk-item">
          <div class="chunk-head">
            <span>{{ padPosition(chunk.position) }}</span>
            <span class="type-tag">{{ chunk.type === 'automatic' ? '自动' : '自定义' }}</span>
          </div>
          <p>{{ chunk.content || '暂无内容' }}</p>
          <div class="chunk-footer">
            <span>{{ chunk.word_count || 0 }} 字</span>
            <div>
              <el-button text :icon="EditPen" @click="openEdit(chunk)">编辑</el-button>
              <el-button text type="danger" :icon="Delete" @click="removeChunk(chunk)">
                删除
              </el-button>
            </div>
          </div>
        </article>

        <div v-if="!loading && !list.length" class="chunk-empty">
          <span>暂无子分段</span>
          <el-button type="primary" plain :icon="Plus" @click="openCreate">新增子分段</el-button>
        </div>
      </div>

      <el-pagination
        v-if="pager.total > pager.limit"
        class="chunk-pagination"
        small
        layout="prev, pager, next"
        :current-page="pager.page"
        :page-size="pager.limit"
        :total="pager.total"
        @current-change="changePage"
      />
    </div>

    <el-dialog
      v-model="editVisible"
      append-to-body
      width="min(520px, calc(100% - 32px))"
      :title="editMode === 'create' ? '新增子分段' : '编辑子分段'"
    >
      <el-form label-position="top">
        <el-form-item label="子分段内容" required :error="contentError">
          <el-input
            v-model="editContent"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 14 }"
            placeholder="请输入子分段内容"
            @input="contentError = ''"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveChunk">保存</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<style scoped lang="less">
.chunk-panel {
  display: grid;
  gap: 16px;
}

.parent-hint,
.chunk-toolbar,
.chunk-head,
.chunk-footer {
  display: flex;
  align-items: center;
}

.parent-hint {
  padding: 12px 14px;
  font-size: 12px;
  color: #64748b;
  background: #f2f6ff;
  border: 1px solid #e4eaf3;
  border-radius: 12px;
  justify-content: space-between;
}

.parent-hint span {
  font-family: var(--font-mono);
  color: var(--brand-primary, #2563eb);
}

.chunk-toolbar {
  gap: 10px;
}

.chunk-list {
  display: grid;
  min-height: 180px;
  gap: 10px;
}

.chunk-item {
  padding: 14px;
  background: #fff;
  border: 1px solid #e4eaf3;
  border-radius: 14px;
}

.chunk-head {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-primary, #2563eb);
  justify-content: space-between;
}

.type-tag {
  padding: 3px 8px;
  font-family: inherit;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  border-radius: 999px;
}

.chunk-item p {
  margin: 12px 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.65;
  color: #475569;
  white-space: pre-wrap;
}

.chunk-footer {
  padding-top: 8px;
  font-size: 11px;
  color: #94a3b8;
  border-top: 1px solid #eef2f7;
  justify-content: space-between;
}

.chunk-footer :deep(.el-button + .el-button) {
  margin-left: 2px;
}

.chunk-empty {
  display: grid;
  min-height: 180px;
  color: #94a3b8;
  background: #f8faff;
  border: 1px dashed #d5dfef;
  border-radius: 14px;
  place-items: center;
  align-content: center;
  gap: 12px;
}

.chunk-pagination {
  justify-self: end;
}

@media (width <= 520px) {
  .chunk-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
