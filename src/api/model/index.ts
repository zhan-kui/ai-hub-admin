import type { AxiosResponse } from 'axios'
import { toDisplayError } from '@/utils/display-text'
import { apiClient, type R } from '@/api/frontend-api'
import type {
  AvailableModelResponse,
  CredentialValidationRequest,
  DefaultModelResponse,
  DefaultModelSetting,
  LocalCredentialMetadata,
  ModelCredentialRequest,
  ModelProviderResponse,
  ModelStatusRequest,
  ModelType,
  ProviderCredentialRequest,
  ProviderIconType,
  SwitchModelCredentialRequest,
  SwitchProviderCredentialRequest,
  ValidateResult
} from './types'

export * from './types'

async function unwrap<T>(promise: Promise<AxiosResponse<R<T>>>): Promise<T> {
  const response = await promise
  const body = response.data
  if (body?.code !== 0 && body?.code !== 200) {
    throw new Error(toDisplayError(body?.message || `接口请求失败：${body?.code}`))
  }
  return body.data
}

const BASE_PATH = '/api/models'

/**
 * 供应商图标走后端代理。
 * Dify 返回的 icon_small 是它自己 CONSOLE_API_URL 拼的地址（自部署常见是 localhost），
 * 浏览器直连取不到图，所以统一由后端转发字节流。
 */
export function providerIconUrl(
  provider: string,
  iconType: ProviderIconType = 'icon_small',
  lang = 'zh_Hans'
): string {
  const base = apiClient.defaults.baseURL?.replace(/\/$/, '') || ''
  const query = new URLSearchParams({ provider, iconType, lang })
  return `${base}${BASE_PATH}/icon?${query.toString()}`
}

export const modelApi = {
  providers: (modelType?: ModelType) =>
    unwrap(
      apiClient.get<R<ModelProviderResponse>>(`${BASE_PATH}/providers`, {
        params: modelType ? { modelType } : undefined
      })
    ),
  local: (provider?: string) =>
    unwrap(
      apiClient.get<R<LocalCredentialMetadata[]>>(`${BASE_PATH}/local`, {
        params: provider ? { provider } : undefined
      })
    ),
  available: (modelType: ModelType) =>
    unwrap(
      apiClient.get<R<AvailableModelResponse>>(`${BASE_PATH}/available`, {
        params: { modelType }
      })
    ),

  /* ── 供应商级凭据 ─────────────────────────────────── */

  /** 连通性校验：返回 { result, error }，result === 'error' 也是 HTTP 200 */
  validateProvider: (data: CredentialValidationRequest) =>
    unwrap(apiClient.post<R<ValidateResult>>(`${BASE_PATH}/providers/credentials/validate`, data)),
  createProviderCredential: (data: ProviderCredentialRequest) =>
    unwrap(apiClient.post<R<Record<string, unknown>>>(`${BASE_PATH}/providers/credentials`, data)),
  updateProviderCredential: (data: ProviderCredentialRequest) =>
    unwrap(apiClient.put<R<Record<string, unknown>>>(`${BASE_PATH}/providers/credentials`, data)),
  removeProviderCredential: (provider: string, credentialId: string) =>
    unwrap(
      apiClient.delete<R<void>>(`${BASE_PATH}/providers/credentials`, {
        data: { provider, credentialId }
      })
    ),
  /** 切换该供应商当前生效的凭据（其余凭据保留为备用） */
  switchProviderCredential: (provider: string, credentialId: string) =>
    unwrap(
      apiClient.post<R<void>>(`${BASE_PATH}/providers/credentials/switch`, {
        provider,
        credentialId
      } satisfies SwitchProviderCredentialRequest)
    ),

  /* ── 模型级凭据 ───────────────────────────────────── */

  validateCustomModel: (data: CredentialValidationRequest) =>
    unwrap(apiClient.post<R<ValidateResult>>(`${BASE_PATH}/custom/validate`, data)),
  createCustomModel: (data: ModelCredentialRequest) =>
    unwrap(apiClient.post<R<Record<string, unknown>>>(`${BASE_PATH}/custom`, data)),
  updateCustomModel: (data: ModelCredentialRequest) =>
    unwrap(apiClient.put<R<Record<string, unknown>>>(`${BASE_PATH}/custom`, data)),
  setCustomModelStatus: (data: ModelStatusRequest) =>
    unwrap(apiClient.patch<R<void>>(`${BASE_PATH}/custom/status`, data)),
  removeCustomModel: (provider: string, model: string, modelType: ModelType) =>
    unwrap(
      apiClient.delete<R<void>>(`${BASE_PATH}/custom`, {
        data: { provider, model, modelType }
      })
    ),
  /** 切换某个自定义模型使用的凭据；模型不在列表里时会顺带把它加进来 */
  switchModelCredential: (data: SwitchModelCredentialRequest) =>
    unwrap(apiClient.post<R<void>>(`${BASE_PATH}/custom/credentials/switch`, data)),

  /* ── 默认模型 ─────────────────────────────────────── */

  defaultModel: (modelType: ModelType) =>
    unwrap(
      apiClient.get<R<DefaultModelResponse>>(`${BASE_PATH}/default`, {
        params: { modelType }
      })
    ),
  setDefaultModel: (modelSettings: DefaultModelSetting[]) =>
    unwrap(apiClient.post<R<Record<string, unknown>>>(`${BASE_PATH}/default`, { modelSettings }))
}
