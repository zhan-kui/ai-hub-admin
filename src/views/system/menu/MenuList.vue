<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import { menuApi, type MenuVO, type MenuType, type MenuPlatform } from '@/api/frontend-api'

type MenuRow = MenuVO & Record<string, any>

const loading = ref(false)
const submitting = ref(false)

const keyword = ref('')
const platform = ref<MenuPlatform | ''>('pc')
const menuTree = ref<MenuRow[]>([])

const formVisible = ref(false)
const formRef = ref<FormInstance>()
const formMode = ref<'create' | 'edit'>('create')
const formData = reactive({
  id: 0,
  parentId: undefined as number | undefined,
  menuName: '',
  menuType: 'DIR' as MenuType,
  path: '',
  component: '',
  permission: '',
  icon: '',
  sort: 1,
  visible: true,
  status: true,
  platform: 'pc' as MenuPlatform
})

const formRules: FormRules = {
  menuName: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  menuType: [{ required: true, message: '请选择菜单类型', trigger: 'change' }]
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

function ensureTree(list: MenuRow[]): MenuRow[] {
  if (list.some((item) => Array.isArray(item.children) && item.children.length > 0)) {
    return list
  }

  const map = new Map<number, MenuRow>()
  const roots: MenuRow[] = []
  list.forEach((item) => {
    map.set(Number(item.id), { ...item, children: [] })
  })
  map.forEach((item) => {
    const parentId = Number(item.parentId || 0)
    if (parentId > 0 && map.has(parentId)) {
      map.get(parentId)!.children.push(item)
    } else {
      roots.push(item)
    }
  })
  return roots
}

function filterTreeByKeyword(tree: MenuRow[], text: string): MenuRow[] {
  const value = text.trim().toLowerCase()
  if (!value) return tree

  const walk = (nodes: MenuRow[]): MenuRow[] => {
    return nodes
      .map((node) => {
        const children = walk(node.children || [])
        const matched = node.menuName?.toLowerCase?.().includes(value)
        if (matched || children.length > 0) {
          return { ...node, children }
        }
        return null
      })
      .filter((item): item is MenuRow => Boolean(item))
  }
  return walk(tree)
}

async function loadMenus() {
  loading.value = true
  try {
    const res = await menuApi.list(platform.value || undefined)
    const list = ensureTree(pickArray(res) as MenuRow[])
    menuTree.value = filterTreeByKeyword(list, keyword.value)
  } catch (error: any) {
    ElMessage.error(error?.message || '菜单列表加载失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formData.id = 0
  formData.parentId = undefined
  formData.menuName = ''
  formData.menuType = 'DIR'
  formData.path = ''
  formData.component = ''
  formData.permission = ''
  formData.icon = ''
  formData.sort = 1
  formData.visible = true
  formData.status = true
  formData.platform = 'pc'
}

function openCreate(parent?: MenuRow) {
  formMode.value = 'create'
  formVisible.value = true
  resetForm()
  if (parent) {
    formData.parentId = Number(parent.id)
  }
}

function openEdit(row: MenuRow) {
  formMode.value = 'edit'
  formVisible.value = true
  formData.id = Number(row.id)
  formData.parentId = row.parentId > 0 ? Number(row.parentId) : undefined
  formData.menuName = row.menuName || ''
  formData.menuType = row.menuType || 'DIR'
  formData.path = row.path || ''
  formData.component = row.component || ''
  formData.permission = row.permission || ''
  formData.icon = row.icon || ''
  formData.sort = Number(row.sort || 1)
  formData.visible = row.visible !== false
  formData.status = row.status !== false
  formData.platform = row.platform || 'pc'
}

async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate()

  submitting.value = true
  try {
    const payload = {
      parentId: formData.parentId,
      menuName: formData.menuName.trim(),
      menuType: formData.menuType,
      path: formData.menuType === 'BUTTON' ? undefined : formData.path || undefined,
      component: formData.menuType === 'MENU' ? formData.component || undefined : undefined,
      permission: formData.menuType === 'DIR' ? undefined : formData.permission || undefined,
      icon: formData.menuType === 'BUTTON' ? undefined : formData.icon || undefined,
      sort: formData.sort,
      visible: formData.visible,
      status: formData.status,
      platform: formData.platform
    }

    if (formMode.value === 'create') {
      await menuApi.create(payload)
      ElMessage.success('菜单创建成功')
    } else {
      await menuApi.update(formData.id, payload)
      ElMessage.success('菜单更新成功')
    }

    formVisible.value = false
    await loadMenus()
  } catch (error: any) {
    ElMessage.error(error?.message || '菜单保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: MenuRow) {
  try {
    await ElMessageBox.confirm(`确认删除菜单「${row.menuName}」吗？`, '删除确认', {
      type: 'warning'
    })
    await menuApi.delete(Number(row.id))
    ElMessage.success('菜单删除成功')
    await loadMenus()
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '菜单删除失败')
    }
  }
}

function menuTypeTag(type: MenuType): 'success' | 'warning' | 'info' {
  if (type === 'DIR') return 'success'
  if (type === 'MENU') return 'warning'
  return 'info'
}

function menuTypeText(type: MenuType): string {
  if (type === 'DIR') return '目录'
  if (type === 'MENU') return '菜单'
  return '按钮'
}

const parentOptions = computed(() => menuTree.value)
const defaultExpandedRowKeys = computed(() => {
  const keys: string[] = []
  const walk = (nodes: MenuRow[], depth: number) => {
    nodes.forEach((node) => {
      const id = String(node.id ?? '')
      if (id && depth === 1) {
        keys.push(id)
      }
      const children = Array.isArray(node.children) ? (node.children as MenuRow[]) : []
      if (children.length > 0) {
        walk(children, depth + 1)
      }
    })
  }
  walk(menuTree.value, 1)
  return keys
})
const showPath = computed(() => formData.menuType !== 'BUTTON')
const showComponent = computed(() => formData.menuType === 'MENU')
const showPermission = computed(() => formData.menuType !== 'DIR')
const showIcon = computed(() => formData.menuType !== 'BUTTON')

onMounted(() => {
  void loadMenus()
})
</script>

<template>
  <ContentWrap
    class="system-management-page"
    title="菜单管理"
    message="维护导航层级、页面组件与权限标识"
  >
    <div class="toolbar">
      <el-form inline>
        <el-form-item label="关键词">
          <el-input v-model="keyword" placeholder="菜单名称" clearable @keyup.enter="loadMenus" />
        </el-form-item>
        <el-form-item label="平台">
          <el-select v-model="platform" class="platform-select" clearable @change="loadMenus">
            <el-option label="PC 端" value="pc" />
            <el-option label="H5 端" value="h5" />
            <el-option label="全平台" value="all" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="toolbar-actions">
        <el-button @click="loadMenus">查询</el-button>
        <el-button type="success" @click="openCreate()">新建菜单</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="menuTree"
      :row-key="(row: MenuRow) => String(row.id)"
      border
      :expand-row-keys="defaultExpandedRowKeys"
      :tree-props="{ children: 'children' }"
    >
      <el-table-column prop="menuName" label="菜单名称" min-width="180" />
      <el-table-column label="类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="menuTypeTag(row.menuType)">{{ menuTypeText(row.menuType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="icon" label="图标" min-width="90" />
      <el-table-column prop="path" label="路由路径" min-width="140" />
      <el-table-column prop="component" label="组件路径" min-width="170" />
      <el-table-column prop="permission" label="权限标识" min-width="140" />
      <el-table-column prop="platform" label="平台" width="90" align="center" />
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column label="可见" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.visible ? 'success' : 'info'">{{ row.visible ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'">{{
            row.status ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button type="primary" link @click="openCreate(row)">新增子菜单</el-button>
            <el-button type="success" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>
  </ContentWrap>

  <el-dialog
    v-model="formVisible"
    :title="formMode === 'create' ? '新建菜单' : '编辑菜单'"
    width="680px"
    destroy-on-close
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="90px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="父菜单">
            <el-tree-select
              v-model="formData.parentId"
              class="w-full"
              :data="parentOptions"
              node-key="id"
              :props="{ label: 'menuName', children: 'children', value: 'id' }"
              check-strictly
              default-expand-all
              clearable
              placeholder="顶级菜单"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="菜单类型" prop="menuType">
            <el-radio-group v-model="formData.menuType">
              <el-radio-button label="DIR">目录</el-radio-button>
              <el-radio-button label="MENU">菜单</el-radio-button>
              <el-radio-button label="BUTTON">按钮</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="菜单名称" prop="menuName">
            <el-input v-model="formData.menuName" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="排序">
            <el-input-number v-model="formData.sort" class="w-full" :min="1" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row v-if="showPath" :gutter="16">
        <el-col :span="12">
          <el-form-item label="路由路径">
            <el-input v-model="formData.path" />
          </el-form-item>
        </el-col>
        <el-col v-if="showComponent" :span="12">
          <el-form-item label="组件路径">
            <el-input v-model="formData.component" placeholder="如：system/user/UserList" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col v-if="showPermission" :span="12">
          <el-form-item label="权限标识">
            <el-input v-model="formData.permission" />
          </el-form-item>
        </el-col>
        <el-col v-if="showIcon" :span="12">
          <el-form-item label="图标">
            <el-input v-model="formData.icon" placeholder="如：House" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="平台">
            <el-select v-model="formData.platform" class="w-full">
              <el-option label="PC 端" value="pc" />
              <el-option label="H5 端" value="h5" />
              <el-option label="全平台" value="all" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="可见">
            <el-switch v-model="formData.visible" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
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

.platform-select {
  width: 120px;
}
</style>
