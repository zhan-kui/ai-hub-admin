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
const userMenuOpen = ref(false)

function closeUserMenu() {
  userMenuOpen.value = false
}

function handleProfile() {
  closeUserMenu()
  // 如果项目已有个人信息路由，可将这里替换为对应路径。
  router.push('/profile').catch(() => {
    ElMessage.info('个人信息功能待接入')
  })
}

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
  closeUserMenu()
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
    <el-aside width="248px" class="layout-aside">
      <div class="layout-logo">
        <div class="logo-icon-wrap">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
            <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.4" />
          </svg>
        </div>
        <span class="logo-title">AI Hub</span>
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

      <div class="sidebar-footer">
        <el-popover
          v-model:visible="userMenuOpen"
          trigger="click"
          placement="top-start"
          popper-class="layout-user-popover"
          :width="208"
          :show-arrow="false"
          :offset="8"
        >
          <template #reference>
            <button
              type="button"
              class="user-profile"
              :class="{ 'is-open': userMenuOpen }"
              aria-label="打开用户菜单"
            >
              <div class="user-avatar">
                <span class="avatar-text">{{ userInitial }}</span>
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
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </template>

          <div class="user-menu-panel">
            <button type="button" class="user-menu-item" @click="handleProfile">
              <span class="user-menu-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span>修改个人信息</span>
            </button>

            <button type="button" class="user-menu-item is-danger" @click="handleLogout">
              <span class="user-menu-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </span>
              <span>退出登录</span>
            </button>
          </div>
        </el-popover>
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
            <div class="route-spinner"></div>
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.layout-container {
  --app-bg: #eef6fb;
  --app-bg-soft: #f7fbfe;
  --panel-bg: rgb(255 255 255 / 76%);
  --panel-bg-solid: #fff;
  --panel-border: rgb(125 166 189 / 24%);
  --brand: #0ea5e9;
  --brand-strong: #0284c7;
  --brand-soft: rgb(14 165 233 / 12%);
  --brand-softer: rgb(14 165 233 / 7%);
  --mint: #22c55e;
  --text-main: #102033;
  --text-secondary: #52677a;
  --text-muted: #8aa0b3;
  --shadow-soft: 0 18px 45px rgb(15 96 137 / 10%);
  --shadow-hover: 0 12px 26px rgb(14 116 144 / 16%);

  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--text-main);
  background: radial-gradient(circle at 0% 0%, rgb(14 165 233 / 14%) 0, transparent 34%),
    radial-gradient(circle at 100% 100%, rgb(34 197 94 / 10%) 0, transparent 30%),
    linear-gradient(135deg, #edf7fc 0%, #f8fbff 48%, #edf8f7 100%);
}

/* ═══════════════════════════════════════════════════
 * Sidebar - 与内容区融合的雾蓝玻璃侧栏
 * ═══════════════════════════════════════════════════ */
.layout-aside {
  position: relative;
  display: flex;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(255 255 255 / 86%) 0%, rgb(239 248 252 / 84%) 100%),
    radial-gradient(circle at 24px 20px, rgb(14 165 233 / 16%), transparent 36%);
  border-right: 1px solid var(--panel-border);
  box-shadow: 12px 0 32px rgb(14 116 144 / 7%);
  backdrop-filter: blur(18px);
  flex-direction: column;
  flex-shrink: 0;
}

.layout-aside::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, rgb(255 255 255 / 52%), transparent 30%),
    radial-gradient(circle at 20% 10%, rgb(14 165 233 / 10%), transparent 32%);
  content: '';
}

.layout-aside > * {
  position: relative;
  z-index: 1;
}

/* ── Logo 区 ── */
.layout-logo {
  display: flex;
  height: 68px;
  padding: 0 20px;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.logo-icon-wrap {
  display: flex;
  width: 36px;
  height: 36px;
  color: #f0f9ff;
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 52%, #22d3ee 100%);
  border: 1px solid rgb(255 255 255 / 56%);
  border-radius: 13px;
  box-shadow:
    0 10px 22px rgb(14 165 233 / 24%),
    inset 0 1px 0 rgb(255 255 255 / 32%);
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-icon-wrap svg {
  stroke: currentcolor;
  filter: drop-shadow(0 2px 5px rgb(2 132 199 / 28%));
}

.logo-title {
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--text-main);
}

/* ── 菜单滚动区 ── */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
}

