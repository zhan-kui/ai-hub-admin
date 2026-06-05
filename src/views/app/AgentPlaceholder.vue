<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function backToList() {
  router.push('/apps')
}

function goToCreateWorkflow() {
  router.push('/agents/orchestrator/create?mode=blank')
}
</script>

<template>
  <div class="agent-placeholder-page">
    <section class="placeholder-shell">
      <div class="placeholder-card">
        <div class="placeholder-eyebrow">AGENT · COMING SOON</div>
        <h1>Agent 智能体开发中</h1>
        <p>
          当前版本暂未开放 Agent 智能体创建与编辑能力，后续会补充推理规划、自主工具调用等 核心体验。
        </p>

        <div class="placeholder-actions">
          <el-button type="primary" @click="goToCreateWorkflow">去创建 Chatflow</el-button>
          <el-button @click="backToList">返回智能体列表</el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="less">
.agent-placeholder-page {
  min-height: 100%;
  padding: 24px;
  background: radial-gradient(circle at 0 0, rgb(37 99 235 / 8%), transparent 260px),
    linear-gradient(180deg, #f8faff 0%, #f5f7fb 100%);
}

.placeholder-shell {
  display: flex;
  min-height: calc(100vh - 48px);
  align-items: center;
  justify-content: center;
}

.placeholder-card {
  width: min(720px, 100%);
  padding: 32px 30px;
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(226 232 240 / 90%);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgb(15 23 42 / 10%);
  backdrop-filter: blur(10px);
}

.placeholder-eyebrow {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #2563eb;
}

.placeholder-card h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
  color: #172033;
}

.placeholder-card p {
  max-width: 560px;
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.75;
  color: #64748b;
}

.placeholder-actions {
  display: flex;
  margin-top: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

@media (width <= 640px) {
  .agent-placeholder-page {
    padding: 16px;
  }

  .placeholder-card {
    padding: 24px 20px;
  }

  .placeholder-card h1 {
    font-size: 24px;
  }
}
</style>
