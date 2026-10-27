import { useToastStore } from '../../store/toastStore'

const VARIANT_STYLES = {
  success: 'bg-[#dcfae5] text-[#04250e] border border-[#bfe9cb]',
  error:   'bg-[#ffedea] text-[#831c1e] border border-[#f6cfc9]',
  info:    'bg-stone-100 text-white',
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
          className={`px-4 py-2.5 rounded-md shadow-[0_8px_24px_rgb(0_0_0/0.12)] text-sm font-medium cursor-pointer min-w-52 text-center ${VARIANT_STYLES[t.variant]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
