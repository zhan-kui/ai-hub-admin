<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toDisplayText } from '@/utils/display-text'
import { ElMessage } from 'element-plus'
import { MODEL_OPTIONS } from '../constants'
import type { FieldOption, FieldSchema } from '../types'

interface Props {
  modelValue: boolean
  nodeTitle: string
  fields: FieldSchema[]
  config: Record<string, any>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:config', value: Record<string, any>): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const formData = ref<Record<string, any>>({})

watch(
  () => props.modelValue,
  (show) => {
    if (!show) return

    const next: Record<string, any> = {}
    for (const field of props.fields) {
      if (props.config[field.key] !== undefined) {
        next[field.key] = props.config[field.key]
      } else if (field.default !== undefined) {
        next[field.key] = field.default
      } else {
        next[field.key] = undefined
      }
    }
    formData.value = next
  },
  { immediate: true }
)

function isEmptyRequiredValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  return false
}

function resolveSelectOptions(field: FieldSchema): FieldOption[] {
  if (field.key === 'model.name') {
    return MODEL_OPTIONS.map((item) => ({ label: item.label, value: item.value }))
  }
  return field.options || []
}

function handleConfirm() {
  for (const field of props.fields) {
    if (!field.required) continue
    if (isEmptyRequiredValue(formData.value[field.key])) {
      ElMessage.warning(`请填写「${toDisplayText(field.label)}」`)
      return
    }
  }

  emit('update:config', { ...formData.value })
  emit('update:modelValue', false)
}
</script>

<template>
  <el-drawer v-model="visible" :title="`${toDisplayText(nodeTitle)} - 参数配置`" size="520px">
    <el-form label-position="top">
      <el-form-item
        v-for="field in fields"
        :key="field.key"
        :label="toDisplayText(field.label)"
        :required="field.required"
      >
        <el-input
          v-if="field.type === 'input'"
          v-model="formData[field.key]"
          :placeholder="toDisplayText(field.placeholder)"
        />

        <el-input
          v-else-if="field.type === 'textarea'"
          v-model="formData[field.key]"
          type="textarea"
          :rows="field.rows || 4"
          :placeholder="toDisplayText(field.placeholder)"
        />

        <el-select
          v-else-if="field.type === 'select'"
          v-model="formData[field.key]"
          class="w-full"
          clearable
        >
          <el-option
            v-for="option in resolveSelectOptions(field)"
            :key="String(option.value)"
            :label="toDisplayText(option.label)"
            :value="option.value"
          />
        </el-select>

        <el-input-number
          v-else-if="field.type === 'input-number'"
          v-model="formData[field.key]"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          class="w-full"
        />

        <el-switch v-else-if="field.type === 'switch'" v-model="formData[field.key]" />

        <el-input
          v-else
          v-model="formData[field.key]"
          :placeholder="toDisplayText(field.placeholder)"
        />

        <div v-if="field.help" class="field-help">{{ toDisplayText(field.help) }}</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="less">
.field-help {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
