export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Loading">
      <div className="w-5 h-5 border-2 border-stone-700 border-t-stone-100 rounded-full animate-spin" />
    </div>
  )
}
