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
      <!-- 侧边栏顶部装饰线 -->
      <div class="aside-top-line"></div>

      <div class="layout-logo">
        <div class="logo-icon-wrap">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#38bdf8"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
            <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.5" />
          </svg>
        </div>
        <div class="logo-text-wrap">
          <span class="logo-title">AI Hub</span>
          <span class="logo-badge">ADMIN CONSOLE</span>
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

      <!-- 系统状态（科技感细节） -->
      <div class="sidebar-status">
        <span class="status-indicator"></span>
        <span class="status-label">SYSTEM ONLINE</span>
        <span class="status-version">v1.0.0</span>
      </div>

      <div class="sidebar-footer">
        <el-dropdown trigger="click" @command="handleLogout">
          <div class="user-profile">
            <div class="user-avatar">
              <span class="avatar-text">{{ userInitial }}</span>
              <span class="avatar-online-dot"></span>
            </div>
            <div class="user-info">
              <div class="user-name">{{ displayName }}</div>
              <div class="user-role">管理员</div>
            </div>
            <svg
              class="user-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
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
          <div class="header-breadcrumb">
            <svg
              class="breadcrumb-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span class="header-title">AI Hub 管理后台</span>
          </div>
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

/* ═══════════════════════════════════════════════════
 * Sidebar - 深蓝科技感侧边栏（对齐登录页 brand-side）
 * ═══════════════════════════════════════════════════ */
.layout-aside {
  position: relative;
  background: linear-gradient(180deg, #0c1628 0%, #0f172a 100%);
  display: flex;
  flex-direction: column;
  border-right: none;
  box-shadow: 1px 0 0 rgba(56, 189, 248, 0.08);
  flex-shrink: 0;
}

/* 顶部细线 - 登录页同款青色装饰 */
.aside-top-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(56, 189, 248, 0.4) 20%,
    rgba(56, 189, 248, 0.6) 50%,
    rgba(56, 189, 248, 0.4) 80%,
    transparent 100%
  );
  z-index: 1;
}

/* ── Logo 区 ── */
.layout-logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(56, 189, 248, 0.1);
  flex-shrink: 0;
}

.logo-icon-wrap {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.5));
}

.logo-text-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.logo-title {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1;
  letter-spacing: 0.3px;
}

.logo-badge {
  font-size: 9px;
  font-weight: 600;
  color: #38bdf8;
  letter-spacing: 1.2px;
  line-height: 1;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  text-transform: uppercase;
}

/* ── 菜单滚动区 ── */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
}

.sidebar-menu {
  padding: 12px 8px;
}

/* ── Element Plus 菜单深度覆写 - 科技蓝配色 ── */
.layout-aside :deep(.el-menu) {
  background-color: transparent !important;
  border-right: none !important;
}

.layout-aside :deep(.el-menu-item),
.layout-aside :deep(.el-sub-menu__title) {
  color: #94a3b8;
  height: 42px;
  line-height: 42px;
  border-radius: 6px;
  margin: 2px 0;
  padding-left: 14px !important;
  padding-right: 14px !important;
  transition: all 0.2s ease;
  font-size: 14px;
}

.layout-aside :deep(.el-menu-item:hover),
.layout-aside :deep(.el-sub-menu__title:hover) {
  background-color: rgba(56, 189, 248, 0.08) !important;
  color: #e2e8f0 !important;
}

/* 激活菜单 - 青色高亮 + 左侧指示条 */
.layout-aside :deep(.el-menu-item.is-active) {
  background: linear-gradient(
    90deg,
    rgba(14, 165, 233, 0.18) 0%,
    rgba(14, 165, 233, 0.05) 100%
  ) !important;
  color: #38bdf8 !important;
  font-weight: 600;
  position: relative;
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.15);
}

.layout-aside :deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  background: #38bdf8;
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
}

.layout-aside :deep(.el-sub-menu__icon-arrow) {
  color: #64748b;
}

.layout-aside :deep(.el-menu-item .el-icon),
.layout-aside :deep(.el-sub-menu__title .el-icon) {
  color: inherit;
  font-size: 16px;
}

/* 子菜单背景透明 */
.layout-aside :deep(.el-sub-menu .el-menu) {
  background-color: rgba(0, 0, 0, 0.2) !important;
  border-radius: 6px;
  margin: 2px 0;
}

.layout-aside :deep(.el-sub-menu .el-menu-item) {
  font-size: 13px;
  padding-left: 32px !important;
}

/* ── 系统状态指示器 ── */
.sidebar-status {
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #64748b;
  border-top: 1px solid rgba(56, 189, 248, 0.08);
  flex-shrink: 0;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
  animation: statusPulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

.status-label {
  flex: 1;
  color: #94a3b8;
}

.status-version {
  color: #475569;
}

@keyframes statusPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* ── 用户信息区 ── */
.sidebar-footer {
  border-top: 1px solid rgba(56, 189, 248, 0.08);
  padding: 10px 8px 12px;
  flex-shrink: 0;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.user-profile:hover {
  background: rgba(56, 189, 248, 0.06);
  border-color: rgba(56, 189, 248, 0.15);
}

.user-avatar {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow:
    0 2px 8px rgba(14, 165, 233, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.avatar-text {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.02em;
}

.avatar-online-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  border: 2px solid #0c1628;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.user-role {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
  letter-spacing: 0.02em;
}

.user-chevron {
  width: 14px;
  height: 14px;
  color: #475569;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.user-profile:hover .user-chevron {
  color: #94a3b8;
}

/* ═══════════════════════════════════════════════════
 * Header - 极简浅色 + 青色点缀
 * ═══════════════════════════════════════════════════ */
.layout-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

/* Header 顶部装饰细线 - 与侧边栏顶线呼应 */
.layout-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(14, 165, 233, 0.3) 30%,
    rgba(14, 165, 233, 0.5) 50%,
    rgba(14, 165, 233, 0.3) 70%,
    transparent 100%
  );
}

.header-left {
  display: flex;
  align-items: center;
}

.header-breadcrumb {
  display: flex;
  align-items: center;
  gap: 10px;
}

.breadcrumb-icon {
  width: 16px;
  height: 16px;
  color: #0ea5e9;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.01em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 999px;
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
  color: #047857;
  font-weight: 500;
  letter-spacing: 0.02em;
}

/* ═══════════════════════════════════════════════════
 * Main content - 浅冷灰（slate 系）
 * ═══════════════════════════════════════════════════ */
.layout-main {
  background: #f1f5f9;
  padding: 24px;
  overflow-y: auto;
}
</style>
