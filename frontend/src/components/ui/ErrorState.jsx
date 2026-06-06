import { AlertTriangle } from 'lucide-react'

export default function ErrorState({
  message = 'Something went wrong',
  onRetry
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-danger-bg rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-danger" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">
        Error
      </h3>
      <p className="text-sm text-text-secondary max-w-sm mb-4">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors cursor-pointer"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
