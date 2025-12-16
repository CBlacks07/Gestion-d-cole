import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Eleve } from '../types'
import { Plus, Search, Eye } from 'lucide-react'
import { format } from 'date-fns'

export default function Eleves() {
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadEleves()
  }, [])

  const loadEleves = async () => {
    try {
      const response = await api.get('/eleves')
      setEleves(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des élèves', error)
    } finally {
      setLoading(false)
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
        <button className="btn btn-primary flex items-center">
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
                <tr key={eleve._id} className="hover:bg-gray-50">
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
                    {format(new Date(eleve.dateNaissance), 'dd/MM/yyyy')}
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
                    <Link
                      to={`/eleves/${eleve._id}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
