import { ref } from 'vue'
import type {
  CanvasFlowPayload,
  CanvasGraphEdge,
  CanvasGraphNode,
  CanvasNodeData,
  CanvasNodeType,
  CanvasSnapshotPayload,
  CanvasViewport
} from './types'
import { createNode, createStartNode } from './utils'

export function useCanvasState() {
  const nodes = ref<CanvasGraphNode[]>([decorateNode(createStartNode())])
  const edges = ref<CanvasGraphEdge[]>([])
  const viewport = ref<CanvasViewport>({ x: 0, y: 0, zoom: 1 })

  function addNode(nodeType: Exclude<CanvasNodeType, 'start'>, position: { x: number; y: number }) {
    const node = decorateNode(createNode(nodeType, position))
    nodes.value = [...nodes.value, node]
    return node
  }

  function updateNodeData(nodeId: string, nextData: CanvasNodeData) {
    const targetNode = nodes.value.find((node) => node.id === nodeId)
    if (targetNode && targetNode.data) {
      // 用 Object.assign 改变属性，绝不替换 data 对象本身！
      // 这样节点就不会卸载重装，连线点就不会消失！
      Object.assign(targetNode.data, nextData)
    }
  }
  function setViewport(nextViewport: CanvasViewport) {
    viewport.value = nextViewport
  }

  function setGraph(
    nextNodes: CanvasGraphNode[],
    nextEdges: CanvasGraphEdge[],
    nextViewport: CanvasViewport
  ) {
    const hasStart = nextNodes.some((node) => node.data?.nodeType === 'start')
    const normalizedNodes = (hasStart ? nextNodes : [createStartNode(), ...nextNodes]).map((node) =>
      decorateNode(node)
    )
    nodes.value = normalizedNodes
    edges.value = nextEdges
    viewport.value = nextViewport
  }

  function setGraphFromFlow(flow: CanvasFlowPayload['flow'] | CanvasSnapshotPayload['flow']) {
    const nextNodes: CanvasGraphNode[] = (flow.nodes || []).map((node) =>
      decorateNode({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      } as CanvasGraphNode)
    )
    const nextEdges: CanvasGraphEdge[] = (flow.edges || []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: (edge as any).sourceHandle ?? (edge as any).sourceCaseId,
      targetHandle: (edge as any).targetHandle,
      label: (edge as any).label,
      data: (edge as any).data,
      markerEnd: (edge as any).markerEnd,
      style: (edge as any).style,
      type: (edge as any).type || 'smoothstep',
      animated: (edge as any).animated ?? true
    }))
    setGraph(nextNodes, nextEdges, flow.viewport || { x: 0, y: 0, zoom: 1 })
  }

  function resetGraph() {
    nodes.value = [decorateNode(createStartNode())]
    edges.value = []
    viewport.value = { x: 0, y: 0, zoom: 1 }
  }

  return {
    nodes,
    edges,
    viewport,
    addNode,
    updateNodeData,
    setViewport,
    setGraph,
    setGraphFromFlow,
    resetGraph
  }
}

function decorateNode(node: CanvasGraphNode): CanvasGraphNode {
  const nodeType = node.data?.nodeType
  if (nodeType === 'start') {
    const startData = node.data as { variables?: unknown[] }
    if (!Array.isArray(startData.variables)) startData.variables = []
    return {
      ...node,
      type: 'start',
      deletable: false,
      draggable: true,
      selectable: true
    }
  }

  return {
    ...node,
    type: nodeType || node.type,
    deletable: true,
    draggable: true,
    selectable: true
  }
}
