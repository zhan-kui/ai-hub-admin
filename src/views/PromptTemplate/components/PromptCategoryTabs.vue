<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { PromptCategory, PromptCategoryCode, PromptScope } from '@/api/promptTemplate'
import { PROMPT_CATEGORY_ICONS } from '../constants'

defineProps<{
  modelValue: PromptScope | PromptCategoryCode | 'all'
  categories: PromptCategory[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: PromptScope | PromptCategoryCode | 'all'): void
}>()
</script>

<template>
  <nav class="prompt-cats" aria-label="提示词分类筛选">
    <button
      type="button"
      class="cat"
      :class="{ 'is-active': modelValue === 'all' }"
      @click="emit('update:modelValue', 'all')"
    >
      <Icon icon="tabler:layout-grid" />
      全部
    </button>
    <button
      v-for="category in categories"
      :key="category.code"
      type="button"
      class="cat"
      :class="{ 'is-active': modelValue === category.code }"
      @click="emit('update:modelValue', category.code)"
    >
      <Icon :icon="PROMPT_CATEGORY_ICONS[category.code]" />
      {{ category.name }}
    </button>
    <span class="divider" aria-hidden="true"></span>
    <button
      type="button"
      class="cat"
      :class="{ 'is-active': modelValue === 'mine' }"
      @click="emit('update:modelValue', 'mine')"
    >
      <Icon icon="tabler:user" />
      我的提示词
    </button>
    <button
      type="button"
      class="cat"
      :class="{ 'is-active': modelValue === 'fav' }"
      @click="emit('update:modelValue', 'fav')"
    >
      <Icon icon="tabler:star" />
      我的收藏
    </button>
  </nav>
</template>

<style scoped lang="less">
@import url('@/styles/prompt-template.less');

.prompt-cats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: @space-lg;
}

.cat {
  display: inline-flex;
  padding: 7px 13px;
  font: inherit;
  font-size: 12.5px;
  color: @text-secondary;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  align-items: center;
  gap: 6px;

  &:hover {
    color: @primary-strong;
    background: @primary-softer;
  }

  &.is-active {
    font-weight: 600;
    color: @primary-strong;
    background: @primary-soft;
    border-color: @var-border;
  }
}

.divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: @border;
}
</style>
