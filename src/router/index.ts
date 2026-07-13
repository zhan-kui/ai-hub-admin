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
  // 多智能体协作暂未开放，菜单入口先展示占位页。
  {
    path: '/chat',
    component: () => import('@/views/common/RoutePlaceholder.vue'),
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
  {
    path: '/agents/placeholder',
    name: 'AgentPlaceholder',
    component: () => import('@/views/app/AgentPlaceholder.vue'),
    meta: { hidden: true, requiresAuth: true, title: 'Agent 智能体开发中' }
  },
  {
    path: '/workflows/editor',
    name: 'WorkflowEditor',
    component: () => import('@/views/app/WorkflowEditor.vue'),
    meta: { hidden: true, requiresAuth: true, title: '工作流编辑' }
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
      },
      {
        path: 'agents',
        name: 'AgentManagement',
        component: () => import('@/views/app/AppList.vue'),
        meta: {
          title: '智能体管理',
          hidden: true,
          activeMenu: '/agents'
        }
      },
      {
        path: 'ai/writing',
        name: 'AiWriting',
        component: () => import('@/views/ai/writing/WritingLayout.vue'),
        meta: {
          title: 'AI 写作',
          hidden: true,
          activeMenu: '/ai/writing'
        }
      },
      {
        path: 'prompt-template',
        alias: 'prompt-template/index',
        name: 'PromptTemplate',
        component: () => import('@/views/PromptTemplate/PromptTemplate.vue'),
        meta: {
          title: '提示词模板',
          hidden: true,
          activeMenu: '/prompt-template'
        }
      },
      {
        path: 'knowledge',
        name: 'KnowledgeList',
        component: () => import('@/views/knowledge/KnowledgeList.vue'),
        meta: {
          title: '知识库',
          hidden: true
        }
      },
      {
        path: 'knowledge/retrieve',
        name: 'KnowledgeRetrieve',
        component: () => import('@/views/knowledge/RetrievalTest.vue'),
        meta: {
          title: '检索测试',
          hidden: true,
          activeMenu: '/knowledge/retrieve'
        }
      },
      {
        path: 'knowledge/:datasetId',
        name: 'KnowledgeDetail',
        component: () => import('@/views/knowledge/KnowledgeDetail.vue'),
        meta: {
          title: '知识库详情',
          hidden: true,
          activeMenu: '/knowledge'
        }
      },
      {
        path: 'knowledge/:datasetId/documents/:documentId/segments',
        name: 'KnowledgeSegment',
        component: () => import('@/views/knowledge/KnowledgeSegment.vue'),
        meta: {
          title: '文档分段',
          hidden: true,
          activeMenu: '/knowledge'
        }
      },
      {
        path: 'profile',
        name: 'UserProfile',
        component: () => import('@/views/user/Profile.vue'),
        meta: {
          title: '个人中心',
          hidden: true
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
