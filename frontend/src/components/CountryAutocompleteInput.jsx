import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe, Check } from 'lucide-react'

export default function CountryAutocompleteInput({
  value = '',
  onChange,
  placeholder = 'Search Country...',
  className = '',
  countryList = []
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  // Sync internal search with value prop
  useEffect(() => {
    setSearch(value)
  }, [value])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter country list by search term
  const filtered = (countryList || []).filter(item => {
    if (!search) return true
    const term = search.trim().toLowerCase()
    const nameMatch = item.country_name?.toLowerCase().includes(term)
    const codeMatch = item.country_code?.toLowerCase().includes(term)
    return nameMatch || codeMatch
  }).slice(0, 60)

  const handleSelect = (item) => {
    // Automatically set the 2-letter ISO country code
    onChange(item.country_code)
    setSearch(item.country_code)
    setIsOpen(false)
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setSearch(val)
    onChange(val)
    if (!isOpen) setIsOpen(true)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center w-full">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onFocus={() => setIsOpen(true)}
          onChange={handleInputChange}
          className={className}
        />
        <ChevronDown
          className="w-3.5 h-3.5 text-gray-400 absolute right-2 pointer-events-none transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-100 animate-fade-in">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-gray-300" /> No matching country found
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected =
                value?.toUpperCase() === item.country_code?.toUpperCase() ||
                value?.toUpperCase() === item.country_name?.toUpperCase()
              return (
                <div
                  key={idx}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-red-50 text-red-700 font-bold' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span className="truncate pr-2 font-medium">{item.country_name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 font-mono font-bold rounded text-[10px] uppercase">
                      {item.country_code}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-red-600" />}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
