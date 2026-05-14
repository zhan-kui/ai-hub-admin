/** 字段 schema 的可选项定义 */
export interface FieldOption {
  label: string
  value: any
}

/** 字段 schema —— 通用框架的核心 */
export interface FieldSchema {
  /**
   * 字段路径,用点号分隔,如 'model.name'、'model.temperature'、'systemPrompt'
   * 这个 key 直接对应 OrchestrationPayload.nodes[i].config 里的字段路径
   */
  key: string
  /** 表单标签 */
  label: string
  /** 字段说明,放在 form-item 下方或 tooltip */
  help?: string
  /** 控件类型 */
  type: 'input' | 'textarea' | 'select' | 'input-number' | 'switch'
  /** 是否必填 */
  required?: boolean
  /** 默认值 */
  default?: any
  /** select 用,选项列表 */
  options?: FieldOption[]
  /** input-number 用 */
  min?: number
  max?: number
  step?: number
  /** textarea 用 */
  rows?: number
  /** 占位符 */
  placeholder?: string
}

/** 模板节点定义 */
export interface TemplateNode {
  /** 节点 id,如 'llm'、'start'、'answer' */
  id: string
  /** 节点类型,如 'start' | 'llm' | 'answer' | 'if-else' */
  type: string
  /** 节点显示标题 */
  title: string
  /** 节点是否可编辑(用户点击后弹抽屉) */
  editable: boolean
  /** 该节点可编辑的字段 schema */
  fields?: FieldSchema[]
}

/** 模板边定义 */
export interface TemplateEdge {
  /** 起始节点 id */
  source: string
  /** 目标节点 id */
  target: string
}

/** 模板元信息 */
export interface TemplateMeta {
  /** 模板编码,唯一,如 simple_chat */
  code: string
  /** 模板展示名 */
  name: string
  /** 模板描述 */
  description: string
  /** 模板图标 emoji */
  icon: string
  /** 图标背景色 */
  iconBackground: string
  /** Dify 应用模式,如 advanced-chat / workflow / chat */
  mode: string
  /** 节点拓扑 */
  nodes: TemplateNode[]
  /** 节点连线 */
  edges: TemplateEdge[]
  /** 应用元信息字段 schema（可选） */
  appMetaFields?: FieldSchema[]
}

/** 应用元信息 */
export interface AppMeta {
  name: string
  description: string
  icon: string
  iconBackground: string
}

/** 从模板创建应用请求体 */
export interface CreateFromTemplateRequest {
  /** 用哪个模板,对应 TemplateMeta.code */
  templateCode: string
  /** 应用元信息 */
  appMeta: AppMeta
  /** 节点配置数组 */
  nodes: Array<{
    /** 节点 id,跟 TemplateNode.id 对应 */
    id: string
    /** 节点类型,跟 TemplateNode.type 对应 */
    type: string
    /** 用户填写的扁平配置 */
    config: Record<string, any>
  }>
}

/** 从模板创建应用成功响应 */
export interface CreateFromTemplateResponse {
  /** app_config 表主键 */
  id: number
  /** Dify 应用 id(也用作 appCode) */
  difyAppId: string
  /** Dify API key */
  difyApiKey: string
  /** 应用名 */
  appName: string
  /** 应用模式 */
  mode: string
  /** 模板编码 */
  templateCode: string
}

/** 编排页本地状态:用户在表单里填到一半的数据 */
export interface OrchestrationDraft {
  templateCode: string
  appMeta: AppMeta
  /** key: 节点 id; value: 该节点 config 对象(扁平,key 为 FieldSchema.key) */
  nodeConfigs: Record<string, Record<string, any>>
}
