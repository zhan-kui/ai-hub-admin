<script setup lang="ts">
import type { AppMeta } from '../types'
import IconUploader from '@/views/app/components/IconUploader.vue'

const appMeta = defineModel<AppMeta>({ required: true })
</script>

<template>
  <el-form label-position="top" class="app-meta-form">
    <el-row :gutter="16">
      <el-col :span="4">
        <el-form-item label="头像">
          <IconUploader v-model="appMeta.iconImage" :size="72" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="应用名" required>
          <el-input v-model="appMeta.name" maxlength="64" show-word-limit clearable />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="描述" required>
          <el-input
            v-model="appMeta.description"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-col>
      <el-col :span="4">
        <el-form-item label="图标 Emoji" required>
          <el-input v-model="appMeta.icon" maxlength="4" />
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<style scoped lang="less">
.app-meta-form {
  max-width: 980px;
}
</style>
