/// <reference types="vue/jsx" />

declare module 'xgplayer' {
  interface PlayerConfig {
    [key: string]: unknown
    autoplay?: boolean
    el?: Element | string
    poster?: string
    url?: string
  }

  export default class Player {
    constructor(config?: PlayerConfig)
    setConfig(config: Partial<PlayerConfig>): void
    destroy(): void
  }
}

declare module 'monaco-editor' {
  const monaco: any
  export = monaco
}
