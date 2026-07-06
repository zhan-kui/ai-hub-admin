<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { promptTemplateApi } from '@/api/promptTemplate'
import type {
  PromptCategory,
  PromptCategoryCode,
  PromptScope,
  PromptTemplate as PromptTemplateType
} from '@/api/promptTemplate'
import { DEFAULT_PROMPT_CATEGORIES } from './constants'
import { usePromptList } from './composables/usePromptList'
import PromptHeader from './components/PromptHeader.vue'
import PromptCategoryTabs from './components/PromptCategoryTabs.vue'
import PromptCreateCard from './components/PromptCreateCard.vue'
import PromptCard from './components/PromptCard.vue'
import PromptPreviewDrawer from './components/PromptPreviewDrawer.vue'
import PromptEditDrawer from './components/PromptEditDrawer.vue'

defineOptions({ name: 'PromptTemplate' })

const categories = ref<PromptCategory[]>([...DEFAULT_PROMPT_CATEGORIES])
const activeFilter = ref<PromptScope | PromptCategoryCode | 'all'>('all')
const previewVisible = ref(false)
const editVisible = ref(false)
const selectedTemplate = ref<PromptTemplateType | null>(null)
const editingTemplate = ref<PromptTemplateType | null>(null)
const keyword = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const { list, total, loading, query, load, selectFilter, search, changePage } = usePromptList()
const showPagination = computed(() => total.value > query.pageSize)
const favoriteCount = computed(() => list.value.filter((template) => template.favorited).length)

async function loadCategories() {
  try {
    categories.value = await promptTemplateApi.categories()
  } catch {
    categories.value = [...DEFAULT_PROMPT_CATEGORIES]
  }
}

async function handleFilter(value: PromptScope | PromptCategoryCode | 'all') {
  activeFilter.value = value
  await selectFilter(value)
}

function handleSearchInput(value: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void search(value), 300)
}

function handleSearchClear() {
  if (searchTimer) clearTimeout(searchTimer)
  void search('')
}

async function openPreview(template: PromptTemplateType) {
  try {
    selectedTemplate.value = await promptTemplateApi.detail(template.id)
    previewVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || '模板详情加载失败')
  }
}

function openCreate() {
  editingTemplate.value = null
  editVisible.value = true
}

function openEdit(template: PromptTemplateType) {
  previewVisible.value = false
  editingTemplate.value = template
  editVisible.value = true
}

async function copyContent(template: PromptTemplateType) {
  try {
    await navigator.clipboard.writeText(template.content)
    ElMessage.success('提示词正文已复制，请在 LLM 节点的系统提示词中粘贴并替换占位符')
  } catch {
    ElMessage.error('复制失败，请手动复制提示词正文')
  }
}

async function removeTemplate(template: PromptTemplateType) {
  if (!template.owned) return
  try {
    await ElMessageBox.confirm(`确认删除提示词“${template.title}”吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await promptTemplateApi.remove(template.id)
    ElMessage.success('提示词已删除')
    if (selectedTemplate.value?.id === template.id) {
      previewVisible.value = false
      selectedTemplate.value = null
    }
    await load()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.message || '提示词删除失败')
  }
}

async function handleSaved() {
  await load()
}

onMounted(() => {
  void Promise.all([loadCategories(), load()])
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="prompt-page">
    <section class="prompt-shell">
      <PromptHeader :total="total" :current-count="list.length" :favorite-count="favoriteCount" />

      <div class="prompt-content">
        <div class="prompt-toolbar">
          <PromptCategoryTabs
            :model-value="activeFilter"
            :categories="categories"
            @update:model-value="handleFilter"
          />
          <el-input
            v-model="keyword"
            class="search-input"
            clearable
            placeholder="搜索提示词标题或描述"
            aria-label="搜索提示词模板"
            @input="handleSearchInput"
            @clear="handleSearchClear"
          >
            <template #prefix><Icon icon="tabler:search" /></template>
          </el-input>
        </div>

        <div v-loading="loading" class="prompt-list-area">
          <div class="prompt-grid">
            <PromptCreateCard @create="openCreate" />
            <PromptCard
              v-for="template in list"
              :key="template.id"
              :template="template"
              @open="openPreview"
              @copy="copyContent"
              @edit="openEdit"
              @remove="removeTemplate"
            />
          </div>

          <div v-if="!loading && !list.length" class="empty-state">
            <p>当前筛选下还没有提示词模板</p>
            <span>可以调整分类或创建一个新的模板。</span>
          </div>

          <el-pagination
            v-if="showPagination"
            class="pagination"
            background
            layout="prev, pager, next"
            :current-page="query.pageNum"
            :page-size="query.pageSize"
            :total="total"
            @current-change="changePage"
          />
        </div>
      </div>
    </section>

    <PromptPreviewDrawer
      v-model="previewVisible"
      :template="selectedTemplate"
      @edit="openEdit"
      @copy-content="copyContent"
    />

    <PromptEditDrawer
      v-model="editVisible"
      :template="editingTemplate"
      :categories="categories"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped lang="less">
@import url('@/styles/prompt-template.less');

:global(.layout-main) {
  padding: 0 !important;
  background: @app-bg !important;
}

.prompt-page {
  width: 100%;
  min-height: 100%;
  padding: @space-xl;
  color: @text-main;
  background: radial-gradient(circle at 0 0, rgb(37 99 235 / 5%), transparent 280px),
    linear-gradient(180deg, #f8faff 0%, @app-bg 42%, @app-bg 100%);
  box-sizing: border-box;
}

.prompt-shell {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 18px;
}

.prompt-content {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 18px;
  background: rgb(248 250 255 / 70%);
  border: 1px solid @border;
  border-radius: @radius-panel;
  flex-direction: column;
  gap: 16px;
}

.prompt-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 14px;

  :deep(.prompt-cats) {
    flex: 1;
    margin-bottom: 0;
  }
}

.search-input {
  width: min(320px, 100%);
  margin-left: auto;

  :deep(.el-input__wrapper) {
    height: 42px;
    border-radius: @radius-control;
    box-shadow: 0 0 0 1px #dbe5f5 inset;
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow:
      0 0 0 1px @primary inset,
      @shadow-selected;
  }
}

.prompt-list-area {
  min-height: 240px;
}

.prompt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  align-content: start;
  gap: 14px;
}

.empty-state {
  padding: 32px 0 14px;
  color: @text-secondary;
  text-align: center;

  p {
    margin: 0 0 5px;
    font-size: 13px;
    font-weight: 600;
    color: @text-main;
  }

  span {
    font-size: 12px;
  }
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 22px;
}

@media (width <= 720px) {
  .prompt-page {
    padding: 16px;
  }

  .prompt-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-input {
    width: 100%;
    margin-left: 0;
  }
}
</style>
