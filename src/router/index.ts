import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { usePermissionStoreWithOut } from '@/store/modules/permission'

export const ROOT_LAYOUT_NAME = 'RootLayout'

const staticRoutes: RouteRecordRaw[] = [
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
  {
    path: '/chat',
    component: () => import('@/views/ai/chat/ChatLayout.vue'),
    meta: { hidden: true, requiresAuth: true }
  },
  {
    path: '/agent-chat',
    component: () => import('@/views/ai/agent/AgentChat.vue'),
    meta: { hidden: true, requiresAuth: true }
  },
  {
    path: '/apps/orchestrator/create',
    component: () => import('@/views/app/orchestrator/index.vue'),
    meta: { hidden: true, requiresAuth: true, title: '从模板创建应用' }
  },
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
          title: '首页仪表盘',
          icon: 'House',
          permission: 'dashboard:view'
        }
      }
    ]
  },
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
