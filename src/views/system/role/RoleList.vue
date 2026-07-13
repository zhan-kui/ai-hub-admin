<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import { roleApi, menuApi, type RoleVO, type MenuVO } from '@/api/frontend-api'

type RoleRow = RoleVO & Record<string, any>

const loading = ref(false)
const submitting = ref(false)
const menuSubmitting = ref(false)
const keyword = ref('')

const roles = ref<RoleRow[]>([])
const pager = reactive({
  page: 1,
  size: 10,
  total: 0
})

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const formMode = ref<'create' | 'edit'>('create')
const formData = reactive({
  id: 0,
  code: '',
  name: '',
  description: '',
  sort: 1,
  status: 1 as 0 | 1
})

const formRules: FormRules = {
  code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }]
}

const menuVisible = ref(false)
const currentRole = ref<RoleRow | null>(null)
const menuTreeRef = ref()
const menuTree = ref<MenuVO[]>([])
const checkedMenuIds = ref<number[]>([])

const builtinCodes = new Set(['super_admin', 'admin', 'user'])

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, any>
  for (const key of ['list', 'items', 'rows', 'records', 'data']) {
    if (Array.isArray(obj[key])) return obj[key]
  }
  if (obj.data && typeof obj.data === 'object') {
    for (const key of ['list', 'items', 'rows', 'records']) {
      if (Array.isArray(obj.data[key])) return obj.data[key]
    }
  }
  return []
}

function pickTotal(payload: any, listLength: number): number {
  if (!payload || typeof payload !== 'object') return listLength
  const obj = payload as Record<string, any>
  for (const key of ['total', 'count']) {
    const value = Number(obj[key])
    if (Number.isFinite(value)) return value
  }
  if (obj.data && typeof obj.data === 'object') {
    for (const key of ['total', 'count']) {
      const value = Number(obj.data[key])
      if (Number.isFinite(value)) return value
    }
  }
  return listLength
}

function isBuiltin(row: RoleRow): boolean {
  return builtinCodes.has(row.code)
}

async function loadRoles() {
  loading.value = true
  try {
    const res = await roleApi.list({ keyword: keyword.value || undefined })
    const list = pickArray(res) as RoleRow[]
    roles.value = list
    pager.total = pickTotal(res, list.length)
  } catch (error: any) {
    ElMessage.error(error?.message || '角色列表加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pager.page = 1
  void loadRoles()
}

function handleReset() {
  keyword.value = ''
  pager.page = 1
  void loadRoles()
}

function openCreate() {
  formMode.value = 'create'
  formVisible.value = true
  formData.id = 0
  formData.code = ''
  formData.name = ''
  formData.description = ''
  formData.sort = 1
  formData.status = 1
}

function openEdit(row: RoleRow) {
  formMode.value = 'edit'
  formVisible.value = true
  formData.id = Number(row.id)
  formData.code = row.code
  formData.name = row.name
  formData.description = row.description || ''
  formData.sort = Number(row.sort || 1)
  formData.status = Number(row.status || 0) as 0 | 1
}

async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate()

  submitting.value = true
  try {
    const payload = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      description: formData.description || undefined,
      sort: formData.sort,
      status: formData.status === 1
    }
    if (formMode.value === 'create') {
      await roleApi.create(payload)
      ElMessage.success('角色创建成功')
    } else {
      await roleApi.update(formData.id, payload)
      ElMessage.success('角色更新成功')
    }
    formVisible.value = false
    await loadRoles()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: RoleRow) {
  if (isBuiltin(row)) return
  try {
    await ElMessageBox.confirm(`确认删除角色「${row.name}」吗？`, '删除确认', {
      type: 'warning'
    })
    await roleApi.delete(Number(row.id))
    ElMessage.success('角色删除成功')
    await loadRoles()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '角色删除失败')
    }
  }
}

async function handleToggleStatus(row: RoleRow, nextStatus: number) {
  const status: 0 | 1 = nextStatus === 1 ? 1 : 0
  const previous = row.status
  row.status = status
  try {
    await roleApi.toggleStatus(Number(row.id), status)
    ElMessage.success('状态更新成功')
  } catch (error: any) {
    row.status = previous
    ElMessage.error(error?.message || '状态更新失败')
  }
}

