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
  squareTaxIds: string[]
  daysBack: number
  lastSyncDate: string | null
  lastSyncCount: number
  autoSyncEnabled: boolean
  syncIntervalMinutes: number
  customerBackfillDone: boolean

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
      squareTaxIds: [],
      daysBack: 90,
      lastSyncDate: null,
      lastSyncCount: 0,
      autoSyncEnabled: false,
      syncIntervalMinutes: 30,
      customerBackfillDone: false,

      setCredentials: creds => set(s => ({ ...s, ...creds })),
      clearAuth: () => set({
        accessToken: '', refreshToken: '', merchantID: '',
        tokenExpiresAt: null, locationID: '', squareTaxIds: [], lastSyncDate: null, lastSyncCount: 0,
        customerBackfillDone: false,
      }),
    }),
    { name: 'walleys-auth' }
  )
)
