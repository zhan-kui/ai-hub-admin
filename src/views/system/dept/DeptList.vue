<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import { deptApi, roleApi, type DeptVO, type RoleVO } from '@/api/frontend-api'

type DeptRow = DeptVO & Record<string, any>

const loading = ref(false)
const submitting = ref(false)
const roleSubmitting = ref(false)

const keyword = ref('')
const deptTree = ref<DeptRow[]>([])
const roles = ref<RoleVO[]>([])

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const formMode = ref<'create' | 'edit'>('create')
const formData = reactive({
  id: 0,
  parentId: undefined as number | undefined,
  deptName: '',
  sort: 1,
  leader: '',
  phone: '',
  email: '',
  defaultRoleId: undefined as number | undefined,
  status: true
})

const formRules: FormRules = {
  deptName: [{ required: true, message: '请输入部门名称', trigger: 'blur' }]
}

const bindRoleVisible = ref(false)
const bindRoleDept = ref<DeptRow | null>(null)
const bindRoleIds = ref<number[]>([])

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

function filterTreeByKeyword(tree: DeptRow[], text: string): DeptRow[] {
  const value = text.trim().toLowerCase()
  if (!value) return tree

  const walk = (nodes: DeptRow[]): DeptRow[] => {
    return nodes
      .map((node) => {
        const children = walk(node.children || [])
        const matched = node.deptName?.toLowerCase?.().includes(value)
        if (matched || children.length > 0) {
          return { ...node, children }
        }
        return null
      })
      .filter((item): item is DeptRow => Boolean(item))
  }
  return walk(tree)
}

async function loadRoles() {
  const res = await roleApi.list()
  roles.value = pickArray(res) as RoleVO[]
}

