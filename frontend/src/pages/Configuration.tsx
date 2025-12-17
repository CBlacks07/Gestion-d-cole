import { useEffect, useState } from 'react'
import api from '../services/api'
import { Calendar, BookOpen, Plus, CheckCircle } from 'lucide-react'

export default function Configuration() {
  const [annees, setAnnees] = useState<any[]>([])
  const [matieres, setMatieres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewAnnee, setShowNewAnnee] = useState(false)
  const [newAnnee, setNewAnnee] = useState({
    annee: '',
    date_debut: '',
    date_fin: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [anneesRes, matieresRes] = await Promise.all([
        api.get('/annees'),
        api.get('/matieres')
      ])
      setAnnees(anneesRes.data)
      setMatieres(matieresRes.data)
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnnee = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/annees', {
        ...newAnnee,
        active: false
      })
      await loadData()
      setNewAnnee({ annee: '', date_debut: '', date_fin: '' })
      setShowNewAnnee(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la création de l\'année')
    }
  }

  const handleActiverAnnee = async (id: string) => {
    if (!confirm('Voulez-vous activer cette année scolaire ? L\'année actuellement active sera désactivée.')) {
      return
    }
    try {
      await api.put(`/annees/${id}/activer`)
      await loadData()
    } catch (error) {
      alert('Erreur lors de l\'activation de l\'année')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  // Grouper les matières par cycle
  const matieresPrimaire = matieres.filter(m => m.cycles.includes('PRIMAIRE'))
  const matieresCollege = matieres.filter(m => m.cycles.includes('COLLEGE'))
  const matieresLycee = matieres.filter(m => m.cycles.includes('LYCEE'))

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Configuration</h1>

      {/* Années Scolaires */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Années Scolaires
          </h2>
          <button
            onClick={() => setShowNewAnnee(!showNewAnnee)}
            className="btn btn-primary btn-sm flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle année
          </button>
        </div>

        {showNewAnnee && (
          <form onSubmit={handleCreateAnnee} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Année (ex: 2025-2026)
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="2025-2026"
                  value={newAnnee.annee}
                  onChange={(e) => setNewAnnee({ ...newAnnee, annee: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date début
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={newAnnee.date_debut}
                  onChange={(e) => setNewAnnee({ ...newAnnee, date_debut: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date fin
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={newAnnee.date_fin}
                  onChange={(e) => setNewAnnee({ ...newAnnee, date_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary btn-sm">
                Créer
              </button>
              <button
                type="button"
                onClick={() => setShowNewAnnee(false)}
                className="btn btn-secondary btn-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {annees.map((annee) => (
            <div
              key={annee.id}
              className={`p-4 border rounded-lg flex items-center justify-between ${
                annee.active ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-4">
                {annee.active && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{annee.annee}</h3>
                  <p className="text-sm text-gray-600">
                    Du {new Date(annee.date_debut).toLocaleDateString('fr-FR')} au{' '}
                    {new Date(annee.date_fin).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              {!annee.active && (
                <button
                  onClick={() => handleActiverAnnee(annee.id)}
                  className="btn btn-sm bg-green-600 hover:bg-green-700 text-white"
                >
                  Activer
                </button>
              )}
              {annee.active && (
                <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                  Année active
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Matières */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Matières ({matieres.length})
          </h2>
        </div>

        {/* Primaire */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Primaire ({matieresPrimaire.length} matières)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matieresPrimaire.map((matiere) => (
              <div
                key={matiere.id}
                className="p-3 border rounded-lg"
                style={{ borderLeftColor: matiere.couleur, borderLeftWidth: '4px' }}
              >
                <h4 className="font-semibold text-gray-900">{matiere.nom}</h4>
                <p className="text-sm text-gray-600">
                  Code: {matiere.code} | Coef: {matiere.coefficient}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Collège */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Collège ({matieresCollege.length} matières)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matieresCollege.map((matiere) => (
              <div
                key={matiere.id}
                className="p-3 border rounded-lg"
                style={{ borderLeftColor: matiere.couleur, borderLeftWidth: '4px' }}
              >
                <h4 className="font-semibold text-gray-900">{matiere.nom}</h4>
                <p className="text-sm text-gray-600">
                  Code: {matiere.code} | Coef: {matiere.coefficient}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Lycée */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Lycée ({matieresLycee.length} matières)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matieresLycee.map((matiere) => (
              <div
                key={matiere.id}
                className="p-3 border rounded-lg"
                style={{ borderLeftColor: matiere.couleur, borderLeftWidth: '4px' }}
              >
                <h4 className="font-semibold text-gray-900">{matiere.nom}</h4>
                <p className="text-sm text-gray-600">
                  Code: {matiere.code} | Coef: {matiere.coefficient}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
