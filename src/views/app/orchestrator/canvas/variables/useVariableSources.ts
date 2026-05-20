import { computed, type ComputedRef } from 'vue'
import type { CanvasGraphEdge, CanvasGraphNode, StartNodeData } from '../types'
import type { VariableSource } from './types'

export type PromptScene = 'system' | 'user' | 'if-value' | 'generic'

export function useVariableSources(
  scene: ComputedRef<PromptScene>,
  currentNodeId: ComputedRef<string | undefined>,
  nodes: ComputedRef<CanvasGraphNode[]>,
  edges: ComputedRef<CanvasGraphEdge[]>
): ComputedRef<VariableSource[]> {
  const startNode = computed(() =>
    nodes.value.find(
      (node) => (node.data as { nodeType?: string } | undefined)?.nodeType === 'start'
    )
  )

  const hasKnowledgeUpstream = computed(() => {
    if (!currentNodeId.value) return false
    const incoming = edges.value.find((edge) => edge.target === currentNodeId.value)
    if (!incoming) return false
    const upstream = nodes.value.find((node) => node.id === incoming.source)
    return upstream?.data?.nodeType === 'knowledge-retrieval'
  })

  return computed<VariableSource[]>(() => {
    const list: VariableSource[] = []
    const currentScene = scene.value

    if (currentScene === 'system' && hasKnowledgeUpstream.value) {
      list.push({
        key: 'context',
        label: '知识库',
        description: '引用上游知识检索节点的检索结果',
        group: 'context',
        insertText: '{{#context#}}',
        icon: 'Search'
      })
    }

    list.push({
      key: 'sys.query',
      label: '用户输入',
      description: '当前对话用户的原始提问',
      group: 'system',
      insertText: '{{#sys.query#}}',
      icon: 'ChatLineRound'
    })
    if (currentScene !== 'system') {
      list.push({
        key: 'sys.files',
        label: '用户文件',
        description: '当前对话用户上传的文件',
        group: 'system',
        insertText: '{{#sys.files#}}',
        icon: 'Files'
      })
    }

    const startData = startNode.value?.data as StartNodeData | undefined
    const startId = startNode.value?.id
    const variables = startData?.variables || []
    if (!startId) return list
    for (const variable of variables) {
      if (!variable.variable) continue
      list.push({
        key: `${startId}.${variable.variable}`,
        label: variable.label || variable.variable,
        description: '开始节点的自定义输入',
        group: 'start_var',
        insertText: `{{#${startId}.${variable.variable}#}}`
      })
    }

    return list
  })
}
