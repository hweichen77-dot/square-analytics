import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { runSquareSync } from '../engine/squareSyncEngine'

export function useAutoSync() {
  const { autoSyncEnabled, syncIntervalMinutes, accessToken, locationID } = useAuthStore()
  const running = useRef(false)

  useEffect(() => {
    if (!autoSyncEnabled || !accessToken || !locationID) return

    const ms = Math.max(syncIntervalMinutes, 5) * 60 * 1000
    const id = setInterval(() => {
      if (running.current) return
      running.current = true
      runSquareSync(() => {}).catch(() => {}).finally(() => { running.current = false })
    }, ms)

    return () => clearInterval(id)
  }, [autoSyncEnabled, syncIntervalMinutes, accessToken, locationID])
}
