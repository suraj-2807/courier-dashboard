import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2
        className={`${sizeMap[size]} text-primary animate-spin`}
      />
      {text && (
        <p className="text-sm text-text-secondary">{text}</p>
      )}
    </div>
  )
}
