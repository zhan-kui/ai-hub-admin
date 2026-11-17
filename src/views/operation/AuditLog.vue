<script setup lang="ts">
defineOptions({ name: 'OperationAuditLog' })
</script>

<template>
  <div class="operation-page">
    <section class="operation-hero">
      <div>
        <div class="operation-eyebrow">SYSTEM AUDIT</div>
        <h1>审计日志</h1>
        <p>查看平台关键操作记录。</p>
      </div>
      <el-tag type="info" effect="plain">暂未接入</el-tag>
    </section>
    <section class="operation-panel">
      <el-empty description="审计日志功能尚未接入，暂无可展示的操作记录" />
    </section>
  </div>
</template>

<style scoped lang="less">
@import url('./operation.less');
</style>
