<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h1 class="page-title">控制台总览</h1>
      <p class="page-desc">欢迎使用 AI Hub 管理后台，这里是系统运行状态概览</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon--primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
            />
          </svg>
        </div>
        <div class="stat-body">
          <div class="stat-label">已接入模型</div>
          <div class="stat-value">—</div>
          <div class="stat-trend">待接入配置</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--purple">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div class="stat-body">
          <div class="stat-label">今日请求量</div>
          <div class="stat-value">—</div>
          <div class="stat-trend">待统计数据</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div class="stat-body">
          <div class="stat-label">Token 用量</div>
          <div class="stat-value">—</div>
          <div class="stat-trend">待统计数据</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--orange">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
          </svg>
        </div>
        <div class="stat-body">
          <div class="stat-label">活跃用户</div>
          <div class="stat-value">—</div>
          <div class="stat-trend">待统计数据</div>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <h2 class="section-title">快捷入口</h2>
      <div class="action-grid">
        <el-card class="action-card" shadow="never">
          <div class="action-icon action-icon--chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div class="action-title">AI 对话</div>
          <div class="action-desc">与已配置的 AI 应用进行对话测试</div>
        </el-card>

        <el-card class="action-card" shadow="never">
          <div class="action-icon action-icon--config">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"
              />
            </svg>
          </div>
          <div class="action-title">应用配置</div>
          <div class="action-desc">管理和配置 AI 应用接入参数</div>
        </el-card>

        <el-card class="action-card" shadow="never">
          <div class="action-icon action-icon--user">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div class="action-title">用户管理</div>
          <div class="action-desc">管理系统用户账号与权限分配</div>
        </el-card>

        <el-card class="action-card" shadow="never">
          <div class="action-icon action-icon--log">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div class="action-title">调用日志</div>
          <div class="action-desc">查看 API 调用记录与异常报告</div>
        </el-card>
      </div>
    </div>

    <div class="system-info">
      <h2 class="section-title">系统信息</h2>
      <el-card shadow="never" class="info-card">
        <div class="info-row">
          <span class="info-label">系统名称</span>
          <span class="info-value">AI Hub Admin</span>
        </div>
        <div class="info-row">
          <span class="info-label">当前版本</span>
          <span class="info-value">v1.0.0</span>
        </div>
        <div class="info-row">
          <span class="info-label">系统状态</span>
          <span class="info-value">
            <span class="badge badge--success">运行中</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">开发阶段</span>
          <span class="info-value">第一阶段 · AI 对话功能</span>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.page-header {
  margin-bottom: 4px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 6px;
}

.page-desc {
  font-size: 14px;
  color: #6b7280;
}

/* ── Stats Grid ─────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.04);
  border: 1px solid #f1f3f5;
  transition: box-shadow 0.2s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 22px;
  height: 22px;
}

.stat-icon--primary {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}
.stat-icon--purple {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}
.stat-icon--green {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.stat-icon--orange {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.stat-body {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  line-height: 1;
  margin-bottom: 6px;
}

.stat-trend {
  font-size: 12px;
  color: #9ca3af;
}

/* ── Quick Actions ──────────────────────────── */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 14px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 1200px) {
  .action-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .action-grid {
    grid-template-columns: 1fr;
  }
}

.action-card {
  border-radius: 10px !important;
  border: 1px solid #f1f3f5 !important;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-card:hover {
  border-color: #6366f1 !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12) !important;
  transform: translateY(-1px);
}

.action-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.action-icon svg {
  width: 20px;
  height: 20px;
}

.action-icon--chat {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}
.action-icon--config {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.action-icon--user {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
.action-icon--log {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.action-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.action-desc {
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
}

/* ── System Info ────────────────────────────── */
.info-card {
  border-radius: 10px !important;
  border: 1px solid #f1f3f5 !important;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
}

.info-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-row:first-child {
  padding-top: 0;
}

.info-label {
  font-size: 13px;
  color: #6b7280;
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
}

.badge--success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}
</style>
