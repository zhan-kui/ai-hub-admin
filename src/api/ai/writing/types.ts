export type WritingActionType = 'continue' | 'polish'

export interface WritingGeneratePayload {
  query: string
  inputs: {
    selected_text: string
    prefix_context?: string
    suffix_context?: string
    length_limit?: string
  }
}

export const WRITING_APP_ID_MAP: Record<WritingActionType, number> = {
  continue: 9,
  polish: 10
}

export type DocId = string | number

export interface DocListParams {
  page?: number
  size?: number
  keyword?: string
}

export interface DocListItem {
  id: DocId
  title?: string
  content?: string
  updateTime?: string
  wordCount?: number
}

export interface DocListResult {
  list?: DocListItem[]
  records?: DocListItem[]
  items?: DocListItem[]
  total?: number
}

export interface SaveDocPayload {
  id?: DocId
  title: string
  content: string
}

export interface RenameDocPayload {
  id: DocId
  title: string
}
