import type { RouteRecordRaw } from 'vue-router'
import type { MenuVO } from '@/api/frontend-api'

const modules = import.meta.glob([
  '/src/views/**/*.vue',
  '!/src/views/Authorization/**/*.vue',
  '!/src/views/Components/**/*.vue',
  '!/src/views/Example/**/*.vue',
  '!/src/views/Function/**/*.vue',
  '!/src/views/Guide/**/*.vue',
  '!/src/views/hooks/**/*.vue',
  '!/src/views/Level/**/*.vue',
  '!/src/views/Personal/**/*.vue'
])

const LayoutView = () => import('@/layout/BasicLayout.vue')
const ParentView = () => import('@/views/common/ParentView.vue')
const PlaceholderView = () => import('@/views/common/RoutePlaceholder.vue')

function normalizeAbsolutePath(rawPath: string): string {
  const normalized = rawPath.split('/').filter(Boolean).join('/')
  return `/${normalized}`
}

function sanitizeSegment(rawPath: string): string {
  return rawPath.replace(/^\/+|\/+$/g, '')
}

function resolveTopPath(rawPath: string | undefined, id: number): string {
  const segment = sanitizeSegment(rawPath || `menu-${id}`)
  return normalizeAbsolutePath(segment)
}

function resolveChildPath(parentAbsPath: string, rawPath: string | undefined, id: number): string {
  if (!rawPath) return `menu-${id}`

  if (rawPath.startsWith('/')) {
    const absolutePath = normalizeAbsolutePath(rawPath)
    if (absolutePath.startsWith(`${parentAbsPath}/`)) {
      return absolutePath.slice(parentAbsPath.length + 1)
    }
    return absolutePath.slice(1)
  }

  return sanitizeSegment(rawPath) || `menu-${id}`
}

function joinAbsolutePath(parentAbsPath: string, routePath: string): string {
  if (routePath.startsWith('/')) {
    return normalizeAbsolutePath(routePath)
  }
  return normalizeAbsolutePath(`${parentAbsPath}/${routePath}`)
}

function resolveView(
  component: string | undefined,
  hasChildren: boolean
): NonNullable<RouteRecordRaw['component']> {
  if (component === 'Layout') {
    return LayoutView
  }

  if (component === 'ParentView') {
    return ParentView
  }

  if (!component) {
    return hasChildren ? ParentView : PlaceholderView
  }

  const normalized = component.replace(/^\//, '').replace(/\.vue$/, '')
  const possibleKeys = [`/src/views/${normalized}.vue`, `/src/views/${normalized}/index.vue`]
  const matchedEntry = Object.entries(modules).find(([key]) =>
    possibleKeys.some((target) => target.toLowerCase() === key.toLowerCase())
  )

  if (matchedEntry) {
    return matchedEntry[1]
  }

  return hasChildren ? ParentView : PlaceholderView
}

function convertMenuToRoute(menu: MenuVO, parentAbsPath = ''): RouteRecordRaw | null {
  if (menu.menuType === 'BUTTON') {
    return null
  }

  const routePath = parentAbsPath
    ? resolveChildPath(parentAbsPath, menu.path, menu.id)
    : resolveTopPath(menu.path, menu.id)

  const absPath = parentAbsPath ? joinAbsolutePath(parentAbsPath, routePath) : routePath

  const children = (menu.children || [])
    .map((child) => convertMenuToRoute(child, absPath))
    .filter((route): route is RouteRecordRaw => Boolean(route))

  const route: RouteRecordRaw = {
    path: routePath,
    name: `menu-${menu.id}`,
    component: resolveView(menu.component, children.length > 0),
    meta: {
      title: menu.menuName,
      icon: menu.icon,
      hidden: menu.visible === false,
      permission: menu.permission,
      platform: menu.platform,
      menuType: menu.menuType
    }
  }

  if (children.length) {
    route.children = children
    const firstVisible = children.find((item) => item.meta?.hidden !== true)
    if (firstVisible && typeof firstVisible.path === 'string') {
      route.redirect = firstVisible.path
    }
  }

  return route
}

export function buildAsyncRoutes(menuTree: MenuVO[]): RouteRecordRaw[] {
  return menuTree
    .map((menu) => convertMenuToRoute(menu))
    .filter((route): route is RouteRecordRaw => Boolean(route))
}
