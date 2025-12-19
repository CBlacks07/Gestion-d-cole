import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Save } from 'lucide-react'

interface NoteFormClasseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Eleve {
  id: string
  matricule: string
  nom: string
  prenom: string
  note: string
  commentaire: string
}

export default function NoteFormClasseModal({ isOpen, onClose, onSuccess }: NoteFormClasseModalProps) {
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState<any[]>([])
  const [matieres, setMatieres] = useState<any[]>([])
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [anneeActive, setAnneeActive] = useState<any>(null)
  const [formData, setFormData] = useState({
    classeId: '',
    matiereId: '',
    typeEvaluation: 'Devoir',
    periode: '1er Trimestre',
    noteMax: '20',
    dateEvaluation: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [classesRes, matieresRes, anneeRes] = await Promise.all([
        api.get('/classes'),
        api.get('/matieres'),
        api.get('/annees/active')
      ])

      setClasses(classesRes.data)
      setMatieres(matieresRes.data)
      setAnneeActive(anneeRes.data)
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    }
  }

  const loadElevesClasse = async (classeId: string) => {
    try {
      setLoading(true)
      const response = await api.get(`/eleves`, {
        params: { classe: classeId }
      })

      // Mapper les élèves avec des champs vides pour les notes
      const elevesData = response.data
        .filter((e: any) => e.statut === 'ACTIF' || e.statut === 'actif')
        .map((e: any) => ({
          id: e.id,
          matricule: e.matricule,
          nom: e.nom,
          prenom: e.prenom,
          note: '',
          commentaire: ''
        }))

      setEleves(elevesData)
    } catch (error) {
      console.error('Erreur lors du chargement des élèves', error)
      setEleves([])
    } finally {
      setLoading(false)
    }
  }

  const handleClasseChange = (classeId: string) => {
    setFormData(prev => ({ ...prev, classeId }))
    if (classeId) {
      loadElevesClasse(classeId)
    } else {
      setEleves([])
    }
  }

  const handleNoteChange = (index: number, field: string, value: string) => {
    const newEleves = [...eleves]
    newEleves[index] = { ...newEleves[index], [field]: value }
    setEleves(newEleves)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Filtrer uniquement les élèves avec des notes saisies
      const notesToSave = eleves.filter(e => e.note && e.note.trim() !== '')

      if (notesToSave.length === 0) {
        alert('Veuillez saisir au moins une note')
        setLoading(false)
        return
      }

      if (!formData.matiereId) {
        alert('Veuillez sélectionner une matière')
        setLoading(false)
        return
      }

      // Créer les notes en parallèle
      const promises = notesToSave.map(eleve => {
        const data = {
          eleveId: eleve.id,
          matiereId: formData.matiereId,
          classeId: formData.classeId,
          typeEvaluation: formData.typeEvaluation,
          periode: formData.periode,
          note: parseFloat(eleve.note),
          noteMax: parseFloat(formData.noteMax),
          coefficient: 1,
          commentaire: eleve.commentaire || undefined,
          dateEvaluation: formData.dateEvaluation,
          anneeScolaire: anneeActive?.annee
        }
        return api.post('/notes', data)
      })

      await Promise.all(promises)

      alert(`${notesToSave.length} note(s) enregistrée(s) avec succès`)
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
      classeId: '',
      matiereId: '',
      typeEvaluation: 'Devoir',
      periode: '1er Trimestre',
      noteMax: '20',
      dateEvaluation: new Date().toISOString().split('T')[0]
    })
    setEleves([])
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saisir les notes par classe" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations générales */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations générales</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Année scolaire
              </label>
              <input
                type="text"
                value={anneeActive?.annee || ''}
                disabled
                className="input bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Classe <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.classeId}
                onChange={(e) => handleClasseChange(e.target.value)}
                required
                className="input"
              >
                <option value="">Sélectionner une classe</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nom} - {classe.cycle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matière <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.matiereId}
                onChange={(e) => setFormData(prev => ({ ...prev, matiereId: e.target.value }))}
                required
                className="input"
                disabled={!formData.classeId}
              >
                <option value="">Sélectionner une matière</option>
                {matieres.map((matiere) => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.nom} ({matiere.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'évaluation
              </label>
              <select
                value={formData.typeEvaluation}
                onChange={(e) => setFormData(prev => ({ ...prev, typeEvaluation: e.target.value }))}
                className="input"
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
                Période
              </label>
              <select
                value={formData.periode}
                onChange={(e) => setFormData(prev => ({ ...prev, periode: e.target.value }))}
                className="input"
              >
                <option value="1er Trimestre">1er Trimestre</option>
                <option value="2ème Trimestre">2ème Trimestre</option>
                <option value="3ème Trimestre">3ème Trimestre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note maximale
              </label>
              <input
                type="number"
                value={formData.noteMax}
                onChange={(e) => setFormData(prev => ({ ...prev, noteMax: e.target.value }))}
                className="input"
                min="1"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'évaluation
              </label>
              <input
                type="date"
                value={formData.dateEvaluation}
                onChange={(e) => setFormData(prev => ({ ...prev, dateEvaluation: e.target.value }))}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Liste des élèves */}
        {formData.classeId && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Notes des élèves ({eleves.length} élève{eleves.length > 1 ? 's' : ''})
            </h3>

            {loading ? (
              <div className="text-center py-8">Chargement des élèves...</div>
            ) : eleves.length > 0 ? (
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Matricule
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Nom et Prénom
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase">
                        Note /{formData.noteMax}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                        Commentaire
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {eleves.map((eleve, index) => (
                      <tr key={eleve.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{eleve.matricule}</td>
                        <td className="px-4 py-2 text-sm font-medium">
                          {eleve.nom} {eleve.prenom}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={eleve.note}
                            onChange={(e) => handleNoteChange(index, 'note', e.target.value)}
                            className="input text-center w-20"
                            min="0"
                            max={formData.noteMax}
                            step="0.25"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={eleve.commentaire}
                            onChange={(e) => handleNoteChange(index, 'commentaire', e.target.value)}
                            className="input w-full"
                            placeholder="Optionnel"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucun élève actif dans cette classe
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary flex items-center gap-2"
            disabled={loading || !formData.classeId || eleves.length === 0}
          >
            <Save className="h-4 w-4" />
            {loading ? 'Enregistrement...' : 'Enregistrer les notes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
