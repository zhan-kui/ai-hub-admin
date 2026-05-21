import type { CanvasGraphNode } from '../types'

export function inferVarType(
  selector: [string, string],
  nodes: CanvasGraphNode[]
): 'string' | 'number' {
  const [src, key] = selector
  if (src === 'sys') return 'string'

  const startNode = nodes.find((node) => node.id === src)
  if (!startNode || startNode.data?.nodeType !== 'start') return 'string'

  const vars = (startNode.data as { variables?: Array<{ variable?: string; type?: string }> })
    .variables
  const variable = (vars || []).find((item) => item.variable === key)
  if (!variable) return 'string'
  return variable.type === 'number' ? 'number' : 'string'
}

export const STRING_OPERATORS = [
  { label: '包含', value: 'contains' },
  { label: '不包含', value: 'not contains' },
  { label: '等于', value: 'is' },
  { label: '不等于', value: 'is not' },
  { label: '为空', value: 'empty' },
  { label: '不为空', value: 'not empty' },
  { label: '开头是', value: 'start with' },
  { label: '结尾是', value: 'end with' }
] as const

export const NUMBER_OPERATORS = [
  { label: '等于', value: '=' },
  { label: '不等于', value: '≠' },
  { label: '大于', value: '>' },
  { label: '小于', value: '<' },
  { label: '大于等于', value: '≥' },
  { label: '小于等于', value: '≤' },
  { label: '为空', value: 'empty' },
  { label: '不为空', value: 'not empty' }
] as const
