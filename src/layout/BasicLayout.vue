<script setup lang="ts">
import { computed, ref } from 'vue'
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

const sidebarCollapsed = ref(false)

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

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

async function handleLogout() {
  await userStore.logout()
  permissionStore.resetRoutesState()
  resetRouter()
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<template>
  <div class="layout-root">
    <!-- ── Sidebar ── -->
    <aside :class="['layout-sidebar', { 'layout-sidebar--collapsed': sidebarCollapsed }]">
      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="sidebar-logo__icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"
              fill="url(#sl1)"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="#fff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <defs>
              <linearGradient id="sl1" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#818cf8" />
                <stop offset="100%" stop-color="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <Transition name="label-fade">
          <div v-if="!sidebarCollapsed" class="sidebar-logo__text">
            <span class="logo-title">AI Hub</span>
            <span class="logo-badge">Admin</span>
          </div>
        </Transition>
      </div>

      <!-- Nav -->
      <el-scrollbar class="sidebar-nav-scroll">
        <nav class="sidebar-nav">
          <el-menu
            :default-active="activeMenu"
            :collapse="sidebarCollapsed"
            :collapse-transition="false"
            router
            unique-opened
            class="sidebar-menu"
          >
            <SidebarMenuItem
              v-for="menu in visibleMenus"
              :key="menu.id"
              :menu="menu"
              parent-path=""
            />
          </el-menu>
        </nav>
      </el-scrollbar>

      <!-- Footer -->
      <div class="sidebar-footer">
        <el-dropdown trigger="click" placement="top-start" @command="handleLogout">
          <div class="user-card">
            <div class="user-avatar">{{ userInitial }}</div>
            <Transition name="label-fade">
              <div v-if="!sidebarCollapsed" class="user-info">
                <div class="user-name">{{ displayName }}</div>
                <div class="user-role">管理员</div>
              </div>
            </Transition>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">
                <el-icon class="mr-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                </el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <!-- ── Main ── -->
    <div class="layout-main-wrap">
      <!-- Header -->
      <header class="layout-header">
        <div class="header-left">
          <button class="collapse-btn" @click="toggleSidebar">
            <svg
              :class="['collapse-icon', { 'collapse-icon--rotated': sidebarCollapsed }]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <!-- Breadcrumb -->
          <el-breadcrumb separator="/" class="header-breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta?.title">
              {{ route.meta.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <div class="header-status">
            <span class="status-dot"></span>
            <span class="status-text">系统运行中</span>
          </div>

          <div class="header-divider"></div>

          <el-dropdown trigger="click" @command="handleLogout">
            <div class="header-user">
              <div class="header-user__avatar">{{ userInitial }}</div>
              <span class="header-user__name">{{ displayName }}</span>
              <el-icon class="header-user__arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- Content -->
      <main class="layout-content">
        <router-view v-slot="{ Component, route: r }">
          <Transition name="page-slide" mode="out-in">
            <component :is="Component" :key="r.fullPath" />
          </Transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── Root ──────────────────────────────────────────────────────── */
.layout-root {
  display: flex;
  width: 100%;
  height: 100%;
  background: #f3f4f8;
}

/* ── Sidebar ───────────────────────────────────────────────────── */
.layout-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #111827;
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.04), 4px 0 16px rgba(0, 0, 0, 0.12);
  transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  z-index: 100;
}

.layout-sidebar--collapsed {
  width: 64px;
}

/* Logo */
.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
  overflow: hidden;
  white-space: nowrap;
}

.sidebar-logo__icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.45);
  transition: box-shadow 0.2s;
}

.sidebar-logo__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.logo-title {
  font-size: 15px;
  font-weight: 700;
  color: #f9fafb;
  line-height: 1;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.logo-badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 3px;
  padding: 1px 5px;
  width: fit-content;
}

/* Nav */
.sidebar-nav-scroll {
  flex: 1;
  min-height: 0;
}

.sidebar-nav {
  padding: 8px 0;
}

