import { useEffect, useMemo, useState } from 'react'
import { Download, Edit2, GraduationCap, Plus, Search, Trash2 } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { SkeletonList } from '../components/Skeleton'
import { useAuthStore } from '../store/authStore'
import { Enseignant, Matiere } from '../types'
import EnseignantFormModal from '../components/EnseignantFormModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { exportEnseignants } from '../utils/exportExcel'

type SortKey = 'NOM_ASC' | 'NOM_DESC' | 'MATRICULE' | 'STATUT'
type StatutFilter = 'TOUS' | Enseignant['statut']
type ContratFilter = 'TOUS' | Enseignant['typeContrat']

const STATUS_META: Record<
  Enseignant['statut'],
  { label: string; badgeClass: string; cardClass: string }
> = {
  actif: {
    label: 'Actif',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    cardClass: 'border-l-4 border-emerald-500'
  },
  conge: {
    label: 'Conge',
    badgeClass: 'bg-amber-100 text-amber-700',
    cardClass: 'border-l-4 border-amber-500'
  },
  suspendu: {
    label: 'Suspendu',
    badgeClass: 'bg-red-100 text-red-700',
    cardClass: 'border-l-4 border-red-500'
  },
  demissionne: {
    label: 'Demissionne',
    badgeClass: 'bg-gray-100 text-gray-700',
    cardClass: 'border-l-4 border-gray-400'
  }
}

const CONTRAT_LABEL: Record<Enseignant['typeContrat'], string> = {
  permanent: 'Permanent',
  contractuel: 'Contractuel',
  vacataire: 'Vacataire'
}

