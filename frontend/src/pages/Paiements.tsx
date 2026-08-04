import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ChevronDown,
  DollarSign,
  Download,
  Edit2,
  Plus,
  Printer,
  Search,
  Trash2
} from 'lucide-react'
import api from '../services/api'
import { SkeletonList } from '../components/Skeleton'
import { Paiement } from '../types'
import PaiementFormModal from '../components/PaiementFormModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../contexts/ToastContext'
import { printRecu } from '../utils/printRecu'
import { exportImpayes, exportPaiements } from '../utils/exportExcel'
import InfoTip from '../components/InfoTip'

interface PaiementStats {
  montantTotal: number
  totalPaiements: number
  devise: string
}

interface ImpayeItem {
  eleve_id: string
  matricule: string
  nom: string
  prenom: string
  classe: { id: string; nom: string } | null
  totalPaye: number
  totalDu: number
  resteAPayer: number
  devise?: string
}

interface ImpayesData {
  anneeScolaire: string
  totalElevesImpayes: number
  totalResteAPayer: number
  devise: string
  impayes: ImpayeItem[]
}

type SortKey = 'DATE_DESC' | 'DATE_ASC' | 'MONTANT_DESC' | 'MONTANT_ASC'
type StatusFilter = 'TOUS' | 'VALIDE' | 'EN_ATTENTE' | 'ANNULE'
type MoisFilter = 'TOUS' | 'CE_MOIS' | 'MOIS_DERNIER' | 'CETTE_ANNEE'
type ImpayeFilter = 'TOUS' | 'PARTIEL'

const TYPE_OPTIONS = [
  'TOUS',
  'INSCRIPTION',
  'SCOLARITE',
  'CANTINE',
  'TRANSPORT',
  'UNIFORME',
  'AUTRES'
] as const

const normalizeText = (value: string | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const normalizeStatus = (value: string | undefined) => {
  const key = String(value || '').toUpperCase()
  if (key === 'VALIDE') return 'VALIDE'
  if (key === 'EN_ATTENTE') return 'EN_ATTENTE'
  if (key === 'ANNULE') return 'ANNULE'
  return key || 'EN_ATTENTE'
}

const formatPaiementStatus = (status: string) => {
  if (status === 'VALIDE') return 'Valide'
  if (status === 'EN_ATTENTE') return 'En attente'
  if (status === 'ANNULE') return 'Annule'
  return status
}

const getStatusClassName = (status: string) => {
  if (status === 'VALIDE') return 'bg-emerald-100 text-emerald-700'
  if (status === 'EN_ATTENTE') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

const formatType = (value: string) =>
  ({
    INSCRIPTION: 'Inscription',
    SCOLARITE: 'Scolarite',
    CANTINE: 'Cantine',
    TRANSPORT: 'Transport',
    UNIFORME: 'Uniforme',
    AUTRES: 'Autres'
  }[String(value || '').toUpperCase()] || value)

const formatMode = (value: string) =>
  ({
    ESPECES: 'Especes',
    CHEQUE: 'Cheque',
    VIREMENT: 'Virement',
    MOBILE_MONEY: 'Mobile Money'
  }[String(value || '').toUpperCase()] || value)

const safeFormatDate = (value: string | undefined) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return format(date, 'dd/MM/yyyy')
}

const getPaiementClasseName = (paiement: any) =>
  paiement?.eleve?.classe?.nom || paiement?.classe?.nom || 'Sans classe'

const compareLabels = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })

