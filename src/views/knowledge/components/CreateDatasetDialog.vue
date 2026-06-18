<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Collection, Connection, Cpu } from '@element-plus/icons-vue'
import { knowledgeApi, knowledgeModelApi } from '@/api/knowledge'
import type {
  CreateDatasetRequest,
  DatasetVO,
  IndexingTechnique,
  ModelOption,
  Permission,
  SearchMethod,
  Visibility
} from '@/api/knowledge/types'
import { DATASET_MODES, SEARCH_METHODS } from '../constants'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  created: [DatasetVO]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const formRef = ref<FormInstance>()
const loadingModels = ref(false)
const submitting = ref(false)
const embeddingModels = ref<ModelOption[]>([])
const rerankModels = ref<ModelOption[]>([])

const form = reactive({
  mode: 'high_quality' as IndexingTechnique,
  name: '',
  description: '',
  permission: 'only_me' as Permission,
  visibility: 'private' as Visibility,
  searchMethod: 'hybrid_search' as SearchMethod,
  topK: 3,
  scoreThresholdEnabled: false,
  scoreThreshold: 0.5,
  embeddingKey: '',
  rerankingEnable: true,
  rerankKey: ''
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入知识库名称', trigger: 'blur' },
    { min: 1, max: 40, message: '名称长度为 1-40 个字符', trigger: 'blur' }
  ],
  embeddingKey: [
    {
      validator: (_rule, value, callback) => {
        if (form.mode === 'high_quality' && !value) callback(new Error('请选择嵌入模型'))
        else callback()
      },
      trigger: 'change'
    }
  ],
  rerankKey: [
    {
      validator: (_rule, value, callback) => {
        if (form.mode === 'high_quality' && form.rerankingEnable && !value) {
          callback(new Error('请选择重排模型'))
          return
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}

const embeddingOptions = computed(() => toSelectOptions(embeddingModels.value))
const rerankOptions = computed(() => toSelectOptions(rerankModels.value))

function toModelKey(model: ModelOption) {
  return `${model.provider}::${model.model}`
}

function fromModelKey(key: string) {
  const [provider, model] = key.split('::')
  return { provider, model }
}

function toSelectOptions(models: ModelOption[]) {
  return models.map((item) => ({
    label: item.name || item.model,
    value: toModelKey(item),
    provider: item.provider,
    model: item.model
  }))
}

function resetForm() {
  form.mode = 'high_quality'
  form.name = ''
  form.description = ''
  form.permission = 'only_me'
  form.visibility = 'private'
  form.searchMethod = 'hybrid_search'
  form.topK = 3
  form.scoreThresholdEnabled = false
  form.scoreThreshold = 0.5
  form.embeddingKey = ''
  form.rerankingEnable = true
  form.rerankKey = ''
  formRef.value?.clearValidate()
}

async function loadModels() {
  if (!visible.value || embeddingModels.value.length) return
  loadingModels.value = true
  try {
    const [embeddings, reranks] = await Promise.all([
      knowledgeModelApi.getAvailableModels('text-embedding'),
      knowledgeModelApi.getAvailableModels('rerank')
    ])
    embeddingModels.value = embeddings || []
    rerankModels.value = reranks || []
    form.embeddingKey = embeddingOptions.value[0]?.value || ''
    form.rerankKey = rerankOptions.value[0]?.value || ''
  } catch (error: any) {
    ElMessage.error(error?.message || '模型列表加载失败')
  } finally {
    loadingModels.value = false
  }
}

function selectMode(mode: IndexingTechnique) {
  form.mode = mode
  form.searchMethod = mode === 'high_quality' ? 'hybrid_search' : 'keyword_search'
  if (mode === 'economy') {
    form.rerankingEnable = false
  }
}

function buildPayload(): CreateDatasetRequest {
  const retrievalModel: CreateDatasetRequest['retrieval_model'] = {
    search_method: form.searchMethod,
    reranking_enable: form.mode === 'high_quality' ? form.rerankingEnable : false,
    top_k: Number(form.topK || 3),
    score_threshold_enabled: Boolean(form.scoreThresholdEnabled),
    score_threshold: form.scoreThresholdEnabled ? Number(form.scoreThreshold || 0) : null
  }

  const payload: CreateDatasetRequest = {
    name: form.name.trim(),
    description: form.description.trim(),
    permission: form.permission,
    provider: 'vendor',
    indexing_technique: form.mode,
    visibility: form.visibility,
    retrieval_model: retrievalModel
  }

  if (form.mode === 'high_quality') {
    const embedding = fromModelKey(form.embeddingKey)
    payload.embedding_model = embedding.model
    payload.embedding_model_provider = embedding.provider
    if (form.rerankingEnable) {
      const rerank = fromModelKey(form.rerankKey)
      retrievalModel.reranking_mode = 'reranking_model'
      retrievalModel.reranking_model = {
        reranking_provider_name: rerank.provider,
        reranking_model_name: rerank.model
      }
    }
  }

  return payload
}

async function submit() {
  if (!formRef.value) return
  await formRef.value.validate()
  submitting.value = true
  try {
    const created = await knowledgeApi.create(buildPayload())
    emit('created', created)
  } catch (error: any) {
    ElMessage.error(error?.message || '知识库创建失败')
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      resetForm()
      void loadModels()
    }
  }
)
</script>

<template>
  <el-dialog v-model="visible" width="760px" class="kb-create-dialog" destroy-on-close align-center>
    <template #header>
      <div class="dialog-head">
        <span>CREATE KNOWLEDGE</span>
        <h3>创建知识库</h3>
        <p>选择索引模式并配置检索模型，创建后进入详情页上传文档。</p>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <div class="mode-grid">
        <button
          v-for="mode in DATASET_MODES"
          :key="mode.value"
          type="button"
          class="mode-card"
          :class="[`mode-${mode.tone}`, { active: form.mode === mode.value }]"
          @click="selectMode(mode.value)"
        >
          <span class="mode-icon">
            <el-icon
              ><Collection v-if="mode.value === 'high_quality'" /><Connection v-else
            /></el-icon>
          </span>
          <span class="mode-copy">
            <strong>{{ mode.title }}</strong>
            <small>{{ mode.desc }}</small>
          </span>
          <em>{{ mode.badge }}</em>
        </button>
      </div>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="知识库名称" prop="name">
            <el-input v-model="form.name" maxlength="40" show-word-limit placeholder="请输入名称" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="可见范围">
            <el-select v-model="form.visibility" class="w-full">
              <el-option label="私有" value="private" />
              <el-option label="团队" value="team" />
              <el-option label="部门" value="dept" />
              <el-option label="公开" value="public" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="160"
          show-word-limit
          placeholder="简要描述知识库用途"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="权限">
            <el-select v-model="form.permission" class="w-full">
              <el-option label="仅自己" value="only_me" />
              <el-option label="全部团队成员" value="all_team_members" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="检索方式">
            <el-select v-model="form.searchMethod" class="w-full">
              <el-option
                v-for="item in SEARCH_METHODS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div v-if="form.mode === 'high_quality'" v-loading="loadingModels" class="model-panel">
        <div class="panel-title">
          <el-icon><Cpu /></el-icon>
          模型配置
        </div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="嵌入模型" prop="embeddingKey">
              <el-select v-model="form.embeddingKey" class="w-full" filterable placeholder="请选择">
                <el-option
                  v-for="item in embeddingOptions"
                  :key="item.value"
                  :label="`${item.label} · ${item.provider}`"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="启用重排">
              <el-switch v-model="form.rerankingEnable" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="form.rerankingEnable" label="重排模型" prop="rerankKey">
          <el-select v-model="form.rerankKey" class="w-full" filterable placeholder="请选择">
            <el-option
              v-for="item in rerankOptions"
              :key="item.value"
              :label="`${item.label} · ${item.provider}`"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">创建并进入详情</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="less">
.dialog-head span {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--primary, #2563eb);
}

.dialog-head h3 {
  margin: 6px 0 4px;
  font-size: 22px;
  color: var(--text-main, #172033);
}

.dialog-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.mode-grid {
  display: grid;
  margin-bottom: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mode-card {
  position: relative;
  display: flex;
  min-height: 112px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 16px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  gap: 12px;
}

.mode-card:hover,
.mode-card.active {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgb(15 23 42 / 6%);
}

.mode-primary.active {
  border-color: #7fa8f7;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 10%);
}

.mode-teal.active {
  border-color: #5eead4;
  box-shadow: 0 0 0 3px rgb(15 118 110 / 10%);
}

.mode-icon {
  display: grid;
  width: 42px;
  height: 42px;
  color: var(--primary, #2563eb);
  background: var(--primary-soft, #eaf1ff);
  border-radius: 14px;
  place-items: center;
  flex-shrink: 0;
}

.mode-teal .mode-icon {
  color: #0f766e;
  background: #ecfdf5;
}

.mode-copy {
  display: block;
  min-width: 0;
  padding-right: 58px;
}

.mode-copy strong,
.mode-copy small {
  display: block;
}

.mode-copy strong {
  font-size: 15px;
  color: var(--text-main, #172033);
}

.mode-copy small {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary, #64748b);
}

.mode-card em {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 3px 8px;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  color: var(--primary, #2563eb);
  background: var(--primary-soft, #eaf1ff);
  border-radius: 999px;
}

.mode-teal em {
  color: #0f766e;
  background: #ecfdf5;
}

.model-panel {
  padding: 14px 14px 2px;
  margin-top: 4px;
  background: var(--panel-soft, #f8faff);
  border: 1px solid var(--border-soft, #e4eaf3);
  border-radius: 16px;
}

.panel-title {
  display: flex;
  margin-bottom: 12px;
  font-weight: 700;
  color: var(--text-main, #172033);
  align-items: center;
  gap: 8px;
}

.w-full {
  width: 100%;
}

@media (width <= 760px) {
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
