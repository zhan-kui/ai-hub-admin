<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useRouter } from 'vue-router'
import { ContentWrap } from '@/components/ContentWrap'
import { appApi, type AppConfigVO, type CreateAppRequest } from '@/api/frontend-api'

type AppRow = AppConfigVO & Record<string, any>

const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const parameterLoading = ref(false)

const keyword = ref('')
const appList = ref<AppRow[]>([])

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()
const detailFieldMissing = ref(false)

const formData = reactive<CreateAppRequest & { id?: number }>({
  appName: '',
  appCode: '',
  appType: '',
  difyApiKey: '',
  difyAppId: '',
  difyBaseUrl: '',
  description: '',
  icon: '',
  sort: 1,
  id: undefined
})

const formRules: FormRules = {
  appName: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
  appCode: [{ required: true, message: '请输入应用编码', trigger: 'blur' }],
  appType: [{ required: true, message: '请输入应用类型', trigger: 'blur' }],
  difyApiKey: [{ required: true, message: '请输入 Dify API Key', trigger: 'blur' }]
}

const parameterDrawerVisible = ref(false)
const parameterTitle = ref('应用参数')
const parameterText = ref('')

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['list', 'items', 'rows', 'records', 'data']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  if (payload.data && typeof payload.data === 'object') {
    for (const key of ['list', 'items', 'rows', 'records']) {
      if (Array.isArray(payload.data[key])) return payload.data[key]
    }
  }
  return []
}

async function loadApps() {
  loading.value = true
  try {
    const response = await appApi.list()
    appList.value = pickArray(response) as AppRow[]
  } catch (error: any) {
    ElMessage.error(error?.message || '应用列表加载失败')
  } finally {
    loading.value = false
  }
}

const filteredApps = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return appList.value
  return appList.value.filter((item) => {
    const source = `${item.appName || ''}|${item.appCode || ''}|${item.appType || ''}|${item.description || ''}`
    return source.toLowerCase().includes(text)
  })
})

function resetForm() {
  formData.id = undefined
  formData.appName = ''
  formData.appCode = ''
  formData.appType = ''
  formData.difyApiKey = ''
  formData.difyAppId = ''
  formData.difyBaseUrl = ''
  formData.description = ''
  formData.icon = ''
  formData.sort = 1
  detailFieldMissing.value = false
}

function openCreate() {
  dialogMode.value = 'create'
  dialogVisible.value = true
  resetForm()
}

async function openEdit(row: AppRow) {
  dialogMode.value = 'edit'
  dialogVisible.value = true
  resetForm()
  formData.id = Number(row.id)

  try {
    const detail = (await appApi.detail(Number(row.id))) as Record<string, any>
    const missingRequiredDetailField =
      !('difyApiKey' in detail) || !('difyAppId' in detail) || !('difyBaseUrl' in detail)
    detailFieldMissing.value = missingRequiredDetailField

    formData.appName = detail.appName || row.appName || ''
    formData.appCode = detail.appCode || row.appCode || ''
    formData.appType = detail.appType || row.appType || ''
    formData.difyApiKey = detail.difyApiKey || ''
    formData.difyAppId = detail.difyAppId || ''
    formData.difyBaseUrl = detail.difyBaseUrl || ''
    formData.description = detail.description || row.description || ''
    formData.icon = detail.icon || row.icon || ''
    formData.sort = Number(detail.sort || row.sort || 1)

    if (missingRequiredDetailField) {
      ElMessage.error(
        '应用详情接口未返回 difyApiKey / difyAppId / difyBaseUrl，已禁止编辑保存，避免误覆盖。请先补齐后端返回字段。'
      )
    }
  } catch (error: any) {
    formData.appName = row.appName || ''
    formData.appCode = row.appCode || ''
    formData.appType = row.appType || ''
    formData.difyApiKey = ''
    formData.difyAppId = ''
    formData.difyBaseUrl = ''
    formData.description = row.description || ''
    formData.icon = row.icon || ''
    formData.sort = Number(row.sort || 1)
    ElMessage.warning(error?.message || '详情接口调用失败，请确认字段后再保存')
  }
}

function toPayload(): CreateAppRequest {
  return {
    appName: formData.appName.trim(),
    appCode: formData.appCode.trim(),
    appType: formData.appType.trim(),
    difyApiKey: formData.difyApiKey.trim(),
    difyAppId: formData.difyAppId?.trim() || undefined,
    difyBaseUrl: formData.difyBaseUrl?.trim() || undefined,
    description: formData.description?.trim() || undefined,
    icon: formData.icon?.trim() || undefined,
    sort: formData.sort
  }
}