export default function Paiements() {
  const location = useLocation()
  const { success, error: toastError } = useToast()
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [classeScolariteById, setClasseScolariteById] = useState<Map<string, number>>(new Map())
  const [stats, setStats] = useState<PaiementStats | null>(null)
  const [impayesData, setImpayesData] = useState<ImpayesData | null>(null)
  const [impayesAccessDenied, setImpayesAccessDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TOUS')
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]>('TOUS')
  const [classeFilter, setClasseFilter] = useState('TOUTES')
  const [moisFilter, setMoisFilter] = useState<MoisFilter>('TOUS')
  const [sortBy, setSortBy] = useState<SortKey>('DATE_DESC')
  const [showImpayesDetail, setShowImpayesDetail] = useState(false)
  const [impayeFilter, setImpayeFilter] = useState<ImpayeFilter>('TOUS')
  const [collapsedGroupes, setCollapsedGroupes] = useState<Set<string>>(new Set())
  const paiementsListRef = useRef<HTMLDivElement>(null)
  const impayesSectionRef = useRef<HTMLDivElement>(null)
  const initialCollapseRef = useRef(false)
  const navOpenSectionRef = useRef<string | null>((location.state as any)?.openSection ?? null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    eleve: string
    type: string
  } | null>(null)
  const [editingPaiement, setEditingPaiement] = useState<{
    id: string
    eleveId: string
    eleveName: string
    typePaiement: string
    montant: number
    datePaiement: string
    moisConcerne?: string
    modePaiement: string
    numeroPiece?: string
    remarques?: string
    statut?: string
  } | null>(null)

  useEffect(() => {
    loadPageData()
  }, [])

  const loadPageData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadPaiements(), loadStats(), loadImpayes(), loadClasseScolarite()])
    } finally {
      setLoading(false)
    }
  }

  const loadPaiements = async () => {
    try {
      const paiementsRes = await api.get('/paiements', { params: { limit: 500 } })

      const classeByEleveId = new Map<string, { id: string; nom: string } | null>()
      try {
        const elevesRes = await api.get('/eleves', { params: { limit: 500 } })
        const elevesRaw = Array.isArray(elevesRes.data) ? elevesRes.data : (elevesRes.data?.data ?? [])
        elevesRaw.forEach((data: any) => {
          const eleveId = String(data.id || '')
          if (!eleveId) return
          const classe = data.classe
            ? {
                id: data.classe.id,
                nom: data.classe.nom
              }
            : null
          classeByEleveId.set(eleveId, classe)
        })
      } catch {
        // Non bloquant: la page paiements continue meme sans mapping classe depuis /eleves.
      }

      const paiementsRaw = Array.isArray(paiementsRes.data) ? paiementsRes.data : (paiementsRes.data?.data ?? [])
      const mappedPaiements = paiementsRaw.map((data: any) => ({
        id: data.id,
        eleveId: data.eleve_id || data.eleveId,
        typePaiement: String(data.type_paiement || data.typePaiement || '').toUpperCase(),
        montant: Number(data.montant || 0),
        devise: data.devise || 'XOF',
        modePaiement: String(data.mode_paiement || data.modePaiement || '').toUpperCase(),
        datePaiement: data.date_paiement || data.datePaiement,
        statut: normalizeStatus(data.statut),
        reference: data.reference,
        remarques: data.remarques,
        eleve: {
          ...(data.eleve || {
            id: data.eleve_id,
            nom: data.eleve_nom,
            prenom: data.eleve_prenom,
            matricule: data.eleve_matricule
          }),
          classe:
            data.eleve?.classe ||
            classeByEleveId.get(String(data.eleve_id || data.eleveId || data.eleve?.id || '')) ||
            null
        }
      }))
      setPaiements(mappedPaiements)
    } catch (error) {
      console.error('Erreur lors du chargement des paiements', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await api.get('/paiements/stats')
      setStats({
        montantTotal: Number(response.data.montant_total || response.data.montantTotal || 0),
        totalPaiements: Number(response.data.total_paiements || response.data.totalPaiements || 0),
        devise: response.data.devise || 'XOF'
      })
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques', error)
    }
  }

  const loadImpayes = async () => {
    try {
      const response = await api.get('/paiements/impayes')
      setImpayesData(response.data)
      setImpayesAccessDenied(false)
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setImpayesAccessDenied(true)
      }
      console.error('Erreur lors du chargement des impayes', error)
    }
  }

  const loadClasseScolarite = async () => {
    try {
      const res = await api.get('/classes')
      const list = Array.isArray(res.data) ? res.data : []
      const map = new Map<string, number>()
      list.forEach((c: any) => {
        const id = String(c.id || '')
        if (id) map.set(id, Number(c.montant_scolarite || c.montantScolarite || 0))
      })
      setClasseScolariteById(map)
    } catch { /* non bloquant */ }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/paiements/${deleteTarget.id}`)
      await loadPageData()
      success('Paiement supprimé avec succès')
    } catch {
      toastError('Erreur lors de la suppression du paiement')
    } finally {
      setDeleteTarget(null)
    }
  }

  const classesDisponibles = useMemo(
    () =>
      Array.from(new Set(paiements.map((p) => getPaiementClasseName(p)))).sort(compareLabels),
    [paiements]
  )

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { TOUS: paiements.length, VALIDE: 0, EN_ATTENTE: 0, ANNULE: 0 }
    paiements.forEach(p => {
      const s = normalizeStatus(p.statut)
      if (counts[s] !== undefined) counts[s]++
    })
    return counts
  }, [paiements])

  const filteredPaiements = useMemo(() => {
    const term = normalizeText(search)
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const rows = paiements.filter((paiement) => {
      const matchStatus =
        statusFilter === 'TOUS' || normalizeStatus(paiement.statut) === statusFilter
      const matchType =
        typeFilter === 'TOUS' ||
        String(paiement.typePaiement || '').toUpperCase() === typeFilter
      const matchClasse =
        classeFilter === 'TOUTES' || getPaiementClasseName(paiement) === classeFilter

      let matchMois = true
      if (moisFilter !== 'TOUS' && paiement.datePaiement) {
        const d = new Date(paiement.datePaiement)
        if (moisFilter === 'CE_MOIS') {
          matchMois = d.getMonth() === currentMonth && d.getFullYear() === currentYear
        } else if (moisFilter === 'MOIS_DERNIER') {
          const lm = currentMonth === 0 ? 11 : currentMonth - 1
          const ly = currentMonth === 0 ? currentYear - 1 : currentYear
          matchMois = d.getMonth() === lm && d.getFullYear() === ly
        } else if (moisFilter === 'CETTE_ANNEE') {
          matchMois = d.getFullYear() === currentYear
        }
      }

      const searchable = normalizeText(
        `${paiement.eleve?.prenom || ''} ${paiement.eleve?.nom || ''} ${paiement.eleve?.matricule || ''} ${paiement.typePaiement || ''} ${paiement.modePaiement || ''} ${getPaiementClasseName(paiement)}`
      )
      const matchSearch = !term || searchable.includes(term)
      return matchStatus && matchType && matchClasse && matchMois && matchSearch
    })

    rows.sort((a, b) => {
      const dateA = new Date(a.datePaiement).getTime()
      const dateB = new Date(b.datePaiement).getTime()
      const montantA = Number(a.montant || 0)
      const montantB = Number(b.montant || 0)

      if (sortBy === 'DATE_ASC') return dateA - dateB
      if (sortBy === 'MONTANT_DESC') return montantB - montantA
      if (sortBy === 'MONTANT_ASC') return montantA - montantB
      return dateB - dateA
    })

    return rows
  }, [paiements, search, statusFilter, typeFilter, classeFilter, sortBy])

  const groupedPaiements = useMemo(
    () =>
      filteredPaiements.reduce((acc, paiement) => {
        const classeNom = getPaiementClasseName(paiement)
        if (!acc[classeNom]) acc[classeNom] = []
        acc[classeNom].push(paiement)
        return acc
      }, {} as Record<string, Paiement[]>),
    [filteredPaiements]
  )

  const filteredImpayes = useMemo(() => {
    if (!impayesData?.impayes) return []
    if (impayeFilter === 'PARTIEL') {
      return impayesData.impayes.filter((item) => Number(item.totalPaye || 0) > 0 && Number(item.resteAPayer || 0) > 0)
    }
    return impayesData.impayes
  }, [impayesData?.impayes, impayeFilter])

  const groupedImpayes = useMemo(() => {
    if (!filteredImpayes.length) return {}
    return filteredImpayes.reduce((acc, item) => {
      const classeNom = item.classe?.nom || 'Sans classe'
      if (!acc[classeNom]) acc[classeNom] = []
      acc[classeNom].push(item)
      return acc
    }, {} as Record<string, ImpayeItem[]>)
  }, [filteredImpayes])

  const totalFiltre = useMemo(
    () => filteredPaiements.reduce((sum, p) => sum + Number(p.montant || 0), 0),
    [filteredPaiements]
  )

  const hasActiveFilters = search || statusFilter !== 'TOUS' || typeFilter !== 'TOUS' || classeFilter !== 'TOUTES' || moisFilter !== 'TOUS'

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('TOUS')
    setTypeFilter('TOUS')
    setClasseFilter('TOUTES')
    setMoisFilter('TOUS')
    setSortBy('DATE_DESC')
  }

  const totalPayeScolariteByEleveId = useMemo(() => {
    const map = new Map<string, number>()
    paiements.forEach(p => {
      if (String(p.typePaiement || '').toUpperCase() === 'SCOLARITE' &&
          String((p as any).statut || '').toUpperCase() === 'VALIDE') {
        const eleveId = String(p.eleve?.id || (p as any).eleveId || '')
        if (eleveId) map.set(eleveId, (map.get(eleveId) || 0) + Number(p.montant || 0))
      }
    })
    return map
  }, [paiements])

  // Fermer tous les groupes au premier chargement (sauf si on vient du Dashboard avec openSection)
  useEffect(() => {
    const keys = Object.keys(groupedPaiements)
    if (!initialCollapseRef.current && keys.length > 0) {
      initialCollapseRef.current = true
      if (navOpenSectionRef.current === 'paiements') {
        // Garder tout ouvert + scroller
        setCollapsedGroupes(new Set())
        setTimeout(() => paiementsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      } else {
        setCollapsedGroupes(new Set(keys))
      }
    }
  }, [groupedPaiements])

  // Déplier tous les groupes quand un filtre est actif, replier quand tout est réinitialisé
  useEffect(() => {
    if (!initialCollapseRef.current) return
    const isFiltering = !!(search || statusFilter !== 'TOUS' || typeFilter !== 'TOUS' || classeFilter !== 'TOUTES' || moisFilter !== 'TOUS')
    if (isFiltering) {
      setCollapsedGroupes(new Set())
    } else {
      setCollapsedGroupes(new Set(Object.keys(groupedPaiements)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, typeFilter, classeFilter, moisFilter])

  // Navigation depuis le Dashboard → ouvrir section impayés
  useEffect(() => {
    if (navOpenSectionRef.current === 'impayes') {
      setShowImpayesDetail(true)
      setTimeout(() => impayesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recouvrementRate = useMemo(() => {
    const recettes = stats?.montantTotal || 0
    const reste = impayesData?.totalResteAPayer || 0
    const objectif = recettes + reste
    if (objectif <= 0) return 0
    return Math.round((recettes / objectif) * 100)
  }, [stats?.montantTotal, impayesData?.totalResteAPayer])

  if (loading) return <SkeletonList rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-gray-900">Paiements</h1>
          <p className="mt-1 text-sm text-gray-500">
            Suivi des recettes, relances et recouvrement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportPaiements(filteredPaiements as unknown as Record<string, unknown>[])}
            className="btn btn-secondary btn-sm flex items-center justify-center"
            title="Exporter"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Exporter</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm flex items-center justify-center md:justify-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau paiement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <div className="card-sm text-white bg-gradient-to-r from-primary-500 to-primary-700">
          <div className="flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary-100" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-primary-100">Recettes</p>
              <p className="text-2xl font-bold">{(stats?.montantTotal || 0).toLocaleString()}</p>
              <p className="text-xs text-primary-100">{stats?.devise || 'XOF'}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="card-sm text-left hover:bg-primary-50 hover:border-primary-200 transition-colors cursor-pointer"
          onClick={() => {
            setCollapsedGroupes(new Set())
            setTimeout(() => paiementsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
          }}
          title="Voir la liste des paiements"
        >
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Paiements</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">{stats?.totalPaiements || 0}</p>
          <p className="text-[10px] text-primary-500 mt-0.5">↓ Voir la liste</p>
        </button>
        <button
          type="button"
          className="card-sm text-left hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
          onClick={() => {
            setShowImpayesDetail(true)
            setTimeout(() => impayesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
          }}
          title="Voir les élèves impayés"
        >
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Impayés et restes à payer</p>
          <p className="mt-0.5 text-2xl font-bold text-red-600">
            {impayesData?.totalElevesImpayes || 0}
          </p>
          <p className="text-[10px] text-red-400 mt-0.5">↓ Voir la liste</p>
        </button>
        <div className="card-sm">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Reste a recouvrer</p>
          <p className="mt-0.5 text-2xl font-bold text-orange-600">
            {(impayesData?.totalResteAPayer || 0).toLocaleString()} {impayesData?.devise || 'XOF'}
          </p>
        </div>
        <div className="card-sm">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Recouvrement</p>
          <p className="mt-0.5 text-2xl font-bold text-emerald-600">{recouvrementRate}%</p>
        </div>
      </div>

      <div className="card-sm space-y-3">
        {/* Filtres rapides statut — pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['TOUS', 'VALIDE', 'EN_ATTENTE', 'ANNULE'] as StatusFilter[]).map(s => {
            const labels: Record<StatusFilter, string> = { TOUS: 'Tous', VALIDE: 'Validés', EN_ATTENTE: 'En attente', ANNULE: 'Annulés' }
            const colors: Record<StatusFilter, string> = {
              TOUS: statusFilter === 'TOUS' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
              VALIDE: statusFilter === 'VALIDE' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
              EN_ATTENTE: statusFilter === 'EN_ATTENTE' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
              ANNULE: statusFilter === 'ANNULE' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-50',
            }
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${colors[s]}`}
              >
                {labels[s]}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === s ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
                  {statusCounts[s] ?? 0}
                </span>
              </button>
            )
          })}

          {/* Filtre période rapide */}
          <div className="ml-auto flex items-center gap-1">
            {(['TOUS', 'CE_MOIS', 'MOIS_DERNIER', 'CETTE_ANNEE'] as MoisFilter[]).map(m => {
              const labels: Record<MoisFilter, string> = { TOUS: 'Toujours', CE_MOIS: 'Ce mois', MOIS_DERNIER: 'Mois dernier', CETTE_ANNEE: 'Cette année' }
              return (
                <button
                  key={m}
                  onClick={() => setMoisFilter(m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${moisFilter === m ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {labels[m]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Filtres avancés */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Élève, matricule, type, mode..."
                className="input input-sm pl-11"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as (typeof TYPE_OPTIONS)[number])}
              className="input input-sm"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'TOUS' ? 'Tous types' : formatType(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={classeFilter}
              onChange={(e) => setClasseFilter(e.target.value)}
              className="input input-sm"
            >
              <option value="TOUTES">Toutes classes</option>
              {classesDisponibles.map((classeNom) => (
                <option key={classeNom} value={classeNom}>{classeNom}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="input input-sm"
            >
              <option value="DATE_DESC">Date récente</option>
              <option value="DATE_ASC">Date ancienne</option>
              <option value="MONTANT_DESC">Montant décrois.</option>
              <option value="MONTANT_ASC">Montant crois.</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            {hasActiveFilters && (
              <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-primary-600 underline whitespace-nowrap">
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Résumé filtré */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{filteredPaiements.length}</span> paiement(s)
            sur <span className="font-semibold">{paiements.length}</span>
            {' '}· <span className="font-semibold">{Object.keys(groupedPaiements).length}</span> classe(s)
          </p>
          {filteredPaiements.length > 0 && (
            <p className="text-sm font-semibold text-primary-700">
              Total : {totalFiltre.toLocaleString()} XOF
            </p>
          )}
        </div>
      </div>

      <div ref={paiementsListRef} className="space-y-3">{filteredPaiements.length === 0 ? (
          <div className="card p-6 text-center text-sm text-gray-500">
            Aucun paiement ne correspond aux filtres.
          </div>
        ) : (() => {
          const sortedEntries = Object.entries(groupedPaiements).sort(([a], [b]) => compareLabels(a, b))
          const allCollapsed = sortedEntries.every(([k]) => collapsedGroupes.has(k))
          return (
            <>
              {/* Contrôle global accordéon */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {sortedEntries.length} classe(s) — {filteredPaiements.length} paiement(s)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (allCollapsed) {
                      setCollapsedGroupes(new Set())
                    } else {
                      setCollapsedGroupes(new Set(sortedEntries.map(([k]) => k)))
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:underline font-medium"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${allCollapsed ? '' : 'rotate-180'}`} />
                  {allCollapsed ? 'Tout déplier' : 'Tout replier'}
                </button>
              </div>

              {sortedEntries.map(([classeNom, rows]) => {
                const isCollapsed = collapsedGroupes.has(classeNom)
                const totalClasse = rows.reduce((s, r) => s + Number(r.montant || 0), 0)
                return (
              <div key={classeNom} className="card-flush">
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100 transition-colors"
                  onClick={() => setCollapsedGroupes(prev => {
                    const next = new Set(prev)
                    if (next.has(classeNom)) next.delete(classeNom)
                    else next.add(classeNom)
                    return next
                  })}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} />
                    <h3 className="text-sm font-semibold text-gray-800">{classeNom}</h3>
                    <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 border border-gray-200">
                      {rows.length} paiement(s)
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-primary-700 shrink-0">
                    {totalClasse.toLocaleString()} XOF
                  </span>
                </button>

                {!isCollapsed && <div className="hidden overflow-x-auto md:block">
                  <table className="table">
                    <thead className="bg-gray-50/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Eleve
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            Type
                            <InfoTip text="Scolarité, Inscription, Cantine, Transport, Uniforme ou Autres" />
                          </span>
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Montant
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            Mode
                            <InfoTip text="Mode de règlement : espèces, virement, mobile money, chèque…" />
                          </span>
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Statut
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((paiement) => (
                        <tr key={paiement.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-900">
                            {safeFormatDate(paiement.datePaiement)}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-900">
                            <p className="font-semibold">
                              {paiement.eleve?.prenom} {paiement.eleve?.nom}
                            </p>
                            <p className="text-xs text-gray-500">{paiement.eleve?.matricule || '-'}</p>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-900">
                            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              {formatType(paiement.typePaiement)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {Number(paiement.montant || 0).toLocaleString()} {paiement.devise}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-900">
                            {formatMode(paiement.modePaiement)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-900">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusClassName(
                                normalizeStatus(paiement.statut)
                              )}`}
                            >
                              {formatPaiementStatus(normalizeStatus(paiement.statut))}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right text-sm text-gray-900">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const isScolarite = String(paiement.typePaiement || '').toUpperCase() === 'SCOLARITE'
                                  const eleveId = String(paiement.eleve?.id || (paiement as any).eleveId || '')
                                  const classeId = String((paiement.eleve?.classe as any)?.id || '')
                                  const montantDu = isScolarite ? (classeScolariteById.get(classeId) || 0) : 0
                                  const totalPayeAnnuel = isScolarite ? (totalPayeScolariteByEleveId.get(eleveId) || 0) : 0
                                  printRecu({
                                    id: paiement.id,
                                    eleve: paiement.eleve as any,
                                    typePaiement: paiement.typePaiement,
                                    montant: Number(paiement.montant),
                                    devise: paiement.devise,
                                    datePaiement: paiement.datePaiement,
                                    modePaiement: paiement.modePaiement,
                                    moisConcerne: (paiement as any).moisConcerne,
                                    numeroPiece: (paiement as any).numeroPiece,
                                    remarques: paiement.remarques,
                                    statut: (paiement as any).statut,
                                    ...(montantDu > 0 ? { montantDu, totalPayeAnnuel } : {})
                                  })
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
                                title="Imprimer le reçu"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setEditingPaiement({
                                    id: paiement.id,
                                    eleveId: paiement.eleve?.id || (paiement as any).eleveId || '',
                                    eleveName: `${paiement.eleve?.prenom || ''} ${paiement.eleve?.nom || ''}`.trim(),
                                    typePaiement: paiement.typePaiement,
                                    montant: Number(paiement.montant),
                                    datePaiement: paiement.datePaiement,
                                    moisConcerne: (paiement as any).moisConcerne,
                                    modePaiement: paiement.modePaiement,
                                    numeroPiece: (paiement as any).numeroPiece,
                                    remarques: paiement.remarques,
                                    statut: (paiement as any).statut
                                  })
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
                                title="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteTarget({
                                    id: paiement.id,
                                    eleve: `${paiement.eleve?.prenom || ''} ${paiement.eleve?.nom || ''}`.trim(),
                                    type: formatType(paiement.typePaiement)
                                  })
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}

                {!isCollapsed && <div className="divide-y divide-gray-100 md:hidden">
                  {rows.map((paiement) => (
                    <div key={paiement.id} className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-gray-500">{safeFormatDate(paiement.datePaiement)}</p>
                          <p className="text-base font-semibold text-gray-900">
                            {paiement.eleve?.prenom} {paiement.eleve?.nom}
                          </p>
                          <p className="text-xs text-gray-500">{paiement.eleve?.matricule || '-'}</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusClassName(
                            normalizeStatus(paiement.statut)
                          )}`}
                        >
                          {formatPaiementStatus(normalizeStatus(paiement.statut))}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <p className="font-medium text-gray-800">
                          <span className="text-gray-500">Type:</span> {formatType(paiement.typePaiement)}
                        </p>
                        <p className="font-medium text-gray-800">
                          <span className="text-gray-500">Montant:</span>{' '}
                          {Number(paiement.montant || 0).toLocaleString()} {paiement.devise}
                        </p>
                        <p className="font-medium text-gray-800">
                          <span className="text-gray-500">Mode:</span> {formatMode(paiement.modePaiement)}
                        </p>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() =>
                            setEditingPaiement({
                              id: paiement.id,
                              eleveId: paiement.eleve?.id || (paiement as any).eleveId || '',
                              eleveName: `${paiement.eleve?.prenom || ''} ${paiement.eleve?.nom || ''}`.trim(),
                              typePaiement: paiement.typePaiement,
                              montant: Number(paiement.montant),
                              datePaiement: paiement.datePaiement,
                              moisConcerne: (paiement as any).moisConcerne,
                              modePaiement: paiement.modePaiement,
                              numeroPiece: (paiement as any).numeroPiece,
                              remarques: paiement.remarques,
                              statut: (paiement as any).statut
                            })
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              id: paiement.id,
                              eleve: `${paiement.eleve?.prenom || ''} ${paiement.eleve?.nom || ''}`.trim(),
                              type: formatType(paiement.typePaiement)
                            })
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
                )
              })}
            </>
          )
        })()}
      </div>

      <div ref={impayesSectionRef} className="card-flush">
        {/* En-tête */}
        <div className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={() => setShowImpayesDetail(!showImpayesDetail)}
          >
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <span className="text-base font-bold text-gray-900">Impayés et restes à payer</span>
            {!impayesAccessDenied && impayesData?.totalElevesImpayes != null && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {impayesData.totalElevesImpayes}
              </span>
            )}
            {impayesData?.anneeScolaire && (
              <span className="hidden text-xs text-gray-400 sm:inline">— {impayesData.anneeScolaire}</span>
            )}
          </button>
          <div className="flex items-center gap-3 shrink-0">
            {!impayesAccessDenied && impayesData?.impayes?.length ? (
              <button
                type="button"
                onClick={() =>
                  exportImpayes(filteredImpayes as unknown as Record<string, unknown>[], {
                    anneeScolaire: impayesData.anneeScolaire,
                    devise: impayesData.devise
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" />
                Exporter
              </button>
            ) : null}
            {!impayesAccessDenied && impayesData?.totalResteAPayer != null && impayesData.totalResteAPayer > 0 && (
              <span className="text-sm font-semibold text-orange-600">
                {impayesData.totalResteAPayer.toLocaleString()} {impayesData.devise}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowImpayesDetail(!showImpayesDetail)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
              aria-label="Afficher les impayés"
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showImpayesDetail ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Détail dépliable */}
        {showImpayesDetail && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            {impayesAccessDenied ? (
              <p className="text-sm text-gray-500">Votre rôle ne permet pas de voir la liste des impayés.</p>
            ) : impayesData?.impayes && impayesData.impayes.length > 0 ? (
              <div className="space-y-3">
                {/* Filtre impayés */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setImpayeFilter('TOUS')}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      impayeFilter === 'TOUS'
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setImpayeFilter('PARTIEL')}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      impayeFilter === 'PARTIEL'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
                    }`}
                  >
                    Partiellement payés
                  </button>
                  <span className="text-xs text-gray-400">
                    {filteredImpayes.length} élève(s) affichés
                  </span>
                </div>
                {/* KPIs résumé — bannière horizontale */}
                <div className="flex items-stretch gap-0 rounded-xl border border-orange-100 bg-orange-50 overflow-hidden">
                  <div className="flex-1 px-4 py-2.5 text-center border-r border-orange-100">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400">Élèves concernés</p>
                    <p className="mt-0.5 text-2xl font-bold text-red-600">{impayesData.totalElevesImpayes}</p>
                  </div>
                  <div className="flex-[2] px-4 py-2.5 text-center border-r border-orange-100">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">Reste global</p>
                    <p className="mt-0.5 text-2xl font-bold text-orange-600">
                      {impayesData.totalResteAPayer.toLocaleString()} <span className="text-sm font-normal">{impayesData.devise}</span>
                    </p>
                  </div>
                  <div className="flex-1 px-4 py-2.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Recouvrement</p>
                    <p className="mt-0.5 text-2xl font-bold text-emerald-600">{recouvrementRate}%</p>
                  </div>
                </div>

                {/* Liste groupée par classe */}
                {filteredImpayes.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun élève correspond à ce filtre.</p>
                ) : (
                  <div className="max-h-[480px] overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-100">
                    {Object.entries(groupedImpayes)
                      .sort(([a], [b]) => compareLabels(a, b))
                      .map(([classeNom, rows]) => {
                        const totalReste = rows.reduce((s, r) => s + r.resteAPayer, 0)
                        return (
                          <div key={classeNom}>
                            {/* Entête classe sticky */}
                            <div className="sticky top-0 z-10 flex items-center justify-between bg-gray-50 px-3 py-1.5 border-b border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700">{classeNom}</span>
                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                  {rows.length} élève{rows.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-red-500">
                                -{totalReste.toLocaleString()} {impayesData.devise}
                              </span>
                            </div>
                            {/* Lignes élèves */}
                            <div className="divide-y divide-gray-50">
                              {rows.map((item) => {
                                const pct = item.totalDu > 0 ? Math.min(100, Math.round((item.totalPaye / item.totalDu) * 100)) : 0
                                const isZero = item.totalPaye === 0
                                return (
                                  <div key={item.eleve_id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50/80">
                                    {/* Indicateur couleur */}
                                    <div className={`w-1 self-stretch rounded-full shrink-0 ${isZero ? 'bg-red-400' : pct >= 75 ? 'bg-amber-400' : 'bg-orange-400'}`} />
                                    {/* Nom */}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{item.prenom} {item.nom}</p>
                                      <p className="text-[11px] text-gray-400">{item.matricule}</p>
                                    </div>
                                    {/* Barre de progression */}
                                    <div className="w-32 shrink-0 hidden sm:block">
                                      <div className="flex justify-between text-[10px] mb-0.5">
                                        <span className="text-gray-400">{item.totalPaye.toLocaleString()}</span>
                                        <span className={`font-bold ${isZero ? 'text-red-500' : 'text-amber-600'}`}>{pct}%</span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                                        {pct > 0 && (
                                          <div
                                            className={`h-full rounded-full ${pct >= 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        )}
                                      </div>
                                      <p className="text-[10px] text-gray-300 mt-0.5 text-right">/ {item.totalDu.toLocaleString()}</p>
                                    </div>
                                    {/* Reste */}
                                    <div className="shrink-0 text-right min-w-[70px]">
                                      <p className="text-xs font-bold text-red-600">-{item.resteAPayer.toLocaleString()}</p>
                                      <p className="text-[10px] text-gray-400">{impayesData.devise}</p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucun impayé détecté pour l'année active.</p>
            )}
          </div>
        )}
      </div>

      <PaiementFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadPageData}
      />

      <PaiementFormModal
        isOpen={!!editingPaiement}
        onClose={() => setEditingPaiement(null)}
        onSuccess={() => {
          loadPageData()
          setEditingPaiement(null)
        }}
        paiement={editingPaiement ?? undefined}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Supprimer ce paiement"
        message={
          deleteTarget
            ? `Confirmer la suppression du paiement "${deleteTarget.type}" pour ${deleteTarget.eleve} ?`
            : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  )
}






