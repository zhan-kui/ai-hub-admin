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
    <el-card class="login-card" shadow="hover">
      <template #header>
        <div class="login-title">AI Hub 登录</div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @keyup.enter="submit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" clearable />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item label="验证码" prop="captchaCode">
          <div class="captcha-row">
            <el-input v-model="form.captchaCode" placeholder="请输入验证码" clearable />
            <img class="captcha-image" :src="captchaImage" alt="captcha" @click="refreshCaptcha" />
          </div>
        </el-form-item>

        <el-button type="primary" class="login-button" :loading="loading" @click="submit"
          >登录</el-button
        >
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f4f7ff 0%, #eef6ff 100%);
}

.login-card {
  width: 420px;
}

.login-title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
}

.captcha-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 12px;
}

.captcha-image {
  width: 120px;
  height: 32px;
  cursor: pointer;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.login-button {
  width: 100%;
}
</style>
