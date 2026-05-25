<script setup lang="ts">
import type { CanvasAppMeta } from '../types'
import IconUploader from '@/views/app/components/IconUploader.vue'

const appMeta = defineModel<CanvasAppMeta>({ required: true })
</script>

<template>
  <el-form label-position="top" class="meta-bar">
    <el-row :gutter="12">
      <el-col :span="4">
        <el-form-item label="头像">
          <IconUploader v-model="appMeta.iconImage" :size="64" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="应用名称" required>
          <el-input v-model="appMeta.name" maxlength="80" show-word-limit />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="描述">
          <el-input
            v-model="appMeta.description"
            type="textarea"
            maxlength="500"
            :rows="2"
            show-word-limit
          />
        </el-form-item>
      </el-col>
      <el-col :span="2">
        <el-form-item label="图标" required>
          <el-input v-model="appMeta.icon" maxlength="4" />
        </el-form-item>
      </el-col>
      <el-col :span="2">
        <el-form-item label="背景色">
          <el-color-picker v-model="appMeta.iconBackground" />
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<style scoped lang="less">
.meta-bar {
  padding: 6px 10px 2px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}
</style>
