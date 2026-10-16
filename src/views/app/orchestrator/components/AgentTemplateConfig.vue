<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Connection, Cpu, Link, MagicStick, Operation } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  capabilityOptionsApi,
  type CapabilityMcpServerOption,
  type CapabilitySkillOption,
  type CapabilityToolOption
} from '@/api/frontend-api'
import { knowledgeModelApi } from '@/api/knowledge'
import type { ModelOption } from '@/api/knowledge/types'

const props = defineProps<{
  modelValue: Record<string, any>
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: Record<string, any>): void
}>()

const loading = ref(false)
const models = ref<ModelOption[]>([])
const tools = ref<CapabilityToolOption[]>([])
const skills = ref<CapabilitySkillOption[]>([])
const mcpServers = ref<CapabilityMcpServerOption[]>([])

function patch(value: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...value })
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : []
}

const accessMode = computed<'capability' | 'web'>({
  get: () => (props.modelValue['capability.accessMode'] === 'web' ? 'web' : 'capability'),
  set: (value) =>
    patch({
      'capability.accessMode': value,
      ...(value === 'web' ? { 'capability.skillCodes': [], 'capability.mcpServerCodes': [] } : {})
    })
})

const selectedSkillCodes = computed<string[]>({
  get: () => stringArray(props.modelValue['capability.skillCodes']),
  set: (value) => patch({ 'capability.skillCodes': stringArray(value) })
})

const selectedMcpServerCodes = computed<string[]>({
  get: () => stringArray(props.modelValue['capability.mcpServerCodes']),
  set: (value) => patch({ 'capability.mcpServerCodes': stringArray(value) })
})

const modelKey = computed({
  get: () => {
    const provider = String(props.modelValue['model.provider'] || '')
    const name = String(props.modelValue['model.name'] || '')
    return name ? `${provider}::${name}` : ''
  },
  set: (value: string) => {
    const selected = modelOptions.value.find((item) => item.value === value)
    if (selected) {
      patch({ 'model.provider': selected.provider, 'model.name': selected.model })
    }
  }
})

const modelOptions = computed(() => {
  const options = models.value.map((item) => ({
    label: item.name || item.model,
    value: `${item.provider}::${item.model}`,
    provider: item.provider,
    model: item.model
  }))
  const current = modelKey.value
  if (current && !options.some((item) => item.value === current)) {
    options.unshift({
      label: String(props.modelValue['model.name'] || '当前模型'),
      value: current,
      provider: String(props.modelValue['model.provider'] || ''),
      model: String(props.modelValue['model.name'] || '')
    })
  }
  return options
})

const enableThinking = computed({
  get: () => Boolean(props.modelValue['model.enableThinking']),
  set: (value: boolean) => patch({ 'model.enableThinking': value })
})

const temperatureEnabled = computed({
  get: () => Boolean(props.modelValue['model.temperatureEnabled']),
  set: (value: boolean) => patch({ 'model.temperatureEnabled': value })
})

const temperature = computed({
  get: () => Number(props.modelValue['model.temperature'] ?? 0.3),
  set: (value: number) => patch({ 'model.temperature': value })
})

const maximumIterations = computed({
  get: () => Number(props.modelValue.maximumIterations ?? 7),
  set: (value: number) => patch({ maximumIterations: value })
})

const invalidSkillCodes = computed(() => {
  const available = new Set(skills.value.map((item) => item.skillCode))
  return selectedSkillCodes.value.filter((code) => !available.has(code))
})

const invalidMcpServerCodes = computed(() => {
  const available = new Set(mcpServers.value.map((item) => item.serverCode))
  return selectedMcpServerCodes.value.filter((code) => !available.has(code))
})

const selectedSkills = computed(() => {
  const selected = new Set(selectedSkillCodes.value)
  return skills.value.filter((item) => selected.has(item.skillCode))
})

const selectedMcpServers = computed(() => {
  const selected = new Set(selectedMcpServerCodes.value)
  return mcpServers.value.filter((item) => selected.has(item.serverCode))
})

const selectedSkillToolCodes = computed(() =>
  stringArray(selectedSkills.value.flatMap((item) => item.boundToolCodes || []))
)

const selectedMcpToolCodes = computed(() =>
  stringArray(selectedMcpServers.value.flatMap((item) => item.toolCodes || []))
)

const selectedMcpToolCount = computed(() => selectedMcpToolCodes.value.length)

const effectiveToolCount = computed(
  () => new Set([...selectedSkillToolCodes.value, ...selectedMcpToolCodes.value]).size
)

const toolNameByCode = computed(
  () => new Map(tools.value.map((item) => [item.toolCode, item.toolName || item.toolCode]))
)

