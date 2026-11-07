import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authStorage } from './tauriStorage'

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
  stockHistorySyncedThrough: string | null
  stockHistoryError: string | null

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
      stockHistorySyncedThrough: null,
      stockHistoryError: null,

      setCredentials: creds => set(s => ({ ...s, ...creds })),
      clearAuth: () => set({
        accessToken: '', refreshToken: '', merchantID: '',
        tokenExpiresAt: null, locationID: '', squareTaxIds: [], lastSyncDate: null, lastSyncCount: 0,
        customerBackfillDone: false,
        stockHistorySyncedThrough: null,
        stockHistoryError: null,
      }),
    }),
    { name: 'walleys-auth', storage: createJSONStorage(authStorage) }
  )
)
