<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { VariableSource } from './types'

interface Props {
  modelValue: string
  sources: VariableSource[]
  rows?: number
  placeholder?: string
  maxlength?: number
  showWordLimit?: boolean
  ariaLabel?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlightRef = ref<HTMLDivElement | null>(null)
const menuOpen = ref(false)
const menuTop = ref(0)
const menuLeft = ref(0)
const filterKeyword = ref('')
const activeIndex = ref(0)
const triggerStart = ref(-1)

const VAR_REGEX = /\{\{#([^#}]+)#\}\}/g

interface Segment {
  type: 'text' | 'chip'
  raw: string
  label?: string
}

const segments = computed<Segment[]>(() => {
  const value = props.modelValue || ''
  const out: Segment[] = []
  let lastIndex = 0
  const lookupLabel = (insertText: string) =>
    props.sources.find((item) => item.insertText === insertText)?.label

  for (const match of value.matchAll(VAR_REGEX)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      out.push({ type: 'text', raw: value.slice(lastIndex, start) })
    }
    out.push({
      type: 'chip',
      raw: match[0],
      label: lookupLabel(match[0]) || match[1]
    })
    lastIndex = start + match[0].length
  }

  if (lastIndex < value.length) {
    out.push({ type: 'text', raw: value.slice(lastIndex) })
  }
  return out
})

const GROUP_LABELS: Record<string, string> = {
  context: '上下文',
  system: '系统变量',
  start_var: '用户输入变量',
  node_output: '节点输出'
}

const GROUP_ORDER: VariableSource['group'][] = ['context', 'system', 'start_var', 'node_output']

const filteredSources = computed(() => {
  const keyword = filterKeyword.value.toLowerCase().trim()
  if (!keyword) return props.sources
  return props.sources.filter((item) => {
    return item.label.toLowerCase().includes(keyword) || item.key.toLowerCase().includes(keyword)
  })
})

const groupedSources = computed(() => {
  const groups: Record<string, VariableSource[]> = {}
  for (const item of filteredSources.value) {
    if (!groups[item.group]) groups[item.group] = []
    groups[item.group].push(item)
  }
  return GROUP_ORDER.filter((group) => groups[group]?.length).map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: groups[group]
  }))
})

const currentLength = computed(() => props.modelValue?.length || 0)

watch(filteredSources, (list) => {
  if (!list.length || activeIndex.value >= list.length) {
    activeIndex.value = 0
  }
})

watch(
  () => props.modelValue,
  () => {
    nextTick(() => handleScroll())
  }
)

function closeMenu() {
  menuOpen.value = false
  triggerStart.value = -1
  filterKeyword.value = ''
  activeIndex.value = 0
}

function positionMenu(target: HTMLTextAreaElement) {
  const rect = target.getBoundingClientRect()
  menuLeft.value = rect.left
  menuTop.value = rect.bottom + 4
}

function openMenuAt(slashIndex: number, target: HTMLTextAreaElement) {
  triggerStart.value = slashIndex
  filterKeyword.value = ''
  activeIndex.value = 0
  menuOpen.value = true
  nextTick(() => positionMenu(target))
}

function handleScroll() {
  if (!textareaRef.value || !highlightRef.value) return
  highlightRef.value.scrollTop = textareaRef.value.scrollTop
  highlightRef.value.scrollLeft = textareaRef.value.scrollLeft
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  const value = target.value
  const caret = target.selectionStart ?? value.length
  emit('update:modelValue', value)

  if (menuOpen.value && triggerStart.value >= 0) {
    if (caret <= triggerStart.value) {
      closeMenu()
      return
    }
    filterKeyword.value = value.slice(triggerStart.value + 1, caret)
    activeIndex.value = 0
    return
  }

  if (value[caret - 1] !== '/') return

  const before = value[caret - 2]
  const isStart = caret === 1
  const canTrigger =
    isStart ||
    before === ' ' ||
    before === '\n' ||
    before === '\t' ||
    !/[a-zA-Z0-9_]/.test(before ?? '')

  if (canTrigger) {
    openMenuAt(caret - 1, target)
  }
}

function selectItem(item: VariableSource) {
  const textarea = textareaRef.value
  if (!textarea || triggerStart.value < 0) return

  const value = props.modelValue || ''
  const caret = textarea.selectionStart ?? value.length
  const nextValue = value.slice(0, triggerStart.value) + item.insertText + value.slice(caret)

  emit('update:modelValue', nextValue)

  const nextCaret = triggerStart.value + item.insertText.length
  closeMenu()
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(nextCaret, nextCaret)
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (!menuOpen.value) return
  const total = filteredSources.value.length

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!total) return
    activeIndex.value = (activeIndex.value + 1) % total
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!total) return
    activeIndex.value = (activeIndex.value - 1 + total) % total
    return
  }

  if (event.key === 'Enter') {
    if (!total) {
      closeMenu()
      return
    }
    event.preventDefault()
    selectItem(filteredSources.value[activeIndex.value])
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu()
    return
  }

  if (event.key === ' ' && !total) {
    closeMenu()
  }
}

