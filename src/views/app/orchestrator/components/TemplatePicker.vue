<script setup lang="ts">
import type { TemplateMeta } from '../types'

interface Props {
  templates: TemplateMeta[]
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function handleSelect(code: string) {
  emit('update:modelValue', code)
}
</script>

<template>
  <div class="template-grid">
    <div
      v-for="item in props.templates"
      :key="item.code"
      class="template-card"
      :class="{ 'template-card--active': props.modelValue === item.code }"
      @click="handleSelect(item.code)"
    >
      <div class="template-icon" :style="{ background: item.iconBackground || '#f5f5f5' }">
        {{ item.icon }}
      </div>
      <div class="template-name">{{ item.name }}</div>
      <div class="template-desc">{{ item.description }}</div>
    </div>
  </div>
</template>

<style scoped lang="less">
.template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.template-card {
  padding: 14px;
  cursor: pointer;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 6px 16px rgb(0 0 0 / 6%);
}

.template-card--active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
}

.template-icon {
  display: flex;
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  font-size: 22px;
  border-radius: 10px;
  align-items: center;
  justify-content: center;
}

.template-name {
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.template-desc {
  min-height: 38px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

@media (width <= 1200px) {
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 768px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