async function openMenuAssign(row: RoleRow) {
  currentRole.value = row
  menuVisible.value = true

  try {
    const [allMenusRes, checkedRes] = await Promise.all([
      menuApi.list('pc'),
      menuApi.getRoleMenuIds(Number(row.id))
    ])
    menuTree.value = pickArray(allMenusRes) as MenuVO[]
    checkedMenuIds.value = pickArray(checkedRes).map((id) => Number(id))
    await nextTick()
    menuTreeRef.value?.setCheckedKeys?.(checkedMenuIds.value)
  } catch (error: any) {
    ElMessage.error(error?.message || '菜单权限加载失败')
  }
}

async function submitMenuAssign() {
  if (!currentRole.value) return
  menuSubmitting.value = true
  try {
    const checked = menuTreeRef.value?.getCheckedKeys?.() || []
    const halfChecked = menuTreeRef.value?.getHalfCheckedKeys?.() || []
    const menuIds = Array.from(new Set([...checked, ...halfChecked].map((id: any) => Number(id))))
    await menuApi.assignRoleMenus(Number(currentRole.value.id), { menuIds })
    ElMessage.success('菜单权限保存成功')
    menuVisible.value = false
  } catch (error: any) {
    ElMessage.error(error?.message || '菜单权限保存失败')
  } finally {
    menuSubmitting.value = false
  }
}

const pagedRows = computed(() => {
  const start = (pager.page - 1) * pager.size
  return roles.value.slice(start, start + pager.size)
})

const codeDisabled = computed(() => formMode.value === 'edit' && builtinCodes.has(formData.code))

onMounted(() => {
  void loadRoles()
})
</script>

<template>
  <ContentWrap class="system-management-page" title="角色管理" message="配置角色权限与可用状态">
    <div class="toolbar">
      <el-form inline>
        <el-form-item label="关键词">
          <el-input
            v-model="keyword"
            placeholder="角色编码/角色名称"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
      </el-form>
      <div class="toolbar-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button type="success" @click="openCreate">新建角色</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="pagedRows" row-key="id" border>
      <el-table-column type="index" label="#" width="56" />
      <el-table-column prop="code" label="角色编码" min-width="130" />
      <el-table-column prop="name" label="角色名称" min-width="130" />
      <el-table-column prop="description" label="描述" min-width="180" />
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status"
            :active-value="1"
            :inactive-value="0"
            @change="(value) => handleToggleStatus(row, Number(value))"
          />
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column label="标记" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="isBuiltin(row)" type="warning">内置</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="success" link @click="openMenuAssign(row)">菜单权限</el-button>
            <el-button type="danger" link :disabled="isBuiltin(row)" @click="handleDelete(row)">
              删除
            </el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.size"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        :total="pager.total"
      />
    </div>
  </ContentWrap>

  <el-dialog
    v-model="formVisible"
    :title="formMode === 'create' ? '新建角色' : '编辑角色'"
    width="560px"
    destroy-on-close
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="92px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="角色编码" prop="code">
            <el-input v-model="formData.code" :disabled="codeDisabled" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="角色名称" prop="name">
            <el-input v-model="formData.name" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="排序" prop="sort">
            <el-input-number v-model="formData.sort" :min="1" class="w-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态" prop="status">
            <el-switch v-model="formData.status" :active-value="1" :inactive-value="0" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="描述" prop="description">
        <el-input v-model="formData.description" type="textarea" :rows="4" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="menuVisible"
    :title="`菜单权限分配 - ${currentRole?.name || ''}`"
    width="700px"
    destroy-on-close
  >
    <el-tree
      ref="menuTreeRef"
      :data="menuTree"
      node-key="id"
      show-checkbox
      default-expand-all
      :default-checked-keys="checkedMenuIds"
      :props="{ label: 'menuName', children: 'children' }"
      class="menu-tree"
    />
    <template #footer>
      <el-button @click="menuVisible = false">取消</el-button>
      <el-button type="primary" :loading="menuSubmitting" @click="submitMenuAssign">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="less">
.toolbar {
  display: flex;
  padding: 16px 18px;
  margin-bottom: 16px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.toolbar :deep(.el-form) {
  flex: 1;
}

.toolbar :deep(.el-form--inline) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
}

.toolbar :deep(.el-form-item) {
  margin-bottom: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

:deep(.el-table) {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

:deep(.el-table__header-wrapper th.el-table__cell) {
  font-weight: 600;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-extra-light);
}

:deep(.el-table__cell) {
  padding-top: 12px;
  padding-bottom: 12px;
}

.pager {
  display: flex;
  margin-top: 14px;
  justify-content: flex-end;
}

.menu-tree {
  max-height: 460px;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
</style>
