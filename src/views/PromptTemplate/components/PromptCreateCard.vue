<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineEmits<{ (event: 'create'): void }>()
</script>

<template>
  <button type="button" class="create-card" @click="$emit('create')">
    <span class="plus"><Icon icon="tabler:plus" /></span>
    <b>创建提示词</b>
    <span>从空白开始编写可复用模板</span>
  </button>
</template>

<style scoped lang="less">
@import url('@/styles/prompt-template.less');

.create-card {
  display: flex;
  min-height: 200px;
  font: inherit;
  color: @primary;
  text-align: center;
  cursor: pointer;
  background: @panel-soft;
  border: 1px dashed #b8ccf8;
  border-radius: @radius-card;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;

  &:hover {
    background: #eef4ff;
    border-color: #9dbcfb;
  }

  b {
    font-size: 14px;
  }

  > span:last-child {
    font-size: 11.5px;
    color: @text-secondary;
  }
}

.plus {
  display: grid;
  width: 38px;
  height: 38px;
  font-size: 22px;
  background: @primary-soft;
  border-radius: 12px;
  place-items: center;
}
</style>
