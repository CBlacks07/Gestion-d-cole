import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve, Matiere, Classe } from '../types'

interface NoteFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function NoteFormModal({ isOpen, onClose, onSuccess }: NoteFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [formData, setFormData] = useState({
    eleveId: '',
    matiereId: '',
    classeId: '',
    typeEvaluation: 'Devoir',
    periode: '1er Trimestre',
    note: '',
    noteMax: '20',
    coefficient: '1',
    commentaire: '',
    dateEvaluation: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [elevesRes, matieresRes, classesRes] = await Promise.all([
        api.get('/eleves'),
        api.get('/matieres'),
        api.get('/classes')
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

      // Mapper les matières
      const mappedMatieres = matieresRes.data.map((data: any) => ({
        id: data.id,
        nom: data.nom,
        code: data.code
      }))

      // Mapper les classes
      const mappedClasses = classesRes.data.map((data: any) => ({
        id: data.id,
        nom: data.nom,
        cycle: data.cycle
      }))

      setEleves(mappedEleves)
      setMatieres(mappedMatieres)
      setClasses(mappedClasses)
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        eleveId: formData.eleveId,
        matiereId: formData.matiereId,
        classeId: formData.classeId,
        typeEvaluation: formData.typeEvaluation,
        periode: formData.periode,
        note: parseFloat(formData.note),
        noteMax: parseFloat(formData.noteMax),
        coefficient: parseFloat(formData.coefficient),
        commentaire: formData.commentaire || undefined,
        dateEvaluation: formData.dateEvaluation,
        anneeScolaire: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
      }

      await api.post('/notes', data)
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la création de la note', error)
      alert(error.response?.data?.message || 'Erreur lors de la création de la note')
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
      noteMax: '20',
      coefficient: '1',
      commentaire: '',
      dateEvaluation: new Date().toISOString().split('T')[0]
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une nouvelle note" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations de base */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations de base</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Élève <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={formData.eleveId}
                onChange={(e) => setFormData({ ...formData, eleveId: e.target.value })}
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
                Matière <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={formData.matiereId}
                onChange={(e) => setFormData({ ...formData, matiereId: e.target.value })}
              >
                <option value="">Sélectionner une matière...</option>
                {matieres.map((matiere) => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.nom}
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
                onChange={(e) => setFormData({ ...formData, classeId: e.target.value })}
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

        {/* Note et coefficient */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Note et coefficient</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note obtenue <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
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
                className="input"
                value={formData.noteMax}
                onChange={(e) => setFormData({ ...formData, noteMax: e.target.value })}
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
                className="input"
                value={formData.coefficient}
                onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Commentaire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commentaire
          </label>
          <textarea
            className="input"
            rows={3}
            placeholder="Commentaire sur la performance de l'élève..."
            value={formData.commentaire}
            onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
          />
        </div>

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
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