const normalizeText = (value: string | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const compareText = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' })

const toFrontendStatus = (rawStatus: unknown): Enseignant['statut'] => {
  const value = String(rawStatus || '').trim().toUpperCase()
  const map: Record<string, Enseignant['statut']> = {
    ACTIF: 'actif',
    CONGE: 'conge',
    SUSPENDU: 'suspendu',
    DEMISSIONNE: 'demissionne'
  }

  return map[value] || 'actif'
}

const toFrontendContract = (rawContract: unknown): Enseignant['typeContrat'] => {
  const value = String(rawContract || '').trim().toUpperCase()
  const map: Record<string, Enseignant['typeContrat']> = {
    PERMANENT: 'permanent',
    CONTRACTUEL: 'contractuel',
    VACATAIRE: 'vacataire'
  }

  return map[value] || 'contractuel'
}

const mapSpecialites = (rawSpecialites: unknown): Matiere[] => {
  if (!Array.isArray(rawSpecialites)) return []

  return rawSpecialites.reduce<Matiere[]>((acc, item: any) => {
      const matiere = item?.matiere || item
      if (!matiere?.id) {
        return acc
      }

      acc.push({
        id: String(matiere.id),
        nom: String(matiere.nom || ''),
        code: String(matiere.code || ''),
        description: matiere.description ? String(matiere.description) : undefined,
        coefficient: Number(matiere.coefficient || 1),
        niveaux: Array.isArray(matiere.niveaux) ? matiere.niveaux : [],
        cycles: Array.isArray(matiere.cycles) ? matiere.cycles : [],
        couleur: String(matiere.couleur || '#3B82F6')
      })

      return acc
    }, [])
}

export default function Enseignants() {
  const { success, error: toastError } = useToast()
  const { user } = useAuthStore()
  const canEdit = String(user?.role || '').toUpperCase() !== 'SECRETAIRE'
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('TOUS')
  const [contratFilter, setContratFilter] = useState<ContratFilter>('TOUS')
  const [sortBy, setSortBy] = useState<SortKey>('NOM_ASC')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEnseignant, setEditingEnseignant] = useState<Enseignant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; nom: string }>(
    {
      show: false,
      id: '',
      nom: ''
    }
  )

  useEffect(() => {
    loadEnseignants()
  }, [])

  const loadEnseignants = async () => {
    try {
      const response = await api.get('/enseignants', { params: { limit: 500 } })
      const raw = Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
      const mapped = raw.map((data: any): Enseignant => ({
        id: String(data.id || data._id || ''),
        matricule: String(data.matricule || ''),
        nom: String(data.nom || ''),
        prenom: String(data.prenom || ''),
        dateNaissance: String(data.dateNaissance || data.date_naissance || ''),
        sexe: data.sexe === 'F' ? 'F' : 'M',
        telephone: String(data.telephone || ''),
        email: data.email || '',
        adresse: data.adresse || '',
        photo: data.photo || '',
        diplomes: Array.isArray(data.diplomes) ? data.diplomes : [],
        specialites: mapSpecialites(data.specialites),
        classesAssignees: Array.isArray(data.classesCommeResponsable)
          ? data.classesCommeResponsable.map((classe: any) => ({
              id: String(classe.id || ''),
              nom: String(classe.nom || ''),
              niveau: String(classe.niveau || ''),
              cycle: String(classe.cycle || '') as any,
              anneeScolaire: '',
              effectifMax: 0,
              fraisScolarite: {
                montantInscription: 0,
                montantMensuel: 0,
                devise: 'XOF'
              }
            }))
          : [],
        dateRecrutement: String(data.dateRecrutement || data.date_recrutement || ''),
        statut: toFrontendStatus(data.statut),
        typeContrat: toFrontendContract(data.typeContrat || data.type_contrat),
        salaire: data.salaire ? Number(data.salaire) : undefined
      }))

      setEnseignants(mapped)
    } catch (error) {
      console.error('Erreur lors du chargement des enseignants', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEnseignants = useMemo(() => {
    const term = normalizeText(search)
    const results = enseignants.filter((ens) => {
      const searchable = [
        ens.nom,
        ens.prenom,
        ens.matricule,
        ens.telephone,
        ens.email || ''
      ]
        .map((value) => normalizeText(value))
        .join(' ')

      const matchSearch = !term || searchable.includes(term)
      const matchStatus = statutFilter === 'TOUS' || ens.statut === statutFilter
      const matchContract = contratFilter === 'TOUS' || ens.typeContrat === contratFilter

      return matchSearch && matchStatus && matchContract
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
      if (sortBy === 'MATRICULE') {
        return compareText(a.matricule, b.matricule)
      }
      return compareText(STATUS_META[a.statut].label, STATUS_META[b.statut].label)
    })

    return results
  }, [enseignants, search, statutFilter, contratFilter, sortBy])

  const stats = useMemo(
    () => ({
      total: enseignants.length,
      resultats: filteredEnseignants.length,
      actifs: filteredEnseignants.filter((ens) => ens.statut === 'actif').length,
      congeSuspendu: filteredEnseignants.filter(
        (ens) => ens.statut === 'conge' || ens.statut === 'suspendu'
      ).length,
      permanents: filteredEnseignants.filter((ens) => ens.typeContrat === 'permanent').length
    }),
    [enseignants.length, filteredEnseignants]
  )

  const clearFilters = () => {
    setSearch('')
    setStatutFilter('TOUS')
    setContratFilter('TOUS')
    setSortBy('NOM_ASC')
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/enseignants/${id}`)
      await loadEnseignants()
      success("Enseignant supprimé avec succès")
    } catch (error: any) {
      console.error('Erreur lors de la suppression', error)
      toastError(error.response?.data?.message || "Erreur lors de la suppression de l'enseignant")
    } finally {
      setDeleteConfirm({ show: false, id: '', nom: '' })
    }
  }

  if (loading) return <SkeletonList rows={6} />

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-display font-bold text-gray-900">Enseignants</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportEnseignants(filteredEnseignants as unknown as Record<string, unknown>[])}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            title="Exporter"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter</span>
          </button>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Nouvel enseignant
            </button>
          )}
        </div>
      </div>

      {/* Filtres + stats */}
      <div className="card-sm space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, matricule, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-sm pl-11"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value as StatutFilter)}
            className="input h-9 input-sm flex-1 min-w-[130px]"
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="conge">Congé</option>
            <option value="suspendu">Suspendu</option>
            <option value="demissionne">Démissionné</option>
          </select>

          <select
            value={contratFilter}
            onChange={(e) => setContratFilter(e.target.value as ContratFilter)}
            className="input h-9 input-sm flex-1 min-w-[130px]"
          >
            <option value="TOUS">Tous les contrats</option>
            <option value="permanent">Permanent</option>
            <option value="contractuel">Contractuel</option>
            <option value="vacataire">Vacataire</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="input h-9 input-sm flex-1 min-w-[130px]"
          >
            <option value="NOM_ASC">Nom (A-Z)</option>
            <option value="NOM_DESC">Nom (Z-A)</option>
            <option value="MATRICULE">Matricule</option>
            <option value="STATUT">Statut</option>
          </select>

          <button onClick={clearFilters} className="btn btn-secondary btn-sm h-9">
            Réinitialiser
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-sm text-gray-600">
          <span>{stats.resultats} / {stats.total} enseignant(s)</span>
          <span className="text-emerald-600 font-medium">{stats.actifs} actifs</span>
          <span className="text-amber-600 font-medium">{stats.congeSuspendu} congé/suspendu</span>
          <span className="text-blue-600 font-medium">{stats.permanents} permanents</span>
        </div>
      </div>

      {/* Tableau */}
      {filteredEnseignants.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <GraduationCap className="h-7 w-7 text-gray-400" />
          </div>
          {enseignants.length === 0 ? (
            <>
              <p className="font-semibold text-gray-700">Aucun enseignant pour le moment</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Ajoutez votre premier enseignant pour commencer.</p>
              {canEdit && (
                <button onClick={() => setShowAddModal(true)} className="btn btn-primary mx-auto">
                  <Plus className="h-4 w-4" />
                  Ajouter un enseignant
                </button>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-700">Aucun enseignant ne correspond aux filtres</p>
              <p className="text-sm text-gray-400 mt-1">Modifiez la recherche ou les filtres de statut.</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* ── Table desktop ── */}
          <div className="hidden md:block card-flush">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Enseignant</th>
                    <th className="table-header">Contact</th>
                    <th className="table-header">Contrat</th>
                    <th className="table-header text-center" title="Nombre de spécialités / classes assignées">Spéc. / Classes</th>
                    <th className="table-header">Statut</th>
                    {canEdit && <th className="table-header text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredEnseignants.map((ens) => {
                    const initials = `${ens.nom[0] || ''}${ens.prenom[0] || ''}`.toUpperCase()
                    const avatarColor = ens.sexe === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                    return (
                      <tr key={ens.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => canEdit && setEditingEnseignant(ens)}>
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor}`}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{ens.nom} {ens.prenom}</p>
                              <p className="text-xs text-gray-400">{ens.matricule}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell">
                          <p className="text-gray-900">{ens.telephone || '—'}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[180px]">{ens.email || '—'}</p>
                        </td>
                        <td className="table-cell">
                          <span className="text-sm text-gray-700">{CONTRAT_LABEL[ens.typeContrat]}</span>
                        </td>
                        <td className="table-cell text-center">
                          <span className="text-sm text-gray-700">{ens.specialites.length} / {ens.classesAssignees.length}</span>
                        </td>
                        <td className="table-cell">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[ens.statut].badgeClass}`}>
                            {STATUS_META[ens.statut].label}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="table-cell text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={(e) => { e.stopPropagation(); setEditingEnseignant(ens) }} className="icon-btn" title="Modifier">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ show: true, id: ens.id, nom: `${ens.prenom} ${ens.nom}` }) }} className="icon-btn-danger" title="Supprimer">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Cartes mobile ── */}
          <div className="md:hidden space-y-2">
            {filteredEnseignants.map((ens) => {
              const initials = `${ens.nom[0] || ''}${ens.prenom[0] || ''}`.toUpperCase()
              const avatarColor = ens.sexe === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
              return (
                <div key={ens.id} className="card-sm">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 leading-tight">{ens.nom} {ens.prenom}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{ens.matricule}</p>
                        </div>
                        <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[ens.statut].badgeClass}`}>
                          {STATUS_META[ens.statut].label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{CONTRAT_LABEL[ens.typeContrat]}</span>
                        {ens.telephone && <><span>·</span><span>{ens.telephone}</span></>}
                        <><span>·</span><span>{ens.specialites.length} spéc. / {ens.classesAssignees.length} classe(s)</span></>
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                      <button
                        onClick={() => setEditingEnseignant(ens)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ show: true, id: ens.id, nom: `${ens.prenom} ${ens.nom}` })}
                        className="flex items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <EnseignantFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadEnseignants}
      />

      <EnseignantFormModal
        isOpen={Boolean(editingEnseignant)}
        onClose={() => setEditingEnseignant(null)}
        onSuccess={() => {
          loadEnseignants()
          setEditingEnseignant(null)
        }}
        enseignant={editingEnseignant}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: '', nom: '' })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="Supprimer l'enseignant"
        message={`Etes-vous sur de vouloir supprimer ${deleteConfirm.nom} ? Cette action est irreversible.`}
        confirmText="Supprimer"
        type="danger"
      />
    </div>
  )
}

