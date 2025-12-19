import { useEffect, useState } from 'react'
import api from '../services/api'
import { Calendar, BookOpen, Plus, CheckCircle, Edit2, Trash2, X } from 'lucide-react'

export default function Configuration() {
  const [annees, setAnnees] = useState<any[]>([])
  const [matieres, setMatieres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewAnnee, setShowNewAnnee] = useState(false)
  const [showMatiereModal, setShowMatiereModal] = useState(false)
  const [editingMatiere, setEditingMatiere] = useState<any>(null)

  const [newAnnee, setNewAnnee] = useState({
    annee: '',
    date_debut: '',
    date_fin: ''
  })

  const [matiereForm, setMatiereForm] = useState({
    nom: '',
    code: '',
    description: '',
    coefficient: 1,
    cycles: [] as string[],
    niveaux: [] as string[],
    couleur: '#3B82F6'
  })

  const COULEURS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#14B8A6', '#6366F1', '#F97316'
  ]

  const CYCLES = ['PRIMAIRE', 'COLLEGE', 'LYCEE']
  const NIVEAUX_PRIMAIRE = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2']
  const NIVEAUX_COLLEGE = ['SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME']
  const NIVEAUX_LYCEE = ['SECONDE', 'PREMIERE', 'TERMINALE']

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

  const openMatiereModal = (matiere?: any) => {
    if (matiere) {
      setEditingMatiere(matiere)
      // S'assurer que cycles et niveaux sont des tableaux
      const cycles = Array.isArray(matiere.cycles) ? matiere.cycles : []
      const niveaux = Array.isArray(matiere.niveaux) ? matiere.niveaux : []

      setMatiereForm({
        nom: matiere.nom,
        code: matiere.code,
        description: matiere.description || '',
        coefficient: matiere.coefficient,
        cycles: cycles,
        niveaux: niveaux,
        couleur: matiere.couleur || '#3B82F6'
      })
    } else {
      setEditingMatiere(null)
      setMatiereForm({
        nom: '',
        code: '',
        description: '',
        coefficient: 1,
        cycles: [],
        niveaux: [],
        couleur: '#3B82F6'
      })
    }
    setShowMatiereModal(true)
  }

  const closeMatiereModal = () => {
    setShowMatiereModal(false)
    setEditingMatiere(null)
  }

  const handleSaveMatiere = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMatiere) {
        await api.put(`/matieres/${editingMatiere.id}`, matiereForm)
      } else {
        await api.post('/matieres', matiereForm)
      }
      await loadData()
      closeMatiereModal()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de l\'enregistrement')
    }
  }

  const handleDeleteMatiere = async (id: string, nom: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer la matière "${nom}" ?`)) {
      return
    }
    try {
      await api.delete(`/matieres/${id}`)
      await loadData()
    } catch (error) {
      alert('Erreur lors de la suppression')
    }
  }

  const toggleCycle = (cycle: string) => {
    if (matiereForm.cycles.includes(cycle)) {
      setMatiereForm({
        ...matiereForm,
        cycles: matiereForm.cycles.filter(c => c !== cycle)
      })
    } else {
      setMatiereForm({
        ...matiereForm,
        cycles: [...matiereForm.cycles, cycle]
      })
    }
  }

  const toggleNiveau = (niveau: string) => {
    if (matiereForm.niveaux.includes(niveau)) {
      setMatiereForm({
        ...matiereForm,
        niveaux: matiereForm.niveaux.filter(n => n !== niveau)
      })
    } else {
      setMatiereForm({
        ...matiereForm,
        niveaux: [...matiereForm.niveaux, niveau]
      })
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
          <button
            onClick={() => openMatiereModal()}
            className="btn btn-primary btn-sm flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle matière
          </button>
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
                className="p-3 border rounded-lg group hover:shadow-md transition-shadow"
                style={{ borderLeftColor: matiere.couleur, borderLeftWidth: '4px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{matiere.nom}</h4>
                    <p className="text-sm text-gray-600">
                      Code: {matiere.code} | Coef: {matiere.coefficient}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openMatiereModal(matiere)}
                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                      title="Modifier"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMatiere(matiere.id, matiere.nom)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
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
                className="p-3 border rounded-lg group hover:shadow-md transition-shadow"
                style={{ borderLeftColor: matiere.couleur, borderLeftWidth: '4px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{matiere.nom}</h4>
                    <p className="text-sm text-gray-600">
                      Code: {matiere.code} | Coef: {matiere.coefficient}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openMatiereModal(matiere)}
                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                      title="Modifier"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMatiere(matiere.id, matiere.nom)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
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
                className="p-3 border rounded-lg group hover:shadow-md transition-shadow"
                style={{ borderLeftColor: matiere.couleur, borderLeftWidth: '4px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{matiere.nom}</h4>
                    <p className="text-sm text-gray-600">
                      Code: {matiere.code} | Coef: {matiere.coefficient}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openMatiereModal(matiere)}
                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                      title="Modifier"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMatiere(matiere.id, matiere.nom)}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Matière */}
      {showMatiereModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingMatiere ? 'Modifier la matière' : 'Nouvelle matière'}
                </h3>
                <button
                  onClick={closeMatiereModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSaveMatiere} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={matiereForm.nom}
                      onChange={(e) => setMatiereForm({ ...matiereForm, nom: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={matiereForm.code}
                      onChange={(e) => setMatiereForm({ ...matiereForm, code: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    value={matiereForm.description}
                    onChange={(e) => setMatiereForm({ ...matiereForm, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coefficient
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="input"
                      value={matiereForm.coefficient}
                      onChange={(e) => setMatiereForm({ ...matiereForm, coefficient: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Couleur
                    </label>
                    <div className="flex gap-2">
                      {COULEURS.map((couleur) => (
                        <button
                          key={couleur}
                          type="button"
                          className={`w-8 h-8 rounded border-2 ${
                            matiereForm.couleur === couleur ? 'border-gray-900' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: couleur }}
                          onClick={() => setMatiereForm({ ...matiereForm, couleur })}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cycles
                  </label>
                  <div className="flex gap-3">
                    {CYCLES.map((cycle) => (
                      <label key={cycle} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={matiereForm.cycles.includes(cycle)}
                          onChange={() => toggleCycle(cycle)}
                          className="mr-2"
                        />
                        {cycle}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Niveaux
                  </label>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Primaire:</p>
                      <div className="flex flex-wrap gap-2">
                        {NIVEAUX_PRIMAIRE.map((niveau) => (
                          <label key={niveau} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={matiereForm.niveaux.includes(niveau)}
                              onChange={() => toggleNiveau(niveau)}
                              className="mr-1"
                            />
                            {niveau}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Collège:</p>
                      <div className="flex flex-wrap gap-2">
                        {NIVEAUX_COLLEGE.map((niveau) => (
                          <label key={niveau} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={matiereForm.niveaux.includes(niveau)}
                              onChange={() => toggleNiveau(niveau)}
                              className="mr-1"
                            />
                            {niveau}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Lycée:</p>
                      <div className="flex flex-wrap gap-2">
                        {NIVEAUX_LYCEE.map((niveau) => (
                          <label key={niveau} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={matiereForm.niveaux.includes(niveau)}
                              onChange={() => toggleNiveau(niveau)}
                              className="mr-1"
                            />
                            {niveau}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeMatiereModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    {editingMatiere ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
