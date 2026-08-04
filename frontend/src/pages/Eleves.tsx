import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Download, Edit2, Eye, Plus, Search, Trash2, Upload, Users } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { SkeletonList } from '../components/Skeleton'
import { Eleve } from '../types'
import EleveFormModal from '../components/EleveFormModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ImportElevesModal from '../components/ImportElevesModal'
import { exportEleves } from '../utils/exportExcel'

const PAGE_SIZE = 20

type SortKey = 'NOM_ASC' | 'NOM_DESC' | 'CLASSE' | 'MATRICULE'
type ElevesFiltersState = {
  search: string
  classeFilter: string
  sexeFilter: 'TOUS' | 'M' | 'F'
  statutFilter: 'TOUS' | Eleve['statut']
  sortBy: SortKey
}

const ELEVE_FILTERS_STORAGE_KEY = 'eleves:filters:v1'
const DEFAULT_FILTERS: ElevesFiltersState = {
  search: '',
  classeFilter: 'TOUTES',
  sexeFilter: 'TOUS',
  statutFilter: 'TOUS',
  sortBy: 'NOM_ASC'
}

const STATUS_META: Record<
  Eleve['statut'],
  { label: string; badgeClass: string; cardClass: string }
> = {
  actif: {
    label: 'Actif',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    cardClass: 'border-l-4 border-emerald-500'
  },
  inactif: {
    label: 'Inactif',
    badgeClass: 'bg-gray-100 text-gray-700',
    cardClass: 'border-l-4 border-gray-400'
  },
  transfere: {
    label: 'Transfere',
    badgeClass: 'bg-amber-100 text-amber-700',
    cardClass: 'border-l-4 border-amber-500'
  },
  diplome: {
    label: 'Diplome',
    badgeClass: 'bg-blue-100 text-blue-700',
    cardClass: 'border-l-4 border-blue-500'
  }
}

const STATUS_VALUES: Eleve['statut'][] = ['actif', 'inactif', 'transfere', 'diplome']
const SORT_VALUES: SortKey[] = ['NOM_ASC', 'NOM_DESC', 'CLASSE', 'MATRICULE']
const SEXE_VALUES: Array<'TOUS' | 'M' | 'F'> = ['TOUS', 'M', 'F']

