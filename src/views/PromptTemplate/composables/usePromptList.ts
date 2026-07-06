import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { promptTemplateApi } from '@/api/promptTemplate'
import type {
  PromptCategoryCode,
  PromptQuery,
  PromptScope,
  PromptTemplate
} from '@/api/promptTemplate'

export function usePromptList(initialPageSize = 12) {
  const list = ref<PromptTemplate[]>([])
  const total = ref(0)
  const loading = ref(false)
  const query = reactive<
    Required<Pick<PromptQuery, 'scope' | 'pageNum' | 'pageSize'>> & PromptQuery
  >({
    scope: 'all',
    pageNum: 1,
    pageSize: initialPageSize
  })

  const load = async () => {
    loading.value = true
    try {
      const result = await promptTemplateApi.page(query)
      list.value = result.records || []
      total.value = result.total || 0
      query.pageNum = result.pageNum || query.pageNum
      query.pageSize = result.pageSize || query.pageSize
    } catch (error: any) {
      ElMessage.error(error?.message || '提示词模板加载失败')
    } finally {
      loading.value = false
    }
  }

  const selectFilter = (value: PromptScope | PromptCategoryCode | 'all') => {
    query.pageNum = 1
    if (value === 'mine' || value === 'fav' || value === 'official') {
      query.scope = value
      query.category = undefined
    } else {
      query.scope = 'all'
      query.category = value === 'all' ? undefined : value
    }
    return load()
  }

  const search = (keyword: string) => {
    query.keyword = keyword.trim() || undefined
    query.pageNum = 1
    return load()
  }

  const changePage = (page: number) => {
    query.pageNum = page
    return load()
  }

  const toggleFavorite = async (template: PromptTemplate) => {
    const previous = template.favorited
    template.favorited = !previous
    try {
      if (template.favorited) {
        await promptTemplateApi.favorite(template.id)
      } else {
        await promptTemplateApi.unfavorite(template.id)
      }
      if (query.scope === 'fav' && !template.favorited) {
        await load()
      }
    } catch (error: any) {
      template.favorited = previous
      ElMessage.error(error?.message || '收藏状态更新失败')
    }
  }

  return { list, total, loading, query, load, selectFilter, search, changePage, toggleFavorite }
}