.sidebar-menu {
  padding: 8px 12px 14px;
}

/* ── Element Plus 菜单深度覆写 ── */
.layout-aside :deep(.el-menu) {
  background-color: transparent !important;
  border-right: none !important;
}

.layout-aside :deep(.el-menu-item),
.layout-aside :deep(.el-sub-menu__title) {
  position: relative;
  height: 42px;
  padding-right: 13px !important;
  padding-left: 13px !important;
  margin: 3px 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 520;
  line-height: 42px;
  color: var(--text-secondary);
  border: 1px solid transparent;
  border-radius: 12px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.layout-aside :deep(.el-menu-item::before),
.layout-aside :deep(.el-sub-menu__title::before) {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  background: transparent;
  border-radius: 0 999px 999px 0;
  content: '';
  transition: background-color 0.18s ease;
}

.layout-aside :deep(.el-menu-item:hover),
.layout-aside :deep(.el-sub-menu__title:hover) {
  color: var(--brand-strong) !important;
  background: rgb(255 255 255 / 72%) !important;
  border-color: rgb(14 165 233 / 16%);
  transform: translateX(2px);
  box-shadow: 0 8px 22px rgb(14 116 144 / 9%);
}

.layout-aside :deep(.el-menu-item:hover::before),
.layout-aside :deep(.el-sub-menu__title:hover::before) {
  background: rgb(14 165 233 / 45%);
}

/* 激活菜单 - 与内容区同色系 */
.layout-aside :deep(.el-menu-item.is-active) {
  font-weight: 700;
  color: #075985 !important;
  background: linear-gradient(
    90deg,
    rgb(14 165 233 / 17%) 0%,
    rgb(34 211 238 / 8%) 100%
  ) !important;
  border-color: rgb(14 165 233 / 26%);
  box-shadow:
    0 10px 24px rgb(14 165 233 / 14%),
    inset 0 1px 0 rgb(255 255 255 / 62%);
}

.layout-aside :deep(.el-menu-item.is-active::before) {
  background: linear-gradient(180deg, #0284c7, #22d3ee);
  box-shadow: 0 0 10px rgb(14 165 233 / 52%);
}

.layout-aside :deep(.el-sub-menu__icon-arrow) {
  color: #8bb6ca;
}

.layout-aside :deep(.el-menu-item .el-icon),
.layout-aside :deep(.el-sub-menu__title .el-icon) {
  font-size: 17px;
  color: inherit;
}

/* 子菜单 */
.layout-aside :deep(.el-sub-menu .el-menu) {
  padding: 2px 0 4px;
  background-color: transparent !important;
}

.layout-aside :deep(.el-sub-menu .el-menu-item) {
  height: 38px;
  padding-left: 40px !important;
  font-size: 13px;
  line-height: 38px;
}

/* ── 用户信息区 ── */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgb(125 166 189 / 22%);
  flex-shrink: 0;
}

.user-profile {
  display: flex;
  padding: 10px;
  cursor: pointer;
  background: rgb(255 255 255 / 58%);
  border: 1px solid rgb(125 166 189 / 18%);
  border-radius: 14px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  align-items: center;
  gap: 10px;
}

.user-profile:hover {
  background: rgb(255 255 255 / 88%);
  border-color: rgb(14 165 233 / 24%);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgb(14 116 144 / 10%);
}

.user-avatar {
  display: flex;
  width: 34px;
  height: 34px;
  color: #f0f9ff;
  background: linear-gradient(135deg, #075985 0%, #0ea5e9 58%, #2dd4bf 100%);
  border-radius: 12px;
  box-shadow: 0 8px 18px rgb(14 165 233 / 22%);
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 13px;
  font-weight: 700;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.user-chevron {
  width: 14px;
  height: 14px;
  color: #8bb6ca;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════════
 * Main content - 与侧边栏统一的柔和工作区
 * ═══════════════════════════════════════════════════ */
.layout-main {
  position: relative;
  padding: 24px 28px;
  overflow-y: auto;
  background: radial-gradient(circle at 8% 0%, rgb(14 165 233 / 10%) 0, transparent 32%),
    radial-gradient(circle at 92% 8%, rgb(45 212 191 / 8%) 0, transparent 28%),
    linear-gradient(135deg, #f4fbff 0%, #f8fbff 48%, #f0faf8 100%);
}

.layout-main.is-switching {
  cursor: progress;
}

.route-page-shell {
  width: 100%;
  min-height: 100%;
}

.route-loading-bar {
  position: sticky;
  top: -24px;
  left: 0;
  z-index: 20;
  width: 100%;
  height: 3px;
  overflow: hidden;
  background: rgb(14 165 233 / 8%);
  border-radius: 999px;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.route-loading-bar::before {
  display: block;
  width: 38%;
  height: 100%;
  background: linear-gradient(90deg, #0284c7, #22d3ee, #2dd4bf);
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
  pointer-events: none;
  background: rgb(248 251 255 / 72%);
  border: 1px solid rgb(125 166 189 / 18%);
  border-radius: 22px;
  inset: 24px 28px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  backdrop-filter: blur(8px);
}

.route-switch-mask span {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.route-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgb(14 165 233 / 16%);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.route-mask-enter-active,
.route-mask-leave-active {
  transition: opacity 0.18s ease;
}

.route-mask-enter-from,
.route-mask-leave-to {
  opacity: 0;
}

/* ═══════════════════════════════════════════════════
 * Enterprise Scheme A - 企业级蓝灰主题（克制版）
 * 目标：侧栏与内容区连续，不产生割裂；少渐变、少阴影、强调可读性。
 * ═══════════════════════════════════════════════════ */
.layout-container {
  --app-bg: #f5f7fb;
  --sidebar-bg: #f8faff;
  --sidebar-border: #e4eaf3;
  --primary: #2563eb;
  --primary-strong: #1d4ed8;
  --primary-soft: #eaf1ff;
  --primary-softer: #f2f6ff;
  --text-main: #1f2937;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --card-bg: #fff;
  --card-border: #e5eaf2;

  color: var(--text-main);
  background: var(--app-bg);
}

.layout-aside {
  overflow: hidden;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  box-shadow: none;
  backdrop-filter: none;
}

.layout-aside::before {
  display: none;
}

.layout-logo {
  height: 64px;
  padding: 0 18px;
  border-bottom: 1px solid #edf1f7;
}

.logo-icon-wrap {
  width: 34px;
  height: 34px;
  color: #fff;
  background: #2563eb;
  border: none;
  border-radius: 10px;
  box-shadow: 0 8px 16px rgb(37 99 235 / 16%);
}

.logo-icon-wrap svg {
  filter: none;
}

.logo-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.sidebar-menu {
  padding: 10px 10px 14px;
}

.layout-aside :deep(.el-menu-item),
.layout-aside :deep(.el-sub-menu__title) {
  height: 40px;
  padding-right: 12px !important;
  padding-left: 13px !important;
  margin: 2px 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 40px;
  color: var(--text-secondary);
  background: transparent !important;
  border: 1px solid transparent;
  border-radius: 10px;
  transform: none;
  box-shadow: none;
}

.layout-aside :deep(.el-menu-item::before),
.layout-aside :deep(.el-sub-menu__title::before) {
  top: 9px;
  bottom: 9px;
  left: 0;
  width: 3px;
  border-radius: 0 999px 999px 0;
}

.layout-aside :deep(.el-menu-item:hover),
.layout-aside :deep(.el-sub-menu__title:hover) {
  color: var(--primary-strong) !important;
  background: var(--primary-softer) !important;
  border-color: #e1e9fb;
  transform: none;
  box-shadow: none;
}

.layout-aside :deep(.el-menu-item:hover::before),
.layout-aside :deep(.el-sub-menu__title:hover::before) {
  background: #93b4f6;
}

.layout-aside :deep(.el-menu-item.is-active) {
  font-weight: 700;
  color: var(--primary-strong) !important;
  background: var(--primary-soft) !important;
  border-color: #d8e5ff;
  box-shadow: none;
}

.layout-aside :deep(.el-menu-item.is-active::before) {
  background: var(--primary);
  box-shadow: none;
}

.layout-aside :deep(.el-sub-menu__icon-arrow) {
  color: #94a3b8;
}

.layout-aside :deep(.el-sub-menu .el-menu-item) {
  padding-left: 38px !important;
}

.sidebar-footer {
  padding: 10px;
  background: var(--sidebar-bg);
  border-top: 1px solid #edf1f7;
}

.user-profile {
  padding: 9px 10px;
  background: #fff;
  border: 1px solid #e5eaf2;
  border-radius: 12px;
  transform: none;
  box-shadow: none;
}

.user-profile:hover {
  background: #f2f6ff;
  border-color: #d8e5ff;
  transform: none;
  box-shadow: none;
}

.user-avatar {
  width: 32px;
  height: 32px;
  color: #fff;
  background: #2563eb;
  border-radius: 10px;
  box-shadow: none;
}

.user-name {
  color: var(--text-main);
}

.user-role,
.user-chevron {
  color: var(--text-muted);
}

.layout-main {
  position: relative;
  padding: 0;
  overflow-y: auto;
  background: var(--app-bg);
}

.layout-main::before {
  position: sticky;
  top: 0;
  z-index: 5;
  display: block;
  height: 1px;
  margin-bottom: -1px;
  background: #e4eaf3;
  content: '';
}

.route-page-shell {
  width: 100%;
  min-height: 100%;
}

.route-loading-bar {
  top: 0;
  height: 2px;
  background: #eaf1ff;
  border-radius: 0;
}

.route-loading-bar::before {
  background: #2563eb;
  border-radius: 0;
}

.route-switch-mask {
  inset: 0;
  background: rgb(245 247 251 / 72%);
  border: none;
  border-radius: 0;
  backdrop-filter: blur(2px);
}

.route-spinner {
  border-color: #dbe5f5;
  border-top-color: var(--primary);
}

/* ═══════════════════════════════════════════════════
 * User profile menu - quiet native sidebar block
 * ═══════════════════════════════════════════════════ */
.sidebar-footer {
  padding: 8px 10px 12px;
  background: var(--sidebar-bg);
  border-top: 1px solid #edf1f7;
}

.sidebar-footer :deep(.el-popover__reference-wrapper) {
  display: block;
  width: 100%;
}

.user-profile {
  width: 100%;
  min-height: 50px;
  padding: 8px 9px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  transform: none;
  box-shadow: none;
  appearance: none;
}

.user-profile:hover,
.user-profile.is-open {
  background: rgb(255 255 255 / 54%);
  border-color: #dbe6f6;
  transform: none;
  box-shadow: 0 8px 20px rgb(15 23 42 / 7%);
}

.user-profile.is-open .user-chevron {
  color: var(--primary);
  transform: rotate(180deg);
}

.user-avatar {
  width: 32px;
  height: 32px;
  color: #fff;
  background: var(--primary);
  border-radius: 10px;
  box-shadow: none;
}

.user-name {
  color: var(--text-main);
}

.user-role,
.user-chevron {
  color: var(--text-muted);
}

.user-chevron {
  transition:
    color 0.18s ease,
    transform 0.18s ease;
}

:global(.layout-user-popover) {
  padding: 6px !important;
  background: #fff !important;
  border: 1px solid #dbe5f4 !important;
  border-radius: 14px !important;
  box-shadow:
    0 18px 40px rgb(15 23 42 / 12%),
    0 4px 12px rgb(15 23 42 / 7%) !important;
}

.user-menu-panel {
  display: grid;
  gap: 4px;
  font-family: inherit;
}

.user-menu-item {
  display: flex;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 10px;
  align-items: center;
  gap: 10px;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.user-menu-item:hover {
  color: var(--primary-strong);
  background: var(--primary-softer);
}

.user-menu-item.is-danger {
  color: #dc2626;
}

.user-menu-item.is-danger:hover {
  color: #b91c1c;
  background: #fef2f2;
}

.user-menu-icon {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  flex-shrink: 0;
}

.user-menu-icon svg {
  width: 17px;
  height: 17px;
}
</style>
