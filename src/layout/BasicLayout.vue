<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
const pageSwitching = ref(false)
let pageSwitchTimer: number | undefined

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

function finishPageSwitch() {
  window.clearTimeout(pageSwitchTimer)
  pageSwitchTimer = window.setTimeout(() => {
    pageSwitching.value = false
  }, 260)
}

function handleMenuSelect(index: string) {
  if (!index || index === route.path || /^https?:\/\//.test(index)) return
  pageSwitching.value = true
  window.clearTimeout(pageSwitchTimer)
  pageSwitchTimer = window.setTimeout(() => {
    pageSwitching.value = false
  }, 4200)
}

watch(
  () => route.fullPath,
  () => {
    if (pageSwitching.value) {
      finishPageSwitch()
    }
  }
)

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
        <el-menu
          :default-active="activeMenu"
          router
          unique-opened
          class="sidebar-menu"
          @select="handleMenuSelect"
        >
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
      <el-main class="layout-main" :class="{ 'is-switching': pageSwitching }">
        <div class="route-loading-bar" :class="{ 'is-active': pageSwitching }"></div>
        <router-view v-slot="{ Component, route: currentRoute }">
          <Transition name="page-fade" mode="out-in">
            <div :key="currentRoute.fullPath" class="route-page-shell">
              <component :is="Component" />
            </div>
          </Transition>
        </router-view>
        <Transition name="route-mask">
          <div v-if="pageSwitching" class="route-switch-mask">
            <div class="route-spinner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
                <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.45" />
              </svg>
            </div>
            <span>页面加载中</span>
          </div>
        </Transition>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
@keyframes routeLoading {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(270%);
  }
}

@keyframes routeSpin {
  0% {
    transform: rotate(0deg) scale(1);
  }

  60% {
    transform: rotate(230deg) scale(1.05);
  }

  100% {
    transform: rotate(360deg) scale(1);
  }
}

.layout-container {
  width: 100%;
  height: 100%;
}

/* ═══════════════════════════════════════════════════
 * Sidebar - 深蓝科技感侧边栏（对齐登录页 brand-side）
 * ═══════════════════════════════════════════════════ */
.layout-aside {
  position: relative;
  display: flex;
  background: linear-gradient(180deg, #0c1628 0%, #0f172a 100%);
  border-right: none;
  box-shadow: 1px 0 0 rgb(56 189 248 / 8%);
  flex-direction: column;
  flex-shrink: 0;
}

/* 顶部细线 - 登录页同款青色装饰 */
.aside-top-line {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgb(56 189 248 / 40%) 20%,
    rgb(56 189 248 / 60%) 50%,
    rgb(56 189 248 / 40%) 80%,
    transparent 100%
  );
}

