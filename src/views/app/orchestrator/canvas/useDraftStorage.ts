import { DRAFT_KEY } from './constants'
import type { CanvasDraft } from './types'

export function useDraftStorage() {
  function loadDraft(): CanvasDraft | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return null
      return JSON.parse(raw) as CanvasDraft
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
