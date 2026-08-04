import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit2, Eye, Layers, Plus, School, Search, Trash2 } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { SkeletonList } from '../components/Skeleton'
import { useAuthStore } from '../store/authStore'
import { Classe } from '../types'
import ClasseFormModal from '../components/ClasseFormModal'
import ImportClassesModal from '../components/ImportClassesModal'
import ConfirmDialog from '../components/ConfirmDialog'

type SortKey = 'NOM' | 'NIVEAU' | 'EFFECTIF'

const normalizeText = (value: string | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const normalizeCycle = (value: string | undefined) => {
  const key = normalizeText(value)
  if (key.includes('primaire')) return 'primaire'
  if (key.includes('college')) return 'college'
  if (key.includes('lycee')) return 'lycee'
  return key || 'autre'
}

const cycleLabel = (value: string | undefined) => {
  const key = normalizeCycle(value)
  if (key === 'primaire') return 'Primaire'
  if (key === 'college') return 'College'
  if (key === 'lycee') return 'Lycee'
  return value || 'Autre'
}

export default function Classes() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const { user } = useAuthStore()
  const userRole = String(user?.role || '').toUpperCase()
  const canEdit = userRole === 'ADMIN' || userRole === 'DIRECTEUR'
  const [classes, setClasses] = useState<Classe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState<'TOUS' | 'primaire' | 'college' | 'lycee'>('TOUS')
  const [sortBy, setSortBy] = useState<SortKey>('NOM')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [classeToEdit, setClasseToEdit] = useState<Classe | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: '', nom: '' })

  useEffect(() => {
    loadClasses()
  }, [])

  const loadClasses = async () => {
    try {
      const response = await api.get('/classes')
      const mappedClasses = response.data.map((data: any) => ({
        id: data.id,
        nom: data.nom,
        niveau: data.niveau,
        cycle: data.cycle,
        section: data.section,
        anneeScolaire: data.annee_scolaire || data.anneeScolaire,
        enseignantPrincipalId: data.enseignant_principal_id || data.enseignantPrincipalId,
        effectifMax: data.effectif_max || data.effectifMax || 50,
        effectifActuel: data.effectif_actuel || data.effectifActuel || 0,
        salle: data.salle,
        montantInscription: data.montant_inscription || data.montantInscription || 0,
        montantMensuel: data.montant_mensuel || data.montantMensuel || 0,
        devise: data.devise || 'XOF',
        enseignantPrincipal:
          data.enseignantPrincipal ||
          (data.enseignant_principal_id && {
            id: data.enseignant_id,
            nom: data.enseignant_nom,
            prenom: data.enseignant_prenom,
            matricule: data.enseignant_matricule
          }),
        fraisScolarite: {
          montantScolarite: data.montant_scolarite || data.montantScolarite || 0,
          montantInscription: data.montant_inscription || data.montantInscription || 0,
          montantMensuel: data.montant_mensuel || data.montantMensuel || 0,
          devise: data.devise || 'XOF'
        }
      }))

      setClasses(mappedClasses)
    } catch (error) {
      console.error('Erreur lors du chargement des classes', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (classe: Classe) => {
    setClasseToEdit(classe)
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/classes/${id}`)
      await loadClasses()
      setDeleteConfirm({ show: false, id: '', nom: '' })
      success("Classe supprimée avec succès")
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Erreur lors de la suppression')
    }
  }

  const handleModalClose = () => {
    setShowAddModal(false)
    setClasseToEdit(null)
  }

  const filteredClasses = useMemo(() => {
    const term = normalizeText(search)
    const rows = classes.filter((classe) => {
      const cycleKey = normalizeCycle(String(classe.cycle))
      const matchCycle = cycleFilter === 'TOUS' || cycleKey === cycleFilter
      const searchable = normalizeText(
        `${classe.nom} ${classe.niveau} ${classe.section || ''} ${classe.salle || ''}`
      )
      const matchSearch = !term || searchable.includes(term)
      return matchCycle && matchSearch
    })

    rows.sort((a, b) => {
      if (sortBy === 'NIVEAU') {
        const level = String(a.niveau || '').localeCompare(String(b.niveau || ''), 'fr', {
          sensitivity: 'base'
        })
        if (level !== 0) return level
      }
      if (sortBy === 'EFFECTIF') {
        return (b.effectifActuel || 0) - (a.effectifActuel || 0)
      }
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', {
        sensitivity: 'base'
      })
    })

    return rows
  }, [classes, cycleFilter, search, sortBy])

  const stats = useMemo(
    () => ({
      total: classes.length,
      primaire: classes.filter((c) => normalizeCycle(String(c.cycle)) === 'primaire').length,
      college: classes.filter((c) => normalizeCycle(String(c.cycle)) === 'college').length,
      lycee: classes.filter((c) => normalizeCycle(String(c.cycle)) === 'lycee').length
    }),
    [classes]
  )

  if (loading) return <SkeletonList rows={6} />

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-gray-900">Classes</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              title="Créer plusieurs classes d'un coup (système togolais)"
            >
              <Layers className="h-4 w-4" />
              Import rapide
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Nouvelle classe
            </button>
          </div>
        )}
      </div>

      {/* Filtres + stats */}
      <div className="card-sm space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, niveau, section, salle..."
              className="input input-sm pl-11"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="input input-sm w-40 shrink-0"
          >
            <option value="NOM">Trier par nom</option>
            <option value="NIVEAU">Trier par niveau</option>
            <option value="EFFECTIF">Trier par effectif</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
          {[
            { id: 'TOUS',     label: 'Tous',     count: classes.length },
            { id: 'primaire', label: 'Primaire', count: stats.primaire },
            { id: 'college',  label: 'Collège',  count: stats.college },
            { id: 'lycee',    label: 'Lycée',    count: stats.lycee },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setCycleFilter(item.id as 'TOUS' | 'primaire' | 'college' | 'lycee')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all ${
                cycleFilter === item.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                cycleFilter === item.id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {item.count}
              </span>
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">
            {filteredClasses.length} résultat{filteredClasses.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Tableau */}
      {filteredClasses.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <School className="h-7 w-7 text-gray-400" />
          </div>
          {classes.length === 0 ? (
            <>
              <p className="font-semibold text-gray-700">Aucune classe pour le moment</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Commencez par créer vos premières classes.</p>
              {canEdit && (
                <button onClick={() => setShowAddModal(true)} className="btn btn-primary mx-auto">
                  <Plus className="h-4 w-4" />
                  Créer une classe
                </button>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-700">Aucune classe ne correspond aux filtres</p>
              <p className="text-sm text-gray-400 mt-1">Modifiez le cycle ou la recherche.</p>
            </>
          )}
        </div>
      ) : (
        <div className="card-flush">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Classe</th>
                  <th className="table-header">Cycle / Niveau</th>
                  <th className="table-header">Effectif</th>
                  <th className="table-header">Titulaire</th>
                  <th className="table-header">Salle</th>
                  <th className="table-header">Frais de scolarité</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredClasses.map((classe) => {
                  const effectif = classe.effectifActuel || 0
                  const max = classe.effectifMax || 1
                  const taux = Math.max(0, Math.min(100, Math.round((effectif / max) * 100)))
                  const fraisScolarite = (classe.fraisScolarite as any)?.montantScolarite || 0
                  const fraisMensuel = classe.fraisScolarite?.montantMensuel || 0
                  const fraisInscription = classe.fraisScolarite?.montantInscription || 0
                  const devise = classe.fraisScolarite?.devise || 'XOF'
                  const cycleKey = normalizeCycle(String(classe.cycle))
                  const cycleBadgeColor =
                    cycleKey === 'primaire' ? 'bg-green-100 text-green-700' :
                    cycleKey === 'college'  ? 'bg-blue-100 text-blue-700' :
                    cycleKey === 'lycee'    ? 'bg-purple-100 text-purple-700' :
                                             'bg-gray-100 text-gray-700'

                  return (
                    <tr key={classe.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/classes/${classe.id}`)}>
                      <td className="table-cell">
                        <div>
                          <p className="font-semibold text-gray-900">{classe.nom}</p>
                          {classe.section && (
                            <span className="text-xs text-primary-600 font-medium">Section {classe.section}</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cycleBadgeColor}`}>
                          {cycleLabel(String(classe.cycle))}
                        </span>
                        {classe.niveau && (
                          <p className="text-xs text-gray-500 mt-0.5">{classe.niveau}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-medium text-gray-900">{effectif} / {max}</p>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${taux >= 90 ? 'bg-red-500' : taux >= 70 ? 'bg-amber-500' : 'bg-primary-500'}`}
                            style={{ width: `${taux}%` }}
                          />
                        </div>
                      </td>
                      <td className="table-cell">
                        {classe.enseignantPrincipal ? (
                          <span className="text-sm text-gray-700">
                            {classe.enseignantPrincipal.prenom} {classe.enseignantPrincipal.nom}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className="text-sm text-gray-700">{classe.salle || '—'}</span>
                      </td>
                      <td className="table-cell">
                        {fraisScolarite > 0 || fraisMensuel > 0 || fraisInscription > 0 ? (
                          <div className="space-y-0.5">
                            {fraisScolarite > 0 && (
                              <p className="text-sm font-semibold text-primary-700">
                                {fraisScolarite.toLocaleString()} {devise}
                                <span className="ml-1 text-xs font-normal text-gray-400">/an</span>
                              </p>
                            )}
                            {fraisMensuel > 0 && (
                              <p className="text-xs text-gray-500">
                                Mensuel : {fraisMensuel.toLocaleString()} {devise}
                              </p>
                            )}
                            {fraisInscription > 0 && (
                              <p className="text-xs text-gray-500">
                                Inscr. : {fraisInscription.toLocaleString()} {devise}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/classes/${classe.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-primary-300 hover:text-primary-600"
                            title="Voir"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {canEdit && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(classe) }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-primary-300 hover:text-primary-600"
                                title="Modifier"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ show: true, id: classe.id, nom: classe.nom }) }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-400 transition-colors hover:border-red-300 hover:text-red-600"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ClasseFormModal
        isOpen={showAddModal}
        onClose={handleModalClose}
        onSuccess={loadClasses}
        classe={classeToEdit}
      />

      <ImportClassesModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadClasses}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Supprimer la classe"
        message={`Etes-vous sur de vouloir supprimer la classe "${deleteConfirm.nom}" ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ show: false, id: '', nom: '' })}
        variant="danger"
      />
    </div>
  )
}
