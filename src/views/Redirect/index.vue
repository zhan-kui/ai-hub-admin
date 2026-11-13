<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const redirectPath = Array.isArray(route.params.path)
    ? route.params.path.join('/')
    : route.params.path
  const path = redirectPath ? `/${redirectPath}` : '/'
  router.replace({
    path,
    query: route.query
  })
})
</script>

<template>
  <div></div>
</template>
