<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, language: string) {
    const hasLanguage = Boolean(language && hljs.getLanguage(language))
    const value = hasLanguage
      ? hljs.highlight(code, { language, ignoreIllegals: true }).value
      : hljs.highlightAuto(code).value
    const langClass = hasLanguage ? language : 'plaintext'
    return `<pre class="hljs"><code class="language-${langClass}">${value}</code></pre>`
  }
})

const renderedContent = computed(() => md.render(props.content || ''))
</script>

<template>
  <div class="markdown-body" v-html="renderedContent"></div>
</template>

<style scoped>
.markdown-body :deep(p) {
  margin: 0;
}

.markdown-body :deep(p + p) {
  margin-top: 10px;
}

.markdown-body :deep(pre) {
  margin: 8px 0;
  overflow: auto;
  border-radius: 8px;
}

.markdown-body :deep(code) {
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
}

.markdown-body :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}
</style>
