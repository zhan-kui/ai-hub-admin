<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { ContentWrap } from '@/components/ContentWrap'
import {
  capabilityToolApi,
  httpToolApi,
  type CapabilityTool,
  type HttpAuthType,
  type HttpBodyMode,
  type HttpMethod,
  type HttpParameterLocation,
  type HttpResponseType,
  type HttpToolParameter,
  type HttpToolRequest,
  type ToolCallResult
} from '@/api/capability'
import JsonEditor from './components/JsonEditor.vue'
import KeyValueEditor from './components/KeyValueEditor.vue'
import { formatDate, parseJsonObject, stringifyJson } from './utils'

defineOptions({ name: 'HttpToolList' })

interface ParameterRow {
  name: string
  location: HttpParameterLocation
  targetName: string
  required: boolean
  dataType: string
  description: string
  defaultValueText: string
}

interface HttpFormState {
  toolCode: string
  toolName: string
  description: string
  tags: string[]
  status: 0 | 1
  httpMethod: HttpMethod
  baseUrl: string
  path: string
  contentType: string
  responseType: HttpResponseType
  bodyMode: HttpBodyMode
  connectTimeoutSeconds: number
  requestTimeoutSeconds: number
  fixedHeaders: Record<string, string>
  parameters: ParameterRow[]
  authType: HttpAuthType
  bearerToken: string
  apiKeyHeader: string
  apiKeyValue: string
  basicUsername: string
  basicPassword: string
  customAuthHeaders: Record<string, string>
  inputSchemaText: string
  outputSchemaText: string
  bodyTemplateText: string
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const list = ref<CapabilityTool[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '', status: undefined as 0 | 1 | undefined })

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const editingId = ref<number>()
const form = reactive<HttpFormState>(createEmptyForm())
const rules: FormRules = {
  toolCode: [
    { required: true, message: '请输入 Tool 编码', trigger: 'blur' },
    {
      pattern: /^[a-z0-9][a-z0-9_-]{1,158}[a-z0-9]$/,
      message: '编码需为 3～160 位小写字母、数字、下划线或中划线，首尾必须为字母或数字',
      trigger: 'blur'
    }
  ],
  toolName: [{ required: true, message: '请输入 Tool 名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入用途和使用时机', trigger: 'blur' }],
  httpMethod: [{ required: true, message: '请选择 HTTP Method', trigger: 'change' }],
  baseUrl: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }],
  path: [{ required: true, message: '请输入请求路径', trigger: 'blur' }]
}

const testVisible = ref(false)
const testing = ref(false)
const testTool = ref<CapabilityTool>()
const testArguments = ref('{}')
const testResult = ref<ToolCallResult>()

function createEmptyForm(): HttpFormState {
  return {
    toolCode: '',
    toolName: '',
    description: '',
    tags: [],
    status: 1,
    httpMethod: 'GET',
    baseUrl: '',
    path: '/',
    contentType: 'application/json',
    responseType: 'AUTO',
    bodyMode: 'PARAMETERS',
    connectTimeoutSeconds: 10,
    requestTimeoutSeconds: 60,
    fixedHeaders: {},
    parameters: [],
    authType: 'NONE',
    bearerToken: '',
    apiKeyHeader: 'X-API-Key',
    apiKeyValue: '',
    basicUsername: '',
    basicPassword: '',
    customAuthHeaders: {},
    inputSchemaText: '{\n  "type": "object",\n  "properties": {}\n}',
    outputSchemaText: '{}',
    bodyTemplateText: '{}'
  }
}

