import { useEffect, useState } from 'react'
import api from '../services/api'
import { Enseignant } from '../types'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import EnseignantFormModal from '../components/EnseignantFormModal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Enseignants() {
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEnseignant, setEditingEnseignant] = useState<Enseignant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: string, nom: string}>({
    show: false,
    id: '',
    nom: ''
  })

  useEffect(() => {
    loadEnseignants()
  }, [])

  const loadEnseignants = async () => {
    try {
      const response = await api.get('/enseignants')
      setEnseignants(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des enseignants', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/enseignants/${id}`)
      await loadEnseignants()
      setDeleteConfirm({ show: false, id: '', nom: '' })
    } catch (error: any) {
      console.error('Erreur lors de la suppression', error)
      alert(error.response?.data?.message || 'Erreur lors de la suppression de l\'enseignant')
    }
  }

  const filteredEnseignants = enseignants.filter(
    (ens) =>
      ens.nom.toLowerCase().includes(search.toLowerCase()) ||
      ens.prenom.toLowerCase().includes(search.toLowerCase()) ||
      ens.matricule.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Enseignants</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvel enseignant
        </button>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un enseignant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Matricule</th>
                <th className="table-header">Nom</th>
                <th className="table-header">Prénom</th>
                <th className="table-header">Téléphone</th>
                <th className="table-header">Email</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Type contrat</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEnseignants.map((ens) => (
                <tr key={ens._id || ens.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{ens.matricule}</td>
                  <td className="table-cell">{ens.nom}</td>
                  <td className="table-cell">{ens.prenom}</td>
                  <td className="table-cell">{ens.telephone}</td>
                  <td className="table-cell">{ens.email || '-'}</td>
                  <td className="table-cell">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ens.statut === 'actif'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {ens.statut}
                    </span>
                  </td>
                  <td className="table-cell">{ens.typeContrat}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingEnseignant(ens)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({
                          show: true,
                          id: ens.id || ens._id,
                          nom: `${ens.prenom} ${ens.nom}`
                        })}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEnseignants.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Aucun enseignant trouvé
            </div>
          )}
        </div>
      </div>

      {/* Modal pour ajouter un enseignant */}
      <EnseignantFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadEnseignants}
      />

      {/* Modal pour modifier un enseignant */}
      <EnseignantFormModal
        isOpen={!!editingEnseignant}
        onClose={() => setEditingEnseignant(null)}
        onSuccess={() => {
          loadEnseignants()
          setEditingEnseignant(null)
        }}
        enseignant={editingEnseignant}
      />

      {/* Dialogue de confirmation de suppression */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: '', nom: '' })}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        title="Supprimer l'enseignant"
        message={`Êtes-vous sûr de vouloir supprimer ${deleteConfirm.nom} ? Cette action est irréversible.`}
        confirmText="Supprimer"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
      />
    </div>
  )
}
