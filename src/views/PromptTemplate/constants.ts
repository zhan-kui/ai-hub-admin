import type { PromptCategoryCode } from '@/api/promptTemplate'

export const PROMPT_CATEGORY_ICONS: Record<PromptCategoryCode, string> = {
  role: 'tabler:masks-theater',
  code: 'tabler:code',
  write: 'tabler:pencil',
  trans: 'tabler:language',
  market: 'tabler:speakerphone',
  data: 'tabler:chart-bar',
  office: 'tabler:briefcase',
  other: 'tabler:dots'
}

export const DEFAULT_PROMPT_CATEGORIES = [
  { code: 'role', name: '角色扮演' },
  { code: 'code', name: '编程开发' },
  { code: 'write', name: '写作创作' },
  { code: 'trans', name: '翻译润色' },
  { code: 'market', name: '营销文案' },
  { code: 'data', name: '数据分析' },
  { code: 'office', name: '效率办公' },
  { code: 'other', name: '其他' }
] as const

export function resolvePromptIcon(icon: string | undefined, category: PromptCategoryCode): string {
  if (!icon) return PROMPT_CATEGORY_ICONS[category]
  if (icon.startsWith('ti-')) return `tabler:${icon.slice(3)}`
  if (icon.startsWith('vi-tabler:')) return `tabler:${icon.slice('vi-tabler:'.length)}`
  return icon
}
