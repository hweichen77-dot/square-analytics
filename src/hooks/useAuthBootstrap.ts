import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { refreshAccessToken } from '../engine/squareAuth'

const EXPIRY_BUFFER_MS = 24 * 60 * 60 * 1000

async function reconnectIfNeeded() {
  const { accessToken, refreshToken, tokenExpiresAt } = useAuthStore.getState()
  if (!refreshToken) return
  const expiringSoon = tokenExpiresAt != null && Date.now() > tokenExpiresAt - EXPIRY_BUFFER_MS
  if (accessToken && !expiringSoon) return
  await refreshAccessToken().catch(() => {})
}

export function useAuthBootstrap() {
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      reconnectIfNeeded()
      return
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => reconnectIfNeeded())
    return unsub
  }, [])
}
