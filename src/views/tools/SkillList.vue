<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
  type UploadFile
} from 'element-plus'
import { Plus, Search, Upload } from '@element-plus/icons-vue'
import { ContentWrap } from '@/components/ContentWrap'
import { CodeEditor } from '@/components/CodeEditor'
import {
  capabilityToolApi,
  skillApi,
  type BoundTool,
  type CapabilityTool,
  type ProviderType,
  type Skill,
  type SkillDetail,
  type SkillParseResult,
  type SkillRequest
} from '@/api/capability'
import JsonEditor from './components/JsonEditor.vue'
import { formatDate, stringifyJson } from './utils'

defineOptions({ name: 'SkillList' })

interface SelectedTool {
  toolDbId: number
  toolId: string
  name: string
  description?: string
  providerType?: ProviderType
  status?: 0 | 1
  required: boolean
  usageDescription: string
}

const DEFAULT_SKILL = `---
name: example-skill
description: 说明该技能解决什么问题，以及应在什么情况下使用。
license: MIT
metadata:
  version: 1.0.0
---

# 技能名称

## 目标

说明技能的目标。

## 执行步骤

1. 第一步。
2. 第二步。
`

const loading = ref(false)
const list = ref<Skill[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '', status: undefined as 0 | 1 | undefined })

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const parsing = ref(false)
const editingId = ref<number>()
const activeTab = ref('content')
const parseResult = ref<SkillParseResult>()
const form = reactive({
  displayName: '',
  tags: [] as string[],
  status: 1 as 0 | 1,
  rawContent: DEFAULT_SKILL
})
const selectedTools = ref<SelectedTool[]>([])
const rules: FormRules = {
  rawContent: [{ required: true, message: '请输入完整的 SKILL.md', trigger: 'blur' }]
}

const detailVisible = ref(false)
const detail = ref<SkillDetail>()
const uploading = ref(false)

const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerList = ref<CapabilityTool[]>([])
const pickerTotal = ref(0)
const pickerQuery = reactive({
  page: 1,
  size: 10,
  keyword: '',
  providerType: undefined as ProviderType | undefined
})

