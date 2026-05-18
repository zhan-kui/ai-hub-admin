<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TemplateMode from './TemplateMode.vue'
import CanvasMode from './canvas/index.vue'

const route = useRoute()
const mode = computed(() => (route.query.mode as string | undefined) || 'template')
</script>

<template>
  <CanvasMode v-if="mode === 'blank'" />
  <TemplateMode v-else />
</template>
