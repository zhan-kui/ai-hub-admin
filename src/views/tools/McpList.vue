<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Connection, Download, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ContentWrap } from '@/components/ContentWrap'
import {
  mcpServerApi,
  type McpImportResult,
  type McpServer,
  type McpServerRequest,
  type McpSyncResult,
  type McpTestResult,
  type McpTransportType
} from '@/api/capability'
import JsonEditor from './components/JsonEditor.vue'
import KeyValueEditor from './components/KeyValueEditor.vue'
import { formatDate, stringifyJson } from './utils'

defineOptions({ name: 'McpList' })

const loading = ref(false)
const submitting = ref(false)
const list = ref<McpServer[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '', status: undefined as 0 | 1 | undefined })

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref<number>()
const form = reactive<McpServerRequest>({
  serverCode: '',
  serverName: '',
  description: '',
  sourceType: 'MANUAL',
  sourceUrl: '',
  transportType: 'AUTO',
  baseUrl: '',
  endpoint: '/mcp',
  headers: {},
  command: '',
  args: [],
  env: {},
  workingDirectory: '',
  connectTimeoutSeconds: 10,
  requestTimeoutSeconds: 60,
  status: 1
})

const rules: FormRules = {
  serverCode: [{ required: true, message: '请输入服务编码', trigger: 'blur' }],
  serverName: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  transportType: [{ required: true, message: '请选择传输类型', trigger: 'change' }],
  baseUrl: [
    {
      validator: (_rule, value, callback) => {
        if (form.transportType !== 'STDIO' && !String(value || '').trim()) {
          callback(new Error('远程 MCP 必须填写 Base URL'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ],
  command: [
    {
      validator: (_rule, value, callback) => {
        if (form.transportType === 'STDIO' && !String(value || '').trim()) {
          callback(new Error('STDIO MCP 必须填写 Command'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

const detailVisible = ref(false)
const detail = ref<McpServer>()
const importVisible = ref(false)
const importSubmitting = ref(false)
const importForm = reactive({
  sourceType: 'IMPORT' as const,
  sourceUrl: '',
  configJson: '{\n  "mcpServers": {}\n}'
})
const resultVisible = ref(false)
const resultTitle = ref('')
const resultText = ref('{}')

async function load() {
  loading.value = true
  try {
    const result = await mcpServerApi.page({
      page: query.page,
      size: query.size,
      keyword: query.keyword.trim() || undefined,
      status: query.status
    })
    list.value = result.records || []
    total.value = result.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || 'MCP 服务加载失败')
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
  Object.assign(form, {
    serverCode: '',
    serverName: '',
    description: '',
    sourceType: 'MANUAL',
    sourceUrl: '',
    transportType: 'AUTO',
    baseUrl: '',
    endpoint: '/mcp',
    headers: {},
    command: '',
    args: [],
    env: {},
    workingDirectory: '',
    connectTimeoutSeconds: 10,
    requestTimeoutSeconds: 60,
    status: 1
  } satisfies McpServerRequest)
}

function openCreate() {
  resetForm()
  formVisible.value = true
}

async function openEdit(row: McpServer) {
  try {
    const value = await mcpServerApi.detail(row.id)
    resetForm()
    editingId.value = row.id
    Object.assign(form, {
      serverCode: value.serverCode,
      serverName: value.serverName,
      description: value.description || '',
      sourceType: value.sourceType || 'MANUAL',
      sourceUrl: value.sourceUrl || '',
      transportType: value.transportType,
      baseUrl: value.baseUrl || '',
      endpoint: value.endpoint || '',
      headers: { ...(value.headers || {}) },
      command: value.command || '',
      args: [...(value.args || [])],
      env: { ...(value.env || {}) },
      workingDirectory: value.workingDirectory || '',
      connectTimeoutSeconds: value.connectTimeoutSeconds || 10,
      requestTimeoutSeconds: value.requestTimeoutSeconds || 60,
      status: value.status
    })
    formVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || 'MCP 服务详情加载失败')
  }
}

async function openDetail(row: McpServer) {
  try {
    detail.value = await mcpServerApi.detail(row.id)
    detailVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || 'MCP 服务详情加载失败')
  }
}

async function submit() {
  if (!formRef.value) return
  await formRef.value.validate()
  submitting.value = true
  try {
    const payload: McpServerRequest = {
      ...form,
      serverCode: form.serverCode.trim(),
      serverName: form.serverName.trim(),
      description: form.description?.trim() || undefined,
      sourceUrl: form.sourceUrl?.trim() || undefined,
      baseUrl: form.transportType === 'STDIO' ? undefined : form.baseUrl?.trim(),
      endpoint: form.transportType === 'STDIO' ? undefined : form.endpoint?.trim() || undefined,
      headers: form.transportType === 'STDIO' ? undefined : form.headers,
      command: form.transportType === 'STDIO' ? form.command?.trim() : undefined,
      args: form.transportType === 'STDIO' ? form.args : undefined,
      env: form.transportType === 'STDIO' ? form.env : undefined,
      workingDirectory:
        form.transportType === 'STDIO' ? form.workingDirectory?.trim() || undefined : undefined
    }
    if (editingId.value) {
      await mcpServerApi.update(editingId.value, payload)
      ElMessage.success('MCP 服务已更新')
    } else {
      await mcpServerApi.create(payload)
      ElMessage.success('MCP 服务已创建')
    }
    formVisible.value = false
    await load()
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

async function changeStatus(row: McpServer, value: string | number | boolean) {
  const status = Number(value) as 0 | 1
  try {
    await mcpServerApi.setStatus(row.id, status)
    row.status = status
    ElMessage.success(status ? '已启用' : '已停用')
  } catch (error: any) {
    ElMessage.error(error?.message || '状态修改失败')
    await load()
  }
}

async function remove(row: McpServer) {
  try {
    await ElMessageBox.confirm(
      `删除“${row.serverName}”会同时删除其 MCP Tool 以及相关 Skill 绑定，确认继续吗？`,
      '删除 MCP 服务',
      { type: 'warning', confirmButtonText: '确认删除' }
    )
    await mcpServerApi.remove(row.id)
    ElMessage.success('MCP 服务已删除')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败')
  }
}

function showResult(title: string, value: McpTestResult | McpSyncResult | McpImportResult) {
  resultTitle.value = title
  resultText.value = stringifyJson(value)
  resultVisible.value = true
}

async function test(row: McpServer) {
  try {
    const value = await mcpServerApi.test(row.id)
    showResult('连接测试结果', value)
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '连接测试失败')
    await load()
  }
}

async function sync(row: McpServer) {
  try {
    const value = await mcpServerApi.syncTools(row.id)
    showResult('Tool 同步结果', value)
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || 'Tool 同步失败')
    await load()
  }
}

async function submitImport() {
  if (!importForm.configJson.trim()) {
    ElMessage.warning('请输入 MCP JSON 配置')
    return
  }
  try {
    JSON.parse(importForm.configJson)
  } catch {
    ElMessage.error('MCP 配置不是合法 JSON')
    return
  }
  importSubmitting.value = true
  try {
    const value = await mcpServerApi.importConfig({
      sourceType: importForm.sourceType,
      sourceUrl: importForm.sourceUrl.trim() || undefined,
      configJson: importForm.configJson
    })
    importVisible.value = false
    showResult('MCP 配置导入结果', value)
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || 'MCP 配置导入失败')
  } finally {
    importSubmitting.value = false
  }
}

function connectionTag(status: string) {
  if (status === 'CONNECTED') return 'success'
  if (status === 'ERROR') return 'danger'
  if (status === 'DISCONNECTED') return 'warning'
  return 'info'
}

function transportChanged(value: McpTransportType) {
  if (value === 'STDIO') {
    form.baseUrl = ''
    form.endpoint = ''
  } else if (!form.endpoint) {
    form.endpoint = '/mcp'
  }
}

onMounted(load)
</script>

<template>
  <ContentWrap title="MCP 服务" message="维护 MCP Server 连接，并同步远端 Tool">
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
        <el-button :icon="Download" @click="importVisible = true">导入配置</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增 MCP 服务</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" row-key="id">
      <el-table-column label="服务" min-width="220">
        <template #default="{ row }">
          <div class="primary-cell">
            <strong>{{ row.serverName }}</strong>
            <span>{{ row.serverCode }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="transportType" label="传输类型" width="160" />
      <el-table-column label="连接状态" width="130">
        <template #default="{ row }">
          <el-tooltip :content="row.lastError || ''" :disabled="!row.lastError">
            <el-tag :type="connectionTag(row.connectionStatus)">{{ row.connectionStatus }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="最后同步" min-width="170">
        <template #default="{ row }">{{ formatDate(row.lastSyncTime) }}</template>
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
      <el-table-column label="操作" width="330" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="success" :icon="Connection" @click="test(row)">测试</el-button>
          <el-button link type="primary" :icon="Refresh" @click="sync(row)">同步</el-button>
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
    :title="editingId ? '编辑 MCP 服务' : '新增 MCP 服务'"
    size="720px"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-divider content-position="left">基础信息</el-divider>
      <div class="form-grid">
        <el-form-item label="服务编码" prop="serverCode">
          <el-input v-model="form.serverCode" :disabled="Boolean(editingId)" />
        </el-form-item>
        <el-form-item label="服务名称" prop="serverName"
          ><el-input v-model="form.serverName"
        /></el-form-item>
        <el-form-item label="来源类型">
          <el-select v-model="form.sourceType">
            <el-option label="手工配置" value="MANUAL" />
            <el-option label="导入" value="IMPORT" />
            <el-option label="魔搭社区" value="MODELSCOPE" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio><el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
      <el-form-item label="描述"
        ><el-input v-model="form.description" type="textarea" :rows="3"
      /></el-form-item>
      <el-form-item label="来源地址"
        ><el-input v-model="form.sourceUrl" placeholder="项目主页或来源页面"
      /></el-form-item>

      <el-divider content-position="left">连接配置</el-divider>
      <el-form-item label="传输类型" prop="transportType">
        <el-select v-model="form.transportType" @change="transportChanged">
          <el-option label="自动探测" value="AUTO" />
          <el-option label="Streamable HTTP" value="STREAMABLE_HTTP" />
          <el-option label="SSE" value="SSE" />
          <el-option label="STDIO" value="STDIO" />
        </el-select>
      </el-form-item>

      <template v-if="form.transportType !== 'STDIO'">
        <el-form-item label="Base URL" prop="baseUrl"
          ><el-input v-model="form.baseUrl" placeholder="https://example.com"
        /></el-form-item>
        <el-form-item label="Endpoint"
          ><el-input v-model="form.endpoint" placeholder="/mcp"
        /></el-form-item>
        <el-form-item label="Headers">
          <KeyValueEditor
            v-model="form.headers"
            secret
            key-placeholder="Header 名称"
            value-placeholder="Header 值"
          />
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="Command" prop="command"
          ><el-input v-model="form.command" placeholder="npx / uvx / 可执行文件"
        /></el-form-item>
        <el-form-item label="Args">
          <el-select
            v-model="form.args"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入参数后回车"
          />
        </el-form-item>
        <el-form-item label="Env">
          <KeyValueEditor
            v-model="form.env"
            secret
            key-placeholder="环境变量"
            value-placeholder="变量值"
          />
        </el-form-item>
        <el-form-item label="工作目录"><el-input v-model="form.workingDirectory" /></el-form-item>
      </template>

      <div class="form-grid">
        <el-form-item label="连接超时(秒)"
          ><el-input-number v-model="form.connectTimeoutSeconds" :min="1" :max="600"
        /></el-form-item>
        <el-form-item label="请求超时(秒)"
          ><el-input-number v-model="form.requestTimeoutSeconds" :min="1" :max="3600"
        /></el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-drawer>

  <el-drawer v-model="detailVisible" title="MCP 服务详情" size="620px">
    <el-descriptions v-if="detail" :column="1" border>
      <el-descriptions-item label="服务"
        >{{ detail.serverName }}（{{ detail.serverCode }}）</el-descriptions-item
      >
      <el-descriptions-item label="传输类型">{{ detail.transportType }}</el-descriptions-item>
      <el-descriptions-item label="连接状态">{{ detail.connectionStatus }}</el-descriptions-item>
      <el-descriptions-item label="远端服务"
        >{{ detail.remoteServerName || '-' }}
        {{ detail.remoteServerVersion || '' }}</el-descriptions-item
      >
      <el-descriptions-item label="协议版本">{{
        detail.protocolVersion || '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="最后同步">{{
        formatDate(detail.lastSyncTime)
      }}</el-descriptions-item>
      <el-descriptions-item label="最后错误"
        ><span class="error-text">{{ detail.lastError || '-' }}</span></el-descriptions-item
      >
      <el-descriptions-item label="更新时间">{{
        formatDate(detail.updateTime)
      }}</el-descriptions-item>
    </el-descriptions>
    <el-divider>Capabilities</el-divider>
    <JsonEditor :model-value="stringifyJson(detail?.capabilities)" readonly :height="220" />
  </el-drawer>

  <el-dialog v-model="importVisible" title="导入 MCP 配置" width="760px">
    <el-form label-width="100px">
      <el-form-item label="来源地址"><el-input v-model="importForm.sourceUrl" /></el-form-item>
      <el-form-item label="JSON 配置"
        ><JsonEditor v-model="importForm.configJson" :height="360"
      /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="importVisible = false">取消</el-button>
      <el-button type="primary" :loading="importSubmitting" @click="submitImport">导入</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="resultVisible" :title="resultTitle" width="720px">
    <JsonEditor :model-value="resultText" readonly :height="420" />
  </el-dialog>
</template>

<style scoped lang="less">
@import url('./styles/list-toolbar.less');

.primary-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
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

.error-text {
  color: var(--el-color-danger);
  white-space: pre-wrap;
}

:deep(.el-select) {
  width: 100%;
}

@media (width <= 900px) {
  .form-grid {
    display: block;
  }
}
</style>
