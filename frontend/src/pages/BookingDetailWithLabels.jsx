import { Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { useParams } from 'react-router-dom'
import { useBookingById } from '../hooks/useBookings'
import { getForwarderLabels } from '../utils/forwarderLabels'
import { openBase64Pdf, openPdfUrl } from '../utils/openVendorDocument'
import BookingDetailPage from './BookingDetailPage'

export default function BookingDetailWithLabels() {
  const { id } = useParams()
  const { data } = useBookingById(id)
  const labels = getForwarderLabels(data?.booking)

  return (
    <>
      {labels.length > 0 && (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {labels.map(({ name, title, value }, index) => (
            <button
              key={`${name}-${index}`}
              type="button"
              onClick={() => {
                const opened = /^https?:\/\//i.test(value)
                  ? openPdfUrl(value, name)
                  : openBase64Pdf(value, name)
                if (!opened) toast.error(`Could not open ${title}`)
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-[12px] font-bold text-text-primary transition-colors hover:bg-surface-alt"
            >
              <Package className="w-3.5 h-3.5" />
              {title}{labels.length > 1 ? ` ${index + 1}` : ''}
            </button>
          ))}
        </div>
      )}
      <BookingDetailPage />
    </>
  )
}
