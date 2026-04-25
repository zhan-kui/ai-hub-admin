<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { authApi } from '@/api/frontend-api'
import { usePermissionStore } from '@/store/modules/permission'
import { useUserStore } from '@/store/modules/user'

interface LoginForm {
  username: string
  password: string
  captchaCode: string
  captchaId: string
}

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const loading = ref(false)
const captchaRaw = ref('')
const formRef = ref<FormInstance>()

const form = reactive<LoginForm>({
  username: 'admin',
  password: 'admin123',
  captchaCode: '',
  captchaId: ''
})

const rules: FormRules<LoginForm> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captchaCode: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

const captchaImage = computed(() => {
  if (!captchaRaw.value) return ''
  return captchaRaw.value.startsWith('data:')
    ? captchaRaw.value
    : `data:image/png;base64,${captchaRaw.value}`
})

async function refreshCaptcha() {
  const data = await authApi.getCaptchaImage()
  form.captchaId = data.captchaId
  form.captchaCode = ''
  captchaRaw.value = data.imageBase64
}

async function submit() {
  if (!formRef.value) return
  await formRef.value.validate()
  loading.value = true
  try {
    const loginResp = await authApi.login({
      username: form.username,
      password: form.password,
      captchaCode: form.captchaCode,
      captchaId: form.captchaId
    })
    userStore.setToken(loginResp.token)
    userStore.setUserInfo(null)
    userStore.setPermissions([])
    permissionStore.resetRoutesState()
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (error: any) {
    ElMessage.error(error?.message || '登录失败，请重试')
    await refreshCaptcha()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refreshCaptcha()
})
</script>

<template>
  <div class="login-page">
    <!-- ========== 左侧品牌展示区 ========== -->
    <aside class="brand-side">
      <!-- 背景层 -->
      <div class="brand-grid"></div>
      <div class="brand-glow"></div>

      <!-- 装饰性数据可视化 -->
      <svg class="brand-viz" viewBox="0 0 500 500" fill="none" aria-hidden="true">
        <!-- 外圈 -->
        <circle cx="250" cy="250" r="200" stroke="rgba(56, 189, 248, 0.15)" stroke-width="1" />
        <circle
          cx="250"
          cy="250"
          r="160"
          stroke="rgba(56, 189, 248, 0.2)"
          stroke-width="1"
          stroke-dasharray="4 8"
        />
        <circle cx="250" cy="250" r="120" stroke="rgba(56, 189, 248, 0.25)" stroke-width="1" />
        <circle
          cx="250"
          cy="250"
          r="80"
          stroke="rgba(56, 189, 248, 0.3)"
          stroke-width="1"
          stroke-dasharray="2 4"
        />
        <!-- 节点 -->
        <circle cx="250" cy="50" r="4" fill="#38bdf8" />
        <circle cx="450" cy="250" r="3" fill="#38bdf8" />
        <circle cx="250" cy="450" r="4" fill="#38bdf8" />
        <circle cx="50" cy="250" r="3" fill="#38bdf8" />
        <circle cx="391" cy="109" r="2.5" fill="#22d3ee" />
        <circle cx="391" cy="391" r="2.5" fill="#22d3ee" />
        <circle cx="109" cy="391" r="2.5" fill="#22d3ee" />
        <circle cx="109" cy="109" r="2.5" fill="#22d3ee" />
        <!-- 连线 -->
        <line
          x1="250"
          y1="50"
          x2="250"
          y2="450"
          stroke="rgba(56, 189, 248, 0.15)"
          stroke-width="1"
        />
        <line
          x1="50"
          y1="250"
          x2="450"
          y2="250"
          stroke="rgba(56, 189, 248, 0.15)"
          stroke-width="1"
        />
        <line
          x1="109"
          y1="109"
          x2="391"
          y2="391"
          stroke="rgba(56, 189, 248, 0.1)"
          stroke-width="1"
        />
        <line
          x1="391"
          y1="109"
          x2="109"
          y2="391"
          stroke="rgba(56, 189, 248, 0.1)"
          stroke-width="1"
        />
        <!-- 中心 -->
        <circle cx="250" cy="250" r="6" fill="#38bdf8">
          <animate attributeName="r" values="6;9;6" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle
          cx="250"
          cy="250"
          r="18"
          fill="none"
          stroke="#38bdf8"
          stroke-width="1.5"
          opacity="0.6"
        >
          <animate attributeName="r" values="18;40;18" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </svg>

      <!-- 品牌信息 -->
      <div class="brand-content">
        <div class="brand-logo">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
              <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.5" />
            </svg>
          </div>
          <span class="logo-text">AI HUB</span>
        </div>

        <h1 class="brand-headline">
          下一代<br />
          <span class="accent">智能控制台</span>
        </h1>
        <p class="brand-desc">
          集成大模型、数据分析与自动化工作流，<br />
          为企业构建稳定、安全、可扩展的 AI 基础设施。
        </p>

        <!-- 特性列表 -->
        <ul class="feature-list">
          <li>
            <span class="feature-dot"></span>
            <div>
              <div class="feature-title">统一模型管理</div>
              <div class="feature-desc">多模型编排 · 成本可视化</div>
            </div>
          </li>
          <li>
            <span class="feature-dot"></span>
            <div>
              <div class="feature-title">企业级安全</div>
              <div class="feature-desc">RBAC 权限 · 审计日志</div>
            </div>
          </li>
          <li>
            <span class="feature-dot"></span>
            <div>
              <div class="feature-title">实时数据分析</div>
              <div class="feature-desc">全链路监控 · 智能告警</div>
            </div>
          </li>
        </ul>
      </div>

      <!-- 底部状态 -->
      <div class="brand-footer">
        <span class="status-dot"></span>
        SYSTEM ONLINE · v2.6.1
      </div>
    </aside>

    <!-- ========== 右侧登录表单区 ========== -->
    <main class="form-side">
      <div class="form-container">
        <div class="form-header">
          <div class="form-tag">ACCOUNT LOGIN</div>
          <h2 class="form-title">登录到 AI Hub</h2>
          <p class="form-hint">输入账号信息以进入智能控制台</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          class="login-form"
          @keyup.enter="submit"
        >
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="输入用户名" />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="输入密码"
              show-password
            />
          </el-form-item>

          <el-form-item label="验证码" prop="captchaCode">
            <div class="captcha-row">
              <el-input v-model="form.captchaCode" placeholder="输入验证码" />
              <div class="captcha-box" @click="refreshCaptcha">
                <img :src="captchaImage" alt="captcha" />
              </div>
            </div>
          </el-form-item>

          <el-button type="primary" class="login-btn" :loading="loading" @click="submit">
            <span>登 录</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </el-button>
        </el-form>

        <div class="form-footer">
          <span>© 2026 AI Hub</span>
          <span class="sep">·</span>
          <a href="#">帮助中心</a>
          <span class="sep">·</span>
          <a href="#">隐私政策</a>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ========== 科技风格 - 深蓝青色系，左右分栏 ========== */
.login-page {
  width: 100%;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  background: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

/* ===== 左侧品牌展示 ===== */
.brand-side {
  position: relative;
  padding: 56px 64px;
  background: linear-gradient(135deg, #0c1628 0%, #0f172a 50%, #0a1426 100%);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

.brand-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 30% 50%, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at 30% 50%, black 30%, transparent 80%);
  pointer-events: none;
}

.brand-glow {
  position: absolute;
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, transparent 60%);
  top: 50%;
  left: -200px;
  transform: translateY(-50%);
  filter: blur(40px);
  pointer-events: none;
}

.brand-viz {
  position: absolute;
  right: -100px;
  top: 50%;
  transform: translateY(-50%);
  width: 580px;
  height: 580px;
  opacity: 0.45;
  pointer-events: none;
}

/* 品牌 LOGO */
.brand-content {
  position: relative;
  z-index: 2;
  max-width: 460px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 80px;
}
.logo-icon {
  width: 36px;
  height: 36px;
  color: #38bdf8;
  filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.5));
}
.logo-icon svg {
  width: 100%;
  height: 100%;
}
.logo-text {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #f1f5f9;
}

