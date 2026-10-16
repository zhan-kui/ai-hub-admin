<script setup lang="ts">
withDefaults(
  defineProps<{
    active: boolean
    title?: string
    description?: string
  }>(),
  {
    title: '正在准备流程编排',
    description: '正在保存配置并初始化画布，请稍候…'
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="route-loading-fade">
      <div
        v-if="active"
        class="route-loading-overlay"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="route-loading-card">
          <div class="route-loading-visual" aria-hidden="true">
            <span class="orbit orbit-outer"></span>
            <span class="orbit orbit-inner"></span>
            <span class="visual-core">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 5.5h10M7 12h6M7 18.5h10" />
                <circle cx="5" cy="5.5" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="5" cy="18.5" r="1.5" />
              </svg>
            </span>
          </div>

          <div class="route-loading-copy">
            <span class="route-loading-eyebrow">AI WORKSPACE</span>
            <h3>{{ title }}</h3>
            <p>{{ description }}</p>
          </div>

          <div class="route-loading-progress" aria-hidden="true">
            <span class="route-loading-progress-bar"></span>
          </div>

          <div class="route-loading-steps" aria-hidden="true">
            <span class="is-complete"><i></i>保存配置</span>
            <span class="is-active"><i></i>初始化画布</span>
            <span><i></i>打开编排器</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="less">
.route-loading-overlay {
  position: fixed;
  z-index: 10000;
  display: grid;
  background: radial-gradient(circle at 50% 42%, rgb(99 102 241 / 18%), transparent 34%),
    rgb(15 23 42 / 48%);
  backdrop-filter: blur(8px);
  inset: 0;
  place-items: center;
}

.route-loading-card {
  width: min(430px, calc(100vw - 40px));
  padding: 34px 36px 28px;
  text-align: center;
  background: rgb(255 255 255 / 97%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 22px;
  box-shadow: 0 28px 80px rgb(15 23 42 / 24%);
}

.route-loading-visual {
  position: relative;
  width: 82px;
  height: 82px;
  margin: 0 auto 22px;
}

.orbit,
.visual-core {
  position: absolute;
  border-radius: 50%;
}

.orbit {
  border: 1px solid rgb(99 102 241 / 22%);
  inset: 0;
}

.orbit::after {
  position: absolute;
  top: 8px;
  left: 7px;
  width: 8px;
  height: 8px;
  background: #6366f1;
  border-radius: 50%;
  content: '';
  box-shadow: 0 0 0 5px rgb(99 102 241 / 12%);
}

.orbit-outer {
  animation: route-loading-spin 2.8s linear infinite;
}

.orbit-inner {
  border-color: rgb(14 165 233 / 18%);
  animation: route-loading-spin 2s linear infinite reverse;
  inset: 9px;
}

.orbit-inner::after {
  top: 37px;
  right: 2px;
  left: auto;
  width: 6px;
  height: 6px;
  background: #0ea5e9;
  box-shadow: 0 0 0 4px rgb(14 165 233 / 12%);
}

.visual-core {
  display: grid;
  color: #fff;
  background: linear-gradient(145deg, #6366f1, #4f46e5 55%, #2563eb);
  box-shadow: 0 10px 28px rgb(79 70 229 / 30%);
  inset: 19px;
  place-items: center;
}

.visual-core svg {
  width: 25px;
  height: 25px;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.route-loading-copy h3 {
  margin: 7px 0 8px;
  font-size: 21px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: #172033;
}

.route-loading-copy p {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: #64748b;
}

.route-loading-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #6366f1;
}

.route-loading-progress {
  height: 7px;
  margin-top: 24px;
  overflow: hidden;
  background: #eef2ff;
  border-radius: 999px;
}

.route-loading-progress-bar {
  display: block;
  width: 38%;
  height: 100%;
  background: linear-gradient(90deg, #818cf8, #4f46e5 60%, #38bdf8);
  border-radius: inherit;
  box-shadow: 0 0 14px rgb(99 102 241 / 38%);
  animation: route-loading-progress 1.9s ease-in-out infinite;
}

.route-loading-steps {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
  font-size: 11px;
  color: #94a3b8;
}

.route-loading-steps span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.route-loading-steps i {
  width: 6px;
  height: 6px;
  background: #cbd5e1;
  border-radius: 50%;
}

.route-loading-steps .is-complete,
.route-loading-steps .is-active {
  color: #4f46e5;
}

.route-loading-steps .is-complete i {
  background: #4f46e5;
}

.route-loading-steps .is-active i {
  background: #6366f1;
  box-shadow: 0 0 0 4px rgb(99 102 241 / 14%);
  animation: route-loading-pulse 1.2s ease-in-out infinite;
}

.route-loading-fade-enter-active,
.route-loading-fade-leave-active {
  transition: opacity 180ms ease;
}

.route-loading-fade-enter-active .route-loading-card,
.route-loading-fade-leave-active .route-loading-card {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.route-loading-fade-enter-from,
.route-loading-fade-leave-to,
.route-loading-fade-enter-from .route-loading-card,
.route-loading-fade-leave-to .route-loading-card {
  opacity: 0;
}

.route-loading-fade-enter-from .route-loading-card,
.route-loading-fade-leave-to .route-loading-card {
  transform: translateY(8px) scale(0.98);
}

@keyframes route-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes route-loading-progress {
  0% {
    transform: translateX(-110%);
  }

  55% {
    width: 54%;
  }

  100% {
    width: 38%;
    transform: translateX(280%);
  }
}

@keyframes route-loading-pulse {
  50% {
    box-shadow: 0 0 0 7px rgb(99 102 241 / 6%);
  }
}

@media (width <= 520px) {
  .route-loading-card {
    padding: 30px 24px 24px;
  }

  .route-loading-steps {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orbit,
  .route-loading-progress-bar,
  .route-loading-steps .is-active i {
    animation-duration: 8s;
  }
}
</style>
