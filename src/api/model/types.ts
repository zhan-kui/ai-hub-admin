export type ModelType = 'llm' | 'text-embedding' | 'rerank' | 'speech2text' | 'tts' | 'moderation'

/** 页面筛选用：'' 表示不限类型 */
export type ModelTypeFilter = ModelType | ''

export type CredentialFieldType = 'text-input' | 'secret-input' | 'select' | 'radio' | 'switch'

export type I18nText = Record<string, string>

export interface CredentialOption {
  value: string
  label?: I18nText
}

export interface CredentialShowCondition {
  variable: string
  value: string
}

export interface CredentialFormSchema {
  variable: string
  label?: I18nText
  placeholder?: I18nText
  type: CredentialFieldType
  required?: boolean
  default?: string | boolean | number
  options?: CredentialOption[]
  show_on?: CredentialShowCondition[]
}

export interface CredentialSchemaGroup {
  credential_form_schemas?: CredentialFormSchema[]
}

export interface LocalCredentialMetadata {
  id: number
  scope: 'PROVIDER' | 'MODEL'
  provider: string
  modelName?: string
  modelType?: ModelType
  credentialName: string
  difyCredentialId?: string
  enabled?: boolean
  lastError?: string
  remark?: string
  createBy?: string
  createTime?: string
  updateBy?: string
  updateTime?: string
}

/** 凭据池里的一项，Dify 的 CredentialConfiguration */
export interface CredentialRef {
  credential_id: string
  credential_name: string
}

export interface ProviderCredential extends CredentialRef {
  credentials?: Record<string, string>
  local_metadata?: LocalCredentialMetadata
}

export interface CustomModel {
  model: string
  model_type: ModelType
  status?: string
  credentials?: Record<string, string>
  /** 该模型当前生效的凭据（Dify 1.8+ 每个自定义模型有独立凭据池） */
  current_credential_id?: string
  current_credential_name?: string
  /** 可切换的凭据池，长度 > 1 时页面给下拉 */
  available_model_credentials?: CredentialRef[]
  /** 已建凭据但还没加进模型列表 */
  unadded_to_model_list?: boolean
  local_metadata?: LocalCredentialMetadata
  /** @deprecated Dify 1.8 前的字段，仅为兼容旧响应保留，新代码用 current_credential_id */
  credential_id?: string
  /** @deprecated 同上 */
  credential_name?: string
}

/** Dify 已知、但还没加入模型列表的模型 */
export interface UnaddedModel {
  model: string
  model_type: ModelType
}

export interface ProviderConfiguration {
  status?: 'active' | 'no-configure' | string
  current_credential_id?: string
  current_credential_name?: string
  available_credentials?: ProviderCredential[]
  custom_models?: CustomModel[]
  /** 「添加模型」的候选来源 */
  can_added_models?: UnaddedModel[]
}

export interface ModelProvider {
  provider: string
  label?: I18nText
  icon_small?: I18nText
  icon_large?: I18nText
  supported_model_types?: ModelType[]
  configurate_methods?: Array<'predefined-model' | 'customizable-model' | string>
  provider_credential_schema?: CredentialSchemaGroup
  model_credential_schema?: CredentialSchemaGroup & {
    model?: { label?: I18nText; placeholder?: I18nText }
  }
  custom_configuration?: ProviderConfiguration
}

export interface ModelProviderResponse {
  data: ModelProvider[]
}

export interface CredentialValidationRequest {
  provider: string
  credentialId?: string
  model?: string
  modelType?: ModelType
  credentials: Record<string, string>
}

/**
 * 凭据校验结果。
 * 注意：Dify 校验失败时 HTTP 仍然是 200，靠 result 字段区分，
 * 后端必须原样透传，不要在失败时抛异常。
 */
export interface ValidateResult {
  result: 'success' | 'error'
  error?: string
}

export interface ProviderCredentialRequest {
  provider: string
  credentialId?: string
  credentials: Record<string, string>
  name: string
}

export interface ModelCredentialRequest extends ProviderCredentialRequest {
  model: string
  modelType: ModelType
}

/** 切换供应商当前生效凭据 */
export interface SwitchProviderCredentialRequest {
  provider: string
  credentialId: string
}

/** 切换某个自定义模型使用的凭据 */
export interface SwitchModelCredentialRequest {
  provider: string
  model: string
  modelType: ModelType
  credentialId: string
}

export interface ModelStatusRequest {
  provider: string
  model: string
  modelType: ModelType
  enabled: boolean
}

export interface AvailableModel {
  provider: string
  model: string
  label?: I18nText
  model_type?: ModelType
  status?: string
}

export interface AvailableModelProvider {
  provider: string
  label?: I18nText
  status?: string
  models?: AvailableModel[]
}

export interface AvailableModelResponse {
  data: AvailableModelProvider[]
}

export interface DefaultModelSetting {
  modelType: ModelType
  provider: string
  model: string
}

export interface DefaultModelResponse {
  model_type?: ModelType
  provider?: string
  model?: string
}

/** 供应商图标类型 */
export type ProviderIconType = 'icon_small' | 'icon_large'
