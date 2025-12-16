import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { Users } from 'lucide-react'

export default function ClasseDetail() {
  const { id } = useParams()
  const [classe, setClasse] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClasse()
  }, [id])

  const loadClasse = async () => {
    try {
      const response = await api.get(`/classes/${id}`)
      setClasse(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement de la classe', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!classe) {
    return <div className="text-center py-12">Classe non trouvée</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{classe.nom}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-sm text-gray-600">Cycle</p>
          <p className="text-2xl font-bold">{classe.cycle}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Niveau</p>
          <p className="text-2xl font-bold">{classe.niveau}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Effectif</p>
          <p className="text-2xl font-bold">
            {classe.effectifActuel}/{classe.effectifMax}
          </p>
        </div>
      </div>

      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Informations</h2>
        <div className="grid grid-cols-2 gap-4">
          {classe.enseignantPrincipal && (
            <div>
              <p className="text-sm text-gray-600">Enseignant principal</p>
              <p className="font-medium">
                {classe.enseignantPrincipal.prenom} {classe.enseignantPrincipal.nom}
              </p>
            </div>
          )}
          {classe.salle && (
            <div>
              <p className="text-sm text-gray-600">Salle</p>
              <p className="font-medium">{classe.salle}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Année scolaire</p>
            <p className="font-medium">{classe.anneeScolaire}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Liste des élèves</h2>
          <div className="flex items-center">
            <Users className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-600">{classe.eleves?.length || 0} élèves</span>
          </div>
        </div>

        {classe.eleves && classe.eleves.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Matricule</th>
                  <th className="table-header">Nom</th>
                  <th className="table-header">Prénom</th>
                  <th className="table-header">Sexe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classe.eleves.map((eleve: any) => (
                  <tr key={eleve._id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{eleve.matricule}</td>
                    <td className="table-cell">{eleve.nom}</td>
                    <td className="table-cell">{eleve.prenom}</td>
                    <td className="table-cell">
                      {eleve.sexe === 'M' ? 'Garçon' : 'Fille'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Aucun élève dans cette classe</p>
        )}
      </div>
    </div>
  )
}
