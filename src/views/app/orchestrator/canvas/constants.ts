import type { IfCondition, LlmNodeData } from './types'

export const MAX_NODES = 20
export const MAX_IF_CASES = 5

export const DEFAULT_ICON = '🤖'
export const DEFAULT_ICON_BG = '#FFEAD5'
export const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.85 }

export const NODE_DIMENSIONS = {
  start: { width: 242, height: 72 },
  llm: { width: 242, height: 87 },
  'if-else': { width: 242, height: 171 },
  'knowledge-retrieval': { width: 242, height: 89 },
  answer: { width: 242, height: 102 }
} as const

export const DEFAULT_MODEL: Required<LlmNodeData['model']> = {
  provider: 'langgenius/openai_api_compatible/openai_api_compatible',
  name: 'Qwen3.5-35B-A3B',
  temperature: 0.7,
  enableThinking: false,
  reasoningEffort: 'medium'
}

export const DEFAULT_CLASSIFIER_MODEL: Required<LlmNodeData['model']> = {
  provider: 'langgenius/openai_api_compatible/openai_api_compatible',
  name: 'qwen3.5-35b-a3b-fast-v1',
  temperature: 0.1,
  enableThinking: false,
  reasoningEffort: 'medium'
}

export interface ModelOption {
  label: string
  value: string
  provider: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    label: 'Qwen 3.5 35B-A3B',
    value: 'Qwen3.5-35B-A3B',
    provider: 'langgenius/openai_api_compatible/openai_api_compatible'
  },
  {
    label: 'Qwen 3.5 35B-A3B Fast V1',
    value: 'qwen3.5-35b-a3b-fast-v1',
    provider: 'langgenius/openai_api_compatible/openai_api_compatible'
  },
  {
    label: 'DeepSeek V3 (待验证)',
    value: 'deepseek-v3',
    provider: 'langgenius/openai_api_compatible/openai_api_compatible'
  }
]

export const IF_OPERATORS: Array<{ label: string; value: IfCondition['operator'] }> = [
  { label: '包含', value: 'contains' },
  { label: '不包含', value: 'not contains' },
  { label: '等于', value: 'is' },
  { label: '不等于', value: 'is not' },
  { label: '为空', value: 'empty' },
  { label: '非空', value: 'not empty' },
  { label: '开头是', value: 'start with' },
  { label: '结尾是', value: 'end with' }
]
