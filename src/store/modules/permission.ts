import { defineStore } from 'pinia'
import { store } from '../index'
import { menuApi, type MenuPlatform, type MenuVO } from '@/api/frontend-api'
import { buildAsyncRoutes } from '@/router/menu-transform'

interface PermissionState {
  menuTree: MenuVO[]
  routes: AppRouteRecordRaw[]
  menuTabRouters: AppRouteRecordRaw[]
  isRoutesLoaded: boolean
  dynamicRouteNames: string[]
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    menuTree: [],
    routes: [],
    menuTabRouters: [],
    isRoutesLoaded: false,
    dynamicRouteNames: []
  }),
  getters: {
    getMenuTree: (state): MenuVO[] => state.menuTree,
    getRoutes: (state): AppRouteRecordRaw[] => state.routes,
    getMenuTabRouters: (state): AppRouteRecordRaw[] => state.menuTabRouters,
    getIsRoutesLoaded: (state): boolean => state.isRoutesLoaded,
    getDynamicRouteNames: (state): string[] => state.dynamicRouteNames
  },
  actions: {
    async loadMenusAndPermissions(
      platform: MenuPlatform = 'pc'
    ): Promise<{ routes: AppRouteRecordRaw[]; permissions: string[] }> {
      const [menuTree, permissions] = await Promise.all([
        menuApi.tree(platform),
        menuApi.permissions(platform)
      ])

      this.menuTree = Array.isArray(menuTree) ? menuTree : []
      this.routes = buildAsyncRoutes(this.menuTree)
      this.isRoutesLoaded = true

      return {
        routes: this.routes,
        permissions: Array.isArray(permissions) ? permissions : []
      }
    },
    setMenuTabRouters(routes: AppRouteRecordRaw[]) {
      this.menuTabRouters = Array.isArray(routes) ? routes : []
    },
    addDynamicRouteName(name: string) {
      if (!name) return
      if (!this.dynamicRouteNames.includes(name)) {
        this.dynamicRouteNames.push(name)
      }
    },
    clearDynamicRouteNames() {
      this.dynamicRouteNames = []
    },
    resetRoutesState() {
      this.menuTree = []
      this.routes = []
      this.menuTabRouters = []
      this.isRoutesLoaded = false
      this.dynamicRouteNames = []
    }
  }
})

export const usePermissionStoreWithOut = () => usePermissionStore(store)
