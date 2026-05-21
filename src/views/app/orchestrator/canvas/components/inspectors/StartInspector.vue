<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { StartNodeData, StartVariable } from '../../types'

interface Props {
  nodeData: StartNodeData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: StartNodeData): void
}>()

const SYS_VARS = [
  { variable: 'query', label: '用户输入', desc: '对话用户的原始提问' },
  { variable: 'files', label: '用户文件', desc: '对话用户上传的文件' }
]

const formData = reactive<StartNodeData>(cloneData(props.nodeData))
const dialogVisible = ref(false)
const editingIndex = ref(-1)
const form = reactive<StartVariable>(emptyForm())

const variables = computed(() => formData.variables || [])

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, cloneData(value))
    if (!Array.isArray(formData.variables)) {
      formData.variables = []
    }
  },
  { deep: true, immediate: true }
)

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function emptyForm(): StartVariable {
  return {
    id: genVarId(),
    variable: '',
    label: '',
    type: 'paragraph',
    required: false,
    default: '',
    hint: '',
    placeholder: '',
    maxLength: 200000
  }
}

function genVarId() {
  const rand = Math.random().toString(36).slice(2, 8)
  return `start_var_${Date.now()}_${rand}`
}

function openAdd() {
  editingIndex.value = -1
  Object.assign(form, emptyForm())
  dialogVisible.value = true
}

function openEdit(index: number) {
  editingIndex.value = index
  Object.assign(form, emptyForm(), cloneData(variables.value[index]))
  dialogVisible.value = true
}

function remove(index: number) {
  formData.variables = formData.variables.filter((_, i) => i !== index)
}

function saveVariable() {
  const key = form.variable.trim()
  if (!key) {
    ElMessage.error('请填写变量 Key')
    return
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,29}$/.test(key)) {
    ElMessage.error('变量 Key 仅允许英文/数字/下划线，且不能数字开头，长度 1-30')
    return
  }
  if (key === 'query' || key === 'files') {
    ElMessage.error('该 Key 与系统变量冲突')
    return
  }
  if (!form.label.trim()) {
    ElMessage.error('请填写显示名')
    return
  }

  const duplicateAt = variables.value.findIndex((item) => item.variable === key)
  if (duplicateAt >= 0 && duplicateAt !== editingIndex.value) {
    ElMessage.error(`变量 Key "${key}" 已存在`)
    return
  }

  const normalizedType: StartVariable['type'] = form.type === 'number' ? 'number' : 'paragraph'
  const item: StartVariable = {
    ...cloneData(form),
    id: form.id || genVarId(),
    variable: key,
    label: form.label.trim(),
    type: normalizedType,
    default:
      normalizedType === 'number'
        ? normalizeNumberDefault(form.default)
        : String(form.default ?? ''),
    maxLength: normalizedType === 'number' ? 0 : form.maxLength || 200000
  }

  if (editingIndex.value >= 0) {
    formData.variables[editingIndex.value] = item
  } else {
    formData.variables.push(item)
  }
  dialogVisible.value = false
}

function handleSave() {
  emit('save', cloneData(formData))
}

function normalizeNumberDefault(value: StartVariable['default']): number | '' {
  if (value === '' || value === undefined || value === null) return ''
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : ''
}

function numberDefaultModelValue(): number | undefined {
  const normalized = normalizeNumberDefault(form.default)
  return normalized === '' ? undefined : normalized
}

function updateNumberDefault(value: number | null | undefined) {
  form.default = value ?? ''
}

watch(
  () => form.type,
  (type) => {
    if (type === 'number') {
      form.default = normalizeNumberDefault(form.default)
      form.maxLength = 0
      return
    }

    form.default = String(form.default ?? '')
    if (!form.maxLength || form.maxLength < 1) {
      form.maxLength = 200000
    }
  }
)
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="节点标题">
      <el-input v-model="formData.title" maxlength="40" />
    </el-form-item>

    <el-form-item label="系统变量">
      <div class="sys-var-list">
        <div v-for="item in SYS_VARS" :key="item.variable" class="sys-var-row">
          <code class="sys-var-key">sys.{{ item.variable }}</code>
          <span class="sys-var-label">{{ item.label }}</span>
          <span class="sys-var-desc">{{ item.desc }}</span>
          <el-tag type="info" size="small">系统</el-tag>
        </div>
      </div>
    </el-form-item>

    <el-form-item label="自定义变量">
      <div class="custom-var-list">
        <div v-for="(item, index) in variables" :key="item.id" class="custom-var-row">
          <code class="var-key">{{ item.variable }}</code>
          <span class="var-label">{{ item.label }}</span>
          <span class="var-type">{{ item.type === 'number' ? 'number' : 'paragraph' }}</span>
          <el-tag v-if="item.required" type="warning" size="small">必填</el-tag>
          <div class="row-actions">
            <el-button text @click="openEdit(index)">编辑</el-button>
            <el-button text type="danger" @click="remove(index)">删除</el-button>
          </div>
        </div>
        <el-button class="add-btn" plain @click="openAdd">+ 新增变量</el-button>
      </div>
    </el-form-item>
  </el-form>

  <div class="footer">
    <el-button type="primary" @click="handleSave">保存配置</el-button>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingIndex >= 0 ? '编辑变量' : '新增变量'">
    <el-form label-position="top">
      <el-form-item label="变量 Key" required>
        <el-input v-model="form.variable" placeholder="例如: file_type" />
        <div class="form-tip">英文/数字/下划线，不能数字开头</div>
      </el-form-item>
      <el-form-item label="显示名" required>
        <el-input v-model="form.label" placeholder="例如: 文件类型" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="form.type">
          <el-option label="多行文本" value="paragraph" />
          <el-option label="数字" value="number" />
        </el-select>
      </el-form-item>
      <el-form-item label="是否必填">
        <el-switch v-model="form.required" />
      </el-form-item>
      <el-form-item v-if="form.type === 'paragraph'" label="默认值">
        <el-input v-model="form.default" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item v-else label="默认值">
        <el-input-number
          :model-value="numberDefaultModelValue()"
          class="w-full"
          controls-position="right"
          @update:model-value="updateNumberDefault"
        />
      </el-form-item>
      <el-form-item label="提示文字">
        <el-input v-model="form.hint" />
      </el-form-item>
      <el-form-item label="占位符">
        <el-input v-model="form.placeholder" />
      </el-form-item>
      <el-form-item v-if="form.type === 'paragraph'" label="最大长度">
        <el-input-number v-model="form.maxLength" :min="1" :max="200000" class="w-full" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveVariable">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="less">
.sys-var-list,
.custom-var-list {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
}

.sys-var-row,
.custom-var-row {
  display: flex;
  padding: 8px 10px;
  gap: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  align-items: center;
}

.sys-var-key,
.var-key {
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--el-color-primary);
}

.sys-var-label,
.var-label {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.sys-var-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: 1;
}

.var-type {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.row-actions {
  margin-left: auto;
}

.add-btn {
  align-self: flex-start;
}

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.footer {
  display: flex;
  justify-content: flex-end;
}
</style>