async function load() {
  loading.value = true
  try {
    const result = await skillApi.page({
      page: query.page,
      size: query.size,
      keyword: query.keyword.trim() || undefined,
      status: query.status
    })
    list.value = result.records || []
    total.value = result.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || '技能列表加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

function resetForm() {
  editingId.value = undefined
  activeTab.value = 'content'
  parseResult.value = undefined
  Object.assign(form, { displayName: '', tags: [], status: 1, rawContent: DEFAULT_SKILL })
  selectedTools.value = []
}

function openCreate() {
  resetForm()
  formVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function enrichBoundTools(boundTools: BoundTool[]): Promise<SelectedTool[]> {
  return Promise.all(
    boundTools.map(async (bound) => {
      try {
        const tool = await capabilityToolApi.detail(bound.toolDbId)
        return {
          toolDbId: bound.toolDbId,
          toolId: bound.toolId,
          name: bound.name,
          description: bound.description,
          providerType: tool.providerType,
          status: tool.status,
          required: bound.required,
          usageDescription: bound.usageDescription || ''
        }
      } catch {
        return {
          toolDbId: bound.toolDbId,
          toolId: bound.toolId,
          name: bound.name,
          description: bound.description,
          status: 0 as const,
          required: bound.required,
          usageDescription: bound.usageDescription || ''
        }
      }
    })
  )
}

async function fillEdit(value: SkillDetail) {
  editingId.value = value.skill.id
  activeTab.value = 'content'
  parseResult.value = undefined
  Object.assign(form, {
    displayName: value.skill.displayName || '',
    tags: [...(value.skill.tags || [])],
    status: value.skill.status,
    rawContent: value.skill.rawContent
  })
  selectedTools.value = await enrichBoundTools(value.boundTools || [])
  formVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function openEdit(row: Skill) {
  try {
    await fillEdit(await skillApi.detail(row.id))
  } catch (error: any) {
    ElMessage.error(error?.message || '技能详情加载失败')
  }
}

async function openDetail(row: Skill) {
  try {
    detail.value = await skillApi.detail(row.id)
    detailVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || '技能详情加载失败')
  }
}

async function parseSkill() {
  if (!form.rawContent.trim()) {
    ElMessage.warning('请先输入 SKILL.md')
    return
  }
  parsing.value = true
  try {
    parseResult.value = await skillApi.parse(form.rawContent)
    activeTab.value = 'preview'
    ElMessage.success('解析成功')
  } catch (error: any) {
    ElMessage.error(error?.message || 'SKILL.md 解析失败')
  } finally {
    parsing.value = false
  }
}

async function submit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const payload: SkillRequest = {
      displayName: form.displayName.trim() || undefined,
      tags: form.tags,
      status: form.status,
      rawContent: form.rawContent,
      boundTools: selectedTools.value.map((tool, index) => ({
        toolId: tool.toolDbId,
        sort: index + 1,
        requiredFlag: tool.required,
        usageDescription: tool.usageDescription.trim() || undefined
      }))
    }
    if (editingId.value) {
      await skillApi.update(editingId.value, payload)
      ElMessage.success('技能已更新')
    } else {
      await skillApi.create(payload)
      ElMessage.success('技能已创建')
    }
    formVisible.value = false
    await load()
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

async function handleUpload(file: UploadFile) {
  if (!file.raw) return
  if (!file.name.toLowerCase().endsWith('.md')) {
    ElMessage.error('只能上传 .md 文件')
    return
  }
  uploading.value = true
  try {
    const value = await skillApi.upload(file.raw)
    ElMessage.success('SKILL.md 已上传，请继续检查信息并配置工具绑定')
    await load()
    await fillEdit(value)
  } catch (error: any) {
    ElMessage.error(error?.message || 'SKILL.md 上传失败')
  } finally {
    uploading.value = false
  }
}

async function changeStatus(row: Skill, value: string | number | boolean) {
  const status = Number(value) as 0 | 1
  try {
    await skillApi.setStatus(row.id, status)
    row.status = status
    ElMessage.success(status ? '已启用' : '已停用')
  } catch (error: any) {
    ElMessage.error(error?.message || '状态修改失败')
    await load()
  }
}

async function remove(row: Skill) {
  try {
    await ElMessageBox.confirm(`确认删除技能“${row.displayName}”及其工具绑定吗？`, '删除技能', {
      type: 'warning',
      confirmButtonText: '确认删除'
    })
    await skillApi.remove(row.id)
    ElMessage.success('技能已删除')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败')
  }
}

async function loadPicker() {
  pickerLoading.value = true
  try {
    const result = await capabilityToolApi.page({
      page: pickerQuery.page,
      size: pickerQuery.size,
      keyword: pickerQuery.keyword.trim() || undefined,
      providerType: pickerQuery.providerType
    })
    pickerList.value = result.records || []
    pickerTotal.value = result.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || '工具列表加载失败')
  } finally {
    pickerLoading.value = false
  }
}

function openPicker() {
  pickerQuery.page = 1
  pickerQuery.keyword = ''
  pickerQuery.providerType = undefined
  pickerVisible.value = true
  void loadPicker()
}

function pickerSearch() {
  pickerQuery.page = 1
  void loadPicker()
}

function isSelected(tool: CapabilityTool) {
  return selectedTools.value.some((item) => item.toolDbId === tool.id)
}

function addTool(tool: CapabilityTool) {
  if (isSelected(tool)) return
  selectedTools.value.push({
    toolDbId: tool.id,
    toolId: tool.toolCode,
    name: tool.toolName,
    description: tool.description,
    providerType: tool.providerType,
    status: tool.status,
    required: false,
    usageDescription: ''
  })
}

function removeTool(index: number) {
  selectedTools.value.splice(index, 1)
}

function moveTool(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= selectedTools.value.length) return
  const [item] = selectedTools.value.splice(index, 1)
  selectedTools.value.splice(target, 0, item)
}

function providerTag(provider?: ProviderType) {
  if (provider === 'MCP') return 'primary'
  if (provider === 'HTTP') return 'success'
  return 'warning'
}

onMounted(load)
</script>

<template>
  <ContentWrap title="技能管理" message="编辑 Agent Skill，并绑定可执行 Tool">
    <div class="list-toolbar">
      <el-form class="list-toolbar__filters" inline>
        <el-form-item class="list-toolbar__keyword">
          <el-input
            v-model="query.keyword"
            clearable
            placeholder="名称、编码或描述"
            :prefix-icon="Search"
            @clear="search"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item class="list-toolbar__select">
          <el-select v-model="query.status" clearable placeholder="全部状态" @change="search"
            ><el-option label="启用" :value="1" /><el-option label="停用" :value="0"
          /></el-select>
        </el-form-item>
        <el-form-item class="list-toolbar__submit">
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        </el-form-item>
      </el-form>
      <div class="list-toolbar__actions">
        <el-upload
          accept=".md,text/markdown"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleUpload"
        >
          <el-button :loading="uploading" :icon="Upload">上传 SKILL.md</el-button>
        </el-upload>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建技能</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" row-key="id">
      <el-table-column label="技能" min-width="240"
        ><template #default="{ row }"
          ><div class="primary-cell"
            ><strong>{{ row.displayName }}</strong
            ><span>{{ row.skillCode }}</span></div
          ></template
        ></el-table-column
      >
      <el-table-column prop="description" label="用途" min-width="300" show-overflow-tooltip />
      <el-table-column label="来源" width="105"
        ><template #default="{ row }"
          ><el-tag type="info">{{ row.sourceType }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="版本" width="110"
        ><template #default="{ row }">{{ row.version || '-' }}</template></el-table-column
      >
      <el-table-column label="标签" min-width="160"
        ><template #default="{ row }"
          ><el-tag v-for="tag in row.tags || []" :key="tag" size="small" class="tag">{{
            tag
          }}</el-tag
          ><span v-if="!row.tags?.length">-</span></template
        ></el-table-column
      >
      <el-table-column label="更新时间" width="180"
        ><template #default="{ row }">{{ formatDate(row.updateTime) }}</template></el-table-column
      >
      <el-table-column label="启用" width="90"
        ><template #default="{ row }"
          ><el-switch
            :model-value="row.status"
            :active-value="1"
            :inactive-value="0"
            @change="changeStatus(row, $event)" /></template
      ></el-table-column>
      <el-table-column label="操作" width="180" fixed="right"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="openDetail(row)">详情</el-button
          ><el-button link type="primary" @click="openEdit(row)">编辑</el-button
          ><el-button link type="danger" @click="remove(row)">删除</el-button></template
        ></el-table-column
      >
    </el-table>
    <div class="pagination"
      ><el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        @change="load"
    /></div>
  </ContentWrap>

  <el-drawer v-model="formVisible" :title="editingId ? '编辑技能' : '新建技能'" size="920px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <div class="form-grid">
        <el-form-item label="展示名称"
          ><el-input v-model="form.displayName" placeholder="为空时使用 Frontmatter name"
        /></el-form-item>
        <el-form-item label="标签"
          ><el-select v-model="form.tags" multiple filterable allow-create default-first-option
        /></el-form-item>
      </div>
      <el-form-item label="状态"
        ><el-radio-group v-model="form.status"
          ><el-radio :value="1">启用</el-radio><el-radio :value="0">停用</el-radio></el-radio-group
        ></el-form-item
      >

      <el-tabs v-model="activeTab">
        <el-tab-pane label="SKILL.md" name="content">
          <el-form-item label="完整内容" prop="rawContent">
            <div class="editor-wrap"
              ><CodeEditor
                v-model="form.rawContent"
                language="markdown"
                theme="vs"
                :height="520"
                :language-selector="false"
                :theme-selector="false"
                :editor-option="{
                  minimap: { enabled: false },
                  automaticLayout: true,
                  wordWrap: 'on'
                }"
            /></div>
          </el-form-item>
          <div class="parse-action"
            ><el-button type="primary" plain :loading="parsing" @click="parseSkill"
              >解析预览</el-button
            ></div
          >
        </el-tab-pane>
        <el-tab-pane label="解析预览" name="preview">
          <el-empty v-if="!parseResult" description="请先在 SKILL.md 页签点击解析预览" />
          <template v-else>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="name">{{ parseResult.name }}</el-descriptions-item>
              <el-descriptions-item label="license">{{
                parseResult.license || '-'
              }}</el-descriptions-item>
              <el-descriptions-item label="description" :span="2">{{
                parseResult.description
              }}</el-descriptions-item>
              <el-descriptions-item label="compatibility" :span="2">{{
                parseResult.compatibility || '-'
              }}</el-descriptions-item>
              <el-descriptions-item label="allowed-tools" :span="2">{{
                parseResult.allowedTools || '-'
              }}</el-descriptions-item>
              <el-descriptions-item label="contentHash" :span="2">{{
                parseResult.contentHash
              }}</el-descriptions-item>
            </el-descriptions>
            <el-divider>Metadata</el-divider
            ><JsonEditor
              :model-value="stringifyJson(parseResult.metadata)"
              readonly
              :height="180"
            />
            <el-divider>正文</el-divider
            ><div class="editor-wrap"
              ><CodeEditor
                :model-value="parseResult.bodyContent"
                language="markdown"
                theme="vs"
                :height="320"
                :language-selector="false"
                :theme-selector="false"
                :editor-option="{
                  readOnly: true,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  wordWrap: 'on'
                }"
            /></div>
          </template>
        </el-tab-pane>
        <el-tab-pane :label="`工具绑定（${selectedTools.length}）`" name="tools">
          <div class="binding-toolbar"
            ><el-alert
              title="allowed-tools 仅作为文档元数据；实际可用 Tool 以此处数据库绑定为准。"
              type="info"
              :closable="false"
            /><el-button type="primary" :icon="Plus" @click="openPicker">选择 Tool</el-button></div
          >
          <el-table :data="selectedTools" border row-key="toolDbId">
            <el-table-column label="顺序" width="115"
              ><template #default="{ $index }"
                ><el-button link :disabled="$index === 0" @click="moveTool($index, -1)"
                  >上移</el-button
                ><el-button
                  link
                  :disabled="$index === selectedTools.length - 1"
                  @click="moveTool($index, 1)"
                  >下移</el-button
                ></template
              ></el-table-column
            >
            <el-table-column label="Tool" min-width="210"
              ><template #default="{ row }"
                ><div class="primary-cell"
                  ><strong>{{ row.name }}</strong
                  ><span>{{ row.toolId }}</span></div
                ></template
              ></el-table-column
            >
            <el-table-column label="提供方" width="90"
              ><template #default="{ row }"
                ><el-tag :type="providerTag(row.providerType)">{{
                  row.providerType || '未知'
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="状态" width="80"
              ><template #default="{ row }"
                ><el-tag :type="row.status ? 'success' : 'danger'">{{
                  row.status ? '启用' : '停用'
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="必要" width="70"
              ><template #default="{ row }"><el-checkbox v-model="row.required" /></template
            ></el-table-column>
            <el-table-column label="使用说明" min-width="240"
              ><template #default="{ row }"
                ><el-input v-model="row.usageDescription" type="textarea" :rows="2" /></template
            ></el-table-column>
            <el-table-column width="70"
              ><template #default="{ $index }"
                ><el-button link type="danger" @click="removeTool($index)"
                  >移除</el-button
                ></template
              ></el-table-column
            >
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-form>
    <template #footer
      ><el-button @click="formVisible = false">取消</el-button
      ><el-button type="primary" :loading="submitting" @click="submit">保存</el-button></template
    >
  </el-drawer>

  <el-dialog v-model="pickerVisible" title="选择能力工具" width="900px">
    <div class="picker-toolbar"
      ><el-input
        v-model="pickerQuery.keyword"
        clearable
        placeholder="搜索 Tool"
        :prefix-icon="Search"
        @clear="pickerSearch"
        @keyup.enter="pickerSearch"
      /><el-select
        v-model="pickerQuery.providerType"
        clearable
        placeholder="全部提供方"
        @change="pickerSearch"
        ><el-option label="MCP" value="MCP" /><el-option label="HTTP" value="HTTP" /><el-option
          label="LOCAL"
          value="LOCAL" /></el-select
      ><el-button @click="pickerSearch">查询</el-button></div
    >
    <el-table v-loading="pickerLoading" :data="pickerList" row-key="id">
      <el-table-column label="Tool" min-width="220"
        ><template #default="{ row }"
          ><div class="primary-cell"
            ><strong>{{ row.toolName }}</strong
            ><span>{{ row.toolCode }}</span></div
          ></template
        ></el-table-column
      >
      <el-table-column prop="providerType" label="提供方" width="100" />
      <el-table-column prop="description" label="用途" min-width="280" show-overflow-tooltip />
      <el-table-column label="状态" width="80"
        ><template #default="{ row }"
          ><el-tag :type="row.status ? 'success' : 'danger'">{{
            row.status ? '启用' : '停用'
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column width="100"
        ><template #default="{ row }"
          ><el-button type="primary" link :disabled="isSelected(row)" @click="addTool(row)">{{
            isSelected(row) ? '已选择' : '选择'
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <div class="pagination"
      ><el-pagination
        v-model:current-page="pickerQuery.page"
        v-model:page-size="pickerQuery.size"
        layout="total, prev, pager, next"
        :total="pickerTotal"
        @change="loadPicker"
    /></div>
    <template #footer
      ><el-button type="primary" @click="pickerVisible = false">完成</el-button></template
    >
  </el-dialog>

  <el-drawer v-model="detailVisible" title="技能详情" size="760px">
    <el-descriptions v-if="detail" :column="2" border>
      <el-descriptions-item label="名称">{{ detail.skill.displayName }}</el-descriptions-item
      ><el-descriptions-item label="编码">{{ detail.skill.skillCode }}</el-descriptions-item>
      <el-descriptions-item label="来源">{{ detail.skill.sourceType }}</el-descriptions-item
      ><el-descriptions-item label="版本">{{ detail.skill.version || '-' }}</el-descriptions-item>
      <el-descriptions-item label="描述" :span="2">{{
        detail.skill.description
      }}</el-descriptions-item
      ><el-descriptions-item label="license">{{ detail.skill.license || '-' }}</el-descriptions-item
      ><el-descriptions-item label="compatibility">{{
        detail.skill.compatibility || '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="allowed-tools" :span="2">{{
        detail.skill.allowedTools || '-'
      }}</el-descriptions-item
      ><el-descriptions-item label="更新时间" :span="2">{{
        formatDate(detail.skill.updateTime)
      }}</el-descriptions-item>
    </el-descriptions>
    <el-divider>绑定 Tool</el-divider
    ><el-table :data="detail?.boundTools || []"
      ><el-table-column prop="sort" label="顺序" width="70" /><el-table-column
        prop="name"
        label="名称"
      /><el-table-column prop="toolId" label="Tool ID" /><el-table-column label="必要" width="70"
        ><template #default="{ row }">{{ row.required ? '是' : '否' }}</template></el-table-column
      ></el-table
    >
    <el-divider>完整 SKILL.md</el-divider
    ><div class="editor-wrap"
      ><CodeEditor
        :model-value="detail?.skill.rawContent || ''"
        language="markdown"
        theme="vs"
        :height="480"
        :language-selector="false"
        :theme-selector="false"
        :editor-option="{
          readOnly: true,
          minimap: { enabled: false },
          automaticLayout: true,
          wordWrap: 'on'
        }"
    /></div>
  </el-drawer>
</template>

<style scoped lang="less">
@import url('./styles/list-toolbar.less');

.primary-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.primary-cell span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.tag {
  margin: 2px 4px 2px 0;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}

.editor-wrap {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.parse-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.binding-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.binding-toolbar .el-alert {
  flex: 1;
}

.picker-toolbar {
  display: grid;
  grid-template-columns: 1fr 180px auto;
  gap: 10px;
  margin-bottom: 14px;
}

:deep(.el-select) {
  width: 100%;
}

@media (width <= 900px) {
  .form-grid,
  .picker-toolbar {
    display: block;
  }
}
</style>
