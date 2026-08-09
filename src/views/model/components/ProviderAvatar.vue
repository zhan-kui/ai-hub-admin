<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ModelProvider } from '@/api/model'
import { resolveProviderIcon } from '../provider-icon'

const props = withDefaults(defineProps<{ provider: ModelProvider; size?: number }>(), { size: 34 })

const broken = ref(false)
const icon = computed(() => resolveProviderIcon(props.provider))

watch(
  () => props.provider.provider,
  () => (broken.value = false)
)

const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${Math.round(props.size * 0.26)}px`,
  fontSize: `${Math.round(props.size * 0.42)}px`,
  background: icon.value.src && !broken.value ? 'var(--el-fill-color-light)' : icon.value.color
}))
</script>

<template>
  <span class="provider-avatar" :style="boxStyle">
    <img
      v-if="icon.src && !broken"
      :src="icon.src"
      :alt="provider.provider"
      loading="lazy"
      @error="broken = true"
    />
    <template v-else>{{ icon.initial }}</template>
  </span>
</template>

<style scoped>
.provider-avatar {
  display: inline-grid;
  overflow: hidden;
  font-weight: 600;
  line-height: 1;
  color: #fff;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
  user-select: none;
  flex: none;
  place-items: center;
}

.provider-avatar img {
  width: 72%;
  height: 72%;
  object-fit: contain;
}
</style>
