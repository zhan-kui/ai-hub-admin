<script setup lang="ts">
import { ref, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'

interface Entry {
  key: string
  value: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: Record<string, string>
    keyPlaceholder?: string
    valuePlaceholder?: string
    secret?: boolean
  }>(),
  {
    modelValue: () => ({}),
    keyPlaceholder: '名称',
    valuePlaceholder: '值',
    secret: false
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: Record<string, string>): void
}>()

const entries = ref<Entry[]>([])

watch(
  () => props.modelValue,
  (value) => {
    const current: Record<string, string> = {}
    entries.value.forEach((row) => {
      if (row.key.trim()) current[row.key.trim()] = row.value
    })
    if (JSON.stringify(current) !== JSON.stringify(value || {})) {
      entries.value = Object.entries(value || {}).map(([key, entryValue]) => ({
        key,
        value: entryValue
      }))
    }
  },
  { immediate: true, deep: true }
)

function commit(rows: Entry[]) {
  const value: Record<string, string> = {}
  rows.forEach((row) => {
    const key = row.key.trim()
    if (key) value[key] = row.value
  })
  emit('update:modelValue', value)
}

function update(index: number, field: keyof Entry, value: string) {
  entries.value[index][field] = value
  commit(entries.value)
}

function add() {
  entries.value.push({ key: '', value: '' })
}

function remove(index: number) {
  entries.value.splice(index, 1)
  commit(entries.value)
}
</script>

<template>
  <div class="key-value-editor">
    <div v-for="(entry, index) in entries" :key="index" class="entry-row">
      <el-input
        :model-value="entry.key"
        :placeholder="keyPlaceholder"
        @update:model-value="update(index, 'key', String($event))"
      />
      <el-input
        :model-value="entry.value"
        :placeholder="valuePlaceholder"
        :show-password="secret"
        :type="secret ? 'password' : 'text'"
        @update:model-value="update(index, 'value', String($event))"
      />
      <el-button text type="danger" :icon="Delete" @click="remove(index)" />
    </div>
    <el-button plain :icon="Plus" @click="add">添加一项</el-button>
  </div>
</template>

<style scoped lang="less">
.key-value-editor {
  width: 100%;
}

.entry-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.8fr) minmax(160px, 1.2fr) 36px;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