async function load() {
  loading.value = true
  try {
    const result = await capabilityToolApi.page({
      page: query.page,
      size: query.size,
      keyword: query.keyword.trim() || undefined,
      providerType: 'HTTP',
      status: query.status
    })
    list.value = result.records || []
    total.value = result.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || 'HTTP Tool 加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

function openCreate() {
  editingId.value = undefined
  Object.assign(form, createEmptyForm())
  formVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function parseDefaultValue(row: ParameterRow): unknown {
  const text = row.defaultValueText.trim()
  if (!text) return undefined
  if (row.dataType === 'number' || row.dataType === 'integer') {
    const value = Number(text)
    if (Number.isNaN(value)) throw new Error(`参数 ${row.name || '(未命名)'} 的默认值不是数字`)
    return value
  }
  if (row.dataType === 'boolean') {
    if (!['true', 'false'].includes(text.toLowerCase())) {
      throw new Error(`参数 ${row.name || '(未命名)'} 的布尔默认值只能是 true 或 false`)
    }
    return text.toLowerCase() === 'true'
  }
  if (row.dataType === 'object' || row.dataType === 'array') {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`参数 ${row.name || '(未命名)'} 的默认值不是合法 JSON`)
    }
  }
  return text
}

function buildAuthConfig(): Record<string, unknown> | undefined {
  if (form.authType === 'BEARER') {
    if (!form.bearerToken) throw new Error('请输入 Bearer Token')
    return { token: form.bearerToken }
  }
  if (form.authType === 'API_KEY_HEADER') {
    if (!form.apiKeyHeader.trim() || !form.apiKeyValue) {
      throw new Error('请输入 API Key Header 名称和值')
    }
    return { headerName: form.apiKeyHeader, value: form.apiKeyValue }
  }
  if (form.authType === 'BASIC') {
    if (!form.basicUsername.trim()) throw new Error('请输入 Basic Auth 用户名')
    return { username: form.basicUsername, password: form.basicPassword }
  }
  if (form.authType === 'CUSTOM_HEADERS') {
    if (!Object.keys(form.customAuthHeaders).length) throw new Error('请至少配置一个认证 Header')
    return { headers: form.customAuthHeaders }
  }
  return undefined
}

function buildPayload(): HttpToolRequest {
  const parameters: HttpToolParameter[] = form.parameters.map((row, index) => {
    if (!row.name.trim() || !row.location) throw new Error(`第 ${index + 1} 个参数的名称和位置必填`)
    return {
      name: row.name.trim(),
      location: row.location,
      targetName: row.targetName.trim() || undefined,
      required: row.required,
      dataType: row.dataType || undefined,
      description: row.description.trim() || undefined,
      defaultValue: parseDefaultValue(row)
    }
  })
  return {
    toolCode: form.toolCode.trim(),
    toolName: form.toolName.trim(),
    description: form.description.trim(),
    tags: form.tags,
    status: form.status,
    inputSchema: parseJsonObject(form.inputSchemaText, '输入 Schema'),
    outputSchema: parseJsonObject(form.outputSchemaText, '输出 Schema'),
    httpConfig: {
      httpMethod: form.httpMethod,
      baseUrl: form.baseUrl.trim(),
      path: form.path.trim(),
      contentType: form.contentType.trim() || 'application/json',
      responseType: form.responseType,
      authType: form.authType,
      authConfig: buildAuthConfig(),
      fixedHeaders: form.fixedHeaders,
      parameters,
      bodyMode: form.bodyMode,
      bodyTemplate: parseJsonObject(form.bodyTemplateText, 'Body Template'),
      connectTimeoutSeconds: form.connectTimeoutSeconds,
      requestTimeoutSeconds: form.requestTimeoutSeconds
    }
  }
}

async function openEdit(row: CapabilityTool) {
  try {
    const detail = await httpToolApi.detail(row.id)
    const auth = detail.httpConfig.authConfig || {}
    Object.assign(form, createEmptyForm(), {
      toolCode: detail.tool.toolCode,
      toolName: detail.tool.toolName,
      description: detail.tool.description,
      tags: [...(detail.tool.tags || [])],
      status: detail.tool.status,
      httpMethod: detail.httpConfig.httpMethod,
      baseUrl: detail.httpConfig.baseUrl,
      path: detail.httpConfig.path,
      contentType: detail.httpConfig.contentType || 'application/json',
      responseType: detail.httpConfig.responseType || 'AUTO',
      bodyMode: detail.httpConfig.bodyMode || 'PARAMETERS',
      connectTimeoutSeconds: detail.httpConfig.connectTimeoutSeconds || 10,
      requestTimeoutSeconds: detail.httpConfig.requestTimeoutSeconds || 60,
      fixedHeaders: { ...(detail.httpConfig.fixedHeaders || {}) },
      parameters: (detail.httpConfig.parameters || []).map((item) => ({
        name: item.name,
        location: item.location,
        targetName: item.targetName || '',
        required: Boolean(item.required),
        dataType: item.dataType || 'string',
        description: item.description || '',
        defaultValueText:
          item.defaultValue === undefined || item.defaultValue === null
            ? ''
            : typeof item.defaultValue === 'string'
              ? item.defaultValue
              : JSON.stringify(item.defaultValue)
      })),
      authType: detail.httpConfig.authType || 'NONE',
      bearerToken: String(auth.token || ''),
      apiKeyHeader: String(auth.headerName || 'X-API-Key'),
      apiKeyValue: String(auth.value || ''),
      basicUsername: String(auth.username || ''),
      basicPassword: String(auth.password || ''),
      customAuthHeaders: { ...((auth.headers as Record<string, string>) || {}) },
      inputSchemaText: stringifyJson(detail.tool.inputSchema),
      outputSchemaText: stringifyJson(detail.tool.outputSchema),
      bodyTemplateText: stringifyJson(detail.httpConfig.bodyTemplate)
    })
    editingId.value = row.id
    formVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  } catch (error: any) {
    ElMessage.error(error?.message || 'HTTP Tool 详情加载失败')
  }
}

async function submit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    const payload = buildPayload()
    submitting.value = true
    if (editingId.value) {
      await httpToolApi.update(editingId.value, payload)
      ElMessage.success('HTTP Tool 已更新')
    } else {
      await httpToolApi.create(payload)
      ElMessage.success('HTTP Tool 已注册')
    }
    formVisible.value = false
    await load()
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

function addParameter() {
  form.parameters.push({
    name: '',
    location: 'QUERY',
    targetName: '',
    required: false,
    dataType: 'string',
    description: '',
    defaultValueText: ''
  })
}

function removeParameter(index: number) {
  form.parameters.splice(index, 1)
}

async function changeStatus(row: CapabilityTool, value: string | number | boolean) {
  const status = Number(value) as 0 | 1
  try {
    await capabilityToolApi.setStatus(row.id, status)
    row.status = status
    ElMessage.success(status ? '已启用' : '已停用')
  } catch (error: any) {
    ElMessage.error(error?.message || '状态修改失败')
    await load()
  }
}

async function remove(row: CapabilityTool) {
  try {
    await ElMessageBox.confirm(
      `删除“${row.toolName}”会同时删除相关 Skill 绑定，确认继续吗？`,
      '删除 HTTP Tool',
      { type: 'warning', confirmButtonText: '确认删除' }
    )
    await httpToolApi.remove(row.id)
    ElMessage.success('HTTP Tool 已删除')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败')
  }
}

function openTest(row: CapabilityTool) {
  testTool.value = row
  testArguments.value = '{}'
  testResult.value = undefined
  testVisible.value = true
}

async function runTest() {
  if (!testTool.value) return
  try {
    const argumentsValue = parseJsonObject(testArguments.value, '测试 Arguments')
    testing.value = true
    testResult.value = await httpToolApi.test(testTool.value.id, argumentsValue)
    if (testResult.value.success) ElMessage.success('调用成功')
    else ElMessage.warning(testResult.value.error?.message || '调用失败')
  } catch (error: any) {
    ElMessage.error(error?.message || 'HTTP Tool 测试失败')
  } finally {
    testing.value = false
  }
}

async function openToolFromQuery() {
  const id = Number(route.query.toolId)
  if (!Number.isFinite(id) || id <= 0) return
  const row = { id } as CapabilityTool
  await openEdit(row)
  const nextQuery = { ...route.query }
  delete nextQuery.toolId
  await router.replace({ query: nextQuery })
}

watch(
  () => route.query.toolId,
  () => void openToolFromQuery()
)

onMounted(async () => {
  await load()
  await openToolFromQuery()
})
</script>

<template>
  <ContentWrap title="HTTP 工具" message="注册 REST API 为可搜索、可绑定、可执行的 Tool">
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
          <el-select v-model="query.status" clearable placeholder="全部状态" @change="search">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item class="list-toolbar__submit">
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        </el-form-item>
      </el-form>
      <div class="list-toolbar__actions">
        <el-button type="primary" :icon="Plus" @click="openCreate">注册 HTTP Tool</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" row-key="id">
      <el-table-column label="Tool" min-width="240">
        <template #default="{ row }">
          <div class="primary-cell"
            ><strong>{{ row.toolName }}</strong
            ><span>{{ row.toolCode }}</span></div
          >
        </template>
      </el-table-column>
      <el-table-column prop="description" label="用途" min-width="280" show-overflow-tooltip />
      <el-table-column label="标签" min-width="180">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags || []" :key="tag" size="small" class="tag">{{
            tag
          }}</el-tag>
          <span v-if="!row.tags?.length">-</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatDate(row.updateTime) }}</template>
      </el-table-column>
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status"
            :active-value="1"
            :inactive-value="0"
            @change="changeStatus(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">配置</el-button>
          <el-button link type="success" @click="openTest(row)">测试</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        @change="load"
      />
    </div>
  </ContentWrap>

  <el-drawer
    v-model="formVisible"
    :title="editingId ? '编辑 HTTP Tool' : '注册 HTTP Tool'"
    size="900px"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="125px">
      <el-divider content-position="left">Tool 信息</el-divider>
      <div class="form-grid">
        <el-form-item label="Tool 编码" prop="toolCode"
          ><el-input v-model="form.toolCode"
        /></el-form-item>
        <el-form-item label="Tool 名称" prop="toolName"
          ><el-input v-model="form.toolName"
        /></el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入标签后回车"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status"
            ><el-radio :value="1">启用</el-radio
            ><el-radio :value="0">停用</el-radio></el-radio-group
          >
        </el-form-item>
      </div>
      <el-form-item label="用途说明" prop="description"
        ><el-input v-model="form.description" type="textarea" :rows="3"
      /></el-form-item>

      <el-divider content-position="left">请求配置</el-divider>
      <div class="request-grid">
        <el-form-item label="Method" prop="httpMethod">
          <el-select v-model="form.httpMethod"
            ><el-option
              v-for="method in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']"
              :key="method"
              :label="method"
              :value="method"
          /></el-select>
        </el-form-item>
        <el-form-item label="Base URL" prop="baseUrl"
          ><el-input v-model="form.baseUrl" placeholder="https://api.example.com"
        /></el-form-item>
        <el-form-item label="Path" prop="path"
          ><el-input v-model="form.path" placeholder="/v1/items/{id}"
        /></el-form-item>
      </div>
      <div class="form-grid">
        <el-form-item label="Content-Type"><el-input v-model="form.contentType" /></el-form-item>
        <el-form-item label="响应类型">
          <el-select v-model="form.responseType"
            ><el-option
              v-for="type in ['AUTO', 'JSON', 'TEXT', 'BINARY']"
              :key="type"
              :label="type"
              :value="type"
          /></el-select>
        </el-form-item>
        <el-form-item label="连接超时(秒)"
          ><el-input-number v-model="form.connectTimeoutSeconds" :min="1" :max="600"
        /></el-form-item>
        <el-form-item label="请求超时(秒)"
          ><el-input-number v-model="form.requestTimeoutSeconds" :min="1" :max="3600"
        /></el-form-item>
      </div>
      <el-form-item label="固定 Headers"
        ><KeyValueEditor
          v-model="form.fixedHeaders"
          secret
          key-placeholder="Header 名称"
          value-placeholder="Header 值"
      /></el-form-item>

      <el-divider content-position="left">认证配置</el-divider>
      <el-form-item label="认证类型">
        <el-select v-model="form.authType"
          ><el-option
            v-for="type in ['NONE', 'BEARER', 'API_KEY_HEADER', 'BASIC', 'CUSTOM_HEADERS']"
            :key="type"
            :label="type"
            :value="type"
        /></el-select>
      </el-form-item>
      <el-form-item v-if="form.authType === 'BEARER'" label="Bearer Token"
        ><el-input v-model="form.bearerToken" type="password" show-password
      /></el-form-item>
      <div v-if="form.authType === 'API_KEY_HEADER'" class="form-grid">
        <el-form-item label="Header 名称"><el-input v-model="form.apiKeyHeader" /></el-form-item>
        <el-form-item label="API Key"
          ><el-input v-model="form.apiKeyValue" type="password" show-password
        /></el-form-item>
      </div>
      <div v-if="form.authType === 'BASIC'" class="form-grid">
        <el-form-item label="用户名"><el-input v-model="form.basicUsername" /></el-form-item>
        <el-form-item label="密码"
          ><el-input v-model="form.basicPassword" type="password" show-password
        /></el-form-item>
      </div>
      <el-form-item v-if="form.authType === 'CUSTOM_HEADERS'" label="认证 Headers"
        ><KeyValueEditor v-model="form.customAuthHeaders" secret
      /></el-form-item>

      <el-divider content-position="left">参数映射</el-divider>
      <el-table :data="form.parameters" border>
        <el-table-column label="参数名称" min-width="135"
          ><template #default="{ row }"><el-input v-model="row.name" /></template
        ></el-table-column>
        <el-table-column label="位置" width="115"
          ><template #default="{ row }"
            ><el-select v-model="row.location"
              ><el-option
                v-for="location in ['PATH', 'QUERY', 'HEADER', 'BODY']"
                :key="location"
                :label="location"
                :value="location" /></el-select></template
        ></el-table-column>
        <el-table-column label="目标名称" min-width="125"
          ><template #default="{ row }"><el-input v-model="row.targetName" /></template
        ></el-table-column>
        <el-table-column label="类型" width="115"
          ><template #default="{ row }"
            ><el-select v-model="row.dataType"
              ><el-option
                v-for="type in ['string', 'number', 'integer', 'boolean', 'object', 'array']"
                :key="type"
                :label="type"
                :value="type" /></el-select></template
        ></el-table-column>
        <el-table-column label="必填" width="70"
          ><template #default="{ row }"><el-checkbox v-model="row.required" /></template
        ></el-table-column>
        <el-table-column label="默认值" min-width="125"
          ><template #default="{ row }"><el-input v-model="row.defaultValueText" /></template
        ></el-table-column>
        <el-table-column label="说明" min-width="150"
          ><template #default="{ row }"><el-input v-model="row.description" /></template
        ></el-table-column>
        <el-table-column width="70"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="removeParameter($index)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button class="add-parameter" plain :icon="Plus" @click="addParameter">添加参数</el-button>

      <el-divider content-position="left">Schema 与 Body</el-divider>
      <el-form-item label="输入 Schema"
        ><JsonEditor v-model="form.inputSchemaText" :height="250"
      /></el-form-item>
      <el-form-item label="输出 Schema"
        ><JsonEditor v-model="form.outputSchemaText" :height="200"
      /></el-form-item>
      <el-form-item label="Body Mode">
        <el-radio-group v-model="form.bodyMode"
          ><el-radio value="PARAMETERS">按参数映射</el-radio
          ><el-radio value="RAW_ARGUMENTS">完整 Arguments</el-radio></el-radio-group
        >
      </el-form-item>
      <el-form-item label="Body Template"
        ><JsonEditor v-model="form.bodyTemplateText" :height="200"
      /></el-form-item>
    </el-form>
    <template #footer
      ><el-button @click="formVisible = false">取消</el-button
      ><el-button type="primary" :loading="submitting" @click="submit">保存</el-button></template
    >
  </el-drawer>

  <el-dialog
    v-model="testVisible"
    :title="`测试 HTTP Tool${testTool ? `：${testTool.toolName}` : ''}`"
    width="760px"
  >
    <el-alert
      title="Arguments 必须是 JSON 对象，字段应与输入 Schema 和参数映射一致。"
      type="info"
      :closable="false"
    />
    <div class="test-editor"><JsonEditor v-model="testArguments" :height="260" /></div>
    <template v-if="testResult">
      <el-descriptions :column="3" border>
        <el-descriptions-item label="结果"
          ><el-tag :type="testResult.success ? 'success' : 'danger'">{{
            testResult.success ? '成功' : '失败'
          }}</el-tag></el-descriptions-item
        >
        <el-descriptions-item label="耗时">{{ testResult.durationMs }} ms</el-descriptions-item>
        <el-descriptions-item label="可重试">{{
          testResult.error?.retryable ? '是' : '否'
        }}</el-descriptions-item>
        <el-descriptions-item v-if="testResult.error" label="错误" :span="3"
          >{{ testResult.error.code }}：{{ testResult.error.message }}</el-descriptions-item
        >
      </el-descriptions>
      <div class="test-editor"
        ><JsonEditor
          :model-value="stringifyJson(testResult.data ?? testResult.error)"
          readonly
          :height="260"
      /></div>
    </template>
    <template #footer
      ><el-button @click="testVisible = false">关闭</el-button
      ><el-button type="primary" :loading="testing" @click="runTest">执行测试</el-button></template
    >
  </el-dialog>
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

.request-grid {
  display: grid;
  grid-template-columns: 160px 1fr 1fr;
  gap: 0 14px;
}

.add-parameter {
  margin-top: 10px;
}

.test-editor {
  margin-top: 14px;
}

:deep(.el-select) {
  width: 100%;
}

@media (width <= 900px) {
  .form-grid,
  .request-grid {
    display: block;
  }
}
</style>
