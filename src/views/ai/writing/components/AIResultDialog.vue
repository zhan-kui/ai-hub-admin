<template>
  <Teleport to="body">
    <Transition name="ai-dialog">
      <div v-if="visible" ref="dialogRef" class="ai-dialog" :style="dialogStyle" @mousedown.stop>
        <div class="ai-dialog__header">
          <div class="ai-dialog__title">
            <Icon
              :icon="action === 'continue' ? 'ep:edit-pen' : 'ep:magic-stick'"
              class="ai-dialog__title-icon"
            />
            <span>{{ action === 'continue' ? 'AI 续写' : 'AI 润色' }}</span>
          </div>

          <el-select
            v-if="action === 'continue'"
            v-model="currentLength"
            size="small"
            class="ai-dialog__select"
            :disabled="isStreaming"
            @change="handleParamChange"
          >
            <el-option
              v-for="(item, key) in LENGTH_MAP"
              :key="key"
              :label="item.label"
              :value="key"
            />
          </el-select>

          <el-select
            v-else
            v-model="currentStyle"
            size="small"
            class="ai-dialog__select"
            :disabled="isStreaming"
            @change="handleParamChange"
          >
            <el-option
              v-for="(item, key) in STYLE_MAP"
              :key="key"
              :label="item.label"
              :value="key"
            />
          </el-select>

          <button class="ai-dialog__close" @click="handleClose">
            <Icon icon="ep:close" />
          </button>
        </div>

        <div ref="contentRef" class="ai-dialog__content">
          <div v-if="errorMsg" class="ai-dialog__error">
            <Icon icon="ep:warning-filled" />
            <span>{{ errorMsg }}</span>
          </div>

          <div v-else class="ai-dialog__content-inner">
            <div class="ai-dialog__text-wrapper">
              <span class="ai-dialog__text">{{ displayText }}</span>
              <!-- 去掉文字 |，改用纯 CSS 绘制光标，更真实 -->
              <span v-if="isStreaming" class="ai-dialog__cursor"></span>
            </div>

            <!-- Google AI Studio 风格的思考状态 -->
            <div v-if="isStreaming" class="ai-dialog__loading">
              <Icon icon="ph:sparkle-fill" class="ai-dialog__loading-icon" />
              <span class="ai-dialog__loading-text">AI 正在思考并生成...</span>
            </div>
          </div>
        </div>

        <div class="ai-dialog__tip">
          <Icon icon="ep:info-filled" />
          <span>AI 生成内容仅供参考，请结合业务场景自行判断。</span>
        </div>

        <div class="ai-dialog__footer">
          <div class="ai-dialog__footer-left">
            <el-button v-if="isStreaming" size="small" @click="handleStop">
              <Icon icon="ep:video-pause" class="mr-4px" />
              停止
            </el-button>
            <el-button v-else size="small" @click="handleRewrite">
              <Icon icon="ep:refresh" class="mr-4px" />
              {{ errorMsg ? '重试' : '重写' }}
            </el-button>
          </div>

          <div class="ai-dialog__footer-right">
            <el-button
              size="small"
              :type="action === 'continue' ? 'primary' : 'default'"
              :disabled="!canApply"
              @click="handleInsert"
            >
              插入
            </el-button>
            <el-button
              size="small"
              :type="action === 'polish' ? 'primary' : 'default'"
              :disabled="!canApply"
              @click="handleReplace"
            >
              替换
            </el-button>
            <el-button size="small" @click="handleClose">关闭</el-button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElButton, ElMessage, ElOption, ElSelect } from 'element-plus'
import { useWritingStream } from '../composables/useWritingStream'
import {
  LENGTH_MAP,
  STYLE_MAP,
  type ContinueLength,
  type PolishStyle,
  type SelectionSnapshot,
  type WritingAction,
  type WritingStreamPayload
} from '../types'

interface Props {
  visible: boolean
  action: WritingAction
  snapshot: SelectionSnapshot | null
  defaultLength?: ContinueLength
  defaultStyle?: PolishStyle
}

