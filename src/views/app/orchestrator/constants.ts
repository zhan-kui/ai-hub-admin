/**
 * 可选模型列表
 *
 * 第一版写死。后续要切到接口拉取(从后端字典或 Dify Console API),
 * 改成 ref + onMounted 调接口即可,使用方处不用动。
 *
 * provider 字符串严格跟 Dify 一致,千万别瞎写,
 * 不确定的留 TODO 让用户验证。
 */
export interface ModelOption {
  label: string
  value: string
  provider: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    label: 'Qwen 3.5 35B-A3B',
    value: 'qwen3.5-35b-a3b',
    provider: 'langgenius/openai_api_compatible/openai_api_compatible'
  },
  // TODO: 以下两个是占位,请按你 Dify 平台实际挂的模型校对 provider 字符串后再启用
  {
    label: 'DeepSeek V3 (待验证)',
    value: 'deepseek-v3',
    provider: 'langgenius/openai_api_compatible/openai_api_compatible'
  },
  {
    label: 'GPT-4o mini (待验证)',
    value: 'gpt-4o-mini',
    provider: 'langgenius/openai/openai'
  }
]

/** 默认图标背景色 */
export const DEFAULT_ICON_BG = '#FFEAD5'

/** 默认图标 emoji */
export const DEFAULT_ICON = '🤖'
