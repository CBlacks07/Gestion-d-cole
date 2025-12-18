import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve } from '../types'
import { Plus, Trash2 } from 'lucide-react'

interface NoteFormMultipleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface MatiereNote {
  matiere_id: string
  matiere_nom: string
  coefficient: number
  note: string
  commentaire: string
}

export default function NoteFormMultipleModal({ isOpen, onClose, onSuccess }: NoteFormMultipleModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingMatieres, setLoadingMatieres] = useState(false)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [anneeActive, setAnneeActive] = useState<any>(null)
  const [formData, setFormData] = useState({
    eleveId: '',
    classeId: '',
    typeEvaluation: 'Devoir',
    periode: '1er Trimestre',
    noteMax: '20',
    dateEvaluation: new Date().toISOString().split('T')[0]
  })
  const [matieres, setMatieres] = useState<MatiereNote[]>([])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [elevesRes, anneeRes] = await Promise.all([
        api.get('/eleves'),
        api.get('/annees/active')
      ])

      // Mapper les élèves (backend snake_case -> frontend camelCase)
      const mappedEleves = elevesRes.data
        .map((data: any) => ({
          id: data.id,
          matricule: data.matricule,
          nom: data.nom,
          prenom: data.prenom,
          statut: data.statut,
          classe: data.classe ? {
            id: data.classe.id,
            nom: data.classe.nom
          } : null
        }))
        .filter((e: any) => e.statut === 'ACTIF' || e.statut === 'actif')

      setEleves(mappedEleves)
      setAnneeActive(anneeRes.data)
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    }
  }

  const loadMatieresClasse = async (eleveId: string) => {
    try {
      setLoadingMatieres(true)
      const eleve = eleves.find(e => e._id === eleveId)
      if (!eleve || !eleve.classe) {
        setMatieres([])
        return
      }

      setFormData(prev => ({ ...prev, classeId: eleve.classe.id }))

      const response = await api.get(`/classe-matieres/classe/${eleve.classe.id}`, {
        params: { annee_scolaire: anneeActive?.annee }
      })

      const matieresData = response.data.map((m: any) => ({
        matiere_id: m.matiere_id,
        matiere_nom: m.nom,
        coefficient: m.coefficient,
        note: '',
        commentaire: ''
      }))

      setMatieres(matieresData)
    } catch (error) {
      console.error('Erreur lors du chargement des matières', error)
      setMatieres([])
    } finally {
      setLoadingMatieres(false)
    }
  }

  const handleEleveChange = (eleveId: string) => {
    setFormData(prev => ({ ...prev, eleveId }))
    if (eleveId) {
      loadMatieresClasse(eleveId)
    } else {
      setMatieres([])
    }
  }

  const handleNoteChange = (index: number, field: string, value: string) => {
    const newMatieres = [...matieres]
    newMatieres[index] = { ...newMatieres[index], [field]: value }
    setMatieres(newMatieres)
  }

  const addMatiere = () => {
    setMatieres([...matieres, {
      matiere_id: '',
      matiere_nom: '',
      coefficient: 1,
      note: '',
      commentaire: ''
    }])
  }

  const removeMatiere = (index: number) => {
    const newMatieres = matieres.filter((_, i) => i !== index)
    setMatieres(newMatieres)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Filtrer uniquement les notes saisies (non vides)
      const notesToSave = matieres.filter(m => m.note && m.note.trim() !== '')

      if (notesToSave.length === 0) {
        alert('Veuillez saisir au moins une note')
        setLoading(false)
        return
      }

      // Créer les notes en parallèle
      const promises = notesToSave.map(matiere => {
        const data = {
          eleve: formData.eleveId,
          matiere: matiere.matiere_id,
          classe: formData.classeId,
          typeEvaluation: formData.typeEvaluation,
          periode: formData.periode,
          note: parseFloat(matiere.note),
          noteMax: parseFloat(formData.noteMax),
          coefficient: matiere.coefficient,
          commentaire: matiere.commentaire || undefined,
          dateEvaluation: formData.dateEvaluation,
          anneeScolaire: anneeActive?.annee
        }
        return api.post('/notes', data)
      })

      await Promise.all(promises)

      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la création des notes', error)
      alert(error.response?.data?.message || 'Erreur lors de la création des notes')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      eleveId: '',
      classeId: '',
      typeEvaluation: 'Devoir',
      periode: '1er Trimestre',
      noteMax: '20',
      dateEvaluation: new Date().toISOString().split('T')[0]
    })
    setMatieres([])
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saisir les notes d'un élève" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations générales */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations générales</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Année scolaire
              </label>
              <input
                type="text"
                className="input bg-gray-100"
                value={anneeActive?.annee || 'Chargement...'}
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Élève <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={formData.eleveId}
                onChange={(e) => handleEleveChange(e.target.value)}
              >
                <option value="">Sélectionner un élève...</option>
                {eleves.map((eleve) => (
                  <option key={eleve.id} value={eleve.id}>
                    {eleve.prenom} {eleve.nom} - {eleve.classe?.nom || 'Sans classe'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'évaluation <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.typeEvaluation}
                onChange={(e) => setFormData({ ...formData, typeEvaluation: e.target.value })}
              >
                <option value="Devoir">Devoir</option>
                <option value="Composition">Composition</option>
                <option value="Interrogation">Interrogation</option>
                <option value="TP">TP</option>
                <option value="Examen">Examen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Période <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.periode}
                onChange={(e) => setFormData({ ...formData, periode: e.target.value })}
              >
                <option value="1er Trimestre">1er Trimestre</option>
                <option value="2ème Trimestre">2ème Trimestre</option>
                <option value="3ème Trimestre">3ème Trimestre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note maximale <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                className="input"
                value={formData.noteMax}
                onChange={(e) => setFormData({ ...formData, noteMax: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'évaluation <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.dateEvaluation}
                onChange={(e) => setFormData({ ...formData, dateEvaluation: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Matières et notes */}
        {formData.eleveId && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Notes par matière {loadingMatieres && <span className="text-sm text-gray-500">(Chargement...)</span>}
              </h3>
              <button
                type="button"
                onClick={addMatiere}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Ajouter une matière
              </button>
            </div>

            {matieres.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {loadingMatieres ? 'Chargement des matières...' : 'Aucune matière disponible pour cette classe'}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {matieres.map((matiere, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900">
                        {matiere.matiere_nom || 'Nouvelle matière'}
                        <span className="ml-2 text-sm text-gray-500">
                          (Coef. {matiere.coefficient})
                        </span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => removeMatiere(index)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <label className="block text-xs text-gray-600 mb-1">
                          Note
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max={formData.noteMax}
                          className="input"
                          placeholder="15"
                          value={matiere.note}
                          onChange={(e) => handleNoteChange(index, 'note', e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-600 mb-1">
                          Commentaire
                        </label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Très bien, continue ainsi..."
                          value={matiere.commentaire}
                          onChange={(e) => handleNoteChange(index, 'commentaire', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => {
              onClose()
              resetForm()
            }}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50"
            disabled={loading || !formData.eleveId || matieres.length === 0}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer les notes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