function handleBlur() {
  setTimeout(closeMenu, 150)
}
</script>

<template>
  <div class="variable-picker">
    <div ref="highlightRef" class="vp-highlight-layer" aria-hidden="true">
      <template v-for="(seg, index) in segments" :key="index">
        <span v-if="seg.type === 'text'" class="vp-text">{{ seg.raw }}</span>
        <span v-else class="vp-chip" :title="seg.raw">
          <span class="vp-chip-measure">{{ seg.raw }}</span>
          <span class="vp-chip-label">{{ seg.label }}</span>
        </span>
      </template>
      <span class="vp-tail">&#8203;</span>
    </div>

    <textarea
      ref="textareaRef"
      class="vp-textarea"
      :value="modelValue"
      :rows="rows ?? 4"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :aria-label="ariaLabel"
      spellcheck="false"
      @input="handleInput"
      @keydown="handleKeydown"
      @blur="handleBlur"
      @scroll="handleScroll"
    ></textarea>

    <div v-if="showWordLimit && maxlength" class="vp-word-limit"
      >{{ currentLength }} / {{ maxlength }}</div
    >

    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="vp-menu"
        :style="{ top: `${menuTop}px`, left: `${menuLeft}px` }"
        @mousedown.prevent
      >
        <template v-if="filteredSources.length">
          <div v-for="group in groupedSources" :key="group.group" class="vp-group">
            <div class="vp-group-label">{{ group.label }}</div>
            <div
              v-for="item in group.items"
              :key="item.key"
              class="vp-item"
              :class="{ active: filteredSources.indexOf(item) === activeIndex }"
              @mouseenter="activeIndex = filteredSources.indexOf(item)"
              @click="selectItem(item)"
            >
              <div class="vp-item-label">{{ item.label }}</div>
              <div v-if="item.description" class="vp-item-desc">{{ item.description }}</div>
              <div class="vp-item-code">{{ item.insertText }}</div>
            </div>
          </div>
        </template>
        <div v-else class="vp-empty">无匹配变量，按 Esc 或空格继续输入</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="less">
.variable-picker {
  position: relative;
  width: 100%;
}

.vp-textarea,
.vp-highlight-layer {
  width: 100%;
  min-height: 90px;
  padding: 8px 12px;
  font-family: var(--el-font-family, inherit);
  font-size: var(--el-input-font-size, 14px);
  line-height: 1.6;
  letter-spacing: 0;
  tab-size: 2;
  word-wrap: break-word;
  white-space: pre-wrap;
  border-radius: var(--el-input-border-radius, 4px);
  box-sizing: border-box;
  overflow-wrap: break-word;
}

.vp-highlight-layer {
  position: absolute;
  overflow: auto;
  color: var(--el-input-text-color, var(--el-text-color-regular));
  pointer-events: none;
  background: transparent;
  border: 1px solid transparent;
  inset: 0;
}

.vp-textarea {
  position: relative;
  z-index: 1;
  color: transparent;
  caret-color: var(--el-text-color-primary);
  background: transparent;
  border: 1px solid var(--el-input-border-color, var(--el-border-color));
  transition:
    border-color var(--el-transition-duration),
    box-shadow var(--el-transition-duration);
  resize: vertical;
}

.vp-textarea:hover {
  border-color: var(--el-input-hover-border-color, var(--el-border-color-hover));
}

.vp-textarea:focus {
  border-color: var(--el-color-primary);
  outline: none;
}

.vp-textarea::placeholder {
  color: var(--el-text-color-placeholder);
}

.vp-chip {
  position: relative;
  display: inline-block;
  color: transparent;
  white-space: nowrap;
  vertical-align: baseline;
  background: rgb(64 158 255 / 12%);
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgb(64 158 255 / 35%);
}

.vp-chip-measure {
  visibility: hidden;
}

.vp-chip-label {
  position: absolute;
  inset: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 12px;
  line-height: inherit;
  color: var(--el-color-primary);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vp-word-limit {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1;
  color: var(--el-text-color-placeholder);
  text-align: right;
}

.vp-menu {
  position: fixed;
  z-index: 9999;
  max-width: 360px;
  max-height: 320px;
  min-width: 280px;
  padding: 4px;
  overflow-y: auto;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
}

.vp-group-label {
  padding: 6px 10px;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--el-text-color-secondary);
}

.vp-item {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
}

.vp-item.active,
.vp-item:hover {
  background: var(--el-fill-color-light);
}

.vp-item-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.vp-item-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.vp-item-code {
  margin-top: 2px;
  font-family: Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--el-color-primary);
}

.vp-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
