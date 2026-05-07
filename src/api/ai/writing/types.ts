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
  continue: 2,
  polish: 3
}