/* 大标题 */
.brand-headline {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 0 0 24px;
  color: #f8fafc;
}
.brand-headline .accent {
  background: linear-gradient(135deg, #38bdf8 0%, #22d3ee 50%, #67e8f9 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-desc {
  font-size: 15px;
  color: #94a3b8;
  line-height: 1.7;
  margin: 0 0 48px;
}

/* 特性列表 */
.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.feature-list li {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.feature-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 8px;
  background: #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.7);
  position: relative;
}
.feature-dot::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.4);
}
.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 2px;
}
.feature-desc {
  font-size: 12px;
  color: #64748b;
  letter-spacing: 0.02em;
}

/* 左下状态 */
.brand-footer {
  position: relative;
  z-index: 2;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.15em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* ===== 右侧表单区 ===== */
.form-side {
  position: relative;
  background: #0a1220;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.form-side::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(to bottom, transparent, rgba(56, 189, 248, 0.3), transparent);
}

.form-container {
  width: 100%;
  max-width: 400px;
}

.form-header {
  margin-bottom: 40px;
}
.form-tag {
  display: inline-block;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: #38bdf8;
  padding: 4px 10px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 4px;
  margin-bottom: 20px;
}
.form-title {
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.01em;
  margin: 0 0 8px;
}
.form-hint {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* ===== Element Plus 重写：科技风 ===== */
:deep(.el-form-item) {
  margin-bottom: 22px;
}

:deep(.el-form-item__label) {
  color: #94a3b8 !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  padding-bottom: 8px !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
}

:deep(.el-input__wrapper) {
  background-color: rgba(15, 23, 42, 0.6) !important;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.15) inset !important;
  border-radius: 6px !important;
  padding: 2px 14px !important;
  transition: all 0.2s ease;
  height: 44px;
}
:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35) inset !important;
  background-color: rgba(15, 23, 42, 0.9) !important;
}
:deep(.el-input__wrapper.is-focus) {
  background-color: rgba(15, 23, 42, 1) !important;
  box-shadow:
    0 0 0 1px #38bdf8 inset,
    0 0 0 3px rgba(56, 189, 248, 0.15),
    0 0 20px rgba(56, 189, 248, 0.15) !important;
}
:deep(.el-input__inner) {
  color: #e2e8f0 !important;
  font-size: 14px !important;
}
:deep(.el-input__inner::placeholder) {
  color: #475569 !important;
}
:deep(.el-input__suffix),
:deep(.el-input__clear) {
  color: #64748b !important;
}

