import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  limit = 10,
  onLimitChange,
  total = 0,
  limitOptions = [10, 20, 50, 100]
}) {
  const currentTotal = total || 0
  const startItem = currentTotal === 0 ? 0 : (page - 1) * limit + 1
  const endItem = Math.min(page * limit, currentTotal)

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3.5 bg-surface rounded-2xl border border-border mt-3 shadow-2xs">
      {/* Left: Counts and Page Info */}
      <div className="flex items-center gap-3 text-[13px] text-text-secondary">
        {currentTotal > 0 ? (
          <span>
            Showing <span className="font-bold text-text-primary">{startItem}-{endItem}</span> of{' '}
            <span className="font-bold text-text-primary">{currentTotal}</span> items
          </span>
        ) : (
          <span>
            Page <span className="font-bold text-text-primary">{page}</span> of{' '}
            <span className="font-bold text-text-primary">{Math.max(1, totalPages)}</span>
          </span>
        )}

        {/* Limit / View More Box (10, 20, 50, 100) */}
        {onLimitChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-border">
            <span className="text-[11.5px] font-medium text-text-tertiary uppercase tracking-wider">Per page:</span>
            <div className="flex items-center gap-1 bg-surface-hover/80 p-0.5 rounded-lg border border-border/80">
              {limitOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onLimitChange(opt)}
                  className={`px-2 py-0.5 rounded-md text-[11.5px] font-bold transition-all cursor-pointer ${
                    limit === opt
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-text-secondary hover:text-navy hover:bg-surface'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Page Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-navy transition-colors cursor-pointer border border-border/60"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {getPageNumbers().map((num) => (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              className={`w-8 h-8 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer ${
                num === page
                  ? 'bg-primary text-white shadow-xs'
                  : 'hover:bg-surface-hover text-text-secondary border border-transparent hover:border-border'
              }`}
            >
              {num}
            </button>
          ))}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-navy transition-colors cursor-pointer border border-border/60"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