const props = withDefaults(defineProps<Props>(), {
  defaultLength: 'medium',
  defaultStyle: 'default'
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'insert', text: string, snapshot: SelectionSnapshot): void
  (e: 'replace', text: string, snapshot: SelectionSnapshot): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const currentLength = ref<ContinueLength>(props.defaultLength)
const currentStyle = ref<PolishStyle>(props.defaultStyle)
const displayText = ref('')
const errorMsg = ref('')

const { isStreaming, start, stop, reset } = useWritingStream()

const canApply = computed(() => !isStreaming.value && !!displayText.value && !errorMsg.value)

const DIALOG_WIDTH = 540 // 稍微加宽一点点，比例更协调
const DIALOG_MAX_HEIGHT = 500
const GAP = 12

const dialogStyle = ref<{ left: string; top: string }>({
  left: '0px',
  top: '0px'
})

const scrollContentToBottom = () => {
  nextTick(() => {
    if (contentRef.value) {
      contentRef.value.scrollTop = contentRef.value.scrollHeight
    }
  })
}

const calcPosition = () => {
  const rect = props.snapshot?.rect
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (!rect) {
    dialogStyle.value = {
      left: `${(viewportWidth - DIALOG_WIDTH) / 2}px`,
      top: `${(viewportHeight - 300) / 2}px`
    }
    return
  }

  let left = rect.left
  let top = rect.bottom + GAP

  if (left + DIALOG_WIDTH > viewportWidth - 16) {
    left = Math.max(16, viewportWidth - DIALOG_WIDTH - 16)
  }

  if (left < 16) {
    left = 16
  }

  if (top + DIALOG_MAX_HEIGHT > viewportHeight - 16) {
    const topAbove = rect.top - GAP - DIALOG_MAX_HEIGHT
    top = topAbove >= 16 ? topAbove : Math.max(16, viewportHeight - DIALOG_MAX_HEIGHT - 16)
  }

  dialogStyle.value = {
    left: `${left}px`,
    top: `${top}px`
  }
}

const buildPayload = (): WritingStreamPayload | null => {
  const snapshot = props.snapshot
  if (!snapshot?.text) {
    return null
  }

  if (props.action === 'continue') {
    const limit = LENGTH_MAP[currentLength.value].limit

    return {
      action: 'continue',
      query: `请根据上下文自然续写选中文本后续内容，保持原文风格、语气和表达一致。续写长度：${limit}。`,
      inputs: {
        selected_text: snapshot.text,
        prefix_context: snapshot.prefix,
        suffix_context: snapshot.suffix,
        length_limit: limit
      }
    }
  }

  const styleDescription = STYLE_MAP[currentStyle.value].description

  return {
    action: 'polish',
    query: `请对选中文本进行润色，要求：${styleDescription}。保留原意和关键事实，输出长度与原文尽量接近。`,
    inputs: {
      selected_text: snapshot.text,
      prefix_context: snapshot.prefix,
      suffix_context: snapshot.suffix,
      length_limit: '与原文字数接近'
    }
  }
}

const fire = async () => {
  const payload = buildPayload()
  if (!payload) {
    errorMsg.value = '未获取到选中文本'
    return
  }

  displayText.value = ''
  errorMsg.value = ''

  await start(payload, {
    onChunk: (text) => {
      // 核心修复：把前面的空格和换行符全部过滤掉，防止弹框前面空几行
      displayText.value = (displayText.value + text).replace(/^\s+/, '')
      scrollContentToBottom()
    },
    onReplace: (text) => {
      displayText.value = text.replace(/^\s+/, '')
      scrollContentToBottom()
    },
    onError: (error) => {
      errorMsg.value = error.message || '生成失败，请稍后重试'
    },
    onDone: () => {
      scrollContentToBottom()
    }
  })
}

const handleStop = async () => {
  await stop()
}

const handleRewrite = () => {
  void fire()
}

const handleParamChange = () => {
  void fire()
}

const handleInsert = () => {
  if (!canApply.value || !props.snapshot) return
  emit('insert', displayText.value, props.snapshot)
  ElMessage.success('已插入')
  void handleClose()
}

const handleReplace = () => {
  if (!canApply.value || !props.snapshot) return
  emit('replace', displayText.value, props.snapshot)
  ElMessage.success('已替换，可使用 Ctrl+Z 撤销')
  void handleClose()
}

const handleClose = async () => {
  await stop()
  emit('update:visible', false)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.visible && event.key === 'Escape') {
    void handleClose()
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      currentLength.value = props.defaultLength
      currentStyle.value = props.defaultStyle
      displayText.value = ''
      errorMsg.value = ''
      await reset()

      await nextTick()
      calcPosition()
      void fire()
      return
    }

    void stop()
  }
)

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', handleKeydown)
      window.addEventListener('resize', calcPosition)
      return
    }

    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', calcPosition)
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', calcPosition)
  void stop()
})
</script>

