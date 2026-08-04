import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve } from '../types'
import { useToast } from '../contexts/ToastContext'

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

const noteMaxFromCoefficient = (coefficient?: number) => {
  const coef = Number(coefficient)
  if (!Number.isFinite(coef) || coef <= 0) return 20
  return coef * 10
}

export default function NoteFormMultipleModal({ isOpen, onClose, onSuccess }: NoteFormMultipleModalProps) {
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingMatieres, setLoadingMatieres] = useState(false)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [anneeActive, setAnneeActive] = useState<string>('')
  const [formData, setFormData] = useState({
    eleveId: '',
    classeId: '',
    typeEvaluation: 'Devoir',
    periode: '1er Trimestre',
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
        api.get('/eleves', { params: { all: true } }),
        api.get('/annees/active')
      ])

      const elevesRaw = Array.isArray(elevesRes.data) ? elevesRes.data : (elevesRes.data?.data ?? [])
      const mappedEleves = elevesRaw
        .map((data: any) => ({
          id: data.id,
          matricule: data.matricule,
          nom: data.nom,
          prenom: data.prenom,
          statut: data.statut,
          classe: data.classe
            ? {
                id: data.classe.id,
                nom: data.classe.nom
              }
            : null
        }))
        .filter((e: any) => String(e.statut || '').toUpperCase() === 'ACTIF')
        .sort((a: any, b: any) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))

      setEleves(mappedEleves)
      setAnneeActive(anneeRes.data?.annee || '')
    } catch (error) {
      console.error('Erreur lors du chargement des donnees', error)
    }
  }

  const loadMatieresClasse = async (eleveId: string) => {
    try {
      setLoadingMatieres(true)

      if (!anneeActive) {
        setMatieres([])
        return
      }

      const eleve = eleves.find((e) => e.id === eleveId)
      const classeId = eleve?.classe?.id || ''

      if (!classeId) {
        setFormData((prev) => ({ ...prev, classeId: '' }))
        setMatieres([])
        return
      }

      setFormData((prev) => ({ ...prev, classeId }))

      const response = await api.get(`/classe-matieres/classe/${classeId}`, {
        params: { annee_scolaire: anneeActive }
      })

      const matieresData = response.data
        .map((row: any) => ({
          matiere_id: row.matiere_id,
          matiere_nom: row.nom,
          coefficient: row.coefficient || 1,
          note: '',
          commentaire: ''
        }))
        .sort((a: MatiereNote, b: MatiereNote) => a.matiere_nom.localeCompare(b.matiere_nom, 'fr'))

      setMatieres(matieresData)
    } catch (error) {
      console.error('Erreur lors du chargement des matieres', error)
      setMatieres([])
    } finally {
      setLoadingMatieres(false)
    }
  }

  const handleEleveChange = (eleveId: string) => {
    setFormData((prev) => ({ ...prev, eleveId, classeId: '' }))

    if (eleveId) {
      loadMatieresClasse(eleveId)
      return
    }

    setMatieres([])
  }

  const handleNoteChange = (index: number, field: string, value: string) => {
    const newMatieres = [...matieres]
    newMatieres[index] = { ...newMatieres[index], [field]: value }
    setMatieres(newMatieres)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!anneeActive) {
        toastError('Aucune année scolaire active')
        setLoading(false)
        return
      }

      const notesToSave = matieres.filter((m) => m.note && m.note.trim() !== '')

      if (notesToSave.length === 0) {
        toastError('Veuillez saisir au moins une note')
        setLoading(false)
        return
      }

      const promises = notesToSave.map((matiere) => {
        const noteMax = noteMaxFromCoefficient(matiere.coefficient)
        const data = {
          eleveId: formData.eleveId,
          matiereId: matiere.matiere_id,
          classeId: formData.classeId,
          typeEvaluation: formData.typeEvaluation,
          periode: formData.periode,
          note: parseFloat(matiere.note),
          noteMax,
          coefficient: matiere.coefficient,
          commentaire: matiere.commentaire || undefined,
          dateEvaluation: formData.dateEvaluation,
          anneeScolaire: anneeActive
        }

        return api.post('/notes', data)
      })

      await Promise.all(promises)

      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la creation des notes', error)
      toastError(error.response?.data?.message || 'Erreur lors de la création des notes')
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
      dateEvaluation: new Date().toISOString().split('T')[0]
    })
    setMatieres([])
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saisir les notes d'un élève" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Informations générales</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Année scolaire</label>
              <input type="text" className="input bg-gray-100" value={anneeActive || 'Chargement...'} disabled />
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
                <option value="2eme Trimestre">2eme Trimestre</option>
                <option value="3eme Trimestre">3eme Trimestre</option>
                <option value="1er Semestre">1er Semestre</option>
                <option value="2eme Semestre">2eme Semestre</option>
              </select>
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

        {formData.eleveId && (
          <div>
            <h3 className="text-lg font-display font-semibold text-gray-900 mb-4">
              Notes par matière {loadingMatieres && <span className="text-sm text-gray-500">(Chargement...)</span>}
            </h3>

            {matieres.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {loadingMatieres ? 'Chargement des matières...' : 'Aucune matière disponible pour cette classe'}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {matieres.map((matiere, index) => {
                  const noteMax = noteMaxFromCoefficient(matiere.coefficient)
                  return (
                    <div key={matiere.matiere_id} className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">
                        {matiere.matiere_nom}
                        <span className="ml-2 text-sm text-gray-500">(Coef. {matiere.coefficient}, /{noteMax})</span>
                      </h4>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-1">
                          <label className="block text-xs text-gray-600 mb-1">Note /{noteMax}</label>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max={noteMax}
                            className="input"
                            placeholder="15"
                            value={matiere.note}
                            onChange={(e) => handleNoteChange(index, 'note', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs text-gray-600 mb-1">Commentaire</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Optionnel"
                            value={matiere.commentaire}
                            onChange={(e) => handleNoteChange(index, 'commentaire', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
