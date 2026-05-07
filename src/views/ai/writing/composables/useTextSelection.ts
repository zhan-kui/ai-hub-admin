import { ref, toRaw, type Ref } from 'vue'
import { SlateEditor, SlateRange, type IDomEditor } from '@wangeditor/editor'
import type { SelectionSnapshot } from '../types'

type EditorSelection = NonNullable<IDomEditor['selection']>

function cloneSlateSelection(
  selection: EditorSelection | null | undefined
): EditorSelection | null {
  if (!selection) {
    return null
  }

  return JSON.parse(JSON.stringify(selection)) as EditorSelection
}

function getSelectionRect(container: HTMLElement): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return container.getBoundingClientRect()
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return container.getBoundingClientRect()
  }

  return rect
}

function normalizeGeneratedHtml(html: string): string {
  return html.trim()
}

function getRawSelection(selection: SelectionSnapshot['slateSelection']): EditorSelection | null {
  return cloneSlateSelection(toRaw(selection) as EditorSelection | null | undefined)
}

export function useTextSelection(
  containerRef: Ref<HTMLElement | null>,
  getEditor: () => IDomEditor | null
) {
  const currentSnapshot = ref<SelectionSnapshot | null>(null)

  const snapshot = (
    options: { prefixChars?: number; suffixChars?: number } = {}
  ): SelectionSnapshot | null => {
    const { prefixChars = 500, suffixChars = 200 } = options
    const container = containerRef.value
    const editor = getEditor()

    if (!container || !editor || !editor.selection) {
      return null
    }

    const currentSelection = cloneSlateSelection(editor.selection)
    if (!currentSelection || SlateRange.isCollapsed(currentSelection)) {
      return null
    }

    const selectedText = editor.getSelectionText()
    if (!selectedText.trim()) {
      return null
    }

    const selectionStart = SlateRange.start(currentSelection)
    const selectionEnd = SlateRange.end(currentSelection)
    const editorStart = SlateEditor.start(editor, [])
    const editorEnd = SlateEditor.end(editor, [])

    const prefix =
      SlateEditor.string(editor, { anchor: editorStart, focus: selectionStart }).slice(
        -prefixChars
      ) || ''
    const suffix =
      SlateEditor.string(editor, { anchor: selectionEnd, focus: editorEnd }).slice(
        0,
        suffixChars
      ) || ''

    const nextSnapshot: SelectionSnapshot = {
      text: selectedText,
      prefix,
      suffix,
      slateSelection: currentSelection,
      rect: getSelectionRect(container)
    }

    currentSnapshot.value = nextSnapshot
    return nextSnapshot
  }

  const replaceSelection = (selectionSnapshot: SelectionSnapshot, html: string): boolean => {
    const normalizedHtml = normalizeGeneratedHtml(html)
    const editor = getEditor()

    if (!normalizedHtml || !editor || !selectionSnapshot.slateSelection) {
      return false
    }

    try {
      const rawSelection = getRawSelection(selectionSnapshot.slateSelection)
      if (!rawSelection) {
        return false
      }

      editor.focus()
      editor.select(rawSelection)
      editor.deleteFragment()
      editor.dangerouslyInsertHtml(normalizedHtml)
      return true
    } catch (error) {
      console.error('[replaceSelection] failed', error)
      return false
    }
  }

  const insertAfterSelection = (selectionSnapshot: SelectionSnapshot, html: string): boolean => {
    const normalizedHtml = normalizeGeneratedHtml(html)
    const editor = getEditor()

    if (!normalizedHtml || !editor || !selectionSnapshot.slateSelection) {
      return false
    }

    try {
      const rawSelection = getRawSelection(selectionSnapshot.slateSelection)
      if (!rawSelection) {
        return false
      }

      const selectionEnd = SlateRange.end(rawSelection)
      editor.focus()
      editor.select({ anchor: selectionEnd, focus: selectionEnd })
      editor.dangerouslyInsertHtml(normalizedHtml)
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
