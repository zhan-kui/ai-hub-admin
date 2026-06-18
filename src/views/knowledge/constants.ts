import type { IndexingStatus, SearchMethod } from '@/api/knowledge/types'

export const DATASET_MODES = [
  {
    value: 'high_quality',
    title: '高质量',
    desc: '使用向量嵌入和可选重排，适合问答与语义检索。',
    badge: '推荐',
    tone: 'primary',
    needModel: true
  },
  {
    value: 'economy',
    title: '经济',
    desc: '使用关键词倒排索引，适合关键词匹配和低成本场景。',
    badge: '低成本',
    tone: 'teal',
    needModel: false
  }
] as const

export const SEARCH_METHODS: { value: SearchMethod; label: string }[] = [
  { value: 'hybrid_search', label: '混合检索' },
  { value: 'semantic_search', label: '语义检索' },
  { value: 'full_text_search', label: '全文检索' },
  { value: 'keyword_search', label: '关键词检索' }
]

export const SEPARATOR_PRESETS = [
  { value: '\n\n', label: '空行（段落）\\n\\n' },
  { value: '\n', label: '换行\\n' },
  { value: '。', label: '中文句号。' },
  { value: '__custom__', label: '自定义...' }
]

export const INDEXING_STATUS_MAP: Record<
  IndexingStatus,
  { text: string; tone: 'wait' | 'run' | 'done' | 'fail' }
> = {
  waiting: { text: '排队中', tone: 'wait' },
  parsing: { text: '解析中', tone: 'run' },
  cleaning: { text: '清洗中', tone: 'run' },
  splitting: { text: '切分中', tone: 'run' },
  indexing: { text: '索引中', tone: 'run' },
  completed: { text: '已完成', tone: 'done' },
  error: { text: '失败', tone: 'fail' },
  paused: { text: '已暂停', tone: 'wait' }
}

export const RUNNING_STATUSES: IndexingStatus[] = [
  'waiting',
  'parsing',
  'cleaning',
  'splitting',
  'indexing'
]