async function submitForm() {
  if (dialogMode.value === 'edit' && detailFieldMissing.value) {
    ElMessage.error(
      '当前后端详情接口字段不完整，已阻止保存。请后端补齐 difyApiKey / difyAppId / difyBaseUrl 后再编辑。'
    )
    return
  }

  if (!formRef.value) return
  await formRef.value.validate()

  submitting.value = true
  try {
    if (dialogMode.value === 'create') {
      await appApi.create(toPayload())
      ElMessage.success('应用创建成功')
    } else {
      await appApi.update(Number(formData.id), toPayload())
      ElMessage.success('应用更新成功')
    }
    dialogVisible.value = false
    await loadApps()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function removeApp(row: AppRow) {
  try {
    await ElMessageBox.confirm(`确认删除应用“${row.appName}”吗？`, '删除确认', { type: 'warning' })
    await appApi.delete(Number(row.id))
    ElMessage.success('应用删除成功')
    await loadApps()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '删除失败')
    }
  }
}

async function showParameters(row: AppRow) {
  parameterLoading.value = true
  parameterDrawerVisible.value = true
  parameterTitle.value = `${row.appName} 参数`
  parameterText.value = ''
  try {
    const response = await appApi.getParameters(Number(row.id))
    parameterText.value = JSON.stringify(response ?? {}, null, 2)
  } catch (error: any) {
    parameterText.value = error?.message || '参数加载失败'
  } finally {
    parameterLoading.value = false
  }
}

function goToOrchestrator() {
  router.push('/apps/orchestrator/create')
}

onMounted(() => {
  void loadApps()
})
</script>

<template>
  <ContentWrap title="应用管理" message="管理员维护 AI 应用配置">
    <div class="toolbar">
      <el-input
        v-model="keyword"
        class="toolbar-search"
        placeholder="按应用名称/编码/类型搜索"
        clearable
      />
      <div class="toolbar-actions">
        <el-button @click="loadApps">刷新</el-button>
        <el-button type="primary" plain @click="goToOrchestrator">从模板创建</el-button>
        <el-button type="primary" @click="openCreate">新建应用</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="filteredApps" row-key="id" border>
      <el-table-column type="index" label="#" width="56" />
      <el-table-column prop="appName" label="应用名称" min-width="160" />
      <el-table-column prop="appCode" label="应用编码" min-width="130" />
      <el-table-column prop="appType" label="应用类型" min-width="120" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="sort" label="排序" width="70" align="center" />
      <el-table-column label="启用" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="success" link @click="showParameters(row)">参数</el-button>
            <el-button type="danger" link @click="removeApp(row)">删除</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogMode === 'create' ? '新建应用' : '编辑应用'"
    width="720px"
    destroy-on-close
  >
    <el-alert
      v-if="dialogMode === 'edit' && detailFieldMissing"
      title="当前应用详情接口字段不完整，已禁止保存，避免配置被覆盖。"
      type="error"
      :closable="false"
      class="mb-16px"
    />

    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="110px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="应用名称" prop="appName">
            <el-input v-model="formData.appName" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="应用编码" prop="appCode">
            <el-input v-model="formData.appCode" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="应用类型" prop="appType">
            <el-input v-model="formData.appType" placeholder="如 chatbot/workflow/agent" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="排序">
            <el-input-number v-model="formData.sort" class="w-full" :min="1" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="Dify API 密钥" prop="difyApiKey">
        <el-input v-model="formData.difyApiKey" type="textarea" :rows="2" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="Dify 应用 ID">
            <el-input v-model="formData.difyAppId" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Dify 基础地址">
            <el-input v-model="formData.difyBaseUrl" placeholder="例如 https://api.dify.ai/v1" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="图标">
            <el-input v-model="formData.icon" />
          </el-form-item>
        </el-col>
        <el-col :span="12" />
      </el-row>

      <el-form-item label="描述">
        <el-input v-model="formData.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="dialogMode === 'edit' && detailFieldMissing"
        @click="submitForm"
      >
        保存
      </el-button>
    </template>
  </el-dialog>

  <el-drawer v-model="parameterDrawerVisible" :title="parameterTitle" size="540px">
    <el-skeleton v-if="parameterLoading" :rows="8" animated />
    <pre v-else class="json-view">{{ parameterText }}</pre>
  </el-drawer>
</template>

<style scoped lang="less">
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.toolbar-search {
  max-width: 420px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.json-view {
  min-height: 320px;
  padding: 12px;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #dbeafe;
  word-break: break-all;
  white-space: pre-wrap;
  background: #0f172a;
  border-radius: 8px;
}
</style>
