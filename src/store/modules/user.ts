import { defineStore } from 'pinia'
import { store } from '../index'
import { authApi, setStaticToken, userApi, type UserInfoVO } from '@/api/frontend-api'

const TOKEN_STORAGE_KEY = 'aihub_token'

const initialToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
if (initialToken) {
  setStaticToken(initialToken)
}

interface UserState {
  token: string | null
  userInfo: UserInfoVO | null
  permissions: string[]
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: initialToken,
    userInfo: null,
    permissions: []
  }),
  getters: {
    getToken: (state): string | null => state.token,
    getUserInfo: (state): UserInfoVO | null => state.userInfo,
    getPermissions: (state): string[] => state.permissions,
    getDisplayName: (state): string =>
      state.userInfo?.nickname || state.userInfo?.username || '管理员'
  },
  actions: {
    setToken(token: string | null) {
      this.token = token
      if (token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
      } else {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      }
      setStaticToken(token)
    },
    setUserInfo(userInfo: UserInfoVO | null) {
      this.userInfo = userInfo
    },
    setPermissions(permissions: string[]) {
      this.permissions = Array.isArray(permissions) ? permissions : []
    },
    async fetchUserInfo(): Promise<UserInfoVO> {
      const userInfo = await userApi.me()
      this.setUserInfo(userInfo)
      return userInfo
    },
    async logout(): Promise<void> {
      try {
        await authApi.logout()
      } catch {
        // noop: logout should still clear local state
      }
      await this.resetAuth()
    },
    async resetAuth(): Promise<void> {
      this.setToken(null)
      this.setUserInfo(null)
      this.setPermissions([])
    }
  }
})

export const useUserStoreWithOut = () => useUserStore(store)
