<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { ContentWrap } from '@/components/ContentWrap'
import {
  userApi,
  roleApi,
  deptApi,
  type UserInfoVO,
  type RoleVO,
  type DeptVO
} from '@/api/frontend-api'

type UserRow = UserInfoVO & Record<string, any>

const loading = ref(false)
const submitting = ref(false)
const roleSubmitting = ref(false)

const keyword = ref('')
const users = ref<UserRow[]>([])
const roles = ref<RoleVO[]>([])
const deptTree = ref<DeptVO[]>([])

const pager = reactive({
  page: 1,
  size: 10,
  total: 0
})

const createVisible = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive({
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
  roleId: undefined as number | undefined,
  deptId: undefined as number | undefined
})

const createRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  roleId: [{ required: true, message: '请选择角色', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择部门', trigger: 'change' }]
}

const changeRoleVisible = ref(false)
const changeRoleFormRef = ref<FormInstance>()
const changeRoleForm = reactive({
  userId: 0,
  username: '',
  roleId: undefined as number | undefined
})

const changeRoleRules: FormRules = {
  roleId: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

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

function roleLabel(row: UserRow): string {
  return row.roleName || row.role?.name || row.role?.roleName || row.roleCode || '-'
}

function deptLabel(row: UserRow): string {
  return row.deptName || row.department?.deptName || row.department?.departmentName || '-'
}

function createdAtLabel(row: UserRow): string {
  return row.createdAt || row.createTime || '-'
}

async function loadRoles() {
  const res = await roleApi.list()
  roles.value = pickArray(res) as RoleVO[]
}

async function loadDeptTree() {
  const res = await deptApi.tree()
  deptTree.value = pickArray(res) as DeptVO[]
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await userApi.list({
      keyword: keyword.value || undefined,
      page: pager.page,
      size: pager.size
    })
    const list = pickArray(res) as UserRow[]
    users.value = list
    pager.total = pickTotal(res, list.length)
  } catch (error: any) {
    ElMessage.error(error?.message || '用户列表加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pager.page = 1
  void loadUsers()
}

function handleReset() {
  keyword.value = ''
  pager.page = 1
  void loadUsers()
}

function openCreate() {
  createVisible.value = true
  createForm.username = ''
  createForm.password = ''
  createForm.nickname = ''
  createForm.email = ''
  createForm.phone = ''
  createForm.roleId = undefined
  createForm.deptId = undefined
}

async function submitCreate() {
  if (!createFormRef.value) return
  await createFormRef.value.validate()

  submitting.value = true
  try {
    await userApi.create({
      username: createForm.username.trim(),
      password: createForm.password,
      nickname: createForm.nickname || undefined,
      email: createForm.email || undefined,
      phone: createForm.phone || undefined,
      roleId: createForm.roleId,
      deptId: createForm.deptId
    })
    ElMessage.success('用户创建成功')
    createVisible.value = false
    pager.page = 1
    await loadUsers()
  } catch (error: any) {
    ElMessage.error(error?.message || '用户创建失败')
  } finally {
    submitting.value = false
  }
}

function openChangeRole(row: UserRow) {
  changeRoleForm.userId = Number(row.id)
  changeRoleForm.username = row.username
  const roleMatch = roles.value.find((role) => role.code === row.roleCode)
  changeRoleForm.roleId = roleMatch?.id
  changeRoleVisible.value = true
}

async function submitChangeRole() {
  if (!changeRoleFormRef.value) return
  await changeRoleFormRef.value.validate()
  if (!changeRoleForm.roleId) return

  roleSubmitting.value = true
  try {
    await userApi.changeRole(changeRoleForm.userId, changeRoleForm.roleId)
    ElMessage.success('角色变更成功')
    changeRoleVisible.value = false
    await loadUsers()
  } catch (error: any) {
    ElMessage.error(error?.message || '角色变更失败')
  } finally {
    roleSubmitting.value = false
  }
}

async function handleToggleStatus(row: UserRow, nextStatus: number) {
  const status: 0 | 1 = nextStatus === 1 ? 1 : 0
  const previous = row.status
  row.status = status
  try {
    await userApi.toggleStatus(Number(row.id), status)
    ElMessage.success('状态更新成功')
  } catch (error: any) {
    row.status = previous
    ElMessage.error(error?.message || '状态更新失败')
  }
}

async function handleDelete(row: UserRow) {
  try {
    await ElMessageBox.confirm(`确认删除用户「${row.username}」吗？`, '删除确认', {
      type: 'warning'
    })
    await userApi.delete(Number(row.id))
    ElMessage.success('用户删除成功')
    await loadUsers()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '用户删除失败')
    }
  }
}

const roleOptions = computed(() =>
  roles.value.map((item) => ({ label: item.name, value: item.id }))
)

onMounted(async () => {
  await Promise.all([loadRoles(), loadDeptTree()])
  await loadUsers()
})
</script>

<template>
  <ContentWrap
    class="system-management-page"
    title="用户管理"
    message="管理平台账号、角色与启用状态"
  >
    <div class="toolbar">
      <el-form inline>
        <el-form-item label="关键词">
          <el-input
            v-model="keyword"
            placeholder="用户名/昵称/邮箱"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
      </el-form>
      <div class="toolbar-actions">
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button type="success" @click="openCreate">新建用户</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="users" row-key="id" border>
      <el-table-column type="index" label="#" width="56" />
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column prop="nickname" label="昵称" min-width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="phone" label="手机号" min-width="130" />
      <el-table-column label="角色" min-width="120">
        <template #default="{ row }">
          <el-tag>{{ roleLabel(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="部门" min-width="140">
        <template #default="{ row }">{{ deptLabel(row) }}</template>
      </el-table-column>
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
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">{{ createdAtLabel(row) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button type="primary" link @click="openChangeRole(row)">变更角色</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-config-provider :locale="zhCn">
        <el-pagination
          v-model:current-page="pager.page"
          v-model:page-size="pager.size"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pager.total"
          @current-change="loadUsers"
          @size-change="
            () => {
              pager.page = 1
              loadUsers()
            }
          "
        />
      </el-config-provider>
    </div>
  </ContentWrap>

  <el-dialog v-model="createVisible" title="新建用户" width="620px" destroy-on-close>
    <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="90px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="createForm.username" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="密码" prop="password">
            <el-input v-model="createForm.password" type="password" show-password />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="昵称" prop="nickname">
            <el-input v-model="createForm.nickname" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="createForm.phone" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="createForm.email" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="角色" prop="roleId">
            <el-select v-model="createForm.roleId" class="w-full" placeholder="请选择角色">
              <el-option
                v-for="item in roleOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="部门" prop="deptId">
        <el-tree-select
          v-model="createForm.deptId"
          class="w-full"
          :data="deptTree"
          node-key="id"
          :props="{ label: 'deptName', children: 'children', value: 'id' }"
          check-strictly
          default-expand-all
          placeholder="请选择部门"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitCreate">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="changeRoleVisible" title="变更角色" width="420px" destroy-on-close>
    <el-form
      ref="changeRoleFormRef"
      :model="changeRoleForm"
      :rules="changeRoleRules"
      label-width="90px"
    >
      <el-form-item label="用户名">
        <el-input :model-value="changeRoleForm.username" disabled />
      </el-form-item>
      <el-form-item label="角色" prop="roleId">
        <el-select v-model="changeRoleForm.roleId" class="w-full" placeholder="请选择角色">
          <el-option
            v-for="item in roleOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="changeRoleVisible = false">取消</el-button>
      <el-button type="primary" :loading="roleSubmitting" @click="submitChangeRole">确认</el-button>
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
</style>
