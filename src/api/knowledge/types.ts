export interface ApiResult<T> {
  code: number
  errorCode?: string | null
  message?: string
  data: T
}

export interface PageResult<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}

export type IndexingTechnique = 'high_quality' | 'economy'
export type Permission = 'only_me' | 'all_team_members'
export type Visibility = 'private' | 'team' | 'dept' | 'public' | 'custom'
export type SearchMethod =
  | 'keyword_search'
  | 'semantic_search'
  | 'full_text_search'
  | 'hybrid_search'
export type RerankingMode = 'reranking_model' | 'weighted_score'
export type DatasetStatus = 'active' | 'disabled' | 'deleted'

export type ModelType = 'text-embedding' | 'rerank' | 'llm' | 'tts' | 'speech2text' | 'moderation'

export interface ModelOption {
  name: string
  model: string
  provider: string
}

export interface RerankingModel {
  reranking_provider_name: string
  reranking_model_name: string
}

export interface RetrievalModel {
  search_method: SearchMethod
  reranking_enable: boolean
  reranking_mode?: RerankingMode
  reranking_model?: RerankingModel
  top_k: number
  score_threshold_enabled: boolean
  score_threshold?: number | null
}

export interface KnowledgeRetrieveRequest {
  query: string
  external_retrieval_model: {
    top_k: number
    score_threshold: number
    score_threshold_enabled: boolean
  }
}

export interface KnowledgeRetrieveSegment {
  id?: string
  position?: number
  content?: string
  answer?: string | null
  document?: {
    id?: string | null
    name?: string | null
  }
}

export interface KnowledgeRetrieveRecord {
  segment?: KnowledgeRetrieveSegment
  score?: number
  summary?: string | null
}

export interface KnowledgeRetrieveResponse {
  query: string | { content?: string }
  records: KnowledgeRetrieveRecord[]
}

export interface CreateDatasetRequest {
  name: string
  description?: string
  permission?: Permission
  provider?: 'vendor'
  indexing_technique?: IndexingTechnique
  embedding_model?: string
  embedding_model_provider?: string
  retrieval_model?: RetrievalModel
  visibility?: Visibility
  authorized_user_ids?: number[]
}

export type UpdateDatasetRequest = Partial<CreateDatasetRequest>

export interface DatasetVO {
  id: string
  name: string
  description?: string
  provider: string
  permission: Permission
  indexingTechnique: IndexingTechnique
  indexingTechniqueName?: string
  embeddingModel?: string | null
  embeddingModelProvider?: string | null
  searchMethod?: SearchMethod | null
  searchMethodName?: string
  rerankingEnable?: boolean
  rerankingMode?: RerankingMode
  rerankingProviderName?: string
  rerankingModelName?: string
  topK?: number | null
  scoreThresholdEnabled?: boolean
  scoreThreshold?: number | null
  documentCount: number
  wordCount: number
  totalDocuments?: number
  totalAvailableDocuments?: number
  visibility: Visibility
  visibilityName?: string
  status: DatasetStatus
  statusName?: string
  ownerUserId: number
  ownerUserName?: string
  createdTime: string
  updatedTime: string
  retrievalModel?: RetrievalModel
  authorizedUserIds?: number[]
}

export type IndexingStatus =
  | 'waiting'
  | 'parsing'
  | 'cleaning'
  | 'splitting'
  | 'indexing'
  | 'completed'
  | 'error'
  | 'paused'

export interface DocumentVO {
  id: string
  position?: number
  data_source_type?: string
  name: string
  created_from?: string
  created_by?: string
  created_at?: number
  tokens?: number
  indexing_status: IndexingStatus
  error?: string | null
  enabled?: boolean
  archived?: boolean
  display_status?: string
  word_count?: number
  hit_count?: number
  doc_form?: string
  doc_language?: string
  completed_at?: number | null
  updated_at?: number | null
  segment_count?: number | null
  average_segment_length?: number | null
}

export interface DocumentPageResult {
  data: DocumentVO[]
  has_more: boolean
  limit: number
  total: number
  page: number
}

export interface PreProcessingRule {
  id: 'remove_extra_spaces' | 'remove_urls_emails'
  enabled: boolean
}

export interface Segmentation {
  separator: string
  max_tokens: number
  chunk_overlap?: number
}

export interface ProcessRule {
  mode: 'custom' | 'automatic' | 'hierarchical'
  rules?: {
    pre_processing_rules?: PreProcessingRule[]
    segmentation?: Segmentation
    parent_mode?: 'paragraph' | 'full-doc'
    subchunk_segmentation?: Segmentation
  }
}

export interface CreateDocByFileData {
  indexing_technique: IndexingTechnique
  doc_form?: 'text_model' | 'hierarchical_model'
  doc_language?: string
  process_rule?: ProcessRule
  embedding_model?: string
  embedding_model_provider?: string
}

export interface CreateDocByFileResult {
  document: { id: string; name: string; indexing_status: IndexingStatus }
  batch: string
}

export interface IndexingStatusItem {
  id: string
  indexing_status: IndexingStatus
  processing_started_at?: number | null
  parsing_completed_at?: number | null
  cleaning_completed_at?: number | null
  splitting_completed_at?: number | null
  completed_at?: number | null
  paused_at?: number | null
  error?: string | null
  stopped_at?: number | null
  completed_segments?: number | null
  total_segments?: number | null
}
