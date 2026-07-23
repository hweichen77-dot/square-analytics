const isTauri = () => typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined

export async function checkForAppUpdate(): Promise<void> {
  if (!isTauri()) return
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update?.available) return

    const { ask } = await import('@tauri-apps/plugin-dialog')
    const accepted = await ask(`Square Analytics ${update.version} is ready to install.`, {
      title: 'Update available',
      kind: 'info',
      okLabel: 'Install and restart',
      cancelLabel: 'Later',
    })
    if (!accepted) return

    await update.downloadAndInstall()
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch (err) {
    console.warn('[update] check failed', err)
  }
}
