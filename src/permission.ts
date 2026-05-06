import type { Router } from 'vue-router'
import { ElMessage } from 'element-plus'
import { setStaticToken } from '@/api/frontend-api'
import { usePermissionStoreWithOut } from '@/store/modules/permission'
import { useUserStoreWithOut } from '@/store/modules/user'
import { resetRouter } from '@/router'

const PLATFORM = 'pc'
const WHITE_LIST = new Set<string>(['/login', '/404'])

let isLoadingDynamicRoutes = false

export function setupAuthGuard(router: Router): void {
  router.beforeEach(async (to) => {
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
      return '/'
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
            router.addRoute(route)
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
}
