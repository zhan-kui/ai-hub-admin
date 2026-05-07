import type { WritingActionType, WritingGeneratePayload } from '@/api/ai/writing'

export type WritingAction = WritingActionType

export type ContinueLength = 'short' | 'medium' | 'long'

export type PolishStyle = 'default' | 'formal' | 'professional' | 'vivid' | 'concise' | 'casual'

export interface SelectionSnapshot {
  text: string
  prefix: string
  suffix: string
  range: Range | null
  textareaStart?: number
  textareaEnd?: number
  rect: DOMRect | null
}

export interface WritingStreamPayload extends WritingGeneratePayload {
  action: WritingAction
}

export const LENGTH_MAP: Record<ContinueLength, { label: string; limit: string }> = {
  short: { label: '短', limit: '50字以内' },
  medium: { label: '中', limit: '100-200字' },
  long: { label: '长', limit: '300字左右' }
}

export const STYLE_MAP: Record<PolishStyle, { label: string; description: string }> = {
  default: {
    label: '默认润色',
    description: '修正语病、优化措辞并提升流畅度，保持原意不变'
  },
  formal: {
    label: '更正式',
    description: '改写为正式书面语，适合公文、通知、邮件等场景'
  },
  professional: {
    label: '更专业',
    description: '增强专业表达和逻辑严谨性，适合方案、汇报、分析等内容'
  },
  vivid: {
    label: '更生动',
    description: '增强画面感和感染力，让文字更自然、更有表现力'
  },
  concise: {
    label: '更简洁',
    description: '删繁就简，压缩冗余表达，只保留核心信息'
  },
  casual: {
    label: '更口语化',
    description: '改成日常自然的表达方式，读起来更轻松'
  }
}
