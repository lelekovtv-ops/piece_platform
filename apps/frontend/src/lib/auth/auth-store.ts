import { create } from "zustand"
import {
  loginApi,
  registerApi,
  refreshApi,
  logoutApi,
  getMeApi,
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  type AuthUser,
} from "./auth-client"
import { authFetch, setCurrentTeamId } from "./auth-fetch"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4030"

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true })
    try {
      if (!getRefreshToken()) {
        set({ isLoading: false })
        return
      }
      const result = await refreshApi()
      if (!result) {
        set({ isLoading: false })
        return
      }
      setAccessToken(result.accessToken)
      const user = await getMeApi()
      if (user) {
        await selectFirstTeam()
      }
      set({ user, isAuthenticated: !!user, isLoading: false })
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    const data = await loginApi(email, password)
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    await selectFirstTeam()
    set({ user: data.user, isAuthenticated: true })
  },

  register: async (email: string, password: string, name?: string) => {
    const data = await registerApi(email, password, name)
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    await selectFirstTeam()
    set({ user: data.user, isAuthenticated: true })
  },

  logout: async () => {
    await logoutApi()
    setCurrentTeamId(null)
    set({ user: null, isAuthenticated: false })
  },
}))

async function selectFirstTeam() {
  try {
    const res = await authFetch("/v1/teams")
    if (res.ok) {
      const teams = await res.json()
      if (teams.data?.length > 0) {
        setCurrentTeamId(teams.data[0].id)
      }
    }
  } catch {
    // Team selection is optional at this stage
  }
}
