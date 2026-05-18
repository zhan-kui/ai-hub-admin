import type { Edge, Node } from '@vue-flow/core'
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasFlowPayload,
  CanvasNodeData,
  CanvasViewport
} from './types'

export interface BuildPayloadOptions {
  appMeta: CanvasFlowPayload['appMeta']
  nodes: Node[]
  edges: Edge[]
  viewport: CanvasViewport
}

export function buildCanvasFlowPayload(options: BuildPayloadOptions): CanvasFlowPayload {
  return {
    appMeta: options.appMeta,
    flow: {
      nodes: options.nodes.map(toFlowNode),
      edges: options.edges.map((edge) => toFlowEdge(edge, options.nodes)),
      viewport: options.viewport
    }
  }
}

function toFlowNode(node: Node): CanvasFlowNode {
  const data = node.data as CanvasNodeData
  return {
    id: node.id,
    type: data.nodeType,
    title: data.title,
    position: {
      x: node.position.x,
      y: node.position.y
    },
    data: cloneData(data)
  }
}

function toFlowEdge(edge: Edge, nodes: Node[]): CanvasFlowEdge {
  const sourceNode = nodes.find((node) => node.id === edge.source)
  const sourceType = (sourceNode?.data as CanvasNodeData | undefined)?.nodeType

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceCaseId: sourceType === 'if-else' ? edge.sourceHandle || undefined : undefined
  }
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
