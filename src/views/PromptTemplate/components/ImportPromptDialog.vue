<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { promptTemplateApi } from '@/api/promptTemplate'
import type { PromptCategory, PromptCategoryCode, PromptTemplate } from '@/api/promptTemplate'
import { DEFAULT_PROMPT_CATEGORIES, resolvePromptIcon } from '../constants'
import { highlightVariables } from '../composables/usePromptVariables'

const props = defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'selected', template: PromptTemplate): void
}>()

const list = ref<PromptTemplate[]>([])
const categories = ref<PromptCategory[]>([...DEFAULT_PROMPT_CATEGORIES])
const selected = ref<PromptTemplate | null>(null)
const keyword = ref('')
const category = ref<PromptCategoryCode | ''>('')
const loading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const highlighted = computed(() => highlightVariables(selected.value?.content || ''))

async function load() {
  loading.value = true
  try {
    const result = await promptTemplateApi.page({
      scope: 'all',
      category: category.value || undefined,
      keyword: keyword.value.trim() || undefined,
      pageNum: 1,
      pageSize: 30
    })
    list.value = result.records || []
    if (!list.value.some((item) => item.id === selected.value?.id)) {
      selected.value = list.value[0] || null
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '提示词模板加载失败')
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    categories.value = await promptTemplateApi.categories()
  } catch {
    categories.value = [...DEFAULT_PROMPT_CATEGORIES]
  }
}

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(), 300)
}

function confirmSelection() {
  if (!selected.value) return
  emit('selected', selected.value)
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    selected.value = null
    void Promise.all([loadCategories(), load()])
  }
)

watch(category, () => {
  if (props.modelValue) void load()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="引入提示词"
    width="900px"
    class="import-prompt-dialog"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dialog-filters">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索标题或描述"
        @input="handleSearch"
        @clear="load"
      >
        <template #prefix><Icon icon="tabler:search" /></template>
      </el-input>
      <el-select v-model="category" placeholder="全部分类" clearable>
        <el-option label="全部分类" value="" />
        <el-option
          v-for="item in categories"
          :key="item.code"
          :label="item.name"
          :value="item.code"
        />
      </el-select>
    </div>

    <div class="import-body" v-loading="loading">
      <div class="template-list">
        <button
          v-for="item in list"
          :key="item.id"
          type="button"
          class="template-option"
          :class="{ selected: selected?.id === item.id }"
          @click="selected = item"
        >
          <span class="option-icon">
            <Icon :icon="resolvePromptIcon(item.icon, item.category)" />
          </span>
          <span class="option-copy">
            <strong>{{ item.title }}</strong>
            <small>{{ item.description || item.categoryName }}</small>
          </span>
          <span v-if="item.source === 'OFFICIAL'" class="official">官方</span>
        </button>
        <el-empty
          v-if="!loading && !list.length"
          :image-size="64"
          description="没有匹配的提示词模板"
        />
      </div>

      <div class="template-preview">
        <template v-if="selected">
          <div class="preview-title">
            <strong>{{ selected.title }}</strong>
            <span>{{ selected.categoryName }}</span>
          </div>
          <div class="preview-content" v-html="highlighted"></div>
          <div v-if="selected.variables.length" class="preview-vars">
            <span v-for="variable in selected.variables" :key="variable.name">{{
              variable.name
            }}</span>
          </div>
        </template>
        <el-empty v-else :image-size="64" description="选择模板后查看正文" />
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected" @click="confirmSelection"
        >引入系统提示词</el-button
      >
    </template>
  </el-dialog>
</template>

<style lang="less">
@import url('@/styles/prompt-template.less');

.import-prompt-dialog {
  max-width: calc(100vw - 32px);
  border-radius: @radius-panel;

  .el-dialog__header {
    padding-bottom: 14px;
    border-bottom: 1px solid @border;
  }

  .dialog-filters {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;

    .el-input {
      flex: 1;
    }

    .el-select {
      width: 180px;
    }
  }

  .import-body {
    display: grid;
    min-height: 390px;
    grid-template-columns: minmax(280px, 0.9fr) minmax(320px, 1.1fr);
    gap: 14px;
  }

  .template-list,
  .template-preview {
    overflow: auto;
    background: @panel-soft;
    border: 1px solid @border;
    border-radius: 12px;
  }

  .template-list {
    max-height: 430px;
    padding: 8px;
  }

  .template-option {
    display: flex;
    width: 100%;
    padding: 10px;
    font: inherit;
    color: @text-main;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    align-items: center;
    gap: 10px;

    &:hover,
    &.selected {
      background: #fff;
      border-color: @var-border;
    }

    &.selected {
      box-shadow: @shadow-selected;
    }
  }

  .option-icon {
    display: grid;
    width: 34px;
    height: 34px;
    color: @primary-strong;
    background: @primary-soft;
    border-radius: 9px;
    flex: none;
    place-items: center;
  }

  .option-copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 3px;

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 13px;
    }

    small {
      font-size: 11px;
      color: @text-secondary;
    }
  }

  .official {
    padding: 1px 5px;
    font-size: 10px;
    color: #0f6e56;
    background: #eafaf2;
    border-radius: 5px;
  }

  .template-preview {
    max-height: 430px;
    padding: 16px;
  }

  .preview-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    span {
      font-size: 11px;
      color: @text-muted;
    }
  }

  .preview-content {
    font-size: 13px;
    line-height: 1.8;
    color: @text-main;
    white-space: pre-wrap;

    .vph {
      padding: 1px 5px;
      font-family: monospace;
      color: @var-color;
      background: @var-bg;
      border: 1px solid @var-border;
      border-radius: 6px;
    }
  }

  .preview-vars {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 14px;
    margin-top: 16px;
    border-top: 1px solid @border;

    span {
      padding: 2px 7px;
      font-family: monospace;
      font-size: 11px;
      color: @var-color;
      background: @var-bg;
      border-radius: 7px;
    }
  }
}

@media (width <= 760px) {
  .import-prompt-dialog {
    .import-body {
      grid-template-columns: 1fr;
    }

    .template-list,
    .template-preview {
      max-height: 280px;
    }
  }
}
</style>
