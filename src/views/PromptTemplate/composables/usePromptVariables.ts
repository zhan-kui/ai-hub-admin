import type { PromptVariable } from '@/api/promptTemplate'

const VARIABLE_RE = /\{\{\s*([^{}]+?)\s*\}\}/g

export function extractVariables(content: string): PromptVariable[] {
  const variables = new Map<string, PromptVariable>()
  let match: RegExpExecArray | null
  VARIABLE_RE.lastIndex = 0
  while ((match = VARIABLE_RE.exec(content))) {
    const name = match[1].trim()
    if (name && !variables.has(name)) {
      variables.set(name, { name, description: '' })
    }
  }
  return [...variables.values()]
}

function escapeHtml(content: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return content.replace(/[&<>"']/g, (character) => entities[character])
}

export function highlightVariables(content: string): string {
  return escapeHtml(content).replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (_source, name: string) => `<span class="vph">{{${name.trim()}}}</span>`
  )
}

export function mergeVariableDescriptions(
  nextVariables: PromptVariable[],
  currentVariables: PromptVariable[]
): PromptVariable[] {
  const descriptions = new Map(
    currentVariables.map((variable) => [variable.name, variable.description])
  )
  return nextVariables.map((variable) => ({
    ...variable,
    description: descriptions.get(variable.name) || ''
  }))
}

export function usePromptVariables() {
  return { extractVariables, highlightVariables, mergeVariableDescriptions }
}
