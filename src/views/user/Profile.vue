<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import { userApi } from '@/api/frontend-api'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const profileLoading = ref(false)
const profileSubmitting = ref(false)
const passwordSubmitting = ref(false)

const profileRef = ref<FormInstance>()
const passwordRef = ref<FormInstance>()

const profileForm = reactive({
  username: '',
  nickname: '',
  email: '',
  phone: '',
  avatar: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const profileRules: FormRules = {
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
}

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  confirmPassword: [
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback(new Error('请确认新密码'))
          return
        }
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

async function loadProfile() {
  profileLoading.value = true
  try {
    const data = await userApi.me()
    profileForm.username = data.username || ''
    profileForm.nickname = data.nickname || ''
    profileForm.email = data.email || ''
    profileForm.phone = data.phone || ''
    profileForm.avatar = data.avatar || ''
  } catch (error: any) {
    ElMessage.error(error?.message || '个人信息加载失败')
  } finally {
    profileLoading.value = false
  }
}

async function submitProfile() {
  if (!profileRef.value) return
  await profileRef.value.validate()

  profileSubmitting.value = true
  try {
    const data = await userApi.updateMe({
      nickname: profileForm.nickname.trim() || undefined,
      email: profileForm.email.trim() || undefined,
      phone: profileForm.phone.trim() || undefined,
      avatar: profileForm.avatar.trim() || undefined
    })
    userStore.setUserInfo(data)
    ElMessage.success('个人信息更新成功')
  } catch (error: any) {
    ElMessage.error(error?.message || '个人信息更新失败')
  } finally {
    profileSubmitting.value = false
  }
}

async function submitPassword() {
  if (!passwordRef.value) return
  await passwordRef.value.validate()

  passwordSubmitting.value = true
  try {
    await userApi.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
    ElMessage.success('密码修改成功')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordRef.value.clearValidate()
  } catch (error: any) {
    ElMessage.error(error?.message || '密码修改失败')
  } finally {
    passwordSubmitting.value = false
  }
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <ContentWrap title="个人中心" message="维护个人资料与账号密码">
    <el-row :gutter="16">
      <el-col :xs="24" :lg="14">
        <el-card shadow="never" class="panel-card" v-loading="profileLoading">
          <template #header>
            <div class="panel-title">基础信息</div>
          </template>

          <el-form ref="profileRef" :model="profileForm" :rules="profileRules" label-width="110px">
            <el-form-item label="用户名">
              <el-input :model-value="profileForm.username" disabled />
            </el-form-item>
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="profileForm.nickname" />
            </el-form-item>
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="profileForm.email" />
            </el-form-item>
            <el-form-item label="手机号">
              <el-input v-model="profileForm.phone" />
            </el-form-item>
            <el-form-item label="头像地址">
              <el-input v-model="profileForm.avatar" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="profileSubmitting" @click="submitProfile">
                保存资料
              </el-button>
              <el-button @click="loadProfile">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <div class="panel-title">修改密码</div>
          </template>

          <el-form
            ref="passwordRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="120px"
          >
            <el-form-item label="旧密码" prop="oldPassword">
              <el-input v-model="passwordForm.oldPassword" show-password type="password" />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input v-model="passwordForm.newPassword" show-password type="password" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="passwordForm.confirmPassword" show-password type="password" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="passwordSubmitting" @click="submitPassword">
                更新密码
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </ContentWrap>
</template>

<style scoped lang="less">
.panel-card {
  min-height: 440px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
}
</style>
