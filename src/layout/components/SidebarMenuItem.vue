<script setup lang="ts">
import { computed } from 'vue'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import type { MenuVO } from '@/api/frontend-api'

defineOptions({
  name: 'SidebarMenuItem'
})

const props = defineProps<{
  menu: MenuVO
  parentPath?: string
}>()

function resolvePath(parentPath: string, path: string | undefined, id: number): string {
  if (path && /^https?:\/\//.test(path)) {
    return path
  }

  if (path && path.startsWith('/')) {
    return path
  }

  const current = (path || `menu-${id}`).replace(/^\/+/, '')
  const base = (parentPath || '').replace(/\/+$/, '')
  const fullPath = `${base}/${current}`.replace(/\/{2,}/g, '/')
  return fullPath.startsWith('/') ? fullPath : `/${fullPath}`
}

const itemPath = computed(() => resolvePath(props.parentPath || '', props.menu.path, props.menu.id))

const children = computed(() =>
  (props.menu.children || []).filter((item) => item.menuType !== 'BUTTON' && item.visible !== false)
)

const hasChildren = computed(() => children.value.length > 0)

const iconComponent = computed(() => {
  if (!props.menu.icon) return null
  const iconMap = ElementPlusIcons as Record<string, unknown>
  return (iconMap[props.menu.icon] as any) || null
})
</script>

<template>
  <el-sub-menu v-if="hasChildren" :index="itemPath">
    <template #title>
      <el-icon v-if="iconComponent">
        <component :is="iconComponent" />
      </el-icon>
      <span>{{ menu.menuName }}</span>
    </template>

    <SidebarMenuItem
      v-for="child in children"
      :key="child.id"
      :menu="child"
      :parent-path="itemPath"
    />
  </el-sub-menu>

  <el-menu-item v-else :index="itemPath">
    <el-icon v-if="iconComponent">
      <component :is="iconComponent" />
    </el-icon>
    <span>{{ menu.menuName }}</span>
  </el-menu-item>
</template>
