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
const showOverlay = ref(false)
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

    showOverlay.value = true
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await new Promise((r) => setTimeout(r, 1600))
    router.replace(redirect)
  } catch (error: any) {
    ElMessage.error(error?.message || '登录失败，请重试')
    await refreshCaptcha()
    loading.value = false
  }
}

onMounted(async () => {
  await refreshCaptcha()
})
</script>

<template>
  <div class="login-root">
    <!-- Animated background -->
    <div class="login-bg">
      <div class="bg-grid"></div>
      <div class="bg-glow bg-glow--1"></div>
      <div class="bg-glow bg-glow--2"></div>
    </div>

    <div class="login-wrap">
      <!-- ── Left brand panel ── -->
      <div class="login-brand">
        <div class="brand-header">
          <div class="brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"
                fill="url(#bgl1)"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="#fff"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <defs>
                <linearGradient id="bgl1" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#818cf8" />
                  <stop offset="100%" stop-color="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span class="brand-name">AI Hub</span>
          <span class="brand-tag">Admin</span>
        </div>

        <div class="brand-hero">
          <h1 class="brand-title">企业级<br /><span class="brand-title--accent">AI 中台</span><br />管理平台</h1>
          <p class="brand-desc">统一管理、调度与监控您的所有 AI 服务资源，构建智能化的企业数字基础设施。</p>
        </div>

        <ul class="brand-features">
          <li class="brand-feature">
            <span class="feature-dot"></span>
            模型接入 &amp; 版本管理
          </li>
          <li class="brand-feature">
            <span class="feature-dot"></span>
            统一 API 网关 &amp; 鉴权
          </li>
          <li class="brand-feature">
            <span class="feature-dot"></span>
            用量监控 &amp; 成本分析
          </li>
          <li class="brand-feature">
            <span class="feature-dot"></span>
            多租户权限访问控制
          </li>
        </ul>

        <!-- Decorative illustration -->
        <div class="brand-illustration">
          <div class="illus-ring illus-ring--1"></div>
          <div class="illus-ring illus-ring--2"></div>
          <div class="illus-ring illus-ring--3"></div>
          <div class="illus-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="url(#il1)" />
              <path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <defs>
                <linearGradient id="il1" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#818cf8" />
                  <stop offset="100%" stop-color="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      <!-- ── Right login panel ── -->
      <div class="login-form-side">
        <div class="login-card">
          <div class="login-card__head">
            <h2 class="login-greeting">欢迎回来</h2>
            <p class="login-subtitle">登录 AI Hub 管理后台</p>
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
              <el-input
                v-model="form.username"
                placeholder="请输入用户名"
                size="large"
                clearable
              >
                <template #prefix>
                  <el-icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                show-password
                clearable
              >
                <template #prefix>
                  <el-icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="验证码" prop="captchaCode">
              <div class="captcha-row">
                <el-input
                  v-model="form.captchaCode"
                  placeholder="请输入验证码"
                  size="large"
                  clearable
                />
                <div class="captcha-img-wrap" @click="refreshCaptcha">
                  <img v-if="captchaImage" :src="captchaImage" alt="captcha" />
                  <span v-else class="captcha-placeholder">加载中...</span>
                  <div class="captcha-refresh-hint">点击刷新</div>
                </div>
              </div>
            </el-form-item>

            <el-button
              type="primary"
              size="large"
              class="login-submit-btn"
              :loading="loading"
              @click="submit"
            >
              <span v-if="!loading">登&nbsp;&nbsp;录</span>
              <span v-else>验证中...</span>
            </el-button>
          </el-form>

          <div class="login-footer-tip">
            <span>默认账号 admin / admin123</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Login success transition overlay ── -->
    <Teleport to="body">
      <Transition name="overlay-fade">
        <div v-if="showOverlay" class="login-overlay">
          <div class="overlay-content">
            <div class="overlay-ring">
              <div class="overlay-ring__spinner"></div>
              <div class="overlay-logo">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"
                    fill="url(#ovl1)"
                  />
                  <path
                    d="M9 12l2 2 4-4"
                    stroke="#fff"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <defs>
                    <linearGradient id="ovl1" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stop-color="#818cf8" />
                      <stop offset="100%" stop-color="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div class="overlay-progress-wrap">
              <div class="overlay-progress-bar"></div>
            </div>

            <div class="overlay-texts">
              <p class="overlay-text overlay-text--1">正在验证身份</p>
              <p class="overlay-text overlay-text--2">加载权限数据</p>
              <p class="overlay-text overlay-text--3">准备就绪 ✓</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Root ──────────────────────────────────────────────────────── */
.login-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  overflow: hidden;
  background: #0b0f1e;
}

/* ── Animated background ───────────────────────────────────────── */
.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  animation: glowFloat 8s ease-in-out infinite alternate;
}

.bg-glow--1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #6366f1 0%, transparent 70%);
  top: -120px;
  left: -100px;
  animation-delay: 0s;
}

.bg-glow--2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
  bottom: -80px;
  right: 5%;
  animation-delay: -4s;
}

@keyframes glowFloat {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(20px, 30px) scale(1.08); }
}

/* ── Layout ────────────────────────────────────────────────────── */
.login-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  min-height: 100vh;
}

/* ── Left brand panel ──────────────────────────────────────────── */
.login-brand {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40px 48px;
  position: relative;
  overflow: hidden;
}

@media (max-width: 900px) {
  .login-brand { display: none; }
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 64px;
}

.brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.5);
  flex-shrink: 0;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  color: #f9fafb;
  letter-spacing: 0.2px;
}

.brand-tag {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  padding: 2px 6px;
}

.brand-hero {
  margin-bottom: 40px;
}