/* Override Element Plus menu */
.layout-sidebar :deep(.sidebar-menu) {
  background-color: transparent !important;
  border-right: none !important;
}

.layout-sidebar :deep(.el-menu--collapse) {
  width: 64px !important;
}

.layout-sidebar :deep(.el-menu-item),
.layout-sidebar :deep(.el-sub-menu__title) {
  height: 42px;
  line-height: 42px;
  color: #6b7280 !important;
  border-radius: 6px;
  margin: 1px 8px;
  width: calc(100% - 16px) !important;
  transition: all 0.18s ease !important;
  font-size: 13.5px;
}

.layout-sidebar :deep(.el-menu-item:hover),
.layout-sidebar :deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.06) !important;
  color: #e5e7eb !important;
}

.layout-sidebar :deep(.el-menu-item.is-active) {
  background-color: rgba(99, 102, 241, 0.16) !important;
  color: #a5b4fc !important;
  font-weight: 600;
  position: relative;
}

.layout-sidebar :deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: linear-gradient(180deg, #6366f1, #8b5cf6);
  border-radius: 0 2px 2px 0;
}

.layout-sidebar :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: #a5b4fc !important;
}

.layout-sidebar :deep(.el-sub-menu__icon-arrow) {
  color: #374151 !important;
  transition: transform 0.2s ease;
}

.layout-sidebar :deep(.el-menu .el-menu) {
  background-color: transparent !important;
}

.layout-sidebar :deep(.el-menu .el-menu .el-menu-item) {
  background-color: transparent !important;
  padding-left: 44px !important;
}

.layout-sidebar :deep(.el-menu .el-menu .el-menu-item:not(.is-active)) {
  background-color: transparent !important;
}

/* Collapsed state - center icons */
.layout-sidebar--collapsed :deep(.el-menu-item),
.layout-sidebar--collapsed :deep(.el-sub-menu__title) {
  margin: 1px 6px;
  width: calc(100% - 12px) !important;
  justify-content: center;
  padding: 0 !important;
}

/* Footer */
.sidebar-footer {
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s ease;
  overflow: hidden;
  white-space: nowrap;
}

.user-card:hover {
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
  color: #fff;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #e5e7eb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.user-role {
  font-size: 11px;
  color: #4b5563;
  margin-top: 1px;
}

/* ── Header ────────────────────────────────────────────────────── */
.layout-main-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layout-header {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.18s ease;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.collapse-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.22s ease;
}

.header-breadcrumb :deep(.el-breadcrumb__item) {
  font-size: 13px;
}

.header-breadcrumb :deep(.el-breadcrumb__inner) {
  color: #6b7280;
  font-weight: 400;
}

.header-breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: #374151;
  font-weight: 500;
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
  0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
  50%       { opacity: 0.6; box-shadow: 0 0 3px rgba(16, 185, 129, 0.2); }
}

.header-divider {
  width: 1px;
  height: 18px;
  background: #e5e7eb;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 8px;
  transition: background 0.18s ease;
}

.header-user:hover {
  background: #f3f4f6;
}

.header-user__avatar {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.header-user__name {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-user__arrow {
  font-size: 12px;
  color: #9ca3af;
  width: 14px;
  height: 14px;
}

/* ── Content ───────────────────────────────────────────────────── */
.layout-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #f3f4f8;
}

/* Custom scrollbar */
.layout-content::-webkit-scrollbar {
  width: 6px;
}

.layout-content::-webkit-scrollbar-track {
  background: transparent;
}

.layout-content::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.layout-content::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* ── Page transition ───────────────────────────────────────────── */
.page-slide-enter-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-slide-leave-active {
  transition: opacity 0.14s ease, transform 0.14s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Sidebar label fade transition ────────────────────────────── */
.label-fade-enter-active {
  transition: opacity 0.18s ease 0.05s, transform 0.18s ease 0.05s;
}

.label-fade-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.label-fade-enter-from,
.label-fade-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}
</style>
