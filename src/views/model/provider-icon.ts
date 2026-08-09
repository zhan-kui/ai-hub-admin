/**
 * 供应商图标解析。
 *
 * 优先级：本地自定义图标 > Dify 图标（走后端代理）> 首字母色块。
 *
 * ── 想换成自己的图标怎么做 ──────────────────────────────
 * 把图片丢进 `src/assets/model-providers/`，文件名用下面任意一种，重新构建即生效，
 * 不用改这里的代码：
 *   1) 全限定名把 `/` 换成 `-` ：langgenius-tongyi-tongyi.png
 *   2) 只写末段              ：tongyi.png
 *   3) 整个前缀兜底          ：langgenius.png
 * 支持 png / jpg / jpeg / svg / webp。
 */

import { providerIconUrl } from '@/api/model'
import type { I18nText, ModelProvider, ProviderIconType } from '@/api/model'

const localIcons = import.meta.glob('../../assets/model-providers/*.{png,jpg,jpeg,svg,webp}', {
  eager: true,
  import: 'default'
}) as Record<string, string>

/** 文件名（去扩展名、转小写）-> 图片地址 */
const localIconMap: Record<string, string> = Object.create(null)
for (const [path, url] of Object.entries(localIcons)) {
  const fileName = path
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '')
    ?.toLowerCase()
  if (fileName) localIconMap[fileName] = url
}

const AVATAR_COLORS = [
  '#5B8FF9',
  '#61DDAA',
  '#65789B',
  '#F6BD16',
  '#7262FD',
  '#78D3F8',
  '#9661BC',
  '#F6903D',
  '#008685',
  '#F08BB4'
]

export interface ProviderIcon {
  /** 有图就是图片地址，没图为空字符串 */
  src: string
  /** 没图时展示的首字母 */
  initial: string
  /** 没图时的底色，按 provider 名 hash，同一供应商固定 */
  color: string
}

export function pickI18n(value?: I18nText, fallback = ''): string {
  return value?.zh_Hans || value?.en_US || fallback
}

export function providerName(provider: ModelProvider): string {
  return pickI18n(provider.label, provider.provider.split('/').at(-1) || provider.provider)
}

function hashColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function findLocalIcon(provider: string): string {
  const full = provider.replace(/\//g, '-').toLowerCase()
  const last = (provider.split('/').at(-1) || provider).toLowerCase()
  const first = (provider.split('/')[0] || provider).toLowerCase()
  return localIconMap[full] || localIconMap[last] || localIconMap[first] || ''
}

function remoteIcon(provider: ModelProvider, iconType: ProviderIconType): string {
  const raw = provider[iconType]
  if (!raw) return ''
  const value = pickI18n(raw)
  if (!value) return ''
  // 同源相对路径或内联图，直接用
  if (value.startsWith('/') || value.startsWith('data:')) return value
  return providerIconUrl(provider.provider, iconType, raw.zh_Hans ? 'zh_Hans' : 'en_US')
}

export function resolveProviderIcon(
  provider: ModelProvider,
  size: 'small' | 'large' = 'small'
): ProviderIcon {
  const name = providerName(provider)
  return {
    src:
      findLocalIcon(provider.provider) ||
      remoteIcon(provider, size === 'large' ? 'icon_large' : 'icon_small'),
    initial: (name.trim()[0] || '?').toUpperCase(),
    color: hashColor(provider.provider)
  }
}
