import { DRAFT_KEY } from './constants'
import type { CanvasDraft } from './types'
import { genCaseId } from './utils'

const LEGACY_KEYS = ['aihub:orchestrator:canvas-draft:v2']

function migrateLegacyDraft(draft: any): CanvasDraft {
  for (const node of draft.nodes || []) {
    if (node?.data?.nodeType === 'start' && !Array.isArray(node.data.variables)) {
      node.data.variables = []
    }
    if (node?.data?.nodeType === 'if-else' && Array.isArray(node.data.cases)) {
      for (const item of node.data.cases) {
        if (!Array.isArray(item.conditions)) {
          item.conditions = [
            {
              id: genCaseId(),
              variableSelector: ['sys', 'query'],
              operator: item.operator || 'contains',
              value: item.value || ''
            }
          ]
          item.logicalOperator = 'and'
          delete item.operator
          delete item.value
        } else {
          item.logicalOperator = 'and'
          for (const condition of item.conditions) {
            if (!condition.id) condition.id = genCaseId()
            if (
              !Array.isArray(condition.variableSelector) ||
              condition.variableSelector.length !== 2
            ) {
              condition.variableSelector = ['sys', 'query']
            }
          }
        }
      }
    }
  }
  return draft as CanvasDraft
}

export function useDraftStorage() {
  function loadDraft(): CanvasDraft | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        return migrateLegacyDraft(JSON.parse(raw))
      }

      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key)
        if (!legacy) continue

        const migrated = migrateLegacyDraft(JSON.parse(legacy))
        localStorage.setItem(DRAFT_KEY, JSON.stringify(migrated))
        localStorage.removeItem(key)
        return migrated
      }

      return null
    } catch {
      return null
    }
  }

  function saveDraft(draft: CanvasDraft) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY)
  }

  function createDebouncedSaver(fn: () => void, delay = 500) {
    let timer: number | undefined
    return () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(fn, delay)
    }
  }

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    createDebouncedSaver
  }
}
