export type PromptScope = 'all' | 'official' | 'mine' | 'fav'

export type PromptCategoryCode =
  | 'role'
  | 'code'
  | 'write'
  | 'trans'
  | 'market'
  | 'data'
  | 'office'
  | 'other'

export interface ApiResponse<T> {
  code: number
  message: string
  errorCode?: string
  data?: T
}

export interface PageResult<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}

export interface PromptVariable {
  name: string
  description: string
}

export interface PromptTemplate {
  id: string
  title: string
  description?: string
  content: string
  category: PromptCategoryCode
  categoryName: string
  variables: PromptVariable[]
  icon?: string
  source: 'OFFICIAL' | 'CUSTOM'
  useCount: number
  favorited: boolean
  owned: boolean
  createTime: string
}

export interface PromptQuery {
  scope?: PromptScope
  category?: PromptCategoryCode
  keyword?: string
  pageNum?: number
  pageSize?: number
}

export interface PromptSaveRequest {
  title: string
  description?: string
  content: string
  category: PromptCategoryCode
  icon?: string
  variables?: PromptVariable[]
}

export interface PromptCategory {
  code: PromptCategoryCode
  name: string
}
