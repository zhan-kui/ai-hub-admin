<script setup lang="ts">
import { CodeEditor } from '@/components/CodeEditor'

withDefaults(
  defineProps<{
    modelValue: string
    height?: number | string
    readonly?: boolean
  }>(),
  {
    height: 220,
    readonly: false
  }
)

defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="json-editor">
    <CodeEditor
      :model-value="modelValue"
      language="json"
      theme="vs"
      :height="height"
      :language-selector="false"
      :theme-selector="false"
      :editor-option="{ readOnly: readonly, minimap: { enabled: false }, automaticLayout: true }"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.json-editor {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}
</style>
