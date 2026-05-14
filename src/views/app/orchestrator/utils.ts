/** 按点号路径在对象上设置值,如 setByPath(obj, 'model.name', 'gpt') */
export function setByPath(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.')
  let cur = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (typeof cur[key] !== 'object' || cur[key] === null) {
      cur[key] = {}
    }
    cur = cur[key]
  }

  cur[keys[keys.length - 1]] = value
}

/** 按点号路径取值,取不到返回 undefined */
export function getByPath(obj: Record<string, any>, path: string): any {
  const keys = path.split('.')
  let cur: any = obj

  for (const key of keys) {
    if (cur == null) return undefined
    cur = cur[key]
  }

  return cur
}
