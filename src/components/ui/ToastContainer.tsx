import { useToastStore } from '../../store/toastStore'

const VARIANT_STYLES = {
  success: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
  error:   'bg-red-500/10 text-red-300 border border-red-500/30',
  info:    'bg-slate-700 text-slate-200 border border-slate-600',
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          onClick={() => dismiss(t.id)}
          className={`px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium cursor-pointer min-w-52 text-center backdrop-blur-sm ${VARIANT_STYLES[t.variant]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
