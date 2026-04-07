import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  appID: string
  appSecret: string
  accessToken: string
  refreshToken: string
  merchantID: string
  tokenExpiresAt: number | null
  locationID: string
  daysBack: number
  lastSyncDate: string | null
  lastSyncCount: number

  setCredentials: (creds: Partial<AuthStore>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      appID: '',
      appSecret: '',
      accessToken: '',
      refreshToken: '',
      merchantID: '',
      tokenExpiresAt: null,
      locationID: '',
      daysBack: 90,
      lastSyncDate: null,
      lastSyncCount: 0,

      setCredentials: creds => set(s => ({ ...s, ...creds })),
      clearAuth: () => set({
        accessToken: '', refreshToken: '', merchantID: '',
        tokenExpiresAt: null, locationID: '', lastSyncDate: null, lastSyncCount: 0,
      }),
    }),
    { name: 'walleys-auth' }
  )
)
