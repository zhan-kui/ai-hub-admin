import type { Router } from 'vue-router'
import { ElMessage } from 'element-plus'
import { setStaticToken } from '@/api/frontend-api'
import { usePermissionStoreWithOut } from '@/store/modules/permission'
import { useUserStoreWithOut } from '@/store/modules/user'
import { resetRouter } from '@/router'
import { useNProgress } from '@/hooks/web/useNProgress'

const PLATFORM = 'pc'
const DEFAULT_HOME_PATH = '/dashboard/home'
const WHITE_LIST = new Set<string>(['/login', '/404'])

let isLoadingDynamicRoutes = false

export function setupAuthGuard(router: Router): void {
  const { start, done } = useNProgress()

  router.beforeEach(async (to, from) => {
    if (to.fullPath !== from.fullPath) {
      start()
    }

    const userStore = useUserStoreWithOut()
    const permissionStore = usePermissionStoreWithOut()

    const token = userStore.getToken

    if (!token) {
      if (WHITE_LIST.has(to.path) || to.meta.requiresAuth === false) {
        return true
      }
      return {
        path: '/login',
        query: { redirect: to.fullPath }
      }
    }

    setStaticToken(token)

    if (to.path === '/login') {
      return DEFAULT_HOME_PATH
    }

    try {
      if (!userStore.getUserInfo) {
        await userStore.fetchUserInfo()
      }

      if (!permissionStore.getIsRoutesLoaded && !isLoadingDynamicRoutes) {
        isLoadingDynamicRoutes = true
        const { routes, permissions } = await permissionStore.loadMenusAndPermissions(PLATFORM)
        userStore.setPermissions(permissions)

        routes.forEach((route) => {
          const routeName = typeof route.name === 'string' ? route.name : ''
          if (routeName && !router.hasRoute(routeName)) {
            router.addRoute(route as Parameters<typeof router.addRoute>[0])
            permissionStore.addDynamicRouteName(routeName)
          }
        })

        isLoadingDynamicRoutes = false
        const redirectedFrom = to.redirectedFrom?.fullPath
        if (to.path === '/404' && redirectedFrom && redirectedFrom !== '/404') {
          return {
            path: redirectedFrom,
            replace: true
          }
        }
        return {
          path: to.fullPath,
          replace: true
        }
      }

      return true
    } catch (error) {
      isLoadingDynamicRoutes = false
      await userStore.resetAuth()
      permissionStore.resetRoutesState()
      resetRouter()
      ElMessage.error('登录状态失效，请重新登录')
      return {
        path: '/login',
        query: { redirect: to.fullPath }
      }
    }
  })

  router.afterEach(() => {
    done()
  })

  router.onError(() => {
    done()
  })
}
