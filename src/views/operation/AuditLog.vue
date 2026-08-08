<script setup lang="ts">
defineOptions({ name: 'OperationAuditLog' })

const previews = [
  { time: '10:32:18', user: '管理员', action: '发布智能体', target: '企业知识助手', level: '重要' },
  {
    time: '10:18:42',
    user: '运营人员',
    action: '更新知识库',
    target: '产品帮助中心',
    level: '普通'
  },
  { time: '09:55:07', user: '管理员', action: '修改角色权限', target: '运营角色', level: '重要' },
  {
    time: '09:21:36',
    user: '系统任务',
    action: '同步 MCP 工具',
    target: '内部数据服务',
    level: '普通'
  }
]
</script>

<template>
  <div class="operation-page">
    <section class="operation-hero"
      ><div
        ><div class="operation-eyebrow">SYSTEM AUDIT</div><h1>审计日志</h1
        ><p>统一记录登录、权限、智能体发布、知识库变更和能力配置等关键操作。</p></div
      ><el-tag type="warning" effect="plain">功能设计预览</el-tag></section
    >
    <el-alert
      title="当前项目尚未建立系统级审计日志表。此页面展示规划结构，不会将示例内容误认为真实操作记录。"
      type="info"
      :closable="false"
      show-icon
    />
    <section class="metric-grid audit-metrics">
      <article class="metric-card"
        ><span>计划覆盖事件</span><strong>6 类</strong
        ><small>登录、权限、智能体、知识库、工具、系统</small></article
      >
      <article class="metric-card"
        ><span>建议保留周期</span><strong>180 天</strong><small>可按合规要求调整</small></article
      >
      <article class="metric-card"
        ><span>敏感字段</span><strong>自动脱敏</strong
        ><small>Token、密码、Cookie 不落明文</small></article
      >
      <article class="metric-card"
        ><span>导出能力</span><strong>待接入</strong><small>建议支持 CSV 与条件筛选</small></article
      >
    </section>
    <section class="operation-panel">
      <div class="panel-title"
        ><div
          ><h2>日志结构预览</h2><p>以下为静态示例，用于确认后续审计页面的信息密度与字段设计</p></div
        ><el-tag>示例数据</el-tag></div
      >
      <el-table :data="previews">
        <el-table-column prop="time" label="时间" width="140" />
        <el-table-column prop="user" label="操作人" min-width="160" />
        <el-table-column prop="action" label="操作" min-width="180" />
        <el-table-column prop="target" label="对象" min-width="220" />
        <el-table-column label="级别" width="120"
          ><template #default="{ row }"
            ><el-tag :type="row.level === '重要' ? 'warning' : 'info'" effect="light">{{
              row.level
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="结果" width="100"
          ><template #default
            ><el-tag type="success" effect="plain">成功</el-tag></template
          ></el-table-column
        >
      </el-table>
    </section>
  </div>
</template>

<style scoped lang="less">
@import url('./operation.less');

.audit-metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
</style>
