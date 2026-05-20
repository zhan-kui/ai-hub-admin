import { computed, type ComputedRef } from 'vue'
import type { CanvasGraphEdge, CanvasGraphNode } from '../types'
import type { VariableSource } from './types'

export function useVariableSources(
  currentNodeId: ComputedRef<string>,
  nodes: ComputedRef<CanvasGraphNode[]>,
  edges: ComputedRef<CanvasGraphEdge[]>
): ComputedRef<VariableSource[]> {
  const hasKnowledgeUpstream = computed(() => {
    return edges.value.some((edge) => {
      if (edge.target !== currentNodeId.value) return false
      const upstream = nodes.value.find((node) => node.id === edge.source)
      return upstream?.data?.nodeType === 'knowledge-retrieval'
    })
  })

  return computed<VariableSource[]>(() => {
    const list: VariableSource[] = []

    if (hasKnowledgeUpstream.value) {
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
    list.push({
      key: 'sys.files',
      label: '用户文件',
      description: '当前对话用户上传的文件',
      group: 'system',
      insertText: '{{#sys.files#}}',
      icon: 'Files'
    })

    return list
  })
}
