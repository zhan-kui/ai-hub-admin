import { computed, type Ref } from 'vue'
import type { CanvasAppMeta, CanvasGraphEdge, CanvasGraphNode, IfElseNodeData } from './types'
import { MAX_IF_CASES, MAX_NODES } from './constants'
import { needCaseValue } from './utils'

interface ValidationResult {
  valid: boolean
  errors: string[]
}

function findPathCycle(nodes: CanvasGraphNode[], edges: CanvasGraphEdge[]): boolean {
  const graph = new Map<string, string[]>()
  for (const node of nodes) graph.set(node.id, [])
  for (const edge of edges) {
    const list = graph.get(edge.source)
    if (list) list.push(edge.target)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()

  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visiting.add(nodeId)
    const next = graph.get(nodeId) || []
    for (const target of next) {
      if (dfs(target)) return true
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  return nodes.some((node) => dfs(node.id))
}

function validateFlow(
  appMeta: CanvasAppMeta,
  nodes: CanvasGraphNode[],
  edges: CanvasGraphEdge[]
): ValidationResult {
  const errors: string[] = []
  const nodeMap = new Map<string, CanvasGraphNode>()

  if (!appMeta.name?.trim()) {
    errors.push('应用名称不能为空')
  }

  if (!nodes.length) {
    errors.push('流程中至少需要 1 个节点')
  }

  if (nodes.length > MAX_NODES) {
    errors.push(`节点数量不能超过 ${MAX_NODES} 个`)
  }

  for (const node of nodes) {
    if (nodeMap.has(node.id)) {
      errors.push(`节点 ID 重复: ${node.id}`)
    } else {
      nodeMap.set(node.id, node)
    }
  }

  const edgeUniq = new Set<string>()
  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      errors.push(`连线 ${edge.id} 的源或目标节点不存在`)
      continue
    }

    if (edge.source === edge.target) {
      errors.push(`连线 ${edge.id} 不允许自连`)
    }

    const key = `${edge.source}->${edge.target}->${edge.sourceHandle || ''}`
    if (edgeUniq.has(key)) {
      errors.push(`存在重复连线: ${edge.source} -> ${edge.target}`)
    }
    edgeUniq.add(key)
  }

  const startNodes = nodes.filter((node) => node.data?.nodeType === 'start')
  if (startNodes.length !== 1) {
    errors.push('必须有且只有 1 个 start 节点')
  }

  const answerNodes = nodes.filter((node) => node.data?.nodeType === 'answer')
  if (answerNodes.length < 1) {
    errors.push('至少需要 1 个 answer 节点')
  }

  const incomersMap = new Map<string, CanvasGraphEdge[]>()
  const outgoersMap = new Map<string, CanvasGraphEdge[]>()
  for (const node of nodes) {
    incomersMap.set(node.id, [])
    outgoersMap.set(node.id, [])
  }

  for (const edge of edges) {
    incomersMap.get(edge.target)?.push(edge)
    outgoersMap.get(edge.source)?.push(edge)
  }

  for (const node of nodes) {
    const incomers = incomersMap.get(node.id) || []
    const outgoers = outgoersMap.get(node.id) || []
    const nodeData = node.data
    if (!nodeData) {
      errors.push(`节点 ${node.id} 缺少 data`)
      continue
    }

    if (nodeData.nodeType === 'start') {
      if (incomers.length > 0) errors.push('start 节点不能有入线')
      if (outgoers.length > 1) errors.push('start 节点最多 1 条出线')
      for (const edge of outgoers) {
        const targetType = nodeMap.get(edge.target)?.data?.nodeType
        if (targetType !== 'llm' && targetType !== 'if-else') {
          errors.push('start 节点只能连接 llm 或 if-else')
        }
      }
      continue
    }

    if (nodeData.nodeType === 'llm') {
      if (!nodeData.systemPrompt?.trim()) {
        errors.push(`LLM 节点「${nodeData.title}」未填写系统提示词`)
      }
      if (!nodeData.model?.provider?.trim()) {
        errors.push(`LLM 节点「${nodeData.title}」未填写模型 provider`)
      }
      if (!nodeData.model?.name?.trim()) {
        errors.push(`LLM 节点「${nodeData.title}」未填写模型名称`)
      }
      if (incomers.length < 1) errors.push(`LLM 节点「${nodeData.title}」必须有入线`)
      if (incomers.length > 1) errors.push(`LLM 节点「${nodeData.title}」最多 1 条入线`)
      if (outgoers.length > 1) errors.push(`LLM 节点「${nodeData.title}」最多 1 条出线`)
      for (const edge of outgoers) {
        const targetType = nodeMap.get(edge.target)?.data?.nodeType
        if (targetType !== 'llm' && targetType !== 'if-else' && targetType !== 'answer') {
          errors.push(`LLM 节点「${nodeData.title}」的出线目标不合法`)
        }
      }
      continue
    }

    if (nodeData.nodeType === 'if-else') {
      const ifData = nodeData as IfElseNodeData
      if (incomers.length !== 1) errors.push(`if 节点「${ifData.title}」必须有且只有 1 条入线`)

      if (incomers.length === 1) {
        const firstIncomer = incomers[0]
        const sourceType = firstIncomer
          ? nodeMap.get(firstIncomer.source)?.data?.nodeType
          : undefined
        if (sourceType !== 'start' && sourceType !== 'llm') {
          errors.push(`if 节点「${ifData.title}」的上游只能是 start 或 llm`)
        }
      }

      if (!ifData.cases?.length) errors.push(`if 节点「${ifData.title}」至少需要 1 个分支`)
      if (ifData.cases.length > MAX_IF_CASES) {
        errors.push(`if 节点「${ifData.title}」分支数量不能超过 ${MAX_IF_CASES}`)
      }

      const caseIdSet = new Set<string>()
      for (const item of ifData.cases) {
        if (caseIdSet.has(item.id)) {
          errors.push(`if 节点「${ifData.title}」分支 ID 重复`)
        }
        caseIdSet.add(item.id)

        if (!item.label?.trim()) {
          errors.push(`if 节点「${ifData.title}」存在空的分支名称`)
        }

        if (needCaseValue(item.operator) && !item.value?.trim()) {
          errors.push(`if 节点「${ifData.title}」分支「${item.label || item.id}」未填写判断值`)
        }
      }

      const caseOutCount: Record<string, number> = {}
      for (const edge of outgoers) {
        if (!edge.sourceHandle) {
          errors.push(`if 节点「${ifData.title}」出线必须带 sourceCaseId`)
          continue
        }

        if (!caseIdSet.has(edge.sourceHandle)) {
          errors.push(`if 节点「${ifData.title}」出线 sourceCaseId 无效`)
          continue
        }

        const targetType = nodeMap.get(edge.target)?.data?.nodeType
        if (targetType === 'answer') {
          errors.push(`if 节点「${ifData.title}」不能直接连接 answer`)
        }

        caseOutCount[edge.sourceHandle] = (caseOutCount[edge.sourceHandle] || 0) + 1
      }

      for (const item of ifData.cases) {
        const outCount = caseOutCount[item.id] || 0
        if (outCount < 1) errors.push(`if 节点「${ifData.title}」分支「${item.label}」缺少出线`)
        if (outCount > 1)
          errors.push(`if 节点「${ifData.title}」分支「${item.label}」最多 1 条出线`)
      }
      continue
    }

    if (nodeData.nodeType === 'answer') {
      if (outgoers.length > 0) errors.push(`answer 节点「${nodeData.title}」不能有出线`)
      if (incomers.length !== 1)
        errors.push(`answer 节点「${nodeData.title}」必须有且只有 1 条入线`)
      if (incomers.length === 1) {
        const firstIncomer = incomers[0]
        const sourceType = firstIncomer
          ? nodeMap.get(firstIncomer.source)?.data?.nodeType
          : undefined
        if (sourceType !== 'start' && sourceType !== 'llm') {
          errors.push(`answer 节点「${nodeData.title}」上游只能是 start 或 llm`)
        }
      }
    }
  }

  if (findPathCycle(nodes, edges)) {
    errors.push('流程中不允许出现环')
  }

  if (startNodes.length === 1) {
    const startId = startNodes[0].id
    const reachable = new Set<string>([startId])
    const queue = [startId]
    while (queue.length) {
      const current = queue.shift() as string
      const outgoers = outgoersMap.get(current) || []
      for (const edge of outgoers) {
        if (!reachable.has(edge.target)) {
          reachable.add(edge.target)
          queue.push(edge.target)
        }
      }
    }

    for (const answerNode of answerNodes) {
      if (!reachable.has(answerNode.id)) {
        errors.push(`answer 节点「${answerNode.data?.title || answerNode.id}」不可从 start 到达`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function useValidation(
  appMeta: Ref<CanvasAppMeta>,
  nodes: Ref<CanvasGraphNode[]>,
  edges: Ref<CanvasGraphEdge[]>
) {
  const validation = computed(() => validateFlow(appMeta.value, nodes.value, edges.value))
  const errors = computed(() => validation.value.errors)
  const isValid = computed(() => validation.value.valid)

  return {
    errors,
    isValid,
    validateNow: () => validateFlow(appMeta.value, nodes.value, edges.value)
  }
}
