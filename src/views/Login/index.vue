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
const loginTransition = ref(false)
const captchaRaw = ref('')
const formRef = ref<FormInstance>()

const LOGIN_TRANSITION_DELAY = 600
const DEFAULT_HOME_PATH = '/dashboard/home'

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

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function resolvePostLoginPath() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  const redirectPath = redirect.split('?')[0]
  if (!redirect || ['/', '/login', '/404'].includes(redirectPath)) {
    return DEFAULT_HOME_PATH
  }
  return redirect
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
    loginTransition.value = true
    ElMessage({
      type: 'success',
      message: '登录成功，正在进入控制台',
      duration: 1800,
      customClass: 'login-success-message'
    })
    await delay(LOGIN_TRANSITION_DELAY)
    await router.replace(resolvePostLoginPath())
  } catch (error: any) {
    loginTransition.value = false
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
    <Transition name="login-gateway">
      <div v-if="loginTransition" class="login-gateway-mask">
        <div class="gateway-orbit">
          <div class="gateway-spinner"></div>
        </div>
        <div class="gateway-title">正在进入 AI Hub</div>
        <div class="gateway-subtitle">同步权限、菜单与应用配置</div>
      </div>
    </Transition>

    <!-- ========== 左侧品牌展示区 ========== -->
    <aside class="brand-side">
      <div class="brand-bg-grid"></div>
      <div class="brand-glow brand-glow--one"></div>
      <div class="brand-glow brand-glow--two"></div>

      <div class="brand-content">
        <div class="brand-logo">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
              <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.4" />
            </svg>
          </div>
          <span class="logo-text">AI Hub</span>
        </div>

        <div class="brand-kicker">ENTERPRISE AI PLATFORM</div>
        <h1 class="brand-headline">
          构建你的 AI 应用<br />
          <span>就在此处。</span>
        </h1>
        <p class="brand-desc">
          一站式企业 AI 应用平台，连接模型、数据与业务流程，让团队更高效地构建、管理和交付智能应用。
        </p>

        <div class="capability-grid">
          <div class="capability-card">
            <div class="capability-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <div class="capability-title">统一接入</div>
              <div class="capability-desc">集中管理模型、应用与业务能力</div>
            </div>
          </div>

          <div class="capability-card">
            <div class="capability-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div>
              <div class="capability-title">安全可控</div>
              <div class="capability-desc">权限、数据与流程可按企业要求配置</div>
            </div>
          </div>

          <div class="capability-card">
            <div class="capability-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8M8 17h5" />
              </svg>
            </div>
            <div>
              <div class="capability-title">持续演进</div>
              <div class="capability-desc">从原型验证到生产应用，支持长期迭代</div>
            </div>
          </div>
        </div>
      </div>

      <div class="brand-footer">
        <span>© 2026 AI Hub</span>
        <span>企业级 AI 应用控制台</span>
      </div>
    </aside>

    <!-- ========== 右侧登录表单区 ========== -->
    <main class="form-side">
      <div class="form-shell">
        <div class="mobile-logo">
          <div class="logo-icon compact">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M12 2 L22 7 L22 17 L12 22 L2 17 L2 7 Z" />
              <path d="M12 2 L12 22 M2 7 L22 17 M22 7 L2 17" opacity="0.4" />
            </svg>
          </div>
          <span>AI Hub</span>
        </div>

        <div class="form-container">
          <div class="form-header">
            <div class="form-kicker">WELCOME BACK</div>
            <h2 class="form-title">登录控制台</h2>
            <p class="form-hint">继续构建、管理和交付企业智能应用。</p>
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
              <el-input v-model="form.username" placeholder="请输入用户名" />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                show-password
              />
            </el-form-item>

            <el-form-item label="验证码" prop="captchaCode">
              <div class="captcha-row">
                <el-input v-model="form.captchaCode" placeholder="请输入验证码" />
                <button
                  type="button"
                  class="captcha-box"
                  title="点击刷新验证码"
                  @click="refreshCaptcha"
                >
                  <img :src="captchaImage" alt="captcha" />
                </button>
              </div>
            </el-form-item>

            <el-button type="primary" class="login-btn" :loading="loading" @click="submit">
              登录 AI Hub
            </el-button>
          </el-form>

          <div class="form-footer">
            <span>安全登录 · 权限同步 · 企业工作台</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes valueCardPulse {
  0%,
  30%,
  100% {
    background: rgb(255 255 255 / 68%);
    border-color: rgb(213 223 239 / 76%);
    transform: translateY(0);
    box-shadow: 0 12px 30px rgb(15 23 42 / 4%);
  }

  9%,
  20% {
    background: rgb(255 255 255 / 92%);
    border-color: rgb(37 99 235 / 30%);
    transform: translateY(-4px);
    box-shadow: 0 18px 38px rgb(37 99 235 / 10%);
  }
}

@keyframes valueIconPulse {
  0%,
  30%,
  100% {
    color: var(--primary);
    background: var(--primary-soft);
    border-color: #d8e5ff;
  }

  9%,
  20% {
    color: #fff;
    background: var(--primary);
    border-color: var(--primary);
  }
}

/* 响应式 */
@media (width <= 1100px) {
  .login-page {
    grid-template-columns: 0.9fr 1fr;
  }

  .brand-side {
    padding: 44px;
  }

  .brand-headline {
    font-size: 46px;
  }
}

@media (width <= 900px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .brand-side {
    display: none;
  }

  .form-side {
    padding: 28px 20px;
  }

  .mobile-logo {
    display: flex;
  }

  .form-container {
    padding: 30px 24px;
  }
}

@media (width <= 520px) {
  .captcha-row {
    grid-template-columns: 1fr;
  }

  .captcha-box {
    width: 100%;
  }
}

.login-page {
  --page-bg: #f5f7fb;
  --panel-bg: #fff;
  --panel-soft: #f8faff;
  --border: #e4eaf3;
  --border-strong: #d5dfef;
  --primary: #2563eb;
  --primary-strong: #1d4ed8;
  --primary-soft: #eaf1ff;
  --text-main: #1f2937;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --success: #16a34a;

  display: grid;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    sans-serif;
  color: var(--text-main);
  background: var(--page-bg);
  grid-template-columns: minmax(520px, 1.05fr) minmax(420px, 0.95fr);
}

/* ===== 登录过渡遮罩 ===== */
.login-gateway-mask {
  position: fixed;
  z-index: 1000;
  display: flex;
  color: var(--text-main);
  background: rgb(245 247 251 / 86%);
  inset: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.gateway-orbit {
  display: grid;
  width: 54px;
  height: 54px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgb(15 23 42 / 10%);
  place-items: center;
}

.gateway-spinner {
  width: 26px;
  height: 26px;
  border: 2.5px solid #dbe5f5;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.gateway-title {
  margin-top: 20px;
  font-size: 16px;
  font-weight: 700;
}

.gateway-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.login-gateway-enter-active,
.login-gateway-leave-active {
  transition: opacity 0.3s ease;
}

.login-gateway-enter-from,
.login-gateway-leave-to {
  opacity: 0;
}

:global(.login-success-message) {
  border-radius: 10px !important;
}

/* ===== 左侧品牌展示 ===== */
.brand-side {
  position: relative;
  display: flex;
  min-height: 100vh;
  padding: 56px 64px;
  overflow: hidden;
  background: radial-gradient(circle at 12% 16%, rgb(37 99 235 / 16%), transparent 28%),
    radial-gradient(circle at 86% 72%, rgb(14 116 144 / 10%), transparent 28%),
    linear-gradient(145deg, #f8fbff 0%, #eef4ff 50%, #f6fbff 100%);
  border-right: 1px solid var(--border);
  flex-direction: column;
  justify-content: space-between;
}

.brand-bg-grid {
  position: absolute;
  background-image: linear-gradient(rgb(37 99 235 / 7%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(37 99 235 / 7%) 1px, transparent 1px);
  background-size: 36px 36px;
  opacity: 0.5;
  inset: 0;
  mask-image: linear-gradient(90deg, #000 0%, transparent 88%);
}

.brand-glow {
  position: absolute;
  pointer-events: none;
  border-radius: 999px;
  filter: blur(4px);
}

.brand-glow--one {
  top: 120px;
  right: 90px;
  width: 180px;
  height: 180px;
  background: rgb(37 99 235 / 9%);
}

.brand-glow--two {
  right: -60px;
  bottom: 120px;
  width: 260px;
  height: 260px;
  background: rgb(14 116 144 / 8%);
}

.brand-content {
  position: relative;
  z-index: 2;
  max-width: 620px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 88px;
}

.logo-icon {
  display: grid;
  width: 38px;
  height: 38px;
  color: #fff;
  background: var(--primary);
  border-radius: 12px;
  box-shadow: 0 12px 24px rgb(37 99 235 / 20%);
  place-items: center;
}

.logo-icon.compact {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}

.logo-icon svg {
  width: 22px;
  height: 22px;
}

.logo-text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-main);
}

.brand-kicker,
.form-kicker {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--primary);
}

.brand-headline {
  max-width: 720px;
  margin: 12px 0 18px;
  font-size: clamp(44px, 5.2vw, 68px);
  font-weight: 760;
  line-height: 1.08;
  letter-spacing: -0.05em;
  color: #142033;
}

.brand-headline span {
  font-size: 1.08em;
  font-weight: 850;
  color: var(--primary-strong);
}

.brand-desc {
  max-width: 560px;
  margin: 0 0 34px;
  font-size: 16px;
  line-height: 1.85;
  color: var(--text-secondary);
}

.capability-grid {
  display: grid;
  max-width: 560px;
  gap: 12px;
}

.capability-card {
  position: relative;
  display: flex;
  padding: 14px 16px;
  overflow: hidden;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(213 223 239 / 76%);
  border-radius: 16px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 4%);
  align-items: center;
  gap: 12px;
  transition:
    background-color 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.capability-card:nth-child(1) {
  animation: valueCardPulse 9s ease-in-out infinite;
}

.capability-card:nth-child(2) {
  animation: valueCardPulse 9s ease-in-out infinite;
  animation-delay: 3s;
}

.capability-card:nth-child(3) {
  animation: valueCardPulse 9s ease-in-out infinite;
  animation-delay: 6s;
}

.capability-card:hover {
  background: rgb(255 255 255 / 96%);
  border-color: rgb(37 99 235 / 34%);
  transform: translateY(-4px);
  box-shadow: 0 20px 42px rgb(37 99 235 / 12%);
}

.capability-icon {
  display: grid;
  width: 40px;
  height: 40px;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid #d8e5ff;
  border-radius: 13px;
  place-items: center;
  flex-shrink: 0;
  transition:
    color 0.22s ease,
    background-color 0.22s ease,
    border-color 0.22s ease;
}

.capability-card:nth-child(1) .capability-icon {
  animation: valueIconPulse 9s ease-in-out infinite;
}

.capability-card:nth-child(2) .capability-icon {
  animation: valueIconPulse 9s ease-in-out infinite;
  animation-delay: 3s;
}

.capability-card:nth-child(3) .capability-icon {
  animation: valueIconPulse 9s ease-in-out infinite;
  animation-delay: 6s;
}

.capability-card:hover .capability-icon {
  color: #fff;
  background: var(--primary);
  border-color: var(--primary);
}

.capability-icon svg {
  width: 20px;
  height: 20px;
}

.capability-title {
  margin-bottom: 3px;
  font-size: 14px;
  font-weight: 750;
  color: var(--text-main);
}

.capability-desc {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--text-secondary);
}

.brand-footer {
  position: relative;
  z-index: 2;
  display: flex;
  font-size: 12px;
  color: var(--text-muted);
  justify-content: space-between;
  gap: 18px;
}

/* ===== 右侧表单区 ===== */
.form-side {
  position: relative;
  display: flex;
  min-height: 100vh;
  padding: 40px;
  background: radial-gradient(circle at 80% 10%, rgb(37 99 235 / 8%), transparent 32%),
    linear-gradient(180deg, #fff 0%, #f8faff 100%);
  align-items: center;
  justify-content: center;
}

.form-shell {
  width: 100%;
  max-width: 430px;
}

.mobile-logo {
  display: none;
  margin-bottom: 28px;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 800;
}

.form-container {
  width: 100%;
  padding: 36px;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow:
    0 24px 64px rgb(15 23 42 / 8%),
    inset 0 1px 0 rgb(255 255 255 / 80%);
  backdrop-filter: blur(14px);
}

.form-header {
  margin-bottom: 30px;
}

.form-title {
  margin: 8px 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-main);
}

.form-hint {
  max-width: 330px;
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

/* ===== Element Plus 重写：企业蓝灰 ===== */
:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-form-item__label) {
  padding-bottom: 7px !important;
  font-size: 13px !important;
  font-weight: 650 !important;
  color: var(--text-secondary) !important;
}

:deep(.el-input__wrapper) {
  height: 46px;
  padding: 2px 14px !important;
  background-color: #f8faff !important;
  border-radius: 12px !important;
  box-shadow: 0 0 0 1px var(--border) inset !important;
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

:deep(.el-input__wrapper:hover) {
  background-color: #fff !important;
  box-shadow: 0 0 0 1px #c8d8f5 inset !important;
}

:deep(.el-input__wrapper.is-focus) {
  background-color: #fff !important;
  box-shadow:
    0 0 0 1px var(--primary) inset,
    0 0 0 4px rgb(37 99 235 / 10%) !important;
}

:deep(.el-input__inner) {
  font-size: 14px !important;
  color: var(--text-main) !important;
}

:deep(.el-input__inner::placeholder) {
  color: var(--text-muted) !important;
}

:deep(.el-input__suffix),
:deep(.el-input__clear),
:deep(.el-input__password) {
  color: var(--text-muted) !important;
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
  height: 46px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: #f8faff;
  border: 1px solid var(--border);
  border-radius: 12px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.captcha-box:hover {
  border-color: #bfd0f4;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgb(37 99 235 / 10%);
}

.captcha-box img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  height: 48px !important;
  margin-top: 8px;
  font-size: 15px !important;
  font-weight: 750 !important;
  letter-spacing: 0.02em;
  color: #fff !important;
  background: var(--primary) !important;
  border: none !important;
  border-radius: 12px !important;
  box-shadow: 0 14px 28px rgb(37 99 235 / 22%);
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.login-btn:hover {
  background: var(--primary-strong) !important;
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgb(37 99 235 / 28%);
}

/* 表单底部 */
.form-footer {
  margin-top: 22px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
</style>
