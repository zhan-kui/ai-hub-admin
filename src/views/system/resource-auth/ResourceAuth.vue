<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ContentWrap } from '@/components/ContentWrap'
import {
  appApi,
  knowledgeApi,
  resourceAuthApi,
  userApi,
  type AppConfigVO,
  type KnowledgeBaseVO,
  type UserInfoVO
} from '@/api/frontend-api'

type UserRow = UserInfoVO & Record<string, any>

const userLoading = ref(false)
const authLoading = ref(false)
const saving = ref(false)

const userKeyword = ref('')
const users = ref<UserRow[]>([])
const selectedUserId = ref<number | null>(null)

const apps = ref<AppConfigVO[]>([])
const knowledgeBases = ref<KnowledgeBaseVO[]>([])

const selectedAppIds = ref<number[]>([])
const selectedKnowledgeIds = ref<number[]>([])

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, any>
  for (const key of ['list', 'items', 'rows', 'records', 'data']) {
    if (Array.isArray(obj[key])) return obj[key]
  }
  if (obj.data && typeof obj.data === 'object') {
    for (const key of ['list', 'items', 'rows', 'records']) {
      if (Array.isArray(obj.data[key])) return obj.data[key]
    }
  }
  return []
}

function toNumberArray(value: any): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
}

async function loadUsers() {
  userLoading.value = true
  try {
    const res = await userApi.list({
      keyword: userKeyword.value || undefined,
      page: 1,
      size: 500
    })
    users.value = pickArray(res) as UserRow[]
    if (!selectedUserId.value && users.value.length > 0) {
      selectedUserId.value = Number(users.value[0].id)
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '用户列表加载失败')
  } finally {
    userLoading.value = false
  }
}

async function loadResources() {
  try {
    const [appRes, kbRes] = await Promise.all([appApi.list(), knowledgeApi.list()])
    apps.value = pickArray(appRes) as AppConfigVO[]
    knowledgeBases.value = pickArray(kbRes) as KnowledgeBaseVO[]
  } catch (error: any) {
    ElMessage.error(error?.message || '资源列表加载失败')
  }
}

async function loadUserAuthorizations() {
  if (!selectedUserId.value) return
  authLoading.value = true
  try {
    const res = await resourceAuthApi.getUserAuthorizations(selectedUserId.value)
    selectedAppIds.value = toNumberArray((res as any).app ?? (res as any).APP)
    selectedKnowledgeIds.value = toNumberArray((res as any).knowledge ?? (res as any).KNOWLEDGE)
  } catch (error: any) {
    ElMessage.error(error?.message || '用户授权加载失败')
  } finally {
    authLoading.value = false
  }
}

async function selectUser(userId: number) {
  selectedUserId.value = userId
  await loadUserAuthorizations()
}

async function saveAuthorizations() {
  if (!selectedUserId.value) return
  saving.value = true
  try {
    await resourceAuthApi.revoke(selectedUserId.value, 'APP')
    if (selectedAppIds.value.length > 0) {
      await resourceAuthApi.grant({
        userId: selectedUserId.value,
        resourceType: 'APP',
        resourceIds: selectedAppIds.value
      })
    }

    await resourceAuthApi.revoke(selectedUserId.value, 'KNOWLEDGE')
    if (selectedKnowledgeIds.value.length > 0) {
      await resourceAuthApi.grant({
        userId: selectedUserId.value,
        resourceType: 'KNOWLEDGE',
        resourceIds: selectedKnowledgeIds.value
      })
    }

    ElMessage.success('资源授权保存成功')
    await loadUserAuthorizations()
  } catch (error: any) {
    ElMessage.error(error?.message || '资源授权保存失败')
  } finally {
    saving.value = false
  }
}

const currentUser = computed(() =>
  users.value.find((item) => Number(item.id) === Number(selectedUserId.value))
)

onMounted(async () => {
  await Promise.all([loadUsers(), loadResources()])
  await loadUserAuthorizations()
})
</script>

<template>
  <ContentWrap title="资源授权管理">
    <div class="layout">
      <section class="user-panel">
        <div class="panel-title">用户列表</div>
        <el-input
          v-model="userKeyword"
          class="user-search-input"
          placeholder="搜索用户"
          clearable
          @keyup.enter="loadUsers"
          @clear="loadUsers"
        >
          <template #append>
            <el-tooltip content="刷新用户列表" placement="top">
              <el-button
                class="refresh-icon-btn"
                text
                :icon="RefreshRight"
                :loading="userLoading"
                @click="loadUsers"
              />
            </el-tooltip>
          </template>
        </el-input>
        <el-scrollbar class="user-list">
          <div
            v-for="user in users"
            :key="user.id"
            class="user-item"
            :class="{ active: Number(user.id) === Number(selectedUserId) }"
            @click="selectUser(Number(user.id))"
          >
            <div class="user-name">{{ user.nickname || user.username }}</div>
            <div class="user-sub">{{ user.username }}</div>
          </div>
          <el-empty v-if="users.length === 0" description="暂无用户" :image-size="72" />
        </el-scrollbar>
      </section>

      <section class="auth-panel">
        <div class="panel-head">
          <div class="panel-title">授权配置</div>
          <div class="panel-user">{{
            currentUser?.nickname || currentUser?.username || '未选择用户'
          }}</div>
          <el-button
            type="primary"
            :loading="saving || authLoading"
            :disabled="!selectedUserId"
            @click="saveAuthorizations"
          >
            保存授权
          </el-button>
        </div>

        <el-skeleton :loading="authLoading" animated :rows="6">
          <template #default>
            <el-tabs class="auth-tabs">
              <el-tab-pane label="应用授权">
                <el-checkbox-group v-model="selectedAppIds" class="resource-grid">
                  <el-checkbox v-for="item in apps" :key="item.id" :label="item.id">
                    <div class="resource-item">
                      <div class="resource-name">{{ item.appName }}</div>
                      <div class="resource-sub">{{ item.appCode }}</div>
                    </div>
                  </el-checkbox>
                </el-checkbox-group>
                <el-empty v-if="apps.length === 0" description="暂无可授权应用" :image-size="72" />
              </el-tab-pane>

              <el-tab-pane label="知识库授权">
                <el-checkbox-group v-model="selectedKnowledgeIds" class="resource-grid">
                  <el-checkbox v-for="item in knowledgeBases" :key="item.id" :label="item.id">
                    <div class="resource-item">
                      <div class="resource-name">{{ item.kbName || item.name || item.id }}</div>
                      <div class="resource-sub">{{ item.kbCode || item.description || '-' }}</div>
                    </div>
                  </el-checkbox>
                </el-checkbox-group>
                <el-empty
                  v-if="knowledgeBases.length === 0"
                  description="暂无可授权知识库"
                  :image-size="72"
                />
              </el-tab-pane>
            </el-tabs>
          </template>
        </el-skeleton>
      </section>
    </div>
  </ContentWrap>
</template>

<style scoped lang="less">
.layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  min-height: 620px;
}

.user-panel,
.auth-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px;
  background: var(--el-bg-color);
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.refresh-icon-btn {
  padding: 0 2px;
  border-color: var(--el-border-color);
}

.user-list {
  margin-top: 10px;
  height: calc(100% - 86px);
}

.user-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-item:hover {
  border-color: var(--el-color-primary-light-5);
}

.user-item.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.user-name {
  font-size: 14px;
  font-weight: 600;
}

.user-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.panel-user {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.auth-tabs {
  min-height: 530px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.resource-item {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.resource-name {
  font-size: 13px;
  font-weight: 600;
}

.resource-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
