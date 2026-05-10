<template>
  <div class="dashboard-home">
    <!-- Page header -->
    <div class="dash-header">
      <div class="dash-header__title">
        <h1 class="page-title">控制台总览</h1>
        <p class="page-desc">欢迎使用 AI Hub 管理后台，以下是系统当前运行状态</p>
      </div>
      <div class="dash-header__badge">
        <span class="live-dot"></span>
        实时数据
      </div>
    </div>

    <!-- Stat cards -->
    <div class="stats-grid">
      <div class="stat-card stat-card--indigo">
        <div class="stat-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          </svg>
        </div>
        <div class="stat-card__body">
          <div class="stat-label">已接入模型</div>
          <div class="stat-value">—</div>
          <div class="stat-hint">待接入配置</div>
        </div>
        <div class="stat-card__bg"></div>
      </div>

      <div class="stat-card stat-card--purple">
        <div class="stat-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="stat-card__body">
          <div class="stat-label">今日请求量</div>
          <div class="stat-value">—</div>
          <div class="stat-hint">待统计数据</div>
        </div>
        <div class="stat-card__bg"></div>
      </div>

      <div class="stat-card stat-card--emerald">
        <div class="stat-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div class="stat-card__body">
          <div class="stat-label">Token 用量</div>
          <div class="stat-value">—</div>
          <div class="stat-hint">待统计数据</div>
        </div>
        <div class="stat-card__bg"></div>
      </div>

      <div class="stat-card stat-card--amber">
        <div class="stat-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
          </svg>
        </div>
        <div class="stat-card__body">
          <div class="stat-label">活跃用户</div>
          <div class="stat-value">—</div>
          <div class="stat-hint">待统计数据</div>
        </div>
        <div class="stat-card__bg"></div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">快捷入口</h2>
        <span class="section-desc">常用功能快速访问</span>
      </div>
      <div class="action-grid">
        <div class="action-card action-card--chat">
          <div class="action-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div class="action-card__content">
            <div class="action-title">AI 对话</div>
            <div class="action-desc">与已配置的 AI 应用进行对话测试</div>
          </div>
          <div class="action-card__arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div class="action-card action-card--config">
          <div class="action-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
            </svg>
          </div>
          <div class="action-card__content">
            <div class="action-title">应用配置</div>
            <div class="action-desc">管理和配置 AI 应用接入参数</div>
          </div>
          <div class="action-card__arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div class="action-card action-card--user">
          <div class="action-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div class="action-card__content">
            <div class="action-title">用户管理</div>
            <div class="action-desc">管理系统用户账号与权限分配</div>
          </div>
          <div class="action-card__arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div class="action-card action-card--log">
          <div class="action-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div class="action-card__content">
            <div class="action-title">调用日志</div>
            <div class="action-desc">查看 API 调用记录与异常报告</div>
          </div>
          <div class="action-card__arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- System info -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">系统信息</h2>
      </div>
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">系统名称</span>
          <span class="info-value">AI Hub Admin</span>
        </div>
        <div class="info-row">
          <span class="info-label">当前版本</span>
          <span class="info-value">
            <span class="version-badge">v1.0.0</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">系统状态</span>
          <span class="info-value">
            <span class="status-badge status-badge--success">
              <span class="status-badge__dot"></span>
              运行中
            </span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">开发阶段</span>
          <span class="info-value">第一阶段 · AI 对话功能</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────── */
.dashboard-home {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Header ──────────────────────────────────────────────────────── */
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 5px;
  letter-spacing: -0.3px;
}

.page-desc {
  font-size: 13.5px;
  color: #6b7280;
  line-height: 1.5;
}

.dash-header__badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 99px;
  padding: 5px 12px;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  animation: livePulse 2s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
  50%       { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
}

/* ── Stat cards ──────────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .stats-grid { grid-template-columns: 1fr; }
}

.stat-card {
  position: relative;
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  border: 1px solid #f0f0f3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: box-shadow 0.22s ease, transform 0.22s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.09);
  transform: translateY(-1px);
}

.stat-card__bg {
  position: absolute;
  right: -20px;
  bottom: -20px;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  opacity: 0.05;
  pointer-events: none;
}

.stat-card--indigo .stat-card__bg { background: #6366f1; }
.stat-card--purple .stat-card__bg { background: #8b5cf6; }
.stat-card--emerald .stat-card__bg { background: #10b981; }
.stat-card--amber .stat-card__bg { background: #f59e0b; }

.stat-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__icon svg {
  width: 21px;
  height: 21px;
}

.stat-card--indigo .stat-card__icon { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
.stat-card--purple .stat-card__icon { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
.stat-card--emerald .stat-card__icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.stat-card--amber .stat-card__icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

.stat-card__body { flex: 1; min-width: 0; }

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
  font-weight: 500;
}

.stat-value {
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  line-height: 1;
  margin-bottom: 6px;
  letter-spacing: -0.5px;
}

.stat-hint {
  font-size: 11.5px;
  color: #9ca3af;
}

/* ── Sections ────────────────────────────────────────────────────── */
.section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.section-desc {
  font-size: 12px;
  color: #9ca3af;
}

/* ── Action cards ────────────────────────────────────────────────── */
.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 1200px) {
  .action-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .action-grid { grid-template-columns: 1fr; }
}

.action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f0f3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.22s ease;
  overflow: hidden;
  position: relative;
}

.action-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.09);
  transform: translateY(-1px);
}

.action-card--chat:hover  { border-color: rgba(99, 102, 241, 0.4); }
.action-card--config:hover { border-color: rgba(16, 185, 129, 0.4); }
.action-card--user:hover  { border-color: rgba(245, 158, 11, 0.4); }
.action-card--log:hover   { border-color: rgba(239, 68, 68, 0.4); }

.action-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-card__icon svg {
  width: 19px;
  height: 19px;
}

.action-card--chat  .action-card__icon { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
.action-card--config .action-card__icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.action-card--user  .action-card__icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.action-card--log   .action-card__icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.action-card__content { flex: 1; min-width: 0; }

.action-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 3px;
}

.action-desc {
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}

.action-card__arrow {
  width: 16px;
  height: 16px;
  color: #d1d5db;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.action-card__arrow svg {
  width: 100%;
  height: 100%;
}

.action-card:hover .action-card__arrow {
  color: #9ca3af;
  transform: translateX(2px);
}

/* ── System info ─────────────────────────────────────────────────── */
.info-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f0f3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #f8f8fb;
  transition: background 0.15s ease;
}

.info-row:last-child { border-bottom: none; }

.info-row:hover { background: #fafafa; }

.info-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 600;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 5px;
  padding: 2px 8px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
}

.status-badge--success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.status-badge__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}
</style>
