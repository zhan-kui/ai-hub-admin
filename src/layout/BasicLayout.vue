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
const userInitial = computed(() => {
  const name = displayName.value
  return name ? name.charAt(0).toUpperCase() : 'U'
})

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
    <!-- ── Sidebar ── -->
    <el-aside width="220px" class="layout-aside">
      <div class="layout-logo">
        <div class="logo-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"
              fill="url(#lg1)"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="#fff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <defs>
              <linearGradient id="lg1" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#818cf8" />
                <stop offset="100%" stop-color="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="logo-text-wrap">
          <span class="logo-title">AI Hub</span>
          <span class="logo-badge">Admin</span>
        </div>
      </div>

      <el-scrollbar class="sidebar-scroll">
        <el-menu :default-active="activeMenu" router unique-opened class="sidebar-menu">
          <SidebarMenuItem
            v-for="menu in visibleMenus"
            :key="menu.id"
            :menu="menu"
            parent-path=""
          />
        </el-menu>
      </el-scrollbar>

      <div class="sidebar-footer">
        <el-dropdown trigger="click" @command="handleLogout">
          <div class="user-profile">
            <div class="user-avatar">{{ userInitial }}</div>
            <div class="user-info">
              <div class="user-name">{{ displayName }}</div>
              <div class="user-role">管理员</div>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-aside>

    <!-- ── Main container ── -->
    <el-container>
      <el-header class="layout-header" height="56px">
        <div class="header-left">
          <span class="header-title">AI Hub 管理后台</span>
        </div>
        <div class="header-right">
          <div class="header-status">
            <span class="status-dot"></span>
            <span class="status-text">系统运行中</span>
          </div>
        </div>
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

/* ── Sidebar ──────────────────────────────────── */
.layout-aside {
  background: #111827;
  display: flex;
  flex-direction: column;
  border-right: none;
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.layout-logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.logo-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
}

.logo-text-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.logo-title {
  font-size: 15px;
  font-weight: 700;
  color: #f9fafb;
  line-height: 1;
  letter-spacing: 0.2px;
}

.logo-badge {
  font-size: 9px;
  font-weight: 600;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 3px;
  padding: 1px 4px;
  line-height: 1.5;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  width: fit-content;
}

.sidebar-scroll {
  flex: 1;
  min-height: 0;
}

/* Override Element Plus menu for dark sidebar */
.layout-aside :deep(.el-menu) {
  background-color: transparent !important;
  border-right: none !important;
  padding: 8px 0;
}

.layout-aside :deep(.el-menu-item) {
  color: #9ca3af;
  height: 40px;
  line-height: 40px;
  transition: all 0.18s ease;
}

.layout-aside :deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.06) !important;
  color: #e5e7eb;
}

.layout-aside :deep(.el-menu-item.is-active) {
  background-color: rgba(99, 102, 241, 0.14) !important;
  color: #a5b4fc;
  font-weight: 600;
  border-left: 3px solid #6366f1;
}

.layout-aside :deep(.el-sub-menu__title) {
  color: #9ca3af;
  height: 40px;
  line-height: 40px;
  transition: all 0.18s ease;
}

.layout-aside :deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.06) !important;
  color: #e5e7eb;
}

.layout-aside :deep(.el-sub-menu__icon-arrow) {
  color: #4b5563;
}

.layout-aside :deep(.el-menu-item .el-icon),
.layout-aside :deep(.el-sub-menu__title .el-icon) {
  color: inherit;
}

/* Sidebar footer */
.sidebar-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px 8px;
  flex-shrink: 0;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.user-profile:hover {
  background: rgba(255, 255, 255, 0.06);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #e5e7eb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: 11px;
  color: #6b7280;
  margin-top: 1px;
}

/* ── Header ───────────────────────────────────── */
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
  animation: statusPulse 2.5s ease-in-out infinite;
}

.status-text {
  font-size: 12px;
  color: #6b7280;
}

@keyframes statusPulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 3px rgba(16, 185, 129, 0.2);
  }
}

/* ── Main content ─────────────────────────────── */
.layout-main {
  background: #f3f4f8;
  padding: 24px;
  overflow-y: auto;
}
</style>
