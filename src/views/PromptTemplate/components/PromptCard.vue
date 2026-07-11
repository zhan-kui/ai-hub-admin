<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { PromptTemplate } from '@/api/promptTemplate'
import { resolvePromptIcon } from '../constants'

const props = defineProps<{ template: PromptTemplate }>()

const emit = defineEmits<{
  (event: 'open', template: PromptTemplate): void
  (event: 'favorite', template: PromptTemplate): void
  (event: 'copy', template: PromptTemplate): void
  (event: 'edit', template: PromptTemplate): void
  (event: 'remove', template: PromptTemplate): void
}>()

function handleFavorite(event: MouseEvent) {
  event.stopPropagation()
  emit('favorite', props.template)
}

function handleMoreCommand(command: string | number | object) {
  if (command === 'copy') {
    emit('copy', props.template)
    return
  }
  if (command === 'edit') {
    emit('edit', props.template)
    return
  }
  if (command === 'delete') {
    emit('remove', props.template)
  }
}
</script>

<template>
  <article
    class="prompt-card"
    tabindex="0"
    @click="emit('open', template)"
    @keyup.enter="emit('open', template)"
  >
    <button
      type="button"
      class="favorite-btn"
      :class="{ 'is-active': template.favorited }"
      :title="template.favorited ? '取消收藏' : '收藏提示词'"
      :aria-label="template.favorited ? '取消收藏提示词' : '收藏提示词'"
      @click="handleFavorite"
      @keyup.enter.stop
    >
      <Icon :icon="template.favorited ? 'tabler:star-filled' : 'tabler:star'" />
    </button>

    <div class="card-head">
      <span class="c-ico">
        <Icon :icon="resolvePromptIcon(template.icon, template.category)" />
      </span>
      <div class="head-copy">
        <div class="c-title">
          <span>{{ template.title }}</span>
          <span v-if="template.source === 'OFFICIAL'" class="badge">官方</span>
        </div>
        <div class="c-tag">{{ template.categoryName }}</div>
      </div>
    </div>

    <p class="c-desc">{{ template.description || '暂无描述' }}</p>

    <div class="c-vars">
      <span v-for="variable in template.variables.slice(0, 3)" :key="variable.name" class="vpill">
        {{ variable.name }}
      </span>
      <span v-if="template.variables.length > 3" class="vpill muted">
        +{{ template.variables.length - 3 }}
      </span>
      <span v-if="!template.variables.length" class="no-vars">无占位变量</span>
    </div>

    <div class="c-foot">
      <span class="count"><Icon icon="tabler:copy" /> {{ template.useCount }}</span>
      <el-dropdown class="card-action-bubble" trigger="click" @command="handleMoreCommand">
        <button type="button" class="action-bubble-btn" @click.stop>
          <Icon icon="tabler:dots" />
          <span>更多</span>
        </button>

        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="edit" :disabled="!template.owned">编辑</el-dropdown-item>
            <el-dropdown-item command="copy">复制</el-dropdown-item>
            <el-dropdown-item command="delete" :disabled="!template.owned">
              <span class="danger-text">删除</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </article>
</template>

<style scoped lang="less">
@import url('@/styles/prompt-template.less');

.prompt-card {
  position: relative;
  display: flex;
  min-height: 200px;
  padding: 15px 44px 15px 15px;
  cursor: pointer;
  background: @panel;
  border: 1px solid @border;
  border-radius: @radius-card;
  box-shadow: @shadow-card;
  box-sizing: border-box;
  transition: 0.15s;
  flex-direction: column;

  &:hover,
  &:focus-visible {
    border-color: @border-strong;
    outline: none;
    transform: translateY(-1px);
    box-shadow: @shadow-card-hover;
  }
}

.favorite-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 4;
  display: inline-flex;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 16px;
  color: @text-muted;
  cursor: pointer;
  background: #fff;
  border: 1px solid @border;
  border-radius: 9px;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    color: #d97706;
    background: #fffbeb;
    border-color: #fde68a;
  }

  &.is-active {
    color: #d97706;
    background: #fffbeb;
    border-color: #facc15;
    box-shadow: 0 6px 14px rgb(217 119 6 / 10%);
  }
}

.card-head,
.c-title,
.c-foot {
  display: flex;
  align-items: center;
}

.card-head {
  gap: 10px;
}

.c-ico {
  display: grid;
  width: 36px;
  height: 36px;
  font-size: 18px;
  color: @primary-strong;
  background: @primary-soft;
  border-radius: 10px;
  flex: 0 0 36px;
  place-items: center;
}

.head-copy {
  min-width: 0;
}

.c-title {
  font-size: 14px;
  font-weight: 600;
  color: @text-main;
  gap: 6px;

  > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.badge {
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  color: #0f6e56;
  background: #eafaf2;
  border-radius: 5px;
  flex: none;
}

.c-tag {
  margin-top: 2px;
  font-size: 11px;
  color: @text-muted;
}

.c-desc {
  display: -webkit-box;
  height: 36px;
  margin: 9px 0 10px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.5;
  color: @text-secondary;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.c-vars {
  display: flex;
  min-height: 22px;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 11px;
}

.vpill {
  padding: 2px 7px;
  font-family: monospace;
  font-size: 11px;
  color: @var-color;
  background: @var-bg;
  border: 1px solid @var-border;
  border-radius: 7px;
}

.vpill.muted,
.no-vars {
  color: @text-muted;
}

.no-vars {
  font-size: 11px;
  line-height: 22px;
}

.c-foot {
  position: relative;
  padding-top: 10px;
  margin-top: auto;
  border-top: 1px solid #eef2f8;
  gap: 10px;
}

.count {
  display: inline-flex;
  max-width: calc(100% - 78px);
  font-size: 11px;
  color: @text-muted;
  align-items: center;
  gap: 4px;
}

.card-action-bubble {
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 3;
  opacity: 0;
  transform: translateY(-50%);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.prompt-card:hover .card-action-bubble,
.prompt-card:focus-within .card-action-bubble {
  opacity: 1;
  transform: translateY(-30%);
}

.action-bubble-btn {
  display: inline-flex;
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: @text-secondary;
  cursor: pointer;
  background: #fff;
  border: 1px solid @border;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 2%);
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    color: @text-main;
    background: #f1f5f9;
    border-color: #cbd5e1;
  }
}

.danger-text {
  color: #dc2626;
}

.card-action-bubble.is-opened {
  opacity: 1;
}

.card-action-bubble :deep(.el-tooltip__trigger) {
  margin-left: auto;
}
</style>
