import type { Edge, Node } from '@vue-flow/core'

export type CanvasNodeType = 'start' | 'llm' | 'if-else' | 'answer'

export interface CanvasAppMeta {
  name: string
  description?: string
  icon: string
  iconBackground?: string
}

export interface BaseNodeData {
  nodeType: CanvasNodeType
  title: string
}

export interface StartNodeData extends BaseNodeData {
  nodeType: 'start'
}

export interface LlmNodeData extends BaseNodeData {
  nodeType: 'llm'
  systemPrompt: string
  userPromptTemplate?: string
  model: {
    provider: string
    name: string
    temperature?: number
    enableThinking?: boolean
    reasoningEffort?: 'low' | 'medium' | 'high'
  }
  memory: {
    enabled?: boolean
    windowSize?: number
  }
}

export interface IfCase {
  id: string
  label: string
  operator:
    | 'contains'
    | 'not contains'
    | 'is'
    | 'is not'
    | 'empty'
    | 'not empty'
    | 'start with'
    | 'end with'
  value?: string
}

export interface IfElseNodeData extends BaseNodeData {
  nodeType: 'if-else'
  cases: IfCase[]
}

export interface AnswerNodeData extends BaseNodeData {
  nodeType: 'answer'
}

export type CanvasNodeData = StartNodeData | LlmNodeData | IfElseNodeData | AnswerNodeData

export type CanvasGraphNode = Node<CanvasNodeData> & { selected?: boolean }

export type CanvasGraphEdge = Edge & { selected?: boolean }

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasFlowNode {
  id: string
  type: CanvasNodeType
  title: string
  position: {
    x: number
    y: number
  }
  data: CanvasNodeData
}

export interface CanvasFlowEdge {
  id: string
  source: string
  target: string
  sourceCaseId?: string
}

export interface CanvasFlowPayload {
  appMeta: CanvasAppMeta
  flow: {
    nodes: CanvasFlowNode[]
    edges: CanvasFlowEdge[]
    viewport: CanvasViewport
  }
}

export interface CanvasDraft {
  appMeta: CanvasAppMeta
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
  viewport: CanvasViewport
  savedAt: number
}
