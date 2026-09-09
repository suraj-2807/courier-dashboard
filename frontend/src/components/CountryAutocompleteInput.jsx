import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Globe, Check, X } from 'lucide-react'
import { getFullCountryName, getCountryCode, ISO_COUNTRY_MAP } from '../utils/countryUtils'

export default function CountryAutocompleteInput({
  value = '',
  onChange,
  placeholder = 'Search Country (e.g. India, USA)...',
  className = '',
  countryList = [],
  disabled = false,
  showCodeBadge = true
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const listRef = useRef(null)
  const itemRefs = useRef([])

  // Combined country list (Custom DB list + ISO Map default items)
  const combinedList = useMemo(() => {
    const list = []
    const seenCodes = new Set()

    // 1. Add DB items first
    if (Array.isArray(countryList)) {
      countryList.forEach(item => {
        const code = (item.country_code || '').trim().toUpperCase()
        let name = (item.country_name || '').trim().toUpperCase()
        // Strip trailing "- XX" or leading/trailing hyphens from country name
        name = name.replace(/\s*[-—]\s*[A-Z]{2,3}$/i, '').replace(/^[-—\s]+|[-—\s]+$/g, '').trim()
        if (code && name && name !== '-' && name !== '—' && !seenCodes.has(code)) {
          seenCodes.add(code)
          list.push({ country_name: name, country_code: code })
        }
      })
    }

    // 2. Add fallback items from ISO_COUNTRY_MAP for any missing common 2-letter codes
    Object.entries(ISO_COUNTRY_MAP).forEach(([code, name]) => {
      if (code.length === 2 && !seenCodes.has(code)) {
        seenCodes.add(code)
        list.push({ country_name: name, country_code: code })
      }
    })

    // Sort alphabetically by country name
    return list.sort((a, b) => a.country_name.localeCompare(b.country_name))
  }, [countryList])

  // Compute current resolved code and display name
  const currentCode = useMemo(() => {
    if (!value) return ''
    const cleanVal = String(value).replace(/^[\s\-—]+|[\s\-—]+$/g, '').trim()
    if (!cleanVal || cleanVal === '-' || cleanVal === '—' || cleanVal.toLowerCase() === 'null') return ''
    return getCountryCode(cleanVal, combinedList) || (cleanVal.length === 2 ? cleanVal.toUpperCase() : '')
  }, [value, combinedList])

  const currentFullName = useMemo(() => {
    if (!value) return ''
    const cleanVal = String(value).replace(/^[\s\-—]+|[\s\-—]+$/g, '').trim()
    if (!cleanVal || cleanVal === '-' || cleanVal === '—' || cleanVal.toLowerCase() === 'null') return ''
    const full = getFullCountryName(cleanVal, combinedList)
    if (!full || full === '-' || full === '—') return ''
    return full
  }, [value, combinedList])

  // Sync internal search with value prop (show clean full name or empty string if -)
  useEffect(() => {
    if (!isOpen) {
      if (!value) {
        setSearch('')
      } else {
        const cleanVal = String(value).replace(/^[\s\-—]+|[\s\-—]+$/g, '').trim()
        if (!cleanVal || cleanVal === '-' || cleanVal === '—') {
          setSearch('')
        } else {
          setSearch(currentFullName === '-' || currentFullName === '—' ? '' : currentFullName)
        }
      }
    }
  }, [value, currentFullName, isOpen])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
        if (!value) {
          setSearch('')
        } else {
          const cleanVal = String(value).replace(/^[\s\-—]+|[\s\-—]+$/g, '').trim()
          if (!cleanVal || cleanVal === '-' || cleanVal === '—') {
            setSearch('')
          } else {
            setSearch(currentFullName === '-' || currentFullName === '—' ? '' : currentFullName)
          }
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [currentFullName, value])

  // Filter country list by search term
  const filtered = useMemo(() => {
    if (!search || search.trim() === '' || search.trim() === '-' || search.trim() === '—' || search.toUpperCase() === currentFullName.toUpperCase()) {
      return combinedList.slice(0, 100)
    }
    const term = search.trim().toLowerCase()
    return combinedList.filter(item => {
      const nameMatch = item.country_name?.toLowerCase().includes(term)
      const codeMatch = item.country_code?.toLowerCase().includes(term)
      return nameMatch || codeMatch
    }).slice(0, 100)
  }, [search, combinedList, currentFullName])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [filtered.length, search])

  const handleSelect = (item) => {
    if (disabled) return
    const code = item.country_code?.toUpperCase()
    let name = item.country_name?.toUpperCase() || ''
    name = name.replace(/\s*[-—]\s*[A-Z]{2,3}$/i, '').replace(/^[-—\s]+|[-—\s]+$/g, '').trim()
    setSearch(name)
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (onChange) {
      onChange(code, item)
    }
  }

  const handleInputChange = (e) => {
    if (disabled) return
    let val = e.target.value
    // If user input is just a hyphen, clear it
    if (val === '-' || val === '—') {
      val = ''
    }
    setSearch(val)
    if (!isOpen) setIsOpen(true)

    if (!val.trim()) {
      if (onChange) onChange('')
      return
    }

    // Check if directly matching an exact country code or name
    const exactMatch = combinedList.find(c => 
      c.country_code?.toUpperCase() === val.trim().toUpperCase() ||
      c.country_name?.toUpperCase() === val.trim().toUpperCase()
    )
    if (exactMatch && onChange) {
      onChange(exactMatch.country_code, exactMatch)
    } else if (onChange) {
      onChange(val.trim().toUpperCase())
    }
  }

  const handleKeyDown = (e) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setIsOpen(true)
        setHighlightedIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => {
          const next = prev < filtered.length - 1 ? prev + 1 : 0
          scrollItemIntoView(next)
          return next
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => {
          const next = prev > 0 ? prev - 1 : filtered.length - 1
          scrollItemIntoView(next)
          return next
        })
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex])
        } else if (filtered.length === 1) {
          handleSelect(filtered[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
        setSearch(currentFullName)
        break
    }
  }

  const scrollItemIntoView = (index) => {
    setTimeout(() => {
      if (itemRefs.current[index]) {
        itemRefs.current[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }, 0)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setSearch('')
    if (onChange) onChange('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center w-full">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          disabled={disabled}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true)
            }
          }}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className={`${className} ${disabled ? 'cursor-not-allowed text-gray-500 opacity-75' : ''} ${currentCode && showCodeBadge ? 'pr-20' : 'pr-7'}`}
        />

        {/* Right Adornment: Code Badge + Clear / Chevron */}
        <div className="absolute right-2 flex items-center gap-1.5 pointer-events-none">
          {currentCode && showCodeBadge && (
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-mono font-extrabold text-[10px] tracking-wider uppercase">
              {currentCode}
            </span>
          )}
          {search && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"
              title="Clear Country"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className="w-3.5 h-3.5 text-gray-400 transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
          />
        </div>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-gray-100 animate-fade-in"
        >
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-gray-300" /> No matching country found
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected =
                currentCode?.toUpperCase() === item.country_code?.toUpperCase() ||
                currentFullName?.toUpperCase() === item.country_name?.toUpperCase()
              const isHighlighted = idx === highlightedIndex
              return (
                <div
                  key={`${item.country_code}-${idx}`}
                  ref={el => itemRefs.current[idx] = el}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 text-primary font-bold' :
                    isHighlighted ? 'bg-gray-100 text-gray-900' :
                    'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Globe className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
                    <span className="truncate font-medium">{item.country_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 font-mono font-bold rounded text-[10px] uppercase border border-gray-200">
                      {item.country_code}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
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