function toolDisplayName(toolCode: string): string {
  return toolNameByCode.value.get(toolCode) || toolCode
}

function visibleToolCodes(toolCodes: string[]): string[] {
  return toolCodes.slice(0, 5)
}

function remainingToolNames(toolCodes: string[]): string {
  return toolCodes
    .slice(5)
    .map((code) => toolDisplayName(code))
    .join('、')
}

async function loadOptions() {
  loading.value = true
  try {
    const [modelResult, capabilityResult] = await Promise.all([
      knowledgeModelApi.getAvailableModels('llm'),
      capabilityOptionsApi.list()
    ])
    models.value = modelResult || []
    tools.value = capabilityResult.tools || []
    skills.value = capabilityResult.skills || []
    mcpServers.value = capabilityResult.mcpServers || []
  } catch (error: any) {
    ElMessage.error(error?.message || 'Agent 配置选项加载失败')
  } finally {
    loading.value = false
  }
}

function validate(): boolean {
  if (!String(props.modelValue['model.name'] || '').trim()) {
    ElMessage.warning('请选择大语言模型')
    return false
  }
  if (maximumIterations.value < 1 || maximumIterations.value > 50) {
    ElMessage.warning('最大迭代次数必须在 1 到 50 之间')
    return false
  }
  if (temperatureEnabled.value && (temperature.value < 0 || temperature.value > 2)) {
    ElMessage.warning('温度必须在 0 到 2 之间')
    return false
  }
  if (
    accessMode.value === 'web' &&
    (selectedSkillCodes.value.length || selectedMcpServerCodes.value.length)
  ) {
    ElMessage.warning('联网模式不能同时配置 Skill 或 MCP')
    return false
  }
  if (invalidSkillCodes.value.length || invalidMcpServerCodes.value.length) {
    ElMessage.warning('存在已停用或不存在的能力，请重新选择')
    return false
  }
  return true
}

defineExpose({ validate })

onMounted(() => {
  void loadOptions()
})
</script>

