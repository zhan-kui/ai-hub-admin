import type { Edge, Node } from '@vue-flow/core'
import type { CanvasAppMeta, CanvasSnapshotPayload } from './types'

export function buildCanvasSnapshot(options: {
  appMeta: CanvasAppMeta
  nodes: Node[]
  edges: Edge[]
  viewport: { x: number; y: number; zoom: number }
}): CanvasSnapshotPayload {
  return {
    appMeta: clonePlain(options.appMeta),
    flow: {
      nodes: options.nodes.map(cleanNode),
      edges: options.edges.map(cleanEdge),
      viewport: clonePlain(options.viewport)
    }
  }
}

export function restoreCanvasSnapshot(snapshot: CanvasSnapshotPayload): {
  nodes: Node[]
  edges: Edge[]
  viewport: { x: number; y: number; zoom: number }
} {
  return {
    nodes: (snapshot.flow?.nodes || []).map((node) => ({
      ...node,
      selected: false,
      dragging: false,
      position: {
        x: Number(node.position?.x ?? 0),
        y: Number(node.position?.y ?? 0)
      }
    })),
    edges: (snapshot.flow?.edges || []).map((edge) => ({
      ...edge,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      selected: false
    })),
    viewport: snapshot.flow?.viewport || { x: 0, y: 0, zoom: 1 }
  }
}

function cleanNode(node: Node) {
  const data = cleanNodeData(clonePlain(node.data))
  return {
    id: node.id,
    type: node.type,
    position: clonePlain(node.position),
    data,
    width: node.width,
    height: node.height,
    selected: false,
    dragging: false,
    sourcePosition: node.sourcePosition,
    targetPosition: node.targetPosition
  }
}

function cleanNodeData(data: Record<string, any>) {
  if (data?.nodeType === 'knowledge-retrieval') {
    return {
      nodeType: 'knowledge-retrieval',
      title: data.title || '知识检索',
      datasetIds: Array.isArray(data.datasetIds) ? data.datasetIds.map(String) : []
    }
  }
  return data
}

function cleanEdge(edge: Edge) {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    type: edge.type,
    animated: edge.animated,
    label: clonePlain(edge.label),
    data: clonePlain(edge.data),
    markerEnd: clonePlain(edge.markerEnd),
    style: clonePlain(edge.style)
  }
}

function clonePlain<T>(value: T): T {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value)) as T
}
