import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve, Classe } from '../types'
import { useToast } from '../contexts/ToastContext'

interface NoteFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface MatiereClasse {
  id: string
  nom: string
  code: string
  coefficient: number
}

const noteMaxFromCoefficient = (coefficient?: number) => {
  const coef = Number(coefficient)
  if (!Number.isFinite(coef) || coef <= 0) return 20
  return coef * 10
}

export default function NoteFormModal({ isOpen, onClose, onSuccess }: NoteFormModalProps) {
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [matieres, setMatieres] = useState<MatiereClasse[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [anneeActive, setAnneeActive] = useState<string>('')
  const [formData, setFormData] = useState({
    eleveId: '',
    matiereId: '',
    classeId: '',
    typeEvaluation: 'Devoir',
    periode: '1er Trimestre',
    note: '',
    coefficient: '1',
    commentaire: '',
    dateEvaluation: new Date().toISOString().split('T')[0]
  })
  const selectedMatiere = matieres.find(item => item.id === formData.matiereId)
  const calculatedNoteMax = noteMaxFromCoefficient(Number(formData.coefficient || selectedMatiere?.coefficient || 1))

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [elevesRes, classesRes, anneeRes] = await Promise.all([
        api.get('/eleves', { params: { all: true } }),
        api.get('/classes'),
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
          classe: data.classe ? {
            id: data.classe.id,
            nom: data.classe.nom
          } : null
        }))
        .filter((e: any) => String(e.statut || '').toUpperCase() === 'ACTIF')
        .sort((a: any, b: any) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))

      const mappedClasses = classesRes.data
        .map((data: any) => ({
          id: data.id,
          nom: data.nom,
          cycle: data.cycle
        }))
        .sort((a: any, b: any) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))

      setEleves(mappedEleves)
      setClasses(mappedClasses)
      setAnneeActive(anneeRes.data?.annee || '')
      setMatieres([])
    } catch (error) {
      console.error('Erreur lors du chargement des donnees', error)
    }
  }

  const loadMatieresClasse = async (classeId: string) => {
    if (!classeId || !anneeActive) {
      setMatieres([])
      return
    }

    try {
      const response = await api.get(`/classe-matieres/classe/${classeId}`, {
        params: { annee_scolaire: anneeActive }
      })

      const mapped = response.data
        .map((row: any) => ({
          id: row.matiere_id,
          nom: row.nom,
          code: row.code,
          coefficient: row.coefficient
        }))
        .sort((a: MatiereClasse, b: MatiereClasse) => a.nom.localeCompare(b.nom, 'fr'))

      setMatieres(mapped)
    } catch (error) {
      console.error('Erreur lors du chargement des matieres de la classe', error)
      setMatieres([])
    }
  }

  const handleClasseChange = (classeId: string) => {
    setFormData(prev => ({ ...prev, classeId, matiereId: '', coefficient: '1' }))
    loadMatieresClasse(classeId)
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

      const data = {
        eleveId: formData.eleveId,
        matiereId: formData.matiereId,
        classeId: formData.classeId,
        typeEvaluation: formData.typeEvaluation,
        periode: formData.periode,
        note: parseFloat(formData.note),
        noteMax: calculatedNoteMax,
        coefficient: parseFloat(formData.coefficient),
        commentaire: formData.commentaire || undefined,
        dateEvaluation: formData.dateEvaluation,
        anneeScolaire: anneeActive
      }

      await api.post('/notes', data)
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la creation de la note', error)
      toastError(error.response?.data?.message || 'Erreur lors de la création de la note')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      eleveId: '',
      matiereId: '',
      classeId: '',
      typeEvaluation: 'Devoir',
      periode: '1er Trimestre',
      note: '',
      coefficient: '1',
      commentaire: '',
      dateEvaluation: new Date().toISOString().split('T')[0]
    })
    setMatieres([])
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une nouvelle note" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Informations de base</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Élève <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={formData.eleveId}
                onChange={(e) => {
                  const eleveId = e.target.value
                  const eleve = eleves.find(item => item.id === eleveId)
                  const classeId = eleve?.classe?.id || ''
                  setFormData(prev => ({ ...prev, eleveId, classeId, matiereId: '', coefficient: '1' }))
                  loadMatieresClasse(classeId)
                }}
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
                Classe <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={formData.classeId}
                onChange={(e) => handleClasseChange(e.target.value)}
              >
                <option value="">Sélectionner une classe...</option>
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
                required
                className="input"
                value={formData.matiereId}
                onChange={(e) => {
                  const matiereId = e.target.value
                  const matiere = matieres.find(item => item.id === matiereId)
                  setFormData(prev => ({
                    ...prev,
                    matiereId,
                    coefficient: String(matiere?.coefficient || 1)
                  }))
                }}
                disabled={!formData.classeId}
              >
                <option value="">Sélectionner une matière...</option>
                {matieres.map((matiere) => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.nom} ({matiere.code})
                  </option>
                ))}
              </select>
              {formData.classeId && matieres.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Aucune matière rattachée à cette classe pour l'année active.
                </p>
              )}
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

        <div>
          <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Note et coefficient</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note obtenue <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                max={calculatedNoteMax}
                step="0.25"
                className="input"
                placeholder="15"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note maximale <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                className="input bg-gray-100"
                value={String(calculatedNoteMax)}
                disabled
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coefficient <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                className="input bg-gray-100"
                value={formData.coefficient}
                disabled
                readOnly
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Commentaire sur la performance de l'élève..."
            value={formData.commentaire}
            onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
          />
        </div>

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
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