<template>
  <div v-loading="loading" class="agent-config-grid">
    <div class="agent-config-main">
      <section class="agent-config-card">
        <div class="card-heading">
          <span class="heading-icon"><Operation /></span>
          <div>
            <h3>运行模式</h3>
            <p>联网搜索与固定 Skill、MCP 服务互斥</p>
          </div>
        </div>
        <div class="mode-grid">
          <button
            type="button"
            class="mode-option"
            :class="{ active: accessMode === 'capability' }"
            @click="accessMode = 'capability'"
          >
            <MagicStick />
            <span><strong>固定能力</strong><small>使用指定 Skill 与 MCP 服务</small></span>
          </button>
          <button
            type="button"
            class="mode-option"
            :class="{ active: accessMode === 'web' }"
            @click="accessMode = 'web'"
          >
            <Connection />
            <span><strong>联网搜索</strong><small>仅允许调用系统联网工具</small></span>
          </button>
        </div>
      </section>

      <section class="agent-config-card" :class="{ muted: accessMode === 'web' }">
        <div class="card-heading">
          <span class="heading-icon purple"><MagicStick /></span>
          <div>
            <h3>固定 Skill</h3>
            <p>Agent 对话时只能读取这里选中的技能</p>
          </div>
        </div>
        <el-select
          v-model="selectedSkillCodes"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          fit-input-width
          popper-class="agent-capability-select-popper"
          :disabled="accessMode === 'web'"
          placeholder="选择允许使用的 Skill，可留空"
          class="full-width"
        >
          <el-option
            v-for="skill in skills"
            :key="skill.skillCode"
            :label="skill.displayName"
            :value="skill.skillCode"
          >
            <div class="option-row">
              <strong>{{ skill.displayName }}</strong>
              <span>绑定 {{ skill.boundToolCodes?.length || 0 }} 个工具</span>
            </div>
          </el-option>
        </el-select>

        <div v-if="selectedSkills.length" class="capability-detail-list">
          <div v-for="skill in selectedSkills" :key="skill.skillCode" class="capability-detail">
            <div class="capability-detail__head">
              <strong>{{ skill.displayName }}</strong>
              <span>Skill 自动带入 {{ skill.boundToolCodes?.length || 0 }} 个工具</span>
            </div>
            <div v-if="skill.boundToolCodes?.length" class="tool-chip-list">
              <span
                v-for="toolCode in visibleToolCodes(skill.boundToolCodes)"
                :key="toolCode"
                class="tool-chip"
                :title="toolCode"
              >
                {{ toolDisplayName(toolCode) }}
              </span>
              <el-tooltip
                v-if="skill.boundToolCodes.length > 5"
                :content="remainingToolNames(skill.boundToolCodes)"
                placement="top"
              >
                <span class="tool-chip tool-chip--more"
                  >+{{ skill.boundToolCodes.length - 5 }}</span
                >
              </el-tooltip>
            </div>
            <span v-else class="capability-detail__empty">暂未绑定工具</span>
          </div>
        </div>
      </section>

      <section class="agent-config-card" :class="{ muted: accessMode === 'web' }">
        <div class="card-heading">
          <span class="heading-icon cyan"><Link /></span>
          <div>
            <h3>固定 MCP 服务</h3>
            <p>自动允许所选服务下当前启用的全部工具</p>
          </div>
        </div>
        <el-select
          v-model="selectedMcpServerCodes"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          fit-input-width
          popper-class="agent-capability-select-popper"
          :disabled="accessMode === 'web'"
          placeholder="选择 MCP 服务，可留空"
          class="full-width"
        >
          <el-option
            v-for="server in mcpServers"
            :key="server.serverCode"
            :label="server.serverName"
            :value="server.serverCode"
          >
            <div class="option-row">
              <strong>{{ server.serverName }}</strong>
              <span>{{ server.toolCodes.length }} 个可用工具</span>
            </div>
          </el-option>
        </el-select>

        <div v-if="selectedMcpServers.length" class="capability-detail-list">
          <div
            v-for="server in selectedMcpServers"
            :key="server.serverCode"
            class="capability-detail"
          >
            <div class="capability-detail__head">
              <strong>{{ server.serverName }}</strong>
              <span>包含 {{ server.toolCodes.length }} 个启用工具</span>
            </div>
            <div v-if="server.toolCodes.length" class="tool-chip-list">
              <span
                v-for="toolCode in visibleToolCodes(server.toolCodes)"
                :key="toolCode"
                class="tool-chip"
                :title="toolCode"
              >
                {{ toolDisplayName(toolCode) }}
              </span>
              <el-tooltip
                v-if="server.toolCodes.length > 5"
                :content="remainingToolNames(server.toolCodes)"
                placement="top"
              >
                <span class="tool-chip tool-chip--more">+{{ server.toolCodes.length - 5 }}</span>
              </el-tooltip>
            </div>
            <span v-else class="capability-detail__empty">当前没有启用工具</span>
          </div>
        </div>
      </section>

      <el-alert
        v-if="invalidSkillCodes.length || invalidMcpServerCodes.length"
        type="warning"
        :closable="false"
        title="草稿中存在已停用或不存在的能力，请重新选择后保存。"
      />
    </div>

    <aside class="agent-config-side">
      <section class="agent-config-card sticky-card">
        <div class="card-heading">
          <span class="heading-icon blue"><Cpu /></span>
          <div>
            <h3>推理模型</h3>
            <p>控制 Agent 的规划与工具调用过程</p>
          </div>
        </div>

        <div class="field-block">
          <label>大语言模型</label>
          <el-select v-model="modelKey" filterable placeholder="请选择模型" class="full-width">
            <el-option
              v-for="item in modelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="switch-row">
          <div><strong>思维链</strong><small>允许模型输出内部推理过程</small></div>
          <el-switch v-model="enableThinking" />
        </div>

        <div class="switch-row">
          <div><strong>温度</strong><small>关闭时不会向 AI 模型服务输出 temperature</small></div>
          <el-switch v-model="temperatureEnabled" />
        </div>

        <div v-if="temperatureEnabled" class="temperature-row">
          <el-slider v-model="temperature" :min="0" :max="2" :step="0.1" />
          <el-input-number v-model="temperature" :min="0" :max="2" :step="0.1" :precision="1" />
        </div>

        <div class="field-block">
          <label>最大迭代次数</label>
          <el-input-number
            v-model="maximumIterations"
            :min="1"
            :max="50"
            controls-position="right"
            class="full-width"
          />
        </div>
      </section>

      <section class="summary-card">
        <div class="summary-title">配置概览</div>
        <div class="summary-row"
          ><span>运行模式</span
          ><strong>{{ accessMode === 'web' ? '联网搜索' : '固定能力' }}</strong></div
        >
        <div class="summary-row"
          ><span>Skill</span><strong>{{ selectedSkillCodes.length }} 个</strong></div
        >
        <div class="summary-row"
          ><span>Skill 关联工具</span><strong>{{ selectedSkillToolCodes.length }} 个</strong></div
        >
        <div class="summary-row"
          ><span>MCP 工具</span><strong>{{ selectedMcpToolCount }} 个</strong></div
        >
        <div class="summary-row"
          ><span>可用工具（去重）</span><strong>{{ effectiveToolCount }} 个</strong></div
        >
        <div class="summary-row"
          ><span>思维链</span><strong>{{ enableThinking ? '开启' : '关闭' }}</strong></div
        >
      </section>
    </aside>
  </div>
