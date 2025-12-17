import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { Users, Plus, Trash2, BookOpen } from 'lucide-react'

export default function ClasseDetail() {
  const { id } = useParams()
  const [classe, setClasse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [matieres, setMatieres] = useState<any[]>([])
  const [allMatieres, setAllMatieres] = useState<any[]>([])
  const [anneeActive, setAnneeActive] = useState<any>(null)
  const [showAddMatiere, setShowAddMatiere] = useState(false)
  const [newMatiere, setNewMatiere] = useState({
    matiere_id: '',
    coefficient: 1
  })

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const [classeRes, anneeRes] = await Promise.all([
        api.get(`/classes/${id}`),
        api.get('/annees/active')
      ])
      setClasse(classeRes.data)
      setAnneeActive(anneeRes.data)

      // Charger les matières de la classe
      await loadMatieresClasse(anneeRes.data.annee)

      // Charger toutes les matières disponibles
      const matieresRes = await api.get('/matieres')
      setAllMatieres(matieresRes.data)
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMatieresClasse = async (annee: string) => {
    try {
      const response = await api.get(`/classe-matieres/classe/${id}`, {
        params: { annee_scolaire: annee }
      })
      setMatieres(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des matières', error)
    }
  }

  const handleAddMatiere = async () => {
    if (!newMatiere.matiere_id) {
      alert('Veuillez sélectionner une matière')
      return
    }

    try {
      await api.post('/classe-matieres', {
        classe_id: id,
        matiere_id: newMatiere.matiere_id,
        coefficient: newMatiere.coefficient,
        annee_scolaire: anneeActive?.annee
      })

      await loadMatieresClasse(anneeActive?.annee)
      setNewMatiere({ matiere_id: '', coefficient: 1 })
      setShowAddMatiere(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de l\'ajout de la matière')
    }
  }

  const handleRemoveMatiere = async (matiereId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer cette matière de la classe ?')) {
      return
    }

    try {
      await api.delete(`/classe-matieres/${matiereId}`)
      await loadMatieresClasse(anneeActive?.annee)
    } catch (error) {
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!classe) {
    return <div className="text-center py-12">Classe non trouvée</div>
  }

  // Filtrer les matières déjà ajoutées
  const matieresDisponibles = allMatieres.filter(
    m => !matieres.some(cm => cm.matiere_id === m.id)
  )

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

      {/* Section Matières */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Matières de la classe
          </h2>
          <button
            onClick={() => setShowAddMatiere(!showAddMatiere)}
            className="btn btn-primary btn-sm flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter une matière
          </button>
        </div>

        {showAddMatiere && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <select
                  className="input"
                  value={newMatiere.matiere_id}
                  onChange={(e) => setNewMatiere({ ...newMatiere, matiere_id: e.target.value })}
                >
                  <option value="">Sélectionner une matière...</option>
                  {matieresDisponibles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  min="1"
                  className="input"
                  placeholder="Coefficient"
                  value={newMatiere.coefficient}
                  onChange={(e) => setNewMatiere({ ...newMatiere, coefficient: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleAddMatiere} className="btn btn-primary btn-sm">
                Ajouter
              </button>
              <button onClick={() => setShowAddMatiere(false)} className="btn btn-secondary btn-sm">
                Annuler
              </button>
            </div>
          </div>
        )}

        {matieres.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matieres.map((matiere) => (
              <div
                key={matiere.id}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                style={{ borderLeftColor: matiere.couleur, borderLeftWidth: '4px' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{matiere.nom}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Coefficient: <span className="font-medium">{matiere.coefficient}</span>
                    </p>
                    {matiere.enseignant_nom && (
                      <p className="text-sm text-gray-600 mt-1">
                        Enseignant: {matiere.enseignant_prenom} {matiere.enseignant_nom}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveMatiere(matiere.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Retirer de la classe"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">
            Aucune matière assignée à cette classe
          </p>
        )}
      </div>

      {/* Section Élèves */}
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
