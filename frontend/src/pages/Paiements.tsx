import { useEffect, useState } from 'react'
import api from '../services/api'
import { Paiement } from '../types'
import { Plus, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import PaiementFormModal from '../components/PaiementFormModal'

export default function Paiements() {
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadPaiements()
    loadStats()
  }, [])

  const loadPaiements = async () => {
    try {
      const response = await api.get('/paiements')
      setPaiements(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des paiements', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await api.get('/paiements/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Paiements</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouveau paiement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-r from-primary-500 to-primary-700 text-white">
          <div className="flex items-center">
            <DollarSign className="h-12 w-12 mr-4" />
            <div>
              <p className="text-sm text-primary-100">Recettes totales</p>
              <p className="text-3xl font-bold">
                {stats?.montantTotal.toLocaleString() || 0}
              </p>
              <p className="text-sm text-primary-100">{stats?.devise}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="text-sm text-gray-600">Nombre de paiements</p>
          <p className="text-3xl font-bold">{stats?.totalPaiements || 0}</p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-600">Taux de paiement</p>
          <p className="text-3xl font-bold text-green-600">---%</p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Élève</th>
                <th className="table-header">Type</th>
                <th className="table-header">Montant</th>
                <th className="table-header">Mode</th>
                <th className="table-header">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paiements.map((paiement) => (
                <tr key={paiement._id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    {format(new Date(paiement.datePaiement), 'dd/MM/yyyy')}
                  </td>
                  <td className="table-cell">
                    {paiement.eleve.prenom} {paiement.eleve.nom}
                  </td>
                  <td className="table-cell">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {paiement.typePaiement}
                    </span>
                  </td>
                  <td className="table-cell font-bold">
                    {paiement.montant.toLocaleString()} {paiement.devise}
                  </td>
                  <td className="table-cell">{paiement.modePaiement}</td>
                  <td className="table-cell">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        paiement.statut === 'Validé'
                          ? 'bg-green-100 text-green-800'
                          : paiement.statut === 'En attente'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {paiement.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pour ajouter un paiement */}
      <PaiementFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          loadPaiements()
          loadStats()
        }}
      />
    </div>
  )
}
