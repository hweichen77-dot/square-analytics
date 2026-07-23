import type { StateStorage } from 'zustand/middleware'

const isTauri = () => typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined

const durableStorage: StateStorage = {
  async getItem(name) {
    const { invoke } = await import('@tauri-apps/api/core')
    const stored = await invoke<string | null>('load_state', { key: name })
    if (stored) return stored
    const legacy = typeof localStorage !== 'undefined' ? localStorage.getItem(name) : null
    if (legacy) {
      await invoke('save_state', { key: name, value: legacy })
      return legacy
    }
    return null
  },
  async setItem(name, value) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_state', { key: name, value })
  },
  async removeItem(name) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_state', { key: name, value: '' })
  },
}

export function authStorage(): StateStorage {
  if (isTauri()) return durableStorage
  return {
    getItem: name => localStorage.getItem(name),
    setItem: (name, value) => localStorage.setItem(name, value),
    removeItem: name => localStorage.removeItem(name),
  }
}