</template>

<style scoped lang="less">
.agent-config-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 20px;
  align-items: start;
}

.agent-config-main,
.agent-config-side {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.agent-config-card,
.summary-card {
  padding: 22px;
  background: #fff;
  border: 1px solid #e8edf4;
  border-radius: 14px;
  box-shadow: 0 8px 28px rgb(15 23 42 / 4%);
}

.agent-config-card.muted {
  background: #f8fafc;
}

.card-heading {
  display: flex;
  margin-bottom: 18px;
  align-items: center;
  gap: 12px;

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 15px;
    color: #172033;
  }

  p {
    margin-top: 3px;
    font-size: 12px;
    color: #7b879b;
  }
}

.heading-icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  color: #2563eb;
  background: #eaf1ff;
  border-radius: 10px;
  align-items: center;
  justify-content: center;

  &.purple {
    color: #7c3aed;
    background: #f1eafe;
  }

  &.cyan {
    color: #0891b2;
    background: #e5f7fb;
  }

  &.blue {
    color: #1d4ed8;
    background: #e8f0ff;
  }
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mode-option {
  display: flex;
  padding: 15px;
  color: #64748b;
  text-align: left;
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: 0.2s ease;
  align-items: center;
  gap: 12px;

  svg {
    width: 22px;
  }

  span {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  strong {
    font-size: 14px;
    color: #334155;
  }

  small {
    font-size: 12px;
    color: #94a3b8;
  }

  &.active {
    color: #2563eb;
    background: #eff6ff;
    border-color: #93b4f8;
    box-shadow: 0 0 0 2px rgb(37 99 235 / 8%);
  }
}

.full-width {
  width: 100%;
}

.option-row {
  display: flex;
  width: 100%;
  min-width: 0;
  justify-content: space-between;
  gap: 12px;

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    max-width: 42%;
    overflow: hidden;
    color: #94a3b8;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }
}

:global(.agent-capability-select-popper .el-select-dropdown__item) {
  padding-right: 48px;
}

:global(
  .agent-capability-select-popper
    .el-select-dropdown.is-multiple
    .el-select-dropdown__item.is-selected::after
) {
  right: 16px;
}

.capability-detail-list {
  display: flex;
  margin-top: 12px;
  flex-direction: column;
  gap: 8px;
}

.capability-detail {
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e6edf5;
  border-radius: 9px;
}

.capability-detail__head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
  }
}

.tool-chip-list {
  display: flex;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-chip {
  display: inline-flex;
  max-width: 180px;
  padding: 3px 8px;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.4;
  color: #475569;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #fff;
  border: 1px solid #dbe5f0;
  border-radius: 6px;
  align-items: center;
}

.tool-chip--more {
  color: #2563eb;
  cursor: help;
  background: #eff6ff;
  border-color: #cfe0fb;
}

.capability-detail__empty {
  display: inline-block;
  margin-top: 7px;
  font-size: 11px;
  color: #94a3b8;
}

.sticky-card {
  position: sticky;
  top: 16px;
}

.field-block {
  margin-top: 18px;

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
  }
}

.switch-row {
  display: flex;
  padding: 15px 0;
  border-bottom: 1px solid #edf1f6;
  align-items: center;
  justify-content: space-between;

  div {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  strong {
    font-size: 13px;
    color: #334155;
  }

  small {
    font-size: 11px;
    color: #94a3b8;
  }
}

.temperature-row {
  display: grid;
  grid-template-columns: 1fr 105px;
  margin-top: 14px;
  gap: 14px;
  align-items: center;
}

.summary-card {
  color: #64748b;
  background: linear-gradient(145deg, #f8fbff, #f1f6fd);
  border-color: #dce7f5;
  box-shadow: 0 8px 24px rgb(51 65 85 / 5%);
}

.summary-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
}

.summary-row {
  display: flex;
  padding: 9px 0;
  font-size: 12px;
  border-bottom: 1px solid #e3ebf5;
  justify-content: space-between;

  &:last-child {
    border-bottom: 0;
  }

  strong {
    color: #2563eb;
  }
}

@media (width <= 960px) {
  .agent-config-grid {
    grid-template-columns: 1fr;
  }

  .sticky-card {
    position: static;
  }
}

@media (width <= 640px) {
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
