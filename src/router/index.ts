import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { usePermissionStoreWithOut } from '@/store/modules/permission'

export const ROOT_LAYOUT_NAME = 'RootLayout'

const staticRoutes: RouteRecordRaw[] = [
  // ─────────────────────────────────────
  // 鉴权 / 错误页
  // ─────────────────────────────────────
  {
    path: '/login',
    component: () => import('@/views/Login/index.vue'),
    meta: { hidden: true, requiresAuth: false }
  },
  {
    path: '/404',
    component: () => import('@/views/Error/NotFound.vue'),
    meta: { hidden: true, requiresAuth: false }
  },
  {
    path: '/redirect/:path(.*)',
    component: () => import('@/views/Redirect/index.vue'),
    meta: { hidden: true, requiresAuth: false }
  },

  // ─────────────────────────────────────
  // 全屏布局页 (不走 BasicLayout)
  // ─────────────────────────────────────
  // 多智能体协作 - 全屏聊天 (菜单 id=23, 配合 sys_menu 的 visible 控制入口)
  {
    path: '/chat',
    component: () => import('@/views/ai/chat/ChatLayout.vue'),
    meta: { hidden: true, requiresAuth: true }
  },
  // 智能体内聊天（独立全屏页）
  {
    path: '/agent-chat',
    component: () => import('@/views/ai/agent/AgentChat.vue'),
    meta: { hidden: true, requiresAuth: true }
  },

  // ─────────────────────────────────────
  // 智能体业务路由（新路径）
  // ─────────────────────────────────────
  {
    path: '/agents/:agentId/chat',
    name: 'AgentRunChat',
    component: () => import('@/views/app/AppChat.vue'),
    meta: { hidden: true, requiresAuth: true, title: '智能体对话' }
  },
  {
    path: '/agents/orchestrator/create',
    name: 'AgentOrchestratorCreate',
    component: () => import('@/views/app/orchestrator/index.vue'),
    meta: { hidden: true, requiresAuth: true, title: '从模板创建智能体' }
  },

  // ─────────────────────────────────────
  // 向后兼容：旧 /apps/* 路径自动重定向到 /agents/*
  // 等所有引用都迁移完后可移除
  // ─────────────────────────────────────
  {
    path: '/apps/:appId/chat',
    redirect: (to) => `/agents/${to.params.appId}/chat`,
    meta: { hidden: true, requiresAuth: true }
  },
  {
    path: '/apps/orchestrator/create',
    redirect: '/agents/orchestrator/create',
    meta: { hidden: true, requiresAuth: true }
  },

  // ─────────────────────────────────────
  // 根布局
  // ─────────────────────────────────────
  {
    path: '/',
    name: ROOT_LAYOUT_NAME,
    component: () => import('@/layout/BasicLayout.vue'),
    redirect: '/dashboard/home',
    meta: { requiresAuth: true, hidden: true },
    children: [
      {
        path: 'dashboard/home',
        name: 'DashboardHome',
        component: () => import('@/views/Dashboard/Home.vue'),
        meta: {
          title: '概览首页',
          icon: 'House',
          permission: 'dashboard:view'
        }
      }
    ]
  },

  // ─────────────────────────────────────
  // 404 兜底
  // ─────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
    meta: { hidden: true, requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: staticRoutes,
  scrollBehavior: () => ({ top: 0, left: 0 })
})

export function resetRouter(): void {
  const permissionStore = usePermissionStoreWithOut()
  permissionStore.getDynamicRouteNames.forEach((name) => {
    if (router.hasRoute(name)) {
      router.removeRoute(name)
    }
  })
  permissionStore.clearDynamicRouteNames()
}

export default router