async function loadDeptTree() {
  loading.value = true
  try {
    const res = await deptApi.tree()
    const list = pickArray(res) as DeptRow[]
    deptTree.value = filterTreeByKeyword(list, keyword.value)
  } catch (error: any) {
    ElMessage.error(error?.message || '部门列表加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate(parent?: DeptRow) {
  formMode.value = 'create'
  formVisible.value = true
  formData.id = 0
  formData.parentId = parent ? Number(parent.id) : undefined
  formData.deptName = ''
  formData.sort = 1
  formData.leader = ''
  formData.phone = ''
  formData.email = ''
  formData.defaultRoleId = undefined
  formData.status = true
}

function openEdit(row: DeptRow) {
  formMode.value = 'edit'
  formVisible.value = true
  formData.id = Number(row.id)
  formData.parentId = Number(row.parentId || 0) > 0 ? Number(row.parentId) : undefined
  formData.deptName = row.deptName || ''
  formData.sort = Number(row.sort || 1)
  formData.leader = row.leader || ''
  formData.phone = row.phone || ''
  formData.email = row.email || ''
  formData.defaultRoleId = row.defaultRoleId ? Number(row.defaultRoleId) : undefined
  formData.status = row.status !== false
}

async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate()

  submitting.value = true
  try {
    const payload = {
      parentId: formData.parentId,
      deptName: formData.deptName.trim(),
      sort: formData.sort,
      leader: formData.leader || undefined,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      defaultRoleId: formData.defaultRoleId,
      status: formData.status
    }
    if (formMode.value === 'create') {
      await deptApi.create(payload)
      ElMessage.success('部门创建成功')
    } else {
      await deptApi.update(formData.id, payload)
      ElMessage.success('部门更新成功')
    }
    formVisible.value = false
    await loadDeptTree()
  } catch (error: any) {
    ElMessage.error(error?.message || '部门保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: DeptRow) {
  try {
    await ElMessageBox.confirm(`确认删除部门「${row.deptName}」吗？`, '删除确认', {
      type: 'warning'
    })
    await deptApi.delete(Number(row.id))
    ElMessage.success('部门删除成功')
    await loadDeptTree()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '部门删除失败')
    }
  }
}

async function openBindRole(row: DeptRow) {
  bindRoleDept.value = row
  bindRoleVisible.value = true
  try {
    const res = await deptApi.getDeptRoleIds(Number(row.id))
    bindRoleIds.value = pickArray(res).map((id) => Number(id))
  } catch (error: any) {
    ElMessage.error(error?.message || '部门角色加载失败')
  }
}

async function submitBindRole() {
  if (!bindRoleDept.value) return
  roleSubmitting.value = true
  try {
    await deptApi.assignDeptRoles(Number(bindRoleDept.value.id), {
      roleIds: bindRoleIds.value
    })
    ElMessage.success('角色绑定成功')
    bindRoleVisible.value = false
    await loadDeptTree()
  } catch (error: any) {
    ElMessage.error(error?.message || '角色绑定失败')
  } finally {
    roleSubmitting.value = false
  }
}

function statusText(value: boolean): string {
  return value ? '启用' : '禁用'
}

const parentOptions = computed(() => deptTree.value)
const roleOptions = computed(() =>
  roles.value.map((item) => ({ label: item.name, value: item.id }))
)

onMounted(async () => {
  await loadRoles()
  await loadDeptTree()
})
</script>

<template>
  <ContentWrap title="部门管理">
    <div class="toolbar">
      <el-form inline>
        <el-form-item label="关键词">
          <el-input
            v-model="keyword"
            placeholder="部门名称"
            clearable
            @keyup.enter="loadDeptTree"
          />
        </el-form-item>
      </el-form>
      <div class="toolbar-actions">
        <el-button @click="loadDeptTree">查询</el-button>
        <el-button type="success" @click="openCreate()">新建部门</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="deptTree"
      row-key="id"
      border
      default-expand-all
      :tree-props="{ children: 'children' }"
    >
      <el-table-column prop="deptName" label="部门名称" min-width="180" />
      <el-table-column prop="leader" label="负责人" min-width="120" />
      <el-table-column prop="phone" label="电话" min-width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="defaultRoleName" label="默认角色" min-width="120" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button type="primary" link @click="openCreate(row)">新增子部门</el-button>
            <el-button type="success" link @click="openEdit(row)">编辑</el-button>
            <el-button type="warning" link @click="openBindRole(row)">绑定角色</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <el-dialog
    v-model="formVisible"
    :title="formMode === 'create' ? '新建部门' : '编辑部门'"
    width="680px"
    destroy-on-close
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="92px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="父部门">
            <el-tree-select
              v-model="formData.parentId"
              class="w-full"
              :data="parentOptions"
              node-key="id"
              :props="{ label: 'deptName', children: 'children', value: 'id' }"
              check-strictly
              default-expand-all
              clearable
              placeholder="顶级部门"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="部门名称" prop="deptName">
            <el-input v-model="formData.deptName" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="负责人">
            <el-input v-model="formData.leader" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="排序">
            <el-input-number v-model="formData.sort" class="w-full" :min="1" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="电话">
            <el-input v-model="formData.phone" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="邮箱">
            <el-input v-model="formData.email" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="默认角色">
            <el-select v-model="formData.defaultRoleId" class="w-full" clearable>
              <el-option
                v-for="item in roleOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态">
            <el-switch v-model="formData.status" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="bindRoleVisible"
    :title="`绑定角色 - ${bindRoleDept?.deptName || ''}`"
    width="560px"
    destroy-on-close
  >
    <el-checkbox-group v-model="bindRoleIds" class="bind-role-group">
      <el-checkbox v-for="item in roleOptions" :key="item.value" :label="item.value">
        {{ item.label }}
      </el-checkbox>
    </el-checkbox-group>
    <template #footer>
      <el-button @click="bindRoleVisible = false">取消</el-button>
      <el-button type="primary" :loading="roleSubmitting" @click="submitBindRole">保存</el-button>
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

.bind-role-group {
  display: grid;
  max-height: 320px;
  padding: 12px;
  overflow: auto;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px 14px;
}
</style>
