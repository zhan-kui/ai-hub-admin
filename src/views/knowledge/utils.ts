import type { DatasetVO } from '@/api/knowledge/types'

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function fileIcon(name: string): string {
  const ext = fileExt(name)
  if (ext === 'pdf') return 'vi-vscode-icons:file-type-pdf2'
  if (['doc', 'docx'].includes(ext)) return 'vi-vscode-icons:file-type-word'
  if (['md', 'markdown'].includes(ext)) return 'vi-vscode-icons:file-type-markdown'
  if (['csv', 'xls', 'xlsx'].includes(ext)) return 'vi-vscode-icons:file-type-excel'
  if (['html', 'htm'].includes(ext)) return 'vi-vscode-icons:file-type-html'
  if (ext === 'txt') return 'vi-vscode-icons:file-type-text'
  return 'vi-carbon:document'
}

export function fmtTs(ts?: number | null): string {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`
}

export function compactNumber(value?: number | null): string {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return '0'
  if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 0 : 1)}w`
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`
  return String(num)
}

export function datasetInitial(row: Pick<DatasetVO, 'name'>): string {
  const name = String(row.name || '').trim()
  return name ? name.charAt(0).toUpperCase() : 'K'
}

export function avatarColor(row: Pick<DatasetVO, 'name' | 'id'>): string {
  const colors = ['#2563eb', '#0f766e', '#7c3aed', '#0891b2', '#db2777', '#d97706']
  const text = `${row.name || ''}${row.id || ''}`
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return colors[hash % colors.length]
}
