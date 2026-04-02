import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { startOAuthFlow } from '../engine/squareAuth'
import { fetchLocations } from '../engine/squareAPIClient'
import { runSquareSync } from '../engine/squareSyncEngine'
import type { SyncStatus } from '../engine/squareSyncEngine'
import { useToastStore } from '../store/toastStore'
import { formatNumber } from '../utils/format'

export default function SquareSyncView() {
  const store = useAuthStore()
  const { show } = useToastStore()
  const [appIDInput, setAppIDInput] = useState(store.appID)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)

  const isConnected = !!store.accessToken

  async function handleConnect() {
    if (!appIDInput.trim()) { show('Enter your Square Application ID first', 'error'); return }
    store.setCredentials({ appID: appIDInput.trim() })
    await startOAuthFlow(appIDInput.trim())
  }

  async function handleLoadLocations() {
    try {
      const locs = await fetchLocations(store.accessToken)
      setLocations(locs)
      if (locs.length === 1) store.setCredentials({ locationID: locs[0].id })
      show(`Found ${locs.length} location(s)`, 'success')
    } catch (e) {
      show(`Failed to load locations: ${(e as Error).message}`, 'error')
    }
  }

  async function handleSync() {
    if (!store.locationID) { show('Select a location first', 'error'); return }
    setSyncing(true)
    try {
      await runSquareSync(status => setSyncStatus(status))
      show('Sync complete!', 'success')
    } catch (e) {
      show(`Sync failed: ${(e as Error).message}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900">Square Sync</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Square Application ID</h2>
        <input
          type="text"
          value={appIDInput}
          onChange={e => setAppIDInput(e.target.value)}
          placeholder="sq0idp-…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {!isConnected ? (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Connect Square Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-green-600 font-medium text-sm">✓ Connected — {store.merchantID}</span>
            <button
              onClick={() => { store.clearAuth(); show('Disconnected', 'info') }}
              className="text-sm text-red-500 underline"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Location</h2>
          {locations.length === 0 ? (
            <button
              onClick={handleLoadLocations}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              Load Locations
            </button>
          ) : (
            <select
              value={store.locationID}
              onChange={e => store.setCredentials({ locationID: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
      )}

      {isConnected && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Sync Period</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => store.setCredentials({ daysBack: Math.max(7, store.daysBack - 7) })}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold flex items-center justify-center">−</button>
            <span className="w-24 text-center font-medium">{store.daysBack} days</span>
            <button onClick={() => store.setCredentials({ daysBack: Math.min(365, store.daysBack + 7) })}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold flex items-center justify-center">+</button>
          </div>
        </div>
      )}

      {isConnected && store.locationID && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Sync Now</h2>
            {store.lastSyncDate && (
              <p className="text-xs text-gray-400">
                Last: {new Date(store.lastSyncDate).toLocaleString()} · {formatNumber(store.lastSyncCount)} added
              </p>
            )}
          </div>
          {syncStatus && (
            <p className="text-sm text-gray-600">
              {syncStatus.message}
              {syncStatus.phase === 'done' && ` · ${syncStatus.ordersAdded} orders added, ${syncStatus.productsAdded} products`}
            </p>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Start Sync'}
          </button>
        </div>
      )}
    </div>
  )
}
{syncing ? 'Syncing…' : 'Start Sync'}
          </button>
        </div>
      )}
    </div>
  )
}
