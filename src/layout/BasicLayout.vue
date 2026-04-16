<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { MenuVO } from '@/api/frontend-api'
import { usePermissionStore } from '@/store/modules/permission'
import { useUserStore } from '@/store/modules/user'
import { resetRouter } from '@/router'
import SidebarMenuItem from './components/SidebarMenuItem.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const fallbackMenus: MenuVO[] = [
  {
    id: 0,
    parentId: 0,
    menuName: '首页仪表盘',
    menuType: 'MENU',
    path: '/dashboard/home',
    component: 'dashboard/Home',
    permission: 'dashboard:view',
    icon: 'House',
    sort: 0,
    visible: true,
    status: true,
    platform: 'pc',
    createdAt: '',
    children: []
  }
]

const menus = computed(() => {
  const tree = permissionStore.getMenuTree
  return tree.length > 0 ? tree : fallbackMenus
})

const visibleMenus = computed(() =>
  menus.value.filter((menu) => menu.menuType !== 'BUTTON' && menu.visible !== false)
)

const activeMenu = computed(() => route.path)

const displayName = computed(() => userStore.getDisplayName)

async function handleLogout() {
  await userStore.logout()
  permissionStore.resetRoutesState()
  resetRouter()
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<template>
  <el-container class="layout-container">
    <el-aside width="240px" class="layout-aside">
      <div class="layout-logo">AI Hub Admin</div>
      <el-scrollbar>
        <el-menu :default-active="activeMenu" router unique-opened>
          <SidebarMenuItem
            v-for="menu in visibleMenus"
            :key="menu.id"
            :menu="menu"
            parent-path=""
          />
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <span class="layout-title">AI Hub 管理后台</span>
        <el-dropdown trigger="click" @command="handleLogout">
          <span class="layout-user">{{ displayName }}</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-container {
  width: 100%;
  height: 100%;
}

.layout-aside {
  border-right: 1px solid var(--el-border-color-light);
  background: #ffffff;
}

.layout-logo {
  height: 56px;
  line-height: 56px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  border-bottom: 1px solid var(--el-border-color-light);
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-light);
  background: #ffffff;
}

.layout-title {
  font-size: 16px;
  font-weight: 600;
}

.layout-user {
  cursor: pointer;
  color: var(--el-text-color-primary);
}

.layout-main {
  background: #f5f7fa;
}
</style>
