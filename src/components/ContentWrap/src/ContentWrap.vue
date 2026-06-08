<script setup lang="ts">
import { QuestionFilled } from '@element-plus/icons-vue'
import { ElCard, ElIcon, ElTooltip } from 'element-plus'
import { propTypes } from '@/utils/propTypes'
import { useDesign } from '@/hooks/web/useDesign'

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('content-wrap')

defineProps({
  title: propTypes.string.def(''),
  message: propTypes.string.def('')
})
</script>

<template>
  <ElCard :class="[prefixCls]" shadow="never">
    <template v-if="title" #header>
      <div :class="`${prefixCls}__header`">
        <div :class="`${prefixCls}__label`">
          <span :class="`${prefixCls}__title`">{{ title }}</span>
          <ElTooltip v-if="message" effect="dark" placement="top">
            <template #content>
              <div :class="`${prefixCls}__tooltip-content`">{{ message }}</div>
            </template>
            <ElIcon :class="`${prefixCls}__help-icon`">
              <QuestionFilled />
            </ElIcon>
          </ElTooltip>
        </div>
        <div :class="`${prefixCls}__extra`">
          <slot name="header"></slot>
        </div>
      </div>
    </template>
    <div>
      <slot></slot>
    </div>
  </ElCard>
</template>

<style scoped lang="less">
@prefix-cls: ~'@{adminNamespace}-content-wrap';

.@{prefix-cls} {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  &__label {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 4px;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.4;
  }

  &__help-icon {
    font-size: 14px;
    color: var(--el-text-color-placeholder);
    cursor: help;
    flex-shrink: 0;
  }

  &__tooltip-content {
    max-width: 240px;
    line-height: 1.5;
    white-space: normal;
  }

  &__extra {
    display: flex;
    flex: 1;
    min-width: 0;
    justify-content: flex-end;
    padding-left: 20px;
  }
}
</style>
