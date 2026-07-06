<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { PromptTemplate } from '@/api/promptTemplate'
import { highlightVariables } from '../composables/usePromptVariables'

const props = defineProps<{
  modelValue: boolean
  template: PromptTemplate | null
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'edit', template: PromptTemplate): void
  (event: 'copyContent', template: PromptTemplate): void
}>()

const highlighted = computed(() => highlightVariables(props.template?.content || ''))
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    direction="rtl"
    size="420px"
    class="preview-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div v-if="template" class="drawer-title">
        <div>
          <h2>{{ template.title }}</h2>
          <span>{{ template.categoryName }}</span>
        </div>
        <span v-if="template.source === 'OFFICIAL'" class="official">官方</span>
      </div>
    </template>

    <template v-if="template">
      <p class="description">{{ template.description || '暂无描述' }}</p>

      <section>
        <h3>提示词正文</h3>
        <div class="prompt-body" v-html="highlighted"></div>
      </section>

      <section>
        <h3
          >变量清单 <span>{{ template.variables.length }}</span></h3
        >
        <div v-if="template.variables.length">
          <div v-for="variable in template.variables" :key="variable.name" class="var-row">
            <code>{{ variable.name }}</code>
            <span>{{ variable.description || '暂无说明' }}</span>
          </div>
        </div>
        <el-empty v-else :image-size="60" description="该模板没有占位变量" />
      </section>
    </template>

    <template #footer>
      <div v-if="template" class="drawer-actions">
        <el-button @click="emit('copyContent', template)">
          <Icon icon="tabler:copy" />
          复制
        </el-button>
        <el-button v-if="template.owned" type="primary" @click="emit('edit', template)">
          <Icon icon="tabler:edit" />
          编辑
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style lang="less">
@import url('@/styles/prompt-template.less');

.preview-drawer {
  box-shadow: @shadow-drawer;

  .el-drawer__header {
    padding-bottom: 14px;
    margin-bottom: 0;
    border-bottom: 1px solid @border;
  }

  .el-drawer__body {
    padding-top: 16px;
  }

  .drawer-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    h2 {
      margin: 0;
      font-size: 17px;
      color: @text-main;
    }

    span:not(.official) {
      font-size: 11px;
      color: @text-muted;
    }
  }

  .official {
    padding: 2px 7px;
    font-size: 11px;
    color: #0f6e56;
    background: #eafaf2;
    border-radius: 6px;
  }

  .description {
    margin: 0 0 18px;
    font-size: 12px;
    line-height: 1.6;
    color: @text-secondary;
  }

  section + section {
    margin-top: 20px;
  }

  h3 {
    margin: 0 0 9px;
    font-size: 13px;
    color: @text-main;

    span {
      font-weight: 400;
      color: @text-muted;
    }
  }

  .prompt-body {
    padding: 14px;
    font-size: 13px;
    line-height: 1.8;
    color: @text-main;
    white-space: pre-wrap;
    background: @panel-soft;
    border: 1px solid @border;
    border-radius: 12px;
  }

  .vph {
    padding: 1px 5px;
    font-family: monospace;
    font-size: 12px;
    color: @var-color;
    background: @var-bg;
    border: 1px solid @var-border;
    border-radius: 6px;
  }

  .var-row {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 11px;
    margin-top: 7px;
    border: 1px solid @border;
    border-radius: 10px;

    code {
      padding: 2px 7px;
      font-family: monospace;
      font-size: 12px;
      color: @primary-strong;
      background: @var-bg;
      border-radius: 6px;
    }

    span {
      font-size: 12px;
      color: @text-secondary;
    }
  }

  .drawer-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;

    .el-button {
      border-radius: @radius-control;
    }
  }
}

@media (width <= 520px) {
  .preview-drawer {
    width: 100% !important;
  }
}
</style>
