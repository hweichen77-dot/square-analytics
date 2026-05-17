import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { runSquareSync, isSyncInFlight } from '../engine/squareSyncEngine'
import { useToastStore } from '../store/toastStore'

export function useAutoSync() {
  const { autoSyncEnabled, syncIntervalMinutes, accessToken, locationID } = useAuthStore()
  const { show } = useToastStore()

  useEffect(() => {
    if (!autoSyncEnabled || !accessToken || !locationID) return

    const ms = Math.max(syncIntervalMinutes, 5) * 60 * 1000
    const id = setInterval(() => {
      if (isSyncInFlight()) return
      runSquareSync(() => {}).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Auto-sync failed'
        show(`Square sync failed: ${msg}`, 'error')
      })
    }, ms)

    return () => clearInterval(id)
  }, [autoSyncEnabled, syncIntervalMinutes, accessToken, locationID, show])
}
