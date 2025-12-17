import { useEffect, useState } from 'react'
import api from '../services/api'
import { Enseignant } from '../types'
import { Plus, Search } from 'lucide-react'
import EnseignantFormModal from '../components/EnseignantFormModal'

export default function Enseignants() {
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEnseignants.map((ens) => (
                <tr key={ens._id} className="hover:bg-gray-50">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pour ajouter un enseignant */}
      <EnseignantFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadEnseignants}
      />
    </div>
  )
}
