<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { IF_OPERATORS, MAX_IF_CASES } from '../../constants'
import type { CanvasGraphEdge, CanvasGraphNode, IfCondition, IfElseNodeData } from '../../types'
import { genCaseId, needCaseValue } from '../../utils'
import { useVariableSources } from '../../variables/useVariableSources'
import type { VariableSource } from '../../variables/types'

interface Props {
  nodeId: string
  nodeData: IfElseNodeData
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', value: IfElseNodeData): void
}>()

const formData = reactive<IfElseNodeData>(cloneData(props.nodeData))
const scene = computed(() => 'if-value' as const)
const currentNodeId = computed(() => props.nodeId)
const graphNodes = computed(() => props.nodes)
const graphEdges = computed(() => props.edges)
const sources = useVariableSources(scene, currentNodeId, graphNodes, graphEdges)

watch(
  () => props.nodeData,
  (value) => {
    Object.assign(formData, cloneData(value))
    if (typeof formData.elseEnabled !== 'boolean') formData.elseEnabled = true
    if (!formData.elseLabel) formData.elseLabel = '否则'
    normalizeCases(formData)
  },
  { deep: true, immediate: true }
)

const groupedSources = computed(() => {
  const groups: Record<string, VariableSource[]> = {}
  for (const item of sources.value) {
    if (!groups[item.group]) groups[item.group] = []
    groups[item.group].push(item)
  }
  return groups
})

const groupLabelMap: Record<string, string> = {
  context: '上下文',
  system: '系统变量',
  start_var: '用户输入变量',
  node_output: '节点输出'
}

function selectorKey(selector: [string, string]) {
  return `${selector[0]}.${selector[1]}`
}

function keyToSelector(key: string): [string, string] {
  if (key === 'sys.query') return ['sys', 'query']
  if (key === 'sys.files') return ['sys', 'files']
  const idx = key.lastIndexOf('.')
  if (idx <= 0 || idx >= key.length - 1) return ['sys', 'query']
  return [key.slice(0, idx), key.slice(idx + 1)]
}

function createDefaultCondition(): IfCondition {
  return {
    id: genCaseId(),
    variableSelector: ['sys', 'query'],
    operator: 'contains',
    value: ''
  }
}

function normalizeCases(target: IfElseNodeData) {
  for (const item of target.cases) {
    if (!Array.isArray(item.conditions) || item.conditions.length === 0) {
      const legacy = item as unknown as { operator?: IfCondition['operator']; value?: string }
      item.conditions = [
        {
          id: genCaseId(),
          variableSelector: ['sys', 'query'],
          operator: legacy.operator || 'contains',
          value: legacy.value || ''
        }
      ]
    }
    item.logicalOperator = 'and'
    for (const condition of item.conditions) {
      if (!condition.id) condition.id = genCaseId()
      if (!Array.isArray(condition.variableSelector) || condition.variableSelector.length !== 2) {
        condition.variableSelector = ['sys', 'query']
      }
    }
  }
}

function addCase() {
  if (formData.cases.length >= MAX_IF_CASES) {
    ElMessage.warning(`最多支持 ${MAX_IF_CASES} 个分支`)
    return
  }
  formData.cases.push({
    id: genCaseId(),
    label: `分支 ${formData.cases.length + 1}`,
    conditions: [createDefaultCondition()],
    logicalOperator: 'and'
  })
}

function removeCase(index: number) {
  formData.cases.splice(index, 1)
}

function updateConditionVar(caseIndex: number, condIndex: number, key: string) {
  formData.cases[caseIndex].conditions[condIndex].variableSelector = keyToSelector(key)
}

function updateConditionOperator(
  caseIndex: number,
  condIndex: number,
  operator: IfCondition['operator']
) {
  const condition = formData.cases[caseIndex].conditions[condIndex]
  condition.operator = operator
  if (!needCaseValue(operator)) {
    condition.value = ''
  }
}

function handleSave() {
  normalizeCases(formData)

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

    for (const condition of item.conditions) {
      if (needCaseValue(condition.operator) && !condition.value?.trim()) {
        ElMessage.warning(`分支「${item.label}」未填写判断值`)
        return
      }
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
      <div class="case-title">
        <el-input v-model="item.label" placeholder="分支名称" maxlength="30" />
        <el-button text type="danger" @click="removeCase(index)">删除</el-button>
      </div>

      <div v-for="(condition, condIdx) in item.conditions" :key="condition.id" class="cond-row">
        <el-select
          class="cond-var"
          :model-value="selectorKey(condition.variableSelector)"
          placeholder="选择变量"
          @update:model-value="(value) => updateConditionVar(index, condIdx, value)"
        >
          <el-option-group
            v-for="(options, group) in groupedSources"
            :key="group"
            :label="groupLabelMap[group] || group"
          >
            <el-option
              v-for="option in options"
              :key="option.key"
              :label="option.label"
              :value="option.key"
            />
          </el-option-group>
        </el-select>

        <el-select
          class="cond-op"
          :model-value="condition.operator"
          @update:model-value="(value) => updateConditionOperator(index, condIdx, value)"
        >
          <el-option
            v-for="op in IF_OPERATORS"
            :key="op.value"
            :label="op.label"
            :value="op.value"
          />
        </el-select>

        <el-input
          v-if="needCaseValue(condition.operator)"
          v-model="condition.value"
          class="cond-value"
          placeholder="判断值"
          maxlength="100"
        />
        <span v-else class="empty-value">无需填写判断值</span>
      </div>
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

.case-title {
  display: flex;
  margin-bottom: 8px;
  gap: 8px;
  align-items: center;
}

.cond-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cond-var {
  width: 38%;
}

.cond-op {
  width: 24%;
}

.cond-value {
  width: 38%;
}

.empty-value {
  width: 38%;
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
