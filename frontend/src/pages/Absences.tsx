import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { Absence } from '../types'
import { Calendar, Download, Plus, Search, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '../contexts/ToastContext'
import { SkeletonList } from '../components/Skeleton'
import AbsenceFormModal from '../components/AbsenceFormModal'
import { exportAbsences } from '../utils/exportExcel'

const PERIODE_LABELS: Record<string, string> = {
  MATIN: 'Matin',
  APRES_MIDI: 'Après-midi',
  TOUTE_JOURNEE: 'Toute la journée',
}
const periodeLabel = (v: string) => PERIODE_LABELS[v?.toUpperCase()] || v || '—'

export default function Absences() {
  const { success, error: toastError } = useToast()
  const [absences, setAbsences] = useState<Absence[]>([])
  const [classes, setClasses] = useState<Array<{ id: string; nom: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [classeFilter, setClasseFilter] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [justifieeFilter, setJustifieeFilter] = useState<'TOUS' | 'OUI' | 'NON'>('TOUS')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [absencesRes, classesRes] = await Promise.allSettled([
        api.get('/absences'),
        api.get('/classes')
      ])

      if (absencesRes.status === 'fulfilled') {
        const mappedAbsences = absencesRes.value.data.map((data: any) => ({
          id: data.id,
          eleveId: data.eleve_id || data.eleveId,
          classeId: data.classe_id || data.classeId,
          date: data.date,
          periode: data.periode,
          justifiee: data.justifiee,
          motif: data.motif,
          eleve: data.eleve || {
            id: data.eleve_id,
            nom: data.eleve_nom,
            prenom: data.eleve_prenom,
            matricule: data.eleve_matricule
          },
          classe: data.classe || {
            id: data.classe_id,
            nom: data.classe_nom
          }
        }))
        setAbsences(mappedAbsences)
      }

      if (classesRes.status === 'fulfilled') {
        const sorted = [...classesRes.value.data].sort((a: any, b: any) =>
          String(a.nom || '').localeCompare(String(b.nom || ''), 'fr')
        )
        setClasses(sorted)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des absences', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAbsences = useMemo(() => {
    return absences.filter((a) => {
      const dateStr = a.date ? a.date.slice(0, 10) : ''
      const afterStart = !dateDebut || dateStr >= dateDebut
      const beforeEnd = !dateFin || dateStr <= dateFin
      const classeMatch = !classeFilter || a.classe?.id === classeFilter || a.classe?.nom === classeFilter
      const justifieeMatch =
        justifieeFilter === 'TOUS' ||
        (justifieeFilter === 'OUI' && a.justifiee) ||
        (justifieeFilter === 'NON' && !a.justifiee)
      const searchMatch =
        !searchQuery.trim() ||
        `${a.eleve?.prenom || ''} ${a.eleve?.nom || ''}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim())
      return afterStart && beforeEnd && classeMatch && justifieeMatch && searchMatch
    })
  }, [absences, dateDebut, dateFin, classeFilter, justifieeFilter, searchQuery])

  const stats = useMemo(() => ({
    total: filteredAbsences.length,
    justifiees: filteredAbsences.filter((a) => a.justifiee).length,
    nonJustifiees: filteredAbsences.filter((a) => !a.justifiee).length
  }), [filteredAbsences])

  const hasFilters = searchQuery || classeFilter || dateDebut || dateFin || justifieeFilter !== 'TOUS'

  const clearFilters = () => {
    setSearchQuery('')
    setClasseFilter('')
    setDateDebut('')
    setDateFin('')
    setJustifieeFilter('TOUS')
  }

  const handleDelete = async (id: string, eleve: string, date: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'absence de ${eleve} du ${date} ?`)) {
      return
    }
    try {
      await api.delete(`/absences/${id}`)
      await loadData()
      success('Absence supprimée avec succès')
    } catch {
      toastError("Erreur lors de la suppression de l'absence")
    }
  }

  if (loading) return <SkeletonList rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-display font-bold text-gray-900">Absences</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAbsences(filteredAbsences as unknown as Record<string, unknown>[])}
            className="btn btn-secondary btn-sm flex items-center"
            title="Exporter"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nouvelle absence
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-sm border-t-4 border-slate-400">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Total{hasFilters ? ' (filtrés)' : ''}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="card-sm border-t-4 border-emerald-500">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Justifiées</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.justifiees}</p>
        </div>
        <div className="card-sm border-t-4 border-red-500">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Non justifiées</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.nonJustifiees}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Recherche élève
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Nom ou prénom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-sm pl-9"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Classe
            </label>
            <select
              value={classeFilter}
              onChange={(e) => setClasseFilter(e.target.value)}
              className="input h-9 text-sm"
            >
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Date début
            </label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="input h-9 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Date fin
            </label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="input h-9 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <div className="flex gap-2">
            {(['TOUS', 'OUI', 'NON'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setJustifieeFilter(v)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  justifieeFilter === v
                    ? v === 'OUI'
                      ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                      : v === 'NON'
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                        : 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v === 'TOUS' ? 'Toutes' : v === 'OUI' ? 'Justifiées' : 'Non justifiées'}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
              Effacer les filtres
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {filteredAbsences.length} / {absences.length} absence(s)
          </span>
        </div>
      </div>

      {filteredAbsences.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Calendar className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {hasFilters ? 'Aucune absence ne correspond aux filtres.' : 'Aucune absence enregistrée.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Table desktop ── */}
          <div className="hidden md:block card-flush">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Élève</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Période</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Motif</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAbsences.map((absence) => (
                  <tr key={absence.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {format(new Date(absence.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {absence.eleve.prenom} {absence.eleve.nom}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{absence.classe.nom}</td>
                    <td className="px-4 py-3 text-gray-600">{periodeLabel(absence.periode)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        absence.justifiee ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {absence.justifiee ? 'Justifiée' : 'Non justifiée'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm max-w-[180px] truncate">
                      {absence.motif || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(
                          absence.id,
                          `${absence.eleve.prenom} ${absence.eleve.nom}`,
                          format(new Date(absence.date), 'dd/MM/yyyy')
                        )}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-400 transition-colors hover:border-red-300 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Cartes mobile ── */}
          <div className="md:hidden space-y-2">
            {filteredAbsences.map((absence) => (
              <div key={absence.id} className="card-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Nom élève + classe */}
                    <p className="font-semibold text-gray-900 leading-tight">
                      {absence.eleve.prenom} {absence.eleve.nom}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {absence.classe.nom} · {periodeLabel(absence.periode)}
                    </p>
                  </div>
                  {/* Badge justifiée */}
                  <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    absence.justifiee ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {absence.justifiee ? 'Justifiée' : 'Non justifiée'}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {format(new Date(absence.date), 'dd MMM yyyy')}
                  </span>
                  {absence.motif && (
                    <>
                      <span>·</span>
                      <span className="truncate">{absence.motif}</span>
                    </>
                  )}
                </div>

                <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
                  <button
                    onClick={() => handleDelete(
                      absence.id,
                      `${absence.eleve.prenom} ${absence.eleve.nom}`,
                      format(new Date(absence.date), 'dd/MM/yyyy')
                    )}
                    className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <AbsenceFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
