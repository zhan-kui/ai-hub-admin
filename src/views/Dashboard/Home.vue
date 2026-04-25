<template>
  <div class="dashboard-page">
    <!-- ═══ 欢迎 Banner ═══ -->
    <div class="welcome-banner">
      <div class="banner-bg-grid"></div>
      <div class="banner-bg-glow"></div>
      <div class="banner-content">
        <div class="banner-tag">
          <span class="tag-dot"></span>
          <span>CONSOLE DASHBOARD</span>
        </div>
        <h1 class="banner-title">欢迎回来，<span class="title-accent">AI Hub</span></h1>
        <p class="banner-desc">实时监控系统运行状态，管理 AI 应用与数据服务</p>
      </div>

      <!-- 右侧装饰性 SVG 可视化 -->
      <svg class="banner-viz" viewBox="0 0 240 120" fill="none" aria-hidden="true">
        <!-- 同心圆 -->
        <circle cx="180" cy="60" r="50" stroke="rgba(56, 189, 248, 0.2)" stroke-width="1" />
        <circle
          cx="180"
          cy="60"
          r="35"
          stroke="rgba(56, 189, 248, 0.3)"
          stroke-width="1"
          stroke-dasharray="3 5"
        />
        <circle cx="180" cy="60" r="20" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1" />
        <!-- 节点 -->
        <circle cx="180" cy="10" r="2" fill="#38bdf8" />
        <circle cx="230" cy="60" r="2" fill="#22d3ee" />
        <circle cx="180" cy="110" r="2" fill="#38bdf8" />
        <circle cx="130" cy="60" r="2" fill="#22d3ee" />
        <!-- 连线 -->
        <line
          x1="130"
          y1="60"
          x2="230"
          y2="60"
          stroke="rgba(56, 189, 248, 0.15)"
          stroke-width="1"
        />
        <line
          x1="180"
          y1="10"
          x2="180"
          y2="110"
          stroke="rgba(56, 189, 248, 0.15)"
          stroke-width="1"
        />
        <!-- 中心脉冲 -->
        <circle cx="180" cy="60" r="4" fill="#0ea5e9" />
      </svg>
    </div>

    <!-- ═══ 统计卡片网格 ═══ -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon stat-icon--blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
              />
            </svg>
          </div>
          <div class="stat-badge">MODEL</div>
        </div>
        <div class="stat-label">已接入模型</div>
        <div class="stat-value">—</div>
        <div class="stat-trend">
          <span class="trend-line"></span>
          <span class="trend-text">待接入配置</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon stat-icon--cyan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div class="stat-badge">REQUESTS</div>
        </div>
        <div class="stat-label">今日请求量</div>
        <div class="stat-value">—</div>
        <div class="stat-trend">
          <span class="trend-line"></span>
          <span class="trend-text">待统计数据</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon stat-icon--emerald">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div class="stat-badge">TOKENS</div>
        </div>
        <div class="stat-label">Token 用量</div>
        <div class="stat-value">—</div>
        <div class="stat-trend">
          <span class="trend-line"></span>
          <span class="trend-text">待统计数据</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon stat-icon--amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
            </svg>
          </div>
          <div class="stat-badge">USERS</div>
        </div>
        <div class="stat-label">活跃用户</div>
        <div class="stat-value">—</div>
        <div class="stat-trend">
          <span class="trend-line"></span>
          <span class="trend-text">待统计数据</span>
        </div>
      </div>
    </div>

    <!-- ═══ 快捷入口 ═══ -->
    <div class="quick-actions">
      <div class="section-header">
        <h2 class="section-title">快捷入口</h2>
        <span class="section-sub">Quick Access</span>
      </div>
      <div class="action-grid">
        <div class="action-card">
          <div class="action-icon action-icon--chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div class="action-body">
            <div class="action-title">AI 对话</div>
            <div class="action-desc">与已配置的 AI 应用进行对话测试</div>
          </div>
          <svg
            class="action-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>

        <div class="action-card">
          <div class="action-icon action-icon--config">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
            </svg>
          </div>
          <div class="action-body">
            <div class="action-title">应用配置</div>
            <div class="action-desc">管理和配置 AI 应用接入参数</div>
          </div>
          <svg
            class="action-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>

        <div class="action-card">
          <div class="action-icon action-icon--user">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div class="action-body">
            <div class="action-title">用户管理</div>
            <div class="action-desc">管理系统用户账号与权限分配</div>
          </div>
          <svg
            class="action-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>

        <div class="action-card">
          <div class="action-icon action-icon--log">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div class="action-body">
            <div class="action-title">调用日志</div>
            <div class="action-desc">查看 API 调用记录与异常报告</div>
          </div>
          <svg
            class="action-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>

    <!-- ═══ 系统信息 ═══ -->
    <div class="system-info">
      <div class="section-header">
        <h2 class="section-title">系统信息</h2>
        <span class="section-sub">System Info</span>
      </div>
      <div class="info-card">
        <div class="info-row">
          <div class="info-label">
            <span class="label-indicator"></span>
            系统名称
          </div>
          <span class="info-value">AI Hub Admin</span>
        </div>
        <div class="info-row">
          <div class="info-label">
            <span class="label-indicator"></span>
            当前版本
          </div>
          <span class="info-value">
            <code class="version-code">v1.0.0</code>
          </span>
        </div>
        <div class="info-row">
          <div class="info-label">
            <span class="label-indicator"></span>
            系统状态
          </div>
          <span class="info-value">
            <span class="badge badge--success">
              <span class="badge-dot"></span>
              运行中
            </span>
          </span>
        </div>
        <div class="info-row">
          <div class="info-label">
            <span class="label-indicator"></span>
            开发阶段
          </div>
          <span class="info-value">第一阶段 · AI 对话功能</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ═══════════════════════════════════════════════════
 * Welcome Banner - 深蓝科技感欢迎横幅
 * ═══════════════════════════════════════════════════ */
