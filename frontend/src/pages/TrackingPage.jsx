import { useState } from 'react'
import { useTrackingSearch } from '../hooks/useTracking'
import {
  Search,
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  User,
  Phone
} from 'lucide-react'
import StatusBadge from '../components/ui/StatusBadge'
import { formatDate, formatDateTime } from '../utils/formatters'

export default function TrackingPage() {
  const [inputValue, setInputValue] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')

  const { data, isLoading, isError } = useTrackingSearch(trackingNumber)
  const shipment = data?.shipment

  const handleSearch = (e) => {
    e.preventDefault()
    if (inputValue.trim()) setTrackingNumber(inputValue.trim())
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
          Tracking Overview
        </h1>
        <p className="text-[13px] text-text-secondary mt-1">
          Monitor your active shipments and view real-time status updates.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="bg-surface border border-border rounded-2xl p-1.5 flex gap-2 max-w-2xl focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <div className="flex-1 flex items-center gap-2.5 px-4">
            <Search className="w-[18px] h-[18px] text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              placeholder="Search AWB or Order ID..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="bg-transparent text-[14px] text-text-primary placeholder:text-text-tertiary outline-none w-full py-2"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
          >
            Track
          </button>
        </div>
      </form>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <div className="skeleton h-[180px] rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="skeleton h-[120px] rounded-2xl" />
            <div className="skeleton h-[120px] rounded-2xl" />
          </div>
        </div>
      )}

      {/* Error */}
      {isError && trackingNumber && !isLoading && (
        <div className="bg-surface border border-border rounded-2xl p-14 text-center animate-fade-in">
          <div className="w-14 h-14 bg-danger-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-danger" />
          </div>
          <h3 className="text-[16px] font-bold text-text-primary mb-1">Shipment Not Found</h3>
          <p className="text-[13px] text-text-secondary">
            No shipment found for tracking number "<span className="font-bold">{trackingNumber}</span>"
          </p>
        </div>
      )}

      {/* Default state */}
      {!trackingNumber && !isLoading && (
        <div className="bg-surface border border-border rounded-2xl p-20 text-center">
          <div className="w-16 h-16 bg-surface-alt rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-text-tertiary" />
          </div>
          <h3 className="text-[16px] font-bold text-text-primary mb-1">Track Your Shipment</h3>
          <p className="text-[13px] text-text-secondary max-w-md mx-auto">
            Enter a tracking number or AWB to see real-time shipment status and events.
          </p>
        </div>
      )}

      {/* Result */}
      {shipment && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
          <div className="lg:col-span-2 space-y-4">
            {/* Active Shipment */}
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-bold text-text-primary">Active Shipment Details</h2>
                <StatusBadge status={shipment.status} size="md" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">AWB Number</p>
                  <p className="text-[13px] font-bold text-text-primary font-mono">{shipment.tracking_number}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Carrier</p>
                  <p className="text-[13px] font-bold text-text-primary">{shipment.courier_providers?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Est. Delivery</p>
                  <p className="text-[13px] font-bold text-text-primary">{formatDate(shipment.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[1px] mb-1">Weight</p>
                  <p className="text-[13px] font-bold text-text-primary">{shipment.weight ? `${shipment.weight} kg` : '—'}</p>
                </div>
              </div>
            </div>

            {/* Recent Shipments mini table */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-border">
                <h2 className="text-[15px] font-bold text-text-primary">Shipment Info</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {/* Sender */}
                {shipment.senders && (
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center">
                        <User className="w-3 h-3 text-blue-600" />
                      </div>
                      <span className="text-[12px] font-bold text-text-primary">Origin — Sender</span>
                    </div>
                    <p className="text-[13px] font-bold text-text-primary mb-1">{shipment.senders.name}</p>
                    <p className="text-[12px] text-text-secondary">
                      {[shipment.senders.address, shipment.senders.city, shipment.senders.state].filter(Boolean).join(', ')}
                    </p>
                    {shipment.senders.phone && (
                      <p className="text-[11px] text-text-tertiary mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {shipment.senders.phone}
                      </p>
                    )}
                  </div>
                )}
                {/* Receiver */}
                {shipment.receivers && (
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-[12px] font-bold text-text-primary">Destination — Receiver</span>
                    </div>
                    <p className="text-[13px] font-bold text-text-primary mb-1">{shipment.receivers.name}</p>
                    <p className="text-[12px] text-text-secondary">
                      {[shipment.receivers.address, shipment.receivers.city, shipment.receivers.state].filter(Boolean).join(', ')}
                    </p>
                    {shipment.receivers.phone && (
                      <p className="text-[11px] text-text-tertiary mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {shipment.receivers.phone}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-surface border border-border rounded-2xl p-5 self-start">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                Live Tracking
              </h2>
              <button className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer">
                <svg className="w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {shipment.tracking_events?.length > 0 ? (
              <div>
                {shipment.tracking_events.map((event, idx) => {
                  const isLatest = idx === 0
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isLatest
                              ? 'bg-primary text-white shadow-md shadow-primary/30'
                              : 'bg-surface-alt text-text-tertiary border border-border'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        {idx < shipment.tracking_events.length - 1 && (
                          <div className={`w-px flex-1 min-h-[32px] ${isLatest ? 'bg-primary/20' : 'bg-border'}`} />
                        )}
                      </div>
                      <div className="pb-5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] font-bold ${isLatest ? 'text-primary' : 'text-text-primary'}`}>
                            {event.status}
                          </p>
                          <span className="text-[10px] text-text-tertiary whitespace-nowrap font-medium">
                            {formatDateTime(event.event_time)}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-secondary mt-0.5">{event.description}</p>
                        {event.location && event.location !== 'System' && (
                          <p className="text-[11px] text-text-tertiary mt-1 flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3" /> {event.location}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-surface-alt rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-text-tertiary" />
                </div>
                <p className="text-[13px] text-text-tertiary">No tracking events yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