<style lang="less" scoped>
/* 弹窗基础容器 */
.ai-dialog {
  position: fixed;
  z-index: 2999;
  display: flex;
  flex-direction: column;
  width: 540px;
  max-height: 500px;
  overflow: hidden;
  background: #ffffff;
  border-radius: 12px;
  /* 优化了阴影效果，更具悬浮立体感 */
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.04);
}

/* 头部样式 */
.ai-dialog__header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: 52px;
  padding: 0 16px 0 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #f1f5f9;
}

.ai-dialog__title {
  display: flex;
  flex: 1;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.ai-dialog__title-icon {
  width: 18px;
  height: 18px;
  margin-right: 8px;
  /* 更高科技感的渐变紫色/蓝色 */
  color: #6366f1;
}

.ai-dialog__select {
  width: 110px;
  margin-right: 12px;
}

.ai-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #64748b;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
}

/* 内容区 */
.ai-dialog__content {
  flex: 1;
  min-height: 140px;
  max-height: 360px;
  padding: 16px 20px;
  overflow-y: auto;
  font-size: 14px;
  /* 增加行高，阅读体验更好 */
  line-height: 1.8;
  color: #334155;
}

.ai-dialog__content-inner {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.ai-dialog__text-wrapper {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-dialog__text {
  display: inline;
}

/* ★ 优化：原生质感光标 */
.ai-dialog__cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em; /* 贴合字体高度 */
  background-color: #3b82f6; /* 光标颜色 */
  vertical-align: middle;
  margin-left: 4px;
  border-radius: 2px;
  transform: translateY(-1px);
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* ★ 优化：Google AI Studio 风格的加载态 */
.ai-dialog__loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 16px;
  background: linear-gradient(145deg, #f5f3ff 0%, #eff6ff 100%);
  border-radius: 8px;
  border: 1px solid #e0e7ff;
  align-self: flex-start; /* 让 loading 框贴左侧靠拢 */
}

.ai-dialog__loading-icon {
  font-size: 18px;
  color: #8b5cf6;
  animation: ai-pulse-spin 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.ai-dialog__loading-text {
  font-size: 13px;
  font-weight: 500;
  /* 科技感流光文字渐变 */
  background: linear-gradient(90deg, #6366f1, #a855f7, #3b82f6, #6366f1);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ai-gradient-shimmer 2.5s linear infinite;
  letter-spacing: 0.5px;
}

@keyframes ai-pulse-spin {
  0% {
    transform: scale(0.9) rotate(0deg);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1) rotate(180deg);
    opacity: 1;
  }
  100% {
    transform: scale(0.9) rotate(360deg);
    opacity: 0.8;
  }
}

@keyframes ai-gradient-shimmer {
  to {
    background-position: 200% center;
  }
}

/* 报错区域 */
.ai-dialog__error {
  display: flex;
  gap: 6px;
  align-items: center;
  color: #ef4444;
  background: #fef2f2;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

/* 底部提示 */
.ai-dialog__tip {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  align-items: center;
  padding: 8px 20px;
  font-size: 12px;
  color: #94a3b8;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}

/* 底部按钮 */
.ai-dialog__footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #f1f5f9;
  background: #ffffff;
}

.ai-dialog__footer-right {
  display: flex;
  gap: 8px;
}

.mr-4px {
  margin-right: 4px;
}

/* 弹窗出入动画 */
.ai-dialog-enter-active {
  transition:
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.ai-dialog-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.ai-dialog-enter-from,
.ai-dialog-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
</style>
