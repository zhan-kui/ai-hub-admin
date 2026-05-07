import { ref, type Ref } from 'vue'
import type { SelectionSnapshot } from '../types'

export function useTextSelection(containerRef: Ref<HTMLElement | null>) {
  const currentSnapshot = ref<SelectionSnapshot | null>(null)

  const isTextarea = (element: EventTarget | null): element is HTMLTextAreaElement =>
    element instanceof HTMLTextAreaElement

  const extractContext = (
    container: HTMLElement,
    range: Range,
    prefixChars: number,
    suffixChars: number
  ) => {
    const beforeRange = document.createRange()
    beforeRange.setStart(container, 0)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const prefix = beforeRange.toString().slice(-prefixChars)

    const afterRange = document.createRange()
    afterRange.setStart(range.endContainer, range.endOffset)
    afterRange.setEnd(container, container.childNodes.length)
    const suffix = afterRange.toString().slice(0, suffixChars)

    return { prefix, suffix }
  }

  const snapshot = (
    options: { prefixChars?: number; suffixChars?: number } = {}
  ): SelectionSnapshot | null => {
    const { prefixChars = 500, suffixChars = 200 } = options
    const container = containerRef.value
    if (!container) return null

    const activeElement = document.activeElement
    if (isTextarea(activeElement) && container.contains(activeElement)) {
      const start = activeElement.selectionStart ?? 0
      const end = activeElement.selectionEnd ?? 0
      if (start === end) return null

      const fullText = activeElement.value
      const selectedText = fullText.slice(start, end)
      const prefix = fullText.slice(Math.max(0, start - prefixChars), start)
      const suffix = fullText.slice(end, Math.min(fullText.length, end + suffixChars))

      const nextSnapshot: SelectionSnapshot = {
        text: selectedText,
        prefix,
        suffix,
        range: null,
        textareaStart: start,
        textareaEnd: end,
        rect: activeElement.getBoundingClientRect()
      }

      currentSnapshot.value = nextSnapshot
      return nextSnapshot
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null
    }

    const range = selection.getRangeAt(0).cloneRange()
    if (!container.contains(range.commonAncestorContainer)) {
      return null
    }

    const selectedText = selection.toString()
    if (!selectedText) {
      return null
    }

    const { prefix, suffix } = extractContext(container, range, prefixChars, suffixChars)

    let rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      rect = container.getBoundingClientRect()
    }

    const nextSnapshot: SelectionSnapshot = {
      text: selectedText,
      prefix,
      suffix,
      range,
      rect
    }

    currentSnapshot.value = nextSnapshot
    return nextSnapshot
  }

  const findTextarea = (): HTMLTextAreaElement | null => {
    const container = containerRef.value
    if (!container) return null
    return container.querySelector('textarea')
  }

  const triggerInput = () => {
    const container = containerRef.value
    if (!container) return
    container.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const normalizeGeneratedText = (text: string): string => {
    const normalizedLineBreaks = text.replace(/\r\n/g, '\n')
    return normalizedLineBreaks.replace(/^\n+/, '').replace(/\n+$/, '')
  }

  const replaceSelection = (selectionSnapshot: SelectionSnapshot, newText: string): boolean => {
    const normalizedText = normalizeGeneratedText(newText)
    if (!normalizedText) return false

    if (
      selectionSnapshot.textareaStart !== undefined &&
      selectionSnapshot.textareaEnd !== undefined
    ) {
      const textarea = findTextarea()
      if (!textarea) return false

      textarea.focus()
      textarea.setRangeText(
        normalizedText,
        selectionSnapshot.textareaStart,
        selectionSnapshot.textareaEnd,
        'end'
      )
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }

    if (!selectionSnapshot.range) {
      return false
    }

    try {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(selectionSnapshot.range)

      if (document.queryCommandSupported?.('insertText')) {
        const inserted = document.execCommand('insertText', false, normalizedText)
        if (inserted) {
          triggerInput()
          return true
        }
      }

      selectionSnapshot.range.deleteContents()
      const textNode = document.createTextNode(normalizedText)
      selectionSnapshot.range.insertNode(textNode)

      const nextRange = document.createRange()
      nextRange.setStartAfter(textNode)
      nextRange.collapse(true)

      selection?.removeAllRanges()
      selection?.addRange(nextRange)
      triggerInput()
      return true
    } catch (error) {
      console.error('[replaceSelection] failed', error)
      return false
    }
  }

  const insertAfterSelection = (selectionSnapshot: SelectionSnapshot, newText: string): boolean => {
    const normalizedText = normalizeGeneratedText(newText)
    if (!normalizedText) return false

    if (
      selectionSnapshot.textareaStart !== undefined &&
      selectionSnapshot.textareaEnd !== undefined
    ) {
      const textarea = findTextarea()
      if (!textarea) return false

      textarea.focus()
      textarea.setRangeText(
        normalizedText,
        selectionSnapshot.textareaEnd,
        selectionSnapshot.textareaEnd,
        'end'
      )
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }

    if (!selectionSnapshot.range) {
      return false
    }

    try {
      const insertRange = selectionSnapshot.range.cloneRange()
      insertRange.collapse(false)

      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(insertRange)

      if (document.queryCommandSupported?.('insertText')) {
        const inserted = document.execCommand('insertText', false, normalizedText)
        if (inserted) {
          triggerInput()
          return true
        }
      }

      const textNode = document.createTextNode(normalizedText)
      insertRange.insertNode(textNode)

      const nextRange = document.createRange()
      nextRange.setStartAfter(textNode)
      nextRange.collapse(true)

      selection?.removeAllRanges()
      selection?.addRange(nextRange)
      triggerInput()
      return true
    } catch (error) {
      console.error('[insertAfterSelection] failed', error)
      return false
    }
  }

  const clear = () => {
    currentSnapshot.value = null
  }

  return {
    currentSnapshot,
    snapshot,
    replaceSelection,
    insertAfterSelection,
    clear
  }
}