/* 验证码 */
.captcha-row {
  display: grid;
  grid-template-columns: 1fr 124px;
  gap: 10px;
  width: 100%;
}
.captcha-box {
  width: 124px;
  height: 44px;
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.6);
  transition: all 0.2s ease;
  position: relative;
}
.captcha-box:hover {
  border-color: #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
}
.captcha-box img {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
  filter: brightness(0.95) contrast(1.1);
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  height: 48px !important;
  margin-top: 16px;
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%) !important;
  border: none !important;
  border-radius: 6px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  letter-spacing: 0.15em;
  color: #f0f9ff !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
  box-shadow:
    0 4px 16px rgba(14, 165, 233, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.login-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  transform: skewX(-20deg);
  transition: left 0.6s;
}
.login-btn:hover {
  transform: translateY(-1px);
  box-shadow:
    0 8px 24px rgba(14, 165, 233, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.login-btn:hover::before {
  left: 150%;
}
.login-btn svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}
.login-btn:hover svg {
  transform: translateX(3px);
}

/* 表单底部 */
.form-footer {
  margin-top: 32px;
  text-align: center;
  font-size: 12px;
  color: #475569;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  letter-spacing: 0.03em;
}
.form-footer a {
  color: #64748b;
  text-decoration: none;
  transition: color 0.15s;
}
.form-footer a:hover {
  color: #38bdf8;
}
.form-footer .sep {
  margin: 0 10px;
  color: #334155;
}

/* 响应式 */
@media (max-width: 960px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .brand-side {
    display: none;
  }
  .form-side {
    min-height: 100vh;
  }
}
</style>