/* ── Logo 区 ── */
.layout-logo {
  display: flex;
  height: 60px;
  padding: 0 18px;
  border-bottom: 1px solid rgb(56 189 248 / 10%);
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.logo-icon-wrap {
  display: flex;
  width: 34px;
  height: 34px;
  filter: drop-shadow(0 0 8px rgb(56 189 248 / 50%));
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
  line-height: 1;
  letter-spacing: 0.3px;
  color: #f1f5f9;
}

.logo-badge {
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 1.2px;
  color: #38bdf8;
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
  height: 42px;
  padding-right: 14px !important;
  padding-left: 14px !important;
  margin: 2px 0;
  font-size: 14px;
  line-height: 42px;
  color: #94a3b8;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.layout-aside :deep(.el-menu-item:hover),
.layout-aside :deep(.el-sub-menu__title:hover) {
  color: #e2e8f0 !important;
  background-color: rgb(56 189 248 / 8%) !important;
}

/* 激活菜单 - 青色高亮 + 左侧指示条 */
.layout-aside :deep(.el-menu-item.is-active) {
  position: relative;
  font-weight: 600;
  color: #38bdf8 !important;
  background: linear-gradient(
    90deg,
    rgb(14 165 233 / 18%) 0%,
    rgb(14 165 233 / 5%) 100%
  ) !important;
  box-shadow: inset 0 0 0 1px rgb(56 189 248 / 15%);
}

.layout-aside :deep(.el-menu-item.is-active)::before {
  position: absolute;
  top: 20%;
  bottom: 20%;
  left: 0;
  width: 3px;
  background: #38bdf8;
  border-radius: 0 2px 2px 0;
  content: '';
  box-shadow: 0 0 8px rgb(56 189 248 / 60%);
}

.layout-aside :deep(.el-sub-menu__icon-arrow) {
  color: #64748b;
}

.layout-aside :deep(.el-menu-item .el-icon),
.layout-aside :deep(.el-sub-menu__title .el-icon) {
  font-size: 16px;
  color: inherit;
}

/* 子菜单背景透明 */
.layout-aside :deep(.el-sub-menu .el-menu) {
  margin: 2px 0;
  background-color: rgb(0 0 0 / 20%) !important;
  border-radius: 6px;
}

.layout-aside :deep(.el-sub-menu .el-menu-item) {
  padding-left: 32px !important;
  font-size: 13px;
}

/* ── 系统状态指示器 ── */
.sidebar-status {
  display: flex;
  padding: 10px 18px;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #64748b;
  border-top: 1px solid rgb(56 189 248 / 8%);
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-indicator {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
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

/* ── 用户信息区 ── */
.sidebar-footer {
  padding: 10px 8px 12px;
  border-top: 1px solid rgb(56 189 248 / 8%);
  flex-shrink: 0;
}

.user-profile {
  display: flex;
  padding: 8px 10px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s ease;
  align-items: center;
  gap: 10px;
}

.user-profile:hover {
  background: rgb(56 189 248 / 6%);
  border-color: rgb(56 189 248 / 15%);
}

.user-avatar {
  position: relative;
  display: flex;
  width: 34px;
  height: 34px;
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%);
  border-radius: 8px;
  box-shadow:
    0 2px 8px rgb(14 165 233 / 35%),
    inset 0 1px 0 rgb(255 255 255 / 20%);
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
}

.avatar-online-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 10px;
  height: 10px;
  background: #10b981;
  border: 2px solid #0c1628;
  border-radius: 50%;
  box-shadow: 0 0 6px rgb(16 185 129 / 60%);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: #e2e8f0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  margin-top: 2px;
  font-size: 11px;
  letter-spacing: 0.02em;
  color: #64748b;
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
 * Main content - 浅冷灰（slate 系）
 * ═══════════════════════════════════════════════════ */
.layout-main {
  position: relative;
  padding: 24px;
  overflow-y: auto;
  background: #f1f5f9;
}

.layout-main.is-switching {
  cursor: progress;
}

.route-page-shell {
  width: 100%;
}

.route-loading-bar {
  position: sticky;
  top: -24px;
  left: 0;
  z-index: 20;
  width: 100%;
  height: 3px;
  overflow: hidden;
  background: rgb(14 165 233 / 12%);
  border-radius: 999px;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.route-loading-bar::before {
  display: block;
  width: 38%;
  height: 100%;
  background: linear-gradient(90deg, transparent, #0ea5e9, #67e8f9);
  border-radius: inherit;
  content: '';
  transform: translateX(-120%);
}

.route-loading-bar.is-active {
  opacity: 1;
}

.route-loading-bar.is-active::before {
  animation: routeLoading 0.95s ease-in-out infinite;
}

.route-switch-mask {
  position: absolute;
  z-index: 15;
  display: flex;
  color: #0f172a;
  pointer-events: none;
  background: rgb(241 245 249 / 68%);
  border-radius: 10px;
  inset: 24px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  backdrop-filter: blur(6px);
}

.route-switch-mask span {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.route-spinner {
  width: 24px;
  height: 24px;
  color: #0ea5e9;
  filter: drop-shadow(0 0 8px rgb(14 165 233 / 35%));
  animation: routeSpin 0.95s cubic-bezier(0.45, 0, 0.25, 1) infinite;
}

.route-spinner svg {
  width: 100%;
  height: 100%;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease,
    filter 0.22s ease;
}

.page-fade-enter-from {
  opacity: 0;
  filter: blur(2px);
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
  filter: blur(2px);
  transform: translateY(-6px);
}

.route-mask-enter-active,
.route-mask-leave-active {
  transition: opacity 0.18s ease;
}

.route-mask-enter-from,
.route-mask-leave-to {
  opacity: 0;
}
</style>
