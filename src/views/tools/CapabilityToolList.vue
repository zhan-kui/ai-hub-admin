<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { ContentWrap } from '@/components/ContentWrap'
import {
  capabilityToolApi,
  type CapabilityTool,
  type CapabilityToolUpdateRequest,
  type ProviderType
} from '@/api/capability'
import JsonEditor from './components/JsonEditor.vue'
import { formatDate, stringifyJson } from './utils'

defineOptions({ name: 'CapabilityToolList' })

const router = useRouter()
const loading = ref(false)
const list = ref<CapabilityTool[]>([])
const total = ref(0)
const query = reactive({
  page: 1,
  size: 20,
  keyword: '',
  providerType: undefined as ProviderType | undefined,
  status: undefined as 0 | 1 | undefined
})

const detailVisible = ref(false)
const detail = ref<CapabilityTool>()
const editVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref<number>()
const editForm = reactive({
  toolName: '',
  description: '',
  tags: [] as string[],
  status: 1 as 0 | 1
})
const rules: FormRules = {
  toolName: [{ required: true, message: '请输入 Tool 名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入用途说明', trigger: 'blur' }]
}

async function load() {
  loading.value = true
  try {
    const result = await capabilityToolApi.page({
      page: query.page,
      size: query.size,
      keyword: query.keyword.trim() || undefined,
      providerType: query.providerType,
      status: query.status
    })
    list.value = result.records || []
    total.value = result.total || 0
  } catch (error: any) {
    ElMessage.error(error?.message || '能力工具加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

async function openDetail(row: CapabilityTool) {
  try {
    detail.value = await capabilityToolApi.detail(row.id)
    detailVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || 'Tool 详情加载失败')
  }
}

async function openEdit(row: CapabilityTool) {
  try {
    const value = await capabilityToolApi.detail(row.id)
    editingId.value = value.id
    Object.assign(editForm, {
      toolName: value.toolName,
      description: value.description,
      tags: [...(value.tags || [])],
      status: value.status
    })
    editVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || 'Tool 详情加载失败')
  }
}

async function submitEdit() {
  if (!formRef.value || !editingId.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const payload: CapabilityToolUpdateRequest = {
      toolName: editForm.toolName.trim(),
      description: editForm.description.trim(),
      tags: editForm.tags,
      status: editForm.status
    }
    await capabilityToolApi.update(editingId.value, payload)
    ElMessage.success('Tool 信息已更新')
    editVisible.value = false
    await load()
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
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
  if (row.providerType === 'MCP') {
    ElMessage.warning('MCP Tool 不能手工删除，请停用 Tool 或管理所属 MCP 服务')
    return
  }
  try {
    await ElMessageBox.confirm(
      `删除“${row.toolName}”会移除相关 Skill 绑定，确认继续吗？`,
      '删除能力工具',
      { type: 'warning', confirmButtonText: '确认删除' }
    )
    await capabilityToolApi.remove(row.id)
    ElMessage.success('Tool 已删除')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败')
  }
}

function configureHttp(row: CapabilityTool) {
  void router.push({ path: '/tools/http-tools', query: { toolId: String(row.id) } })
}

function providerTag(provider: ProviderType) {
  if (provider === 'MCP') return 'primary'
  if (provider === 'HTTP') return 'success'
  return 'warning'
}

onMounted(load)
</script>

<template>
  <ContentWrap title="能力工具" message="统一查看 MCP、HTTP 和 LOCAL Tool">
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
          <el-select
            v-model="query.providerType"
            clearable
            placeholder="全部提供方"
            @change="search"
          >
            <el-option label="MCP" value="MCP" />
            <el-option label="HTTP" value="HTTP" />
            <el-option label="LOCAL" value="LOCAL" />
          </el-select>
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
      <el-table-column label="提供方" width="100">
        <template #default="{ row }"
          ><el-tag :type="providerTag(row.providerType)">{{ row.providerType }}</el-tag></template
        >
      </el-table-column>
      <el-table-column prop="description" label="用途" min-width="260" show-overflow-tooltip />
      <el-table-column label="标签" min-width="170">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags || []" :key="tag" size="small" class="tag">{{
            tag
          }}</el-tag>
          <span v-if="!row.tags?.length">-</span>
        </template>
      </el-table-column>
      <el-table-column label="最后同步" width="180">
        <template #default="{ row }">{{ formatDate(row.lastSyncTime) }}</template>
      </el-table-column>
      <el-table-column label="启用" width="90">
        <template #default="{ row }"
          ><el-switch
            :model-value="row.status"
            :active-value="1"
            :inactive-value="0"
            @change="changeStatus(row, $event)"
        /></template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑信息</el-button>
          <el-button
            v-if="row.providerType === 'HTTP'"
            link
            type="success"
            @click="configureHttp(row)"
            >配置</el-button
          >
          <el-tooltip v-if="row.providerType === 'MCP'" content="MCP Tool 不能手工删除">
            <el-button link type="info" disabled>删除</el-button>
          </el-tooltip>
          <el-button v-else link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
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

  <el-drawer v-model="detailVisible" title="Tool 详情" size="720px">
    <el-descriptions v-if="detail" :column="2" border>
      <el-descriptions-item label="名称">{{ detail.toolName }}</el-descriptions-item>
      <el-descriptions-item label="编码">{{ detail.toolCode }}</el-descriptions-item>
      <el-descriptions-item label="提供方">{{ detail.providerType }}</el-descriptions-item>
      <el-descriptions-item label="Provider ID">{{
        detail.providerId || '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="远端原名">{{
        detail.originalToolName || '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{
        detail.status ? '启用' : '停用'
      }}</el-descriptions-item>
      <el-descriptions-item label="描述" :span="2">{{ detail.description }}</el-descriptions-item>
      <el-descriptions-item label="最后同步">{{
        formatDate(detail.lastSyncTime)
      }}</el-descriptions-item>
      <el-descriptions-item label="更新时间">{{
        formatDate(detail.updateTime)
      }}</el-descriptions-item>
    </el-descriptions>
    <el-divider>输入 Schema</el-divider>
    <JsonEditor :model-value="stringifyJson(detail?.inputSchema)" readonly :height="250" />
    <el-divider>输出 Schema</el-divider>
    <JsonEditor :model-value="stringifyJson(detail?.outputSchema)" readonly :height="220" />
    <el-divider v-if="detail?.annotations">Annotations</el-divider>
    <JsonEditor
      v-if="detail?.annotations"
      :model-value="stringifyJson(detail.annotations)"
      readonly
      :height="180"
    />
  </el-drawer>

  <el-dialog v-model="editVisible" title="编辑 Tool 信息" width="620px">
    <el-form ref="formRef" :model="editForm" :rules="rules" label-width="90px">
      <el-form-item label="名称" prop="toolName"
        ><el-input v-model="editForm.toolName"
      /></el-form-item>
      <el-form-item label="描述" prop="description"
        ><el-input v-model="editForm.description" type="textarea" :rows="4"
      /></el-form-item>
      <el-form-item label="标签"
        ><el-select v-model="editForm.tags" multiple filterable allow-create default-first-option
      /></el-form-item>
      <el-form-item label="状态"
        ><el-radio-group v-model="editForm.status"
          ><el-radio :value="1">启用</el-radio><el-radio :value="0">停用</el-radio></el-radio-group
        ></el-form-item
      >
    </el-form>
    <template #footer
      ><el-button @click="editVisible = false">取消</el-button
      ><el-button type="primary" :loading="submitting" @click="submitEdit"
        >保存</el-button
      ></template
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

:deep(.el-select) {
  width: 100%;
}
</style>
