import type { CanvasGraphEdge, CanvasGraphNode, CanvasNodeType, IfCase, IfCondition } from './types'
import { DEFAULT_MODEL } from './constants'

export function genNodeId(type: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `node_${type}_${Date.now()}_${rand}`
}

export function genEdgeId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `edge_${Date.now()}_${rand}`
}

export function genCaseId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `case_${Date.now()}_${rand}`
}

export function needCaseValue(operator: IfCondition['operator']): boolean {
  return operator !== 'empty' && operator !== 'not empty'
}

export function createDefaultCase(): IfCase {
  return {
    id: genCaseId(),
    label: '分支 1',
    conditions: [
      {
        id: genCaseId(),
        variableSelector: ['sys', 'query'],
        operator: 'contains',
        value: ''
      }
    ],
    logicalOperator: 'and'
  }
}

export function toNodeIdType(nodeType: CanvasNodeType): string {
  if (nodeType === 'if-else') return 'if'
  return nodeType
}

export function createNode(
  nodeType: Exclude<CanvasNodeType, 'start'>,
  position: { x: number; y: number }
): CanvasGraphNode {
  const id = genNodeId(toNodeIdType(nodeType))

  if (nodeType === 'llm') {
    return {
      id,
      type: 'llm',
      position,
      data: {
        nodeType: 'llm',
        title: 'LLM',
        systemPrompt: '',
        userPromptTemplate: '{{#sys.query#}}',
        model: { ...DEFAULT_MODEL },
        memory: { enabled: true, windowEnabled: false, windowSize: 10 }
      }
    }
  }

  if (nodeType === 'if-else') {
    return {
      id,
      type: 'if-else',
      position,
      data: {
        nodeType: 'if-else',
        title: '条件分支',
        cases: [createDefaultCase()],
        elseEnabled: true,
        elseLabel: '否则'
      }
    }
  }

  if (nodeType === 'knowledge-retrieval') {
    return {
      id,
      type: 'knowledge-retrieval',
      position,
      data: {
        nodeType: 'knowledge-retrieval',
        title: '知识检索',
        datasetIds: []
      }
    }
  }

  return {
    id,
    type: 'answer',
    position,
    data: {
      nodeType: 'answer',
      title: '直接回复',
      answerMode: 'auto',
      answerText: ''
    }
  }
}

export function createStartNode(): CanvasGraphNode {
  return {
    id: 'node_start_001',
    type: 'start',
    position: { x: 80, y: 240 },
    data: {
      nodeType: 'start',
      title: '用户输入',
      variables: []
    }
  }
}

export function isDuplicateEdge(
  edges: CanvasGraphEdge[],
  source: string,
  target: string,
  sourceHandle?: string | null
): boolean {
  return edges.some(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      (edge.sourceHandle || '') === (sourceHandle || '')
  )
}
