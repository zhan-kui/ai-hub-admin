<template>
  <div class="writing-page">
    <div class="writing-page__toolbar">
      <input v-model="docTitle" class="writing-page__title-input" placeholder="无标题文档" />
      <div class="writing-page__toolbar-right">
        <span class="writing-page__count">{{ wordCount }} 字</span>
        <el-button size="small" :disabled="!docContent" @click="handleClear">清空</el-button>
      </div>
    </div>

    <div class="writing-page__doc-wrap">
      <div ref="editorContainerRef" class="writing-page__doc" @contextmenu="handleContextMenu">
        <textarea
          ref="textareaRef"
          v-model="docContent"
          class="writing-page__textarea"
          placeholder="在这里开始写作，选中文本后右键可使用 AI续写 或 AI润色。"
          spellcheck="false"
        ></textarea>
      </div>
    </div>

    <ContextMenu
      v-model:visible="ctxVisible"
      :x="ctxPos.x"
      :y="ctxPos.y"
      @continue="handleContinueAction"
      @polish="handlePolishAction"
    />

    <AIResultDialog
      v-model:visible="dialogVisible"
      :action="currentAction"
      :snapshot="currentSnapshot"
      :default-length="defaultLength"
      :default-style="defaultStyle"
      @insert="handleInsert"
      @replace="handleReplace"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElButton, ElMessage } from 'element-plus'
import AIResultDialog from './components/AIResultDialog.vue'
import ContextMenu from './components/ContextMenu.vue'
import { useTextSelection } from './composables/useTextSelection'
import type { ContinueLength, PolishStyle, SelectionSnapshot, WritingAction } from './types'

defineOptions({ name: 'WritingLayout' })

const docTitle = ref('')
const docContent = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const editorContainerRef = ref<HTMLElement | null>(null)

const wordCount = computed(() => docContent.value.length)

const handleClear = () => {
  if (!docContent.value) return
  docContent.value = ''
}

const { snapshot, insertAfterSelection, replaceSelection } = useTextSelection(editorContainerRef)

const ctxVisible = ref(false)
const ctxPos = ref({ x: 0, y: 0 })
const currentSnapshot = ref<SelectionSnapshot | null>(null)

const dialogVisible = ref(false)
const currentAction = ref<WritingAction>('continue')
const defaultLength = ref<ContinueLength>('medium')
const defaultStyle = ref<PolishStyle>('default')

const handleContextMenu = (event: MouseEvent) => {
  const selectedSnapshot = snapshot({ prefixChars: 500, suffixChars: 200 })
  if (!selectedSnapshot) {
    return
  }

  event.preventDefault()
  currentSnapshot.value = selectedSnapshot
  ctxPos.value = { x: event.clientX, y: event.clientY }
  ctxVisible.value = true
}

const handleContinueAction = (length: ContinueLength) => {
  if (!currentSnapshot.value) return
  currentAction.value = 'continue'
  defaultLength.value = length
  dialogVisible.value = true
}

const handlePolishAction = (style: PolishStyle) => {
  if (!currentSnapshot.value) return
  currentAction.value = 'polish'
  defaultStyle.value = style
  dialogVisible.value = true
}

const handleInsert = (text: string, selectedSnapshot: SelectionSnapshot) => {
  const success = insertAfterSelection(selectedSnapshot, text)
  if (!success) {
    ElMessage.error('插入失败，请重试')
  }
}

const handleReplace = (text: string, selectedSnapshot: SelectionSnapshot) => {
  const success = replaceSelection(selectedSnapshot, text)
  if (!success) {
    ElMessage.error('替换失败，请重试')
  }
}

onMounted(() => {
  textareaRef.value?.focus()
})

onBeforeUnmount(() => {
  ctxVisible.value = false
  dialogVisible.value = false
})
</script>

<style lang="less" scoped>
.writing-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  background: #f5f6f8;
}

.writing-page__toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: 52px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #ebedf0;
}

.writing-page__title-input {
  flex: 1;
  height: 32px;
  font-size: 16px;
  font-weight: 500;
  color: #1f2329;
  background: transparent;
  border: none;
  outline: none;

  &::placeholder {
    color: #c7cdd6;
  }
}

.writing-page__toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.writing-page__count {
  font-size: 13px;
  color: #8f959e;
}

.writing-page__doc-wrap {
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 32px 24px;
  overflow-y: auto;
}

.writing-page__doc {
  width: 100%;
  max-width: 820px;
  min-height: calc(100vh - 180px);
  padding: 64px 80px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.writing-page__textarea {
  display: block;
  width: 100%;
  min-height: 60vh;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  line-height: 1.85;
  color: #1f2329;
  background: transparent;
  border: none;
  outline: none;
  resize: none;

  &::placeholder {
    color: #c7cdd6;
  }
}

@media (max-width: 768px) {
  .writing-page__doc {
    padding: 32px 24px;
  }
}
</style>
