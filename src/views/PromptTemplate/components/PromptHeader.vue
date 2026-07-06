<script setup lang="ts">
defineProps<{
  total: number
  currentCount: number
  favoriteCount: number
}>()
</script>

<template>
  <header class="prompt-hero">
    <div class="hero-copy">
      <div class="eyebrow">PROMPTS · {{ total }}</div>
      <h1>提示词模板</h1>
      <p>管理可复用提示词模板，让流程编排中的模型指令更高效、更一致。</p>
    </div>

    <div class="hero-metrics">
      <div class="metric-card">
        <span>模板总数</span>
        <strong>{{ total }}</strong>
      </div>
      <div class="metric-card">
        <span>当前页模板</span>
        <strong>{{ currentCount }}</strong>
      </div>
      <div class="metric-card">
        <span>当前页收藏</span>
        <strong>{{ favoriteCount }}</strong>
      </div>
    </div>
  </header>
</template>

<style scoped lang="less">
@import url('@/styles/prompt-template.less');

.prompt-hero {
  position: relative;
  display: grid;
  padding: 22px 24px;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    rgb(234 241 255 / 96%) 0%,
    rgb(248 250 255 / 92%) 56%,
    rgb(245 247 251 / 88%) 100%
  );
  border: 1px solid @border;
  border-radius: @radius-panel;
  box-shadow: 0 12px 30px rgb(37 99 235 / 5%);
  align-items: center;
  grid-template-columns: minmax(0, 1.2fr) auto;
  gap: 22px;

  &::before {
    position: absolute;
    top: 18px;
    bottom: 18px;
    left: 0;
    width: 4px;
    background: @primary;
    border-radius: 0 999px 999px 0;
    content: '';
  }

  h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.18;
    letter-spacing: -0.02em;
    color: @text-main;
  }

  p {
    max-width: 560px;
    margin: 7px 0 0;
    font-size: 14px;
    line-height: 1.55;
    color: @text-secondary;
  }
}

.hero-copy {
  position: relative;
  min-width: 0;
}

.eyebrow {
  margin-bottom: 8px;
  font-family: ui-monospace, SFMono-Regular, consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: @primary;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 1fr));
  gap: 10px;
}

.metric-card {
  min-width: 94px;
  padding: 12px 14px;
  background: rgb(255 255 255 / 54%);
  border: 1px solid rgb(226 232 240 / 76%);
  border-radius: 14px;

  span {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: @text-secondary;
  }

  strong {
    font-family: ui-monospace, SFMono-Regular, consolas, monospace;
    font-size: 22px;
    line-height: 1;
    color: @text-main;
  }
}

@media (width <= 960px) {
  .prompt-hero {
    grid-template-columns: 1fr;
  }

  .hero-metrics {
    max-width: 520px;
  }
}

@media (width <= 720px) {
  .hero-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