.welcome-banner {
  position: relative;
  background: linear-gradient(135deg, #0c1628 0%, #0f172a 50%, #0a1426 100%);
  border-radius: 14px;
  padding: 28px 32px;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.15);
  box-shadow:
    0 4px 16px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(56, 189, 248, 0.1);
}

.banner-bg-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 30% 50%, black 20%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 30% 50%, black 20%, transparent 70%);
  pointer-events: none;
}

.banner-bg-glow {
  position: absolute;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%);
  top: 50%;
  left: -100px;
  transform: translateY(-50%);
  filter: blur(40px);
  pointer-events: none;
}

.banner-content {
  position: relative;
  z-index: 2;
}

.banner-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  color: #38bdf8;
  letter-spacing: 0.15em;
  margin-bottom: 14px;
}

.tag-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
}

.banner-title {
  font-size: 24px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 6px;
  letter-spacing: -0.01em;
}

.title-accent {
  background: linear-gradient(135deg, #38bdf8 0%, #22d3ee 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.banner-desc {
  font-size: 13px;
  color: #94a3b8;
  letter-spacing: 0.01em;
}

.banner-viz {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 240px;
  opacity: 0.9;
  pointer-events: none;
}

/* ═══════════════════════════════════════════════════
 * Stats Grid - 科技感统计卡片
 * ═══════════════════════════════════════════════════ */
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
  position: relative;
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  transition: all 0.25s ease;
  overflow: hidden;
}

/* 顶部青色装饰线 */
.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #0ea5e9, transparent);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.stat-card:hover {
  border-color: #0ea5e9;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.12);
  transform: translateY(-2px);
}

.stat-card:hover::before {
  opacity: 1;
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 20px;
  height: 20px;
}

.stat-icon--blue {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(56, 189, 248, 0.08));
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.2);
}

.stat-icon--cyan {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(103, 232, 249, 0.08));
  color: #0891b2;
  border: 1px solid rgba(34, 211, 238, 0.2);
}

.stat-icon--emerald {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(52, 211, 153, 0.08));
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.stat-icon--amber {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(251, 191, 36, 0.08));
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.stat-badge {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 9px;
  color: #94a3b8;
  letter-spacing: 0.15em;
  padding: 3px 7px;
  background: #f1f5f9;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
  margin-bottom: 10px;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trend-line {
  width: 14px;
  height: 1px;
  background: #cbd5e1;
}

.trend-text {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.02em;
}

/* ═══════════════════════════════════════════════════
 * Section 通用头部
 * ═══════════════════════════════════════════════════ */
.section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.section-sub {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.1em;
}

/* ═══════════════════════════════════════════════════
 * Quick Actions - 快捷入口卡片
 * ═══════════════════════════════════════════════════ */
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
  position: relative;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 18px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-card:hover {
  border-color: #0ea5e9;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.12);
  transform: translateY(-2px);
}

.action-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon svg {
  width: 20px;
  height: 20px;
}

.action-icon--chat {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(56, 189, 248, 0.08));
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.2);
}
.action-icon--config {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(103, 232, 249, 0.08));
  color: #0891b2;
  border: 1px solid rgba(34, 211, 238, 0.2);
}
.action-icon--user {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(52, 211, 153, 0.08));
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.action-icon--log {
  background: linear-gradient(135deg, rgba(100, 116, 139, 0.12), rgba(148, 163, 184, 0.08));
  color: #475569;
  border: 1px solid rgba(100, 116, 139, 0.2);
}

.action-body {
  flex: 1;
}

.action-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.action-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.action-arrow {
  width: 16px;
  height: 16px;
  color: #cbd5e1;
  position: absolute;
  top: 20px;
  right: 18px;
  transition: all 0.25s ease;
}

.action-card:hover .action-arrow {
  color: #0ea5e9;
  transform: translateX(3px);
}

/* ═══════════════════════════════════════════════════
 * System Info - 系统信息卡片
 * ═══════════════════════════════════════════════════ */
.info-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 8px 20px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #f1f5f9;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #64748b;
}

.label-indicator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #cbd5e1;
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
  display: flex;
  align-items: center;
}

.version-code {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.badge--success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 5px rgba(16, 185, 129, 0.6);
  animation: badgePulse 2s ease-in-out infinite;
}

@keyframes badgePulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Banner 响应式 - 窄屏隐藏可视化 */
@media (max-width: 900px) {
  .banner-viz {
    display: none;
  }
  .welcome-banner {
    padding: 24px;
  }
  .banner-title {
    font-size: 20px;
  }
}
</style>
