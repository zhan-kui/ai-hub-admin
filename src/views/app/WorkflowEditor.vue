<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CanvasMode from './orchestrator/canvas/index.vue'

const route = useRoute()
const editId = computed(() => {
  const queryValue = route.query.edit
  if (!queryValue) return undefined
  const parsed = Number(queryValue)
  return Number.isFinite(parsed) ? parsed : undefined
})
</script>

<template>
  <CanvasMode workflow-mode :edit-id="editId" />
</template>