.brand-title {
  font-size: 38px;
  font-weight: 800;
  color: #f9fafb;
  line-height: 1.2;
  letter-spacing: -0.5px;
  margin-bottom: 18px;
}

.brand-title--accent {
  background: linear-gradient(135deg, #818cf8, #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-desc {
  font-size: 15px;
  color: #6b7280;
  line-height: 1.7;
  max-width: 380px;
}

.brand-features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: auto;
}

.brand-feature {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #9ca3af;
}

.feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(99, 102, 241, 0.6);
}

/* Decorative rings */
.brand-illustration {
  position: absolute;
  bottom: -60px;
  right: -60px;
  width: 280px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
}

.illus-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(99, 102, 241, 0.4);
  animation: ringPulse 4s ease-in-out infinite;
}

.illus-ring--1 { width: 100px; height: 100px; animation-delay: 0s; }
.illus-ring--2 { width: 170px; height: 170px; animation-delay: 0.8s; }
.illus-ring--3 { width: 250px; height: 250px; animation-delay: 1.6s; }

.illus-center {
  position: relative;
  z-index: 1;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5);
}

@keyframes ringPulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%       { transform: scale(1.04); opacity: 0.3; }
}

/* ── Right login panel ─────────────────────────────────────────── */
.login-form-side {
  width: 480px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 48px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
}

@media (max-width: 900px) {
  .login-form-side {
    width: 100%;
    border-left: none;
    background: transparent;
    backdrop-filter: none;
    padding: 40px 24px;
  }
}

.login-card {
  width: 100%;
  max-width: 380px;
}

.login-card__head {
  margin-bottom: 32px;
}

.login-greeting {
  font-size: 26px;
  font-weight: 700;
  color: #f9fafb;
  margin-bottom: 6px;
  letter-spacing: -0.3px;
}

.login-subtitle {
  font-size: 14px;
  color: #6b7280;
}

/* Form overrides */
.login-form :deep(.el-form-item__label) {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
  padding-bottom: 6px;
  line-height: 1;
}

.login-form :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
  border-radius: 8px;
  transition: border-color 0.2s, background 0.2s;
}

.login-form :deep(.el-input__wrapper:hover) {
  border-color: rgba(99, 102, 241, 0.5) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  border-color: #6366f1 !important;
  background: rgba(99, 102, 241, 0.08) !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15) !important;
}

.login-form :deep(.el-input__inner) {
  color: #f3f4f6;
  font-size: 14px;
}

.login-form :deep(.el-input__inner::placeholder) {
  color: #4b5563;
}

.login-form :deep(.el-input__prefix) {
  color: #4b5563;
}

.login-form :deep(.el-input__suffix) {
  color: #4b5563;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

/* Captcha row */
.captcha-row {
  display: grid;
  grid-template-columns: 1fr 110px;
  gap: 10px;
  width: 100%;
}

.captcha-img-wrap {
  position: relative;
  height: 40px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  transition: border-color 0.2s;
}

.captcha-img-wrap:hover {
  border-color: rgba(99, 102, 241, 0.5);
}

.captcha-img-wrap:hover .captcha-refresh-hint {
  opacity: 1;
}

.captcha-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.captcha-placeholder {
  font-size: 11px;
  color: #4b5563;
}

.captcha-refresh-hint {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #e5e7eb;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Login button */
.login-submit-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #7c3aed) !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4) !important;
  transition: all 0.2s ease !important;
  margin-top: 8px;
}

.login-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.55) !important;
  background: linear-gradient(135deg, #4f46e5, #6d28d9) !important;
}

.login-submit-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35) !important;
}

.login-footer-tip {
  margin-top: 20px;
  text-align: center;
  font-size: 12px;
  color: #374151;
}

/* ── Transition overlay ────────────────────────────────────────── */
.login-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #0b0f1e 0%, #111827 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

/* Spinning ring + logo */
.overlay-ring {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-ring__spinner {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #6366f1;
  border-right-color: rgba(99, 102, 241, 0.3);
  animation: spinRing 0.9s linear infinite;
}

.overlay-ring__spinner::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-bottom-color: #8b5cf6;
  border-left-color: rgba(139, 92, 246, 0.2);
  animation: spinRing 1.3s linear infinite reverse;
}

@keyframes spinRing {
  to { transform: rotate(360deg); }
}

.overlay-logo {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.5);
}

/* Progress bar */
.overlay-progress-wrap {
  width: 200px;
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  overflow: hidden;
}

.overlay-progress-bar {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa);
  background-size: 200% 100%;
  animation: progressFill 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards,
             progressShimmer 1s linear infinite;
}

@keyframes progressFill {
  from { width: 0%; }
  to   { width: 100%; }
}

@keyframes progressShimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Text sequence */
.overlay-texts {
  height: 22px;
  position: relative;
  overflow: hidden;
}

.overlay-text {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  opacity: 0;
  animation-duration: 1.6s;
  animation-fill-mode: both;
  animation-timing-function: ease;
}

.overlay-text--1 {
  animation-name: textCycle1;
  animation-delay: 0s;
}

.overlay-text--2 {
  animation-name: textCycle2;
  animation-delay: 0.5s;
}

.overlay-text--3 {
  animation-name: textCycle3;
  animation-delay: 1.0s;
  color: #a78bfa;
}

@keyframes textCycle1 {
  0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  40%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  55%  { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  100% { opacity: 0; }
}

@keyframes textCycle2 {
  0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  40%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  55%  { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  100% { opacity: 0; }
}

@keyframes textCycle3 {
  0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
  20%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  80%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; }
}

/* Overlay transition */
.overlay-fade-enter-active {
  transition: opacity 0.3s ease;
}

.overlay-fade-leave-active {
  transition: opacity 0.4s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
