export interface VariableSource {
  key: string
  label: string
  description?: string
  group: 'context' | 'system' | 'start_var' | 'node_output'
  insertText: string
  icon?: string
  readonly?: boolean
}
