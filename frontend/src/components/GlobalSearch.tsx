import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, School, GraduationCap, X } from 'lucide-react'
import api from '../services/api'

interface SearchResult {
  eleves: Array<{ id: string; nom: string; prenom: string; matricule: string; classe_nom?: string }>
  classes: Array<{ id: string; nom: string; cycle: string; niveau: string; annee_scolaire: string }>
  enseignants: Array<{ id: string; nom: string; prenom: string; telephone?: string; type_contrat?: string }>
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get('/search', { params: { q } })
      setResults(data)
      setOpen(true)
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const goTo = (path: string) => {
    setOpen(false)
    setQuery('')
    setResults(null)
    navigate(path)
  }

  const hasResults = results && (
    results.eleves.length > 0 || results.classes.length > 0 || results.enseignants.length > 0
  )

  return (
    <div ref={containerRef} className="relative w-72">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results && hasResults) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un élève, classe..."
          className="w-full pl-9 pr-16 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:text-white dark:placeholder-gray-400"
        />
        {query ? (
          <button
            onClick={() => { setQuery(''); setResults(null); setOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            Ctrl K
          </kbd>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">Recherche...</div>
          )}

          {!loading && !hasResults && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">Aucun résultat</div>
          )}

          {!loading && results && results.eleves.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Élèves
              </div>
              {results.eleves.map(eleve => (
                <button
                  key={eleve.id}
                  onClick={() => goTo(`/eleves/${eleve.id}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{eleve.prenom} {eleve.nom}</div>
                  <div className="text-xs text-gray-500">
                    {eleve.matricule}{eleve.classe_nom ? ` · ${eleve.classe_nom}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && results && results.classes.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center gap-1.5">
                <School className="h-3.5 w-3.5" /> Classes
              </div>
              {results.classes.map(classe => (
                <button
                  key={classe.id}
                  onClick={() => goTo(`/classes/${classe.id}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{classe.nom}</div>
                  <div className="text-xs text-gray-500">{classe.cycle} · {classe.annee_scolaire}</div>
                </button>
              ))}
            </div>
          )}

          {!loading && results && results.enseignants.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Enseignants
              </div>
              {results.enseignants.map(ens => (
                <button
                  key={ens.id}
                  onClick={() => goTo('/enseignants')}
                  className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{ens.prenom} {ens.nom}</div>
                  {ens.type_contrat && <div className="text-xs text-gray-500">{ens.type_contrat}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
