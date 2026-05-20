export interface VariableSource {
  key: string
  label: string
  description?: string
  group: 'context' | 'system' | 'node'
  insertText: string
  icon?: string
}
