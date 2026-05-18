<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IF_OPERATORS, MAX_IF_CASES } from '../../constants'
import type { IfElseNodeData } from '../../types'
import { genCaseId, needCaseValue } from '../../utils'

interface Props {
  nodeData: IfElseNodeData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: IfElseNodeData): void
}>()

const formData = reactive<IfElseNodeData>(cloneData(props.nodeData))

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, cloneData(value))
    if (typeof formData.elseEnabled !== 'boolean') formData.elseEnabled = true
    if (!formData.elseLabel) formData.elseLabel = '否则'
  },
  { deep: true, immediate: true }
)

function addCase() {
  if (formData.cases.length >= MAX_IF_CASES) {
    ElMessage.warning(`最多支持 ${MAX_IF_CASES} 个分支`)
    return
  }
  formData.cases.push({
    id: genCaseId(),
    label: `分支 ${formData.cases.length + 1}`,
    operator: 'contains',
    value: ''
  })
}

function removeCase(index: number) {
  formData.cases.splice(index, 1)
}

function handleSave() {
  if (!formData.cases.length) {
    ElMessage.warning('至少保留 1 个分支')
    return
  }

  const caseIdSet = new Set<string>()
  for (const item of formData.cases) {
    if (!item.label?.trim()) {
      ElMessage.warning('分支名称不能为空')
      return
    }
    if (caseIdSet.has(item.id)) {
      ElMessage.warning('存在重复分支 ID，请删除后重建分支')
      return
    }
    caseIdSet.add(item.id)

    if (needCaseValue(item.operator) && !item.value?.trim()) {
      ElMessage.warning(`分支「${item.label}」未填写判断值`)
      return
    }
  }

  emit('save', cloneData(formData))
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="节点标题">
      <el-input v-model="formData.title" maxlength="40" />
    </el-form-item>

    <div class="case-header">
      <span>分支条件</span>
      <el-button size="small" @click="addCase">新增分支</el-button>
    </div>

    <div v-for="(item, index) in formData.cases" :key="item.id" class="case-item">
      <el-row :gutter="8">
        <el-col :span="7">
          <el-input v-model="item.label" placeholder="分支名称" maxlength="30" />
        </el-col>
        <el-col :span="7">
          <el-select v-model="item.operator">
            <el-option
              v-for="op in IF_OPERATORS"
              :key="op.value"
              :label="op.label"
              :value="op.value"
            />
          </el-select>
        </el-col>
        <el-col :span="8">
          <el-input
            v-if="needCaseValue(item.operator)"
            v-model="item.value"
            placeholder="判断值"
            maxlength="100"
          />
          <span v-else class="empty-value">无需填写判断值</span>
        </el-col>
        <el-col :span="2">
          <el-button text type="danger" @click="removeCase(index)">删</el-button>
        </el-col>
      </el-row>
    </div>

    <el-divider />

    <el-form-item label="启用 else 分支">
      <el-switch v-model="formData.elseEnabled" />
    </el-form-item>

    <el-form-item v-if="formData.elseEnabled" label="else 分支名称">
      <el-input v-model="formData.elseLabel" maxlength="30" placeholder="否则" />
    </el-form-item>
  </el-form>

  <div class="footer">
    <el-button type="primary" @click="handleSave">保存配置</el-button>
  </div>
</template>

<style scoped lang="less">
.case-header {
  display: flex;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  align-items: center;
  justify-content: space-between;
}

.case-item {
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.empty-value {
  font-size: 12px;
  line-height: 32px;
  color: var(--el-text-color-secondary);
}

.footer {
  display: flex;
  margin-top: 8px;
  justify-content: flex-end;
}
</style>
