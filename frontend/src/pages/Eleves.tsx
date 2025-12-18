import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Eleve } from '../types'
import { Plus, Search, Eye, Edit2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import EleveFormModal from '../components/EleveFormModal'

export default function Eleves() {
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null)

  useEffect(() => {
    loadEleves()
  }, [])

  const loadEleves = async () => {
    try {
      const response = await api.get('/eleves')

      // Mapper les données du backend (snake_case) vers le frontend (camelCase)
      const mappedEleves = response.data.map((data: any) => ({
        id: data.id,
        matricule: data.matricule,
        nom: data.nom,
        prenom: data.prenom,
        dateNaissance: data.date_naissance || data.dateNaissance,
        lieuNaissance: data.lieu_naissance || data.lieuNaissance,
        sexe: data.sexe,
        groupeSanguin: data.groupe_sanguin || data.groupeSanguin,
        statut: data.statut,
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
      console.error('Erreur lors du chargement des élèves', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to safely format dates
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

  const handleDelete = async (id: string, nom: string, prenom: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'élève ${nom} ${prenom} ?`)) {
      return
    }
    try {
      await api.delete(`/eleves/${id}`)
      await loadEleves()
    } catch (error) {
      alert('Erreur lors de la suppression de l\'élève')
    }
  }

  const filteredEleves = eleves.filter(
    (eleve) =>
      eleve.nom.toLowerCase().includes(search.toLowerCase()) ||
      eleve.prenom.toLowerCase().includes(search.toLowerCase()) ||
      eleve.matricule.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Élèves</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvel élève
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un élève (nom, prénom, matricule)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold">{eleves.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Garçons</p>
          <p className="text-2xl font-bold text-blue-600">
            {eleves.filter((e) => e.sexe === 'M').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Filles</p>
          <p className="text-2xl font-bold text-pink-600">
            {eleves.filter((e) => e.sexe === 'F').length}
          </p>
        </div>
      </div>

      {/* Liste des élèves */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Matricule</th>
                <th className="table-header">Nom</th>
                <th className="table-header">Prénom</th>
                <th className="table-header">Sexe</th>
                <th className="table-header">Date naissance</th>
                <th className="table-header">Classe</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEleves.map((eleve) => (
                <tr key={eleve.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{eleve.matricule}</td>
                  <td className="table-cell">{eleve.nom}</td>
                  <td className="table-cell">{eleve.prenom}</td>
                  <td className="table-cell">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        eleve.sexe === 'M'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-pink-100 text-pink-800'
                      }`}
                    >
                      {eleve.sexe === 'M' ? 'Garçon' : 'Fille'}
                    </span>
                  </td>
                  <td className="table-cell">
                    {formatDate(eleve.dateNaissance)}
                  </td>
                  <td className="table-cell">{eleve.classe?.nom || '-'}</td>
                  <td className="table-cell">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        eleve.statut === 'actif'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {eleve.statut}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/eleves/${eleve.id}`}
                        className="p-1 text-primary-600 hover:bg-primary-100 rounded transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="h-5 w-5" />
                      </Link>
                      <button
                        onClick={() => setEditingEleve(eleve)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(eleve.id, eleve.nom, eleve.prenom)}
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
        </div>
      </div>

      {/* Modal pour ajouter un élève */}
      <EleveFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadEleves}
      />

      {/* Modal pour modifier un élève */}
      <EleveFormModal
        isOpen={!!editingEleve}
        onClose={() => setEditingEleve(null)}
        onSuccess={() => {
          loadEleves()
          setEditingEleve(null)
        }}
        eleve={editingEleve}
      />
    </div>
  )
}