const loadSavedFilters = (): ElevesFiltersState => {
  if (typeof window === 'undefined') return DEFAULT_FILTERS

  try {
    const raw = sessionStorage.getItem(ELEVE_FILTERS_STORAGE_KEY)
    if (!raw) return DEFAULT_FILTERS

    const parsed = JSON.parse(raw) as Partial<ElevesFiltersState>
    const sexe = SEXE_VALUES.includes(parsed.sexeFilter as any)
      ? (parsed.sexeFilter as ElevesFiltersState['sexeFilter'])
      : DEFAULT_FILTERS.sexeFilter
    const statut =
      parsed.statutFilter === 'TOUS' || STATUS_VALUES.includes(parsed.statutFilter as Eleve['statut'])
        ? (parsed.statutFilter as ElevesFiltersState['statutFilter'])
        : DEFAULT_FILTERS.statutFilter
    const sort = SORT_VALUES.includes(parsed.sortBy as SortKey)
      ? (parsed.sortBy as SortKey)
      : DEFAULT_FILTERS.sortBy

    return {
      search: String(parsed.search || ''),
      classeFilter: String(parsed.classeFilter || DEFAULT_FILTERS.classeFilter),
      sexeFilter: sexe,
      statutFilter: statut,
      sortBy: sort
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

const normalizeText = (value: string | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const compareText = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' })

const toFrontendStatus = (rawStatus: unknown): Eleve['statut'] => {
  const value = String(rawStatus || '')
    .trim()
    .toUpperCase()

  const map: Record<string, Eleve['statut']> = {
    ACTIF: 'actif',
    INACTIF: 'inactif',
    TRANSFERE: 'transfere',
    DIPLOME: 'diplome'
  }

  if (map[value]) return map[value]

  const fallback = value.toLowerCase()
  if (STATUS_VALUES.includes(fallback as Eleve['statut'])) {
    return fallback as Eleve['statut']
  }

  return 'inactif'
}

export default function Eleves() {
  const navigate = useNavigate()
  const savedFilters = useMemo(() => loadSavedFilters(), [])
  const { success, error: toastError } = useToast()
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [totalDb, setTotalDb] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(savedFilters.search)
  const [classeFilter, setClasseFilter] = useState(savedFilters.classeFilter)
  const [sexeFilter, setSexeFilter] = useState<'TOUS' | 'M' | 'F'>(savedFilters.sexeFilter)
  const [statutFilter, setStatutFilter] = useState<'TOUS' | Eleve['statut']>(savedFilters.statutFilter)
  const [sortBy, setSortBy] = useState<SortKey>(savedFilters.sortBy)
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null)
  const [eleveToDelete, setEleveToDelete] = useState<Eleve | null>(null)
  const [anneeActive, setAnneeActive] = useState<string | undefined>()

  useEffect(() => {
    loadEleves()
    api.get('/annees/active').then(res => setAnneeActive(res.data?.annee)).catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const payload: ElevesFiltersState = {
      search,
      classeFilter,
      sexeFilter,
      statutFilter,
      sortBy
    }
    sessionStorage.setItem(ELEVE_FILTERS_STORAGE_KEY, JSON.stringify(payload))
    setPage(1)
  }, [search, classeFilter, sexeFilter, statutFilter, sortBy])

  const loadEleves = async () => {
    try {
      const response = await api.get('/eleves', { params: { limit: 2000 } })
      // Compatibilité format paginé { data: [...] } et ancien format tableau
      const rawData = Array.isArray(response.data) ? response.data : (response.data.data ?? [])
      setTotalDb(response.data?.pagination?.total ?? rawData.length)
      const mappedEleves = rawData.map((data: any) => ({
        id: data.id,
        matricule: data.matricule,
        nom: data.nom,
        prenom: data.prenom,
        dateNaissance: data.date_naissance || data.dateNaissance,
        lieuNaissance: data.lieu_naissance || data.lieuNaissance,
        sexe: data.sexe,
        groupeSanguin: data.groupe_sanguin || data.groupeSanguin,
        statut: toFrontendStatus(data.statut),
        anneeScolaire: data.annee_scolaire || data.anneeScolaire,
        dateInscription: data.date_inscription || data.dateInscription,
        classe: data.classe,
        tuteur: {
          nom: data.tuteur_nom || data.tuteur?.nom || '',
          prenom: data.tuteur_prenom || data.tuteur?.prenom || '',
          telephone: data.tuteur_telephone || data.tuteur?.telephone || '',
          email: data.tuteur_email || data.tuteur?.email || '',
          adresse: data.tuteur_adresse || data.tuteur?.adresse || '',
          profession: data.tuteur_profession || data.tuteur?.profession || ''
        }
      }))

      setEleves(mappedEleves)
    } catch (error) {
      console.error('Erreur lors du chargement des eleves', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '-'
      return format(date, 'dd/MM/yyyy')
    } catch {
      return '-'
    }
  }

  const classesDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          eleves
            .map((eleve) => eleve.classe?.nom)
            .filter((classeNom): classeNom is string => Boolean(classeNom))
        )
      ).sort(compareText),
    [eleves]
  )

  const filteredEleves = useMemo(() => {
    const term = normalizeText(search)

    const results = eleves.filter((eleve) => {
      const searchable = [
        eleve.nom,
        eleve.prenom,
        eleve.matricule,
        eleve.classe?.nom || ''
      ]
        .map((value) => normalizeText(value))
        .join(' ')

      const matchSearch = !term || searchable.includes(term)
      const matchClasse =
        classeFilter === 'TOUTES' || (eleve.classe?.nom || '') === classeFilter
      const matchSexe = sexeFilter === 'TOUS' || eleve.sexe === sexeFilter
      const matchStatut =
        statutFilter === 'TOUS' || eleve.statut === statutFilter

      return matchSearch && matchClasse && matchSexe && matchStatut
    })

    results.sort((a, b) => {
      if (sortBy === 'NOM_ASC') {
        const byNom = compareText(a.nom, b.nom)
        return byNom !== 0 ? byNom : compareText(a.prenom, b.prenom)
      }
      if (sortBy === 'NOM_DESC') {
        const byNom = compareText(b.nom, a.nom)
        return byNom !== 0 ? byNom : compareText(b.prenom, a.prenom)
      }
      if (sortBy === 'CLASSE') {
        const byClasse = compareText(a.classe?.nom || '', b.classe?.nom || '')
        return byClasse !== 0 ? byClasse : compareText(a.nom, b.nom)
      }
      return compareText(a.matricule, b.matricule)
    })

    return results
  }, [eleves, search, classeFilter, sexeFilter, statutFilter, sortBy])

  const isFiltered = !!(search || classeFilter || sexeFilter !== 'TOUS' || statutFilter !== 'TOUS')

  const stats = useMemo(
    () => ({
      total: totalDb || eleves.length,
      resultats: filteredEleves.length,
      actifs: filteredEleves.filter((eleve) => eleve.statut === 'actif').length
    }),
    [totalDb, eleves.length, filteredEleves]
  )

  const totalPages = Math.max(1, Math.ceil(filteredEleves.length / PAGE_SIZE))
  const paginatedEleves = useMemo(
    () => filteredEleves.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredEleves, page]
  )

  const clearFilters = () => {
    setSearch('')
    setClasseFilter('TOUTES')
    setSexeFilter('TOUS')
    setStatutFilter('TOUS')
    setSortBy('NOM_ASC')
  }

  const confirmDelete = async () => {
    if (!eleveToDelete) return
    try {
      await api.delete(`/eleves/${eleveToDelete.id}`)
      await loadEleves()
      success("Élève supprimé avec succès")
    } catch (error) {
      toastError("Erreur lors de la suppression de l'élève")
    } finally {
      setEleveToDelete(null)
    }
  }

  if (loading) return <SkeletonList rows={8} />

  return (
    <div className="space-y-3">
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-gray-900">Élèves</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Importer"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importer</span>
          </button>
          <button
            onClick={() => exportEleves(filteredEleves as unknown as Record<string, unknown>[])}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Exporter"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nouvel élève
          </button>
        </div>
      </div>

      {/* ── Filtres + stats en une seule carte ── */}
      <div className="card-sm space-y-3">
        {/* Recherche */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, matricule, classe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-sm pl-11"
          />
        </div>

        {/* Filtres en ligne */}
        <div className="flex flex-wrap gap-2">
          <select
            value={classeFilter}
            onChange={(e) => setClasseFilter(e.target.value)}
            className="input h-9 input-sm flex-1 min-w-[140px]"
          >
            <option value="TOUTES">Toutes les classes</option>
            {classesDisponibles.map((classeNom) => (
              <option key={classeNom} value={classeNom}>{classeNom}</option>
            ))}
          </select>
          <select
            value={sexeFilter}
            onChange={(e) => setSexeFilter(e.target.value as 'TOUS' | 'M' | 'F')}
            className="input h-9 input-sm flex-1 min-w-[110px]"
          >
            <option value="TOUS">Tous sexes</option>
            <option value="M">Garçons</option>
            <option value="F">Filles</option>
          </select>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value as 'TOUS' | Eleve['statut'])}
            className="input h-9 input-sm flex-1 min-w-[110px]"
          >
            <option value="TOUS">Tous statuts</option>
            {STATUS_VALUES.map((status) => (
              <option key={status} value={status}>{STATUS_META[status].label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="input h-9 input-sm flex-1 min-w-[120px]"
          >
            <option value="NOM_ASC">Nom A→Z</option>
            <option value="NOM_DESC">Nom Z→A</option>
            <option value="CLASSE">Classe</option>
            <option value="MATRICULE">Matricule</option>
          </select>
        </div>

        {/* Barre de stats + reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">
              {isFiltered ? (
                <><span className="font-bold text-gray-800 text-sm">{stats.resultats}</span> / {stats.total} élèves</>
              ) : (
                <><span className="font-bold text-gray-800 text-sm">{stats.total}</span> élèves</>
              )}
              {totalPages > 1 && <span className="text-gray-400 ml-1">· p.{page}/{totalPages}</span>}
            </span>
            <span className="h-3 w-px bg-gray-200" />
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">
              ♂ {stats.resultats > 0 ? filteredEleves.filter(e => e.sexe === 'M').length : 0} garçons
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-pink-700 font-medium">
              ♀ {stats.resultats > 0 ? filteredEleves.filter(e => e.sexe === 'F').length : 0} filles
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium">
              ✓ {stats.actifs} actifs
            </span>
          </div>
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Réinitialiser
          </button>
        </div>
      </div>

      {filteredEleves.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Users className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">Aucun élève trouvé</p>
          <p className="text-xs text-gray-400 mt-1">Modifiez vos filtres ou ajoutez un élève.</p>
        </div>
      ) : (
        <>
          {/* ── Liste desktop ── */}
          <div className="hidden md:block card-flush divide-y divide-gray-100">
            {paginatedEleves.map((eleve) => {
              const statusDot = eleve.statut === 'actif' ? 'bg-emerald-500' : eleve.statut === 'inactif' ? 'bg-gray-400' : eleve.statut === 'transfere' ? 'bg-amber-500' : 'bg-blue-500'
              return (
                <div
                  key={eleve.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/eleves/${eleve.id}`)}
                >
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${eleve.sexe === 'M' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                    {(eleve.prenom?.[0] ?? '').toUpperCase()}{(eleve.nom?.[0] ?? '').toUpperCase()}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{eleve.prenom} {eleve.nom}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_META[eleve.statut].badgeClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                        {STATUS_META[eleve.statut].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>{eleve.matricule}</span>
                      <span className="text-gray-300">·</span>
                      <span className={eleve.sexe === 'M' ? 'text-blue-500' : 'text-pink-500'}>
                        {eleve.sexe === 'M' ? 'Garçon' : 'Fille'}
                      </span>
                      {eleve.dateNaissance && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span>{formatDate(eleve.dateNaissance)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Classe */}
                  <div className="shrink-0 hidden lg:block">
                    {eleve.classe?.nom ? (
                      <span className="inline-flex items-center rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                        {eleve.classe.nom}
                      </span>
                    ) : (
                      <span className="text-xs italic text-gray-400">Sans classe</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingEleve(eleve)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600"
                      title="Modifier"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEleveToDelete(eleve)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Cartes mobile ── */}
          <div className="md:hidden space-y-2">
            {paginatedEleves.map((eleve) => (
              <div key={eleve.id} className="card-sm cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => navigate(`/eleves/${eleve.id}`)}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${eleve.sexe === 'M' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                    {(eleve.prenom?.[0] ?? '').toUpperCase()}{(eleve.nom?.[0] ?? '').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 leading-tight">
                          {eleve.prenom} {eleve.nom}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{eleve.matricule}</p>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[eleve.statut].badgeClass}`}>
                        {STATUS_META[eleve.statut].label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">
                        {eleve.classe?.nom ?? <span className="italic">Sans classe</span>}
                      </span>
                      <span>·</span>
                      <span className={eleve.sexe === 'M' ? 'text-blue-600' : 'text-pink-600'}>
                        {eleve.sexe === 'M' ? 'Garçon' : 'Fille'}
                      </span>
                      {eleve.dateNaissance && (
                        <>
                          <span>·</span>
                          <span>{formatDate(eleve.dateNaissance)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3" onClick={e => e.stopPropagation()}>
                  <Link
                    to={`/eleves/${eleve.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Voir
                  </Link>
                  <button
                    onClick={() => setEditingEleve(eleve)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  <button
                    onClick={() => setEleveToDelete(eleve)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary btn-sm disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-sm text-gray-600 font-medium">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-secondary btn-sm disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      )}

      <EleveFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadEleves}
      />

      <EleveFormModal
        isOpen={!!editingEleve}
        onClose={() => setEditingEleve(null)}
        onSuccess={() => {
          loadEleves()
          setEditingEleve(null)
        }}
        eleve={editingEleve}
      />

      <ImportElevesModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={loadEleves}
        anneeScolaire={anneeActive}
      />

      <ConfirmDialog
        isOpen={!!eleveToDelete}
        title="Supprimer cet élève"
        message={
          eleveToDelete
            ? `Confirmer la suppression de ${eleveToDelete.nom} ${eleveToDelete.prenom} ?`
            : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={confirmDelete}
        onCancel={() => setEleveToDelete(null)}
        variant="danger"
      />
    </div>
  )
}


