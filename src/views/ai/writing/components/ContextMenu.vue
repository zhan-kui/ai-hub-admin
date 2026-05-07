<template>
  <Teleport to="body">
    <Transition name="ctx-menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="ctx-menu"
        :style="menuStyle"
        @click.stop
        @contextmenu.prevent
      >
        <div
          class="ctx-item"
          :class="{ active: hoverKey === 'continue' }"
          @mouseenter="hoverKey = 'continue'"
        >
          <Icon icon="ep:edit-pen" class="ctx-icon" />
          <span class="ctx-label">AI续写</span>
          <Icon icon="ep:arrow-right" class="ctx-arrow" />

          <div v-if="hoverKey === 'continue'" class="ctx-submenu">
            <div
              v-for="option in continueOptions"
              :key="option.value"
              class="ctx-item"
              @click="handleContinue(option.value)"
            >
              <span class="ctx-label">{{ option.label }}</span>
              <span class="ctx-hint">{{ option.hint }}</span>
            </div>
          </div>
        </div>

        <div class="ctx-divider"></div>

        <div
          class="ctx-item"
          :class="{ active: hoverKey === 'polish' }"
          @mouseenter="hoverKey = 'polish'"
        >
          <Icon icon="ep:magic-stick" class="ctx-icon" />
          <span class="ctx-label">AI润色</span>
          <Icon icon="ep:arrow-right" class="ctx-arrow" />

          <div v-if="hoverKey === 'polish'" class="ctx-submenu">
            <div
              v-for="option in polishOptions"
              :key="option.value"
              class="ctx-item"
              @click="handlePolish(option.value)"
            >
              <span class="ctx-label">{{ option.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { ContinueLength, PolishStyle } from '../types'

interface Props {
  visible: boolean
  x: number
  y: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'continue', length: ContinueLength): void
  (e: 'polish', style: PolishStyle): void
}>()

const menuRef = ref<HTMLElement | null>(null)
const hoverKey = ref<'continue' | 'polish' | ''>('')

const MENU_WIDTH = 200
const MENU_HEIGHT = 110
const SUBMENU_WIDTH = 200

const continueOptions: Array<{ value: ContinueLength; label: string; hint: string }> = [
  { value: 'short', label: '短续写', hint: '50字以内' },
  { value: 'medium', label: '中续写', hint: '100-200字' },
  { value: 'long', label: '长续写', hint: '300字左右' }
]

const polishOptions: Array<{ value: PolishStyle; label: string }> = [
  { value: 'default', label: '默认润色' },
  { value: 'formal', label: '更正式' },
  { value: 'professional', label: '更专业' },
  { value: 'vivid', label: '更生动' },
  { value: 'concise', label: '更简洁' },
  { value: 'casual', label: '更口语化' }
]

const menuStyle = computed(() => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let left = props.x
  let top = props.y

  if (left + MENU_WIDTH + SUBMENU_WIDTH > viewportWidth) {
    left = Math.max(8, props.x - MENU_WIDTH)
  }

  if (top + MENU_HEIGHT > viewportHeight) {
    top = Math.max(8, viewportHeight - MENU_HEIGHT - 8)
  }

  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

const close = () => {
  emit('update:visible', false)
  hoverKey.value = ''
}

const handleContinue = (length: ContinueLength) => {
  emit('continue', length)
  close()
}

const handlePolish = (style: PolishStyle) => {
  emit('polish', style)
  close()
}

const handleDocumentClick = (event: MouseEvent) => {
  if (!menuRef.value) return
  if (!menuRef.value.contains(event.target as Node)) {
    close()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      await nextTick()
      document.addEventListener('mousedown', handleDocumentClick)
      document.addEventListener('keydown', handleKeydown)
      return
    }

    document.removeEventListener('mousedown', handleDocumentClick)
    document.removeEventListener('keydown', handleKeydown)
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style lang="less" scoped>
.ctx-menu {
  position: fixed;
  z-index: 3000;
  min-width: 180px;
  padding: 6px;
  font-size: 14px;
  background: #fff;
  border-radius: 8px;
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.04);
}

.ctx-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 10px;
  color: #1f2329;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;

  &:hover,
  &.active {
    background: #f5f6f8;
  }
}

.ctx-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  color: #646a73;
}

.ctx-label {
  flex: 1;
}

.ctx-hint {
  font-size: 12px;
  color: #8f959e;
}

.ctx-arrow {
  width: 12px;
  height: 12px;
  color: #8f959e;
}

.ctx-divider {
  height: 1px;
  margin: 4px 6px;
  background: #f0f1f3;
}

.ctx-submenu {
  position: absolute;
  top: -6px;
  left: 100%;
  min-width: 160px;
  margin-left: 4px;
  padding: 6px;
  background: #fff;
  border-radius: 8px;
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.04);
}

.ctx-menu-enter-active,
.ctx-menu-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.ctx-menu-enter-from,
.ctx-menu-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
