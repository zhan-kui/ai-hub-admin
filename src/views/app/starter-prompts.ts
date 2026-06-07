import type { AppStarterPrompt, PromptIconKey } from '@/api/frontend-api'

export const PROMPT_ICON_KEYS: PromptIconKey[] = ['spark', 'code', 'doc', 'idea']

export const PROMPT_ICON_OPTIONS: Array<{ label: string; value: PromptIconKey }> = [
  { label: 'Spark', value: 'spark' },
  { label: 'Code', value: 'code' },
  { label: 'Doc', value: 'doc' },
  { label: 'Idea', value: 'idea' }
]

const DEFAULT_STARTER_PROMPTS: AppStarterPrompt[] = [
  {
    iconKey: 'spark',
    title: '介绍一下你自己',
    description: '了解 AI 助手的能力范围',
    prompt: '你好，请介绍一下你的能力以及我可以如何使用你。'
  },
  {
    iconKey: 'code',
    title: '帮我写一段代码',
    description: '生成、调试或优化代码片段',
    prompt: '帮我写一个 Python 函数，用于计算斐波那契数列的第 n 项。'
  },
  {
    iconKey: 'doc',
    title: '分析文档内容',
    description: '上传文件后基于内容提问',
    prompt: '请帮我总结这份文档的核心观点，并列出三个关键要点。'
  },
  {
    iconKey: 'idea',
    title: '创意头脑风暴',
    description: '为业务场景提供多样化思路',
    prompt: '我想为一款面向企业的 AI 产品策划一次线上发布会，请给我 5 个创意方向。'
  }
]

export function cloneStarterPrompts(prompts: AppStarterPrompt[]): AppStarterPrompt[] {
  return prompts.map((item) => ({ ...item }))
}

export function createDefaultStarterPrompts(): AppStarterPrompt[] {
  return cloneStarterPrompts(DEFAULT_STARTER_PROMPTS)
}

export function normalizeStarterPrompts(
  value: unknown,
  fallbackToDefault = true
): AppStarterPrompt[] {
  if (!Array.isArray(value)) {
    return fallbackToDefault ? createDefaultStarterPrompts() : []
  }

  const normalized = value
    .slice(0, 4)
    .map((item, index) => {
      const record =
        typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
      const title = String(record.title || '').trim()
      const description = String(record.description || '').trim()
      const prompt = String(record.prompt || '').trim()
      const rawIcon = String(record.iconKey || '').trim() as PromptIconKey
      const iconKey = PROMPT_ICON_KEYS.includes(rawIcon) ? rawIcon : PROMPT_ICON_KEYS[index % 4]
      if (!title || !description || !prompt) return null
      return { title, description, prompt, iconKey }
    })
    .filter((item): item is AppStarterPrompt => Boolean(item))

  if (normalized.length > 0) {
    return normalized
  }

  return fallbackToDefault ? createDefaultStarterPrompts() : []
}
