<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useRouter } from 'vue-router'
import { ContentWrap } from '@/components/ContentWrap'
import {
  appApi,
  orchestrationApi,
  type AppConfigVO,
  type UpdateAppBasicRequest
} from '@/api/frontend-api'

type AppRow = AppConfigVO & Record<string, any>

const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const publishingId = ref<number | null>(null)
const parameterLoading = ref(false)

const keyword = ref('')
const appList = ref<AppRow[]>([])

const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const formData = reactive<UpdateAppBasicRequest & { id?: number }>({
  appName: '',
  description: '',
  icon: '',
  sort: 1,
  enabled: true,
  id: undefined
})

const formRules: FormRules = {
  appName: [{ required: true, message: '请输入应用名称', trigger: 'blur' }]
}

const parameterDrawerVisible = ref(false)
const parameterTitle = ref('应用参数')
const parameterText = ref('')

const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  SAVED: '已保存未发布',
  PUBLISHED: '已发布',
  PUBLISH_FAILED: '发布失败'
}

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

function resolveSourceType(row: AppRow): 'canvas' | 'template' | undefined {
  if (row.sourceType === 'canvas' || row.sourceType === 'template') return row.sourceType
  if (row.templateCode === '__canvas__') return 'canvas'
  if (row.templateCode) return 'template'
  return undefined
}

function getPublishStatusText(status?: string): string {
  if (!status) return '-'
  return statusMap[status] || status
}

function getPublishStatusTagType(status?: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'SAVED' || status === 'DRAFT') return 'warning'
  if (status === 'PUBLISH_FAILED') return 'danger'
  return 'info'
}

function normalizeEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  return Boolean(value)
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
  formData.description = ''
  formData.icon = ''
  formData.sort = 1
  formData.enabled = true
}

async function openBasicEdit(row: AppRow) {
  dialogVisible.value = true
  resetForm()
  formData.id = Number(row.id)
  formData.appName = row.appName || ''
  formData.description = row.description || ''
  formData.icon = row.icon || ''
  formData.sort = Number(row.sort || 1)
  formData.enabled = normalizeEnabled(row.enabled)

  try {
    const detail = (await appApi.detail(Number(row.id))) as Record<string, any>
    formData.appName = detail.appName || row.appName || ''
    formData.description = detail.description || row.description || ''
    formData.icon = detail.icon || row.icon || ''
    formData.sort = Number(detail.sort || row.sort || 1)
    formData.enabled = normalizeEnabled(detail.enabled ?? row.enabled)
  } catch (error: any) {
    ElMessage.warning(error?.message || '详情接口调用失败，已使用列表数据回填')
  }
}

function toBasicPayload(): UpdateAppBasicRequest {
  return {
    appName: formData.appName.trim(),
    description: formData.description?.trim() || undefined,
    icon: formData.icon?.trim() || undefined,
    sort: Number(formData.sort || 1),
    enabled: normalizeEnabled(formData.enabled)
  }
}

async function submitBasicEdit() {
  if (!formRef.value) return
  await formRef.value.validate()

  submitting.value = true
  try {
    await appApi.updateBasic(Number(formData.id), toBasicPayload())
    ElMessage.success('基本信息更新成功')
    dialogVisible.value = false
    await loadApps()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

function handleEditFlow(row: AppRow) {
  const sourceType = resolveSourceType(row)
  if (sourceType === 'canvas') {
    router.push(`/apps/orchestrator/create?mode=blank&edit=${row.id}`)
    return
  }
  if (sourceType === 'template') {
    router.push(`/apps/orchestrator/create?mode=template&edit=${row.id}`)
    return
  }
  ElMessage.warning('该应用缺少编排来源，无法进入流程编辑')
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

async function publishApp(row: AppRow) {
  try {
    await ElMessageBox.confirm(
      `确认发布应用【${row.appName}】吗？\n发布后将把当前保存的流程编排转换为 Dify 应用并生效。\n如果该应用已发布过，将原地更新 Dify 工作流，difyAppId 和 API Key 不变。`,
      '发布确认',
      {
        type: 'warning',
        confirmButtonText: '确认发布',
        cancelButtonText: '取消'
      }
    )
    publishingId.value = Number(row.id)
    await orchestrationApi.publishApp(Number(row.id), {
      version: Number(row.version || 0) || undefined
    })
    ElMessage.success('发布成功')
    await loadApps()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    const status = error?.response?.status
    const backendMessage = error?.response?.data?.message || error?.message || '发布失败'
    if (status === 409) {
      ElMessage.error('应用已被别人修改，请刷新后重试')
    } else if (status === 400) {
      ElMessage.error(String(backendMessage))
    } else if (status === 500) {
      ElMessage.error('发布失败')
    } else {
      ElMessage.error(String(backendMessage))
    }
  } finally {
    publishingId.value = null
  }
}

function goToTemplateCreate() {
  router.push('/apps/orchestrator/create?mode=template')
}

function goToCanvasCreate() {
  router.push('/apps/orchestrator/create?mode=blank')
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
        <el-button type="primary" plain @click="goToTemplateCreate">从模板创建</el-button>
        <el-button type="primary" plain @click="goToCanvasCreate">从空白编排</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="filteredApps" row-key="id" border>
      <el-table-column type="index" label="#" width="56" />
      <el-table-column prop="appName" label="应用名称" min-width="160" />
      <el-table-column prop="appCode" label="应用编码" min-width="130" />
      <el-table-column prop="appType" label="应用类型" min-width="120" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="sort" label="排序" width="70" align="center" />
      <el-table-column label="来源" min-width="96" align="center">
        <template #default="{ row }">
          <el-tag v-if="resolveSourceType(row)" type="info">{{ resolveSourceType(row) }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="发布状态" min-width="138" align="center">
        <template #default="{ row }">
          <el-tag :type="getPublishStatusTagType(row.publishStatus)">
            {{ getPublishStatusText(row.publishStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version" label="当前版本" width="90" align="center" />
      <el-table-column prop="currentDraftVersion" label="草稿版本" width="90" align="center" />
      <el-table-column prop="currentPublishedVersion" label="发布版本" width="90" align="center" />
      <el-table-column prop="lastEditedAt" label="最后编辑时间" min-width="170" />
      <el-table-column label="最后发布时间" min-width="170">
        <template #default="{ row }">
          {{ row.lastPublishedAt || row.publishedAt || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="启用" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column label="操作" width="420" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button type="primary" link @click="handleEditFlow(row)">编辑流程</el-button>
            <el-button
              type="success"
              link
              :loading="publishingId === Number(row.id)"
              @click="publishApp(row)"
            >
              发布
            </el-button>
            <el-button type="warning" link @click="openBasicEdit(row)">改基本信息</el-button>
            <el-button type="info" link @click="showParameters(row)">参数</el-button>
            <el-button type="danger" link @click="removeApp(row)">删除</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <el-dialog v-model="dialogVisible" title="改基本信息" width="640px" destroy-on-close>
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
      <el-row :gutter="16">
        <el-col :span="16">
          <el-form-item label="应用名称" prop="appName">
            <el-input v-model="formData.appName" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="排序">
            <el-input-number v-model="formData.sort" class="w-full" :min="1" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="图标">
            <el-input v-model="formData.icon" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="启用">
            <el-switch v-model="formData.enabled" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="描述">
        <el-input v-model="formData.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitBasicEdit"> 保存 </el-button>
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
