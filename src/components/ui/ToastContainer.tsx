import { useToastStore } from '../../store/toastStore'

const VARIANT_STYLES = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-800 text-white',
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium cursor-pointer min-w-48 text-center ${VARIANT_STYLES[t.variant]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
