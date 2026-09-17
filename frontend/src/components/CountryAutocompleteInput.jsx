import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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

  // Helper: strip all hyphens/dashes from a value, return '' if only hyphens
  const stripHyphen = (val) => {
    if (!val) return ''
    const s = String(val).replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim()
    if (!s || s === '-' || s === '–' || s === '—' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'none') return ''
    return s
  }

  // Combined country list (Custom DB list + ISO Map default items)
  const combinedList = useMemo(() => {
    const list = []
    const seenCodes = new Set()
    const seenNames = new Set()

    // 1. Add DB items first — resolve short codes/aliases to full names
    if (Array.isArray(countryList)) {
      countryList.forEach(item => {
        let code = (item.country_code || '').trim().toUpperCase()
        let rawName = stripHyphen(item.country_name).toUpperCase()
        if (!rawName) return
        // Strip trailing "- XX" from country name
        rawName = rawName.replace(/\s*[-—–]\s*[A-Z]{2,3}$/i, '').trim()
        if (!rawName || rawName === '-' || rawName === '–' || rawName === '—') return
        // Resolve short codes (FRA→FRANCE, DEU→GERMANY, CAN→CANADA, SGP→SINGAPORE, DUBAI→UNITED ARAB EMIRATES, etc.)
        const resolvedName = getFullCountryName(rawName) || getFullCountryName(code) || rawName
        const resolvedCode = getCountryCode(code) || getCountryCode(resolvedName) || (code.length === 2 ? code : '')
        if (resolvedCode && resolvedName && !seenCodes.has(resolvedCode) && !seenNames.has(resolvedName)) {
          seenCodes.add(resolvedCode)
          seenNames.add(resolvedName)
          list.push({ country_name: resolvedName, country_code: resolvedCode })
        }
      })
    }

    // 2. Add fallback items from ISO_COUNTRY_MAP for any missing common 2-letter codes
    Object.entries(ISO_COUNTRY_MAP).forEach(([code, name]) => {
      if (code.length === 2 && !seenCodes.has(code) && !seenNames.has(name)) {
        seenCodes.add(code)
        seenNames.add(name)
        list.push({ country_name: name, country_code: code })
      }
    })

    // Sort alphabetically by country name
    return list.sort((a, b) => a.country_name.localeCompare(b.country_name))
  }, [countryList])

  // Compute current resolved code and display name
  const currentCode = useMemo(() => {
    const cleanVal = stripHyphen(value)
    if (!cleanVal) return ''
    return getCountryCode(cleanVal, combinedList) || (cleanVal.length === 2 ? cleanVal.toUpperCase() : '')
  }, [value, combinedList])

  const currentFullName = useMemo(() => {
    const cleanVal = stripHyphen(value)
    if (!cleanVal) return ''
    const full = stripHyphen(getFullCountryName(cleanVal, combinedList))
    return full || cleanVal || ''
  }, [value, combinedList])

  // Sync internal search with value prop (show clean full name or clean value)
  useEffect(() => {
    if (!isOpen) {
      setSearch(currentFullName || stripHyphen(value) || '')
    }
  }, [value, currentFullName, isOpen])

  // Filter country list by search term (show all matching countries without slicing)
  const filtered = useMemo(() => {
    const cleanSearch = stripHyphen(search).trim()
    if (!cleanSearch || cleanSearch.toUpperCase() === currentFullName.toUpperCase()) {
      return combinedList
    }
    const term = cleanSearch.toLowerCase()
    return combinedList.filter(item => {
      const nameMatch = item.country_name?.toLowerCase().includes(term)
      const codeMatch = item.country_code?.toLowerCase().includes(term)
      return nameMatch || codeMatch
    })
  }, [search, combinedList, currentFullName])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [filtered.length, search])

  const handleSelect = useCallback((item) => {
    if (disabled || !item) return
    const code = (getCountryCode(item.country_code) || item.country_code || '').toUpperCase()
    const name = stripHyphen(item.country_name) || ''
    setSearch(name)
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (onChange) {
      onChange(code, item)
    }
  }, [disabled, onChange])

  const commitSelection = useCallback((rawTerm) => {
    const clean = stripHyphen(rawTerm).trim()
    if (!clean) {
      if (onChange) onChange('')
      setSearch('')
      setIsOpen(false)
      return
    }

    const upper = clean.toUpperCase()

    // 1. Direct exact match by code or name
    const exact = combinedList.find(c => 
      c.country_code?.toUpperCase() === upper ||
      c.country_name?.toUpperCase() === upper
    )
    if (exact) {
      handleSelect(exact)
      return
    }

    // 2. Alias resolution (e.g. "USA" -> "US", "UAE" / "DUBAI" -> "AE", "UK" -> "GB")
    const aliasCode = getCountryCode(upper, combinedList)
    if (aliasCode) {
      const matched = combinedList.find(c => c.country_code?.toUpperCase() === aliasCode.toUpperCase())
      if (matched) {
        handleSelect(matched)
        return
      }
    }

    // 3. Match from filtered list (prefer startsWith)
    if (filtered.length > 0) {
      const startsWithMatch = filtered.find(c =>
        c.country_name?.toUpperCase().startsWith(upper) ||
        c.country_code?.toUpperCase().startsWith(upper)
      )
      handleSelect(startsWithMatch || filtered[0])
      return
    }

    // 4. Fallback: revert to existing valid selection
    setSearch(currentFullName || '')
    setIsOpen(false)
  }, [combinedList, filtered, currentFullName, handleSelect, onChange])

  // Close dropdown on click outside & commit selection
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (isOpen) {
          commitSelection(search)
        }
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, search, commitSelection])

  const handleInputChange = (e) => {
    if (disabled) return
    let val = e.target.value
    // Strip hyphens completely
    val = val.replace(/[-–—]/g, '')
    setSearch(val)
    if (!isOpen) setIsOpen(true)

    if (!val.trim()) {
      if (onChange) onChange('')
      return
    }

    const upper = val.trim().toUpperCase()

    // 1. Direct exact code match (e.g. "US", "IN", "AE", "CA", "FR")
    const exactCode = combinedList.find(c => c.country_code?.toUpperCase() === upper)
    if (exactCode && onChange) {
      onChange(exactCode.country_code, exactCode)
      return
    }

    // 2. Direct exact name match (e.g. "UNITED STATES", "INDIA", "CANADA")
    const exactName = combinedList.find(c => c.country_name?.toUpperCase() === upper)
    if (exactName && onChange) {
      onChange(exactName.country_code, exactName)
      return
    }

    // 3. Known alias match (e.g. "USA", "UK", "DUBAI")
    const aliasCode = getCountryCode(upper, combinedList)
    if (aliasCode && aliasCode.length === 2) {
      const matchedAlias = combinedList.find(c => c.country_code?.toUpperCase() === aliasCode.toUpperCase())
      if (matchedAlias && onChange) {
        onChange(matchedAlias.country_code, matchedAlias)
        return
      }
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
        } else if (filtered.length > 0) {
          handleSelect(filtered[0])
        } else {
          commitSelection(search)
        }
        break
      case 'Tab':
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex])
        } else if (filtered.length > 0 && search && search.toUpperCase() !== currentFullName.toUpperCase()) {
          handleSelect(filtered[0])
        } else {
          setIsOpen(false)
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
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-[9999]' : ''}`}>
      <div className="relative flex items-center w-full">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          disabled={disabled}
          onFocus={(e) => {
            if (!disabled) {
              setIsOpen(true)
              e.target.select()
            }
          }}
          onClick={() => {
            if (!disabled && !isOpen) {
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
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-[99999] max-h-60 overflow-y-auto divide-y divide-gray-100 animate-fade-in"
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
