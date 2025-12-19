import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Classe } from '../types'
import { Plus, Eye, Edit2, Trash2 } from 'lucide-react'
import ClasseFormModal from '../components/ClasseFormModal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Classes() {
  const [classes, setClasses] = useState<Classe[]>([])
  const [loading, setLoading] = useState(true)
  const [cycleFilter, setCycleFilter] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [classeToEdit, setClasseToEdit] = useState<Classe | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: '', nom: '' })

  useEffect(() => {
    loadClasses()
  }, [])

  const loadClasses = async () => {
    try {
      const response = await api.get('/classes')

      // Mapper les données du backend (snake_case) vers le frontend (camelCase)
      const mappedClasses = response.data.map((data: any) => ({
        id: data.id,
        nom: data.nom,
        niveau: data.niveau,
        cycle: data.cycle,
        section: data.section,
        anneeScolaire: data.annee_scolaire || data.anneeScolaire,
        enseignantPrincipalId: data.enseignant_principal_id || data.enseignantPrincipalId,
        effectifMax: data.effectif_max || data.effectifMax || 50,
        effectifActuel: data.effectifActuel || data.effectif_actuel || 0,
        salle: data.salle,
        montantInscription: data.montant_inscription || data.montantInscription || 0,
        montantMensuel: data.montant_mensuel || data.montantMensuel || 0,
        devise: data.devise || 'XOF',
        enseignantPrincipal: data.enseignantPrincipal || (data.enseignant_principal_id && {
          id: data.enseignant_id,
          nom: data.enseignant_nom,
          prenom: data.enseignant_prenom,
          matricule: data.enseignant_matricule
        }),
        // Pour compatibilité avec l'ancien format (si nécessaire)
        fraisScolarite: {
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
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la suppression')
    }
  }

  const handleModalClose = () => {
    setShowAddModal(false)
    setClasseToEdit(null)
  }

  const filteredClasses = cycleFilter
    ? classes.filter((c) => c.cycle === cycleFilter)
    : classes

  const groupedClasses = filteredClasses.reduce((acc, classe) => {
    if (!acc[classe.cycle]) {
      acc[classe.cycle] = []
    }
    acc[classe.cycle].push(classe)
    return acc
  }, {} as Record<string, Classe[]>)

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Classes</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle classe
        </button>
      </div>

      {/* Filtres */}
      <div className="card mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setCycleFilter('')}
            className={`px-4 py-2 rounded-lg ${
              cycleFilter === '' ? 'bg-primary-600 text-white' : 'bg-gray-200'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setCycleFilter('Primaire')}
            className={`px-4 py-2 rounded-lg ${
              cycleFilter === 'Primaire' ? 'bg-primary-600 text-white' : 'bg-gray-200'
            }`}
          >
            Primaire
          </button>
          <button
            onClick={() => setCycleFilter('Collège')}
            className={`px-4 py-2 rounded-lg ${
              cycleFilter === 'Collège' ? 'bg-primary-600 text-white' : 'bg-gray-200'
            }`}
          >
            Collège
          </button>
          <button
            onClick={() => setCycleFilter('Lycée')}
            className={`px-4 py-2 rounded-lg ${
              cycleFilter === 'Lycée' ? 'bg-primary-600 text-white' : 'bg-gray-200'
            }`}
          >
            Lycée
          </button>
        </div>
      </div>

      {/* Classes par cycle */}
      {Object.entries(groupedClasses).map(([cycle, classesList]) => (
        <div key={cycle} className="mb-8">
          <h2 className="text-2xl font-bold mb-4">{cycle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classesList.map((classe) => (
              <div key={classe.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{classe.nom}</h3>
                    <p className="text-sm text-gray-600">{classe.niveau}</p>
                    {classe.section && (
                      <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded mt-1 inline-block">
                        Section {classe.section}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/classes/${classe.id}`}
                      className="p-1 text-primary-600 hover:bg-primary-100 rounded transition-colors"
                      title="Voir détails"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={() => handleEdit(classe)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ show: true, id: classe.id, nom: classe.nom })}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Effectif</span>
                    <span className="font-medium">
                      {classe.effectifActuel || 0}/{classe.effectifMax}
                    </span>
                  </div>
                  {classe.enseignantPrincipal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Enseignant</span>
                      <span className="font-medium">
                        {classe.enseignantPrincipal.prenom} {classe.enseignantPrincipal.nom}
                      </span>
                    </div>
                  )}
                  {classe.salle && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Salle</span>
                      <span className="font-medium">{classe.salle}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm">
                    <span className="text-gray-600">Frais mensuels: </span>
                    <span className="font-bold text-primary-600">
                      {classe.fraisScolarite.montantMensuel.toLocaleString()} {classe.fraisScolarite.devise}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal pour ajouter/modifier une classe */}
      <ClasseFormModal
        isOpen={showAddModal}
        onClose={handleModalClose}
        onSuccess={loadClasses}
        classe={classeToEdit}
      />

      {/* Dialog de confirmation de suppression */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Supprimer la classe"
        message={`Êtes-vous sûr de vouloir supprimer la classe "${deleteConfirm.nom}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={() => handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ show: false, id: '', nom: '' })}
        variant="danger"
      />
    </div>
  )
}
