<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TemplateMode from './TemplateMode.vue'
import CanvasMode from './canvas/index.vue'

const route = useRoute()
const mode = computed(() => (route.query.mode as string | undefined) || 'template')
const editId = computed(() => {
  const queryValue = route.query.edit
  if (!queryValue) return undefined
  const parsed = Number(queryValue)
  return Number.isFinite(parsed) ? parsed : undefined
})
</script>

<template>
  <CanvasMode v-if="mode === 'blank'" :edit-id="editId" />
  <TemplateMode v-else :edit-id="editId" />
</template>
