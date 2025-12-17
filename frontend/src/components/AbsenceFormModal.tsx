import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve, Classe, Matiere } from '../types'

interface AbsenceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AbsenceFormModal({ isOpen, onClose, onSuccess }: AbsenceFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [formData, setFormData] = useState({
    eleveId: '',
    classeId: '',
    matiereId: '',
    date: new Date().toISOString().split('T')[0],
    periode: 'Toute la journée',
    justifiee: false,
    motif: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [elevesRes, classesRes, matieresRes] = await Promise.all([
        api.get('/eleves'),
        api.get('/classes'),
        api.get('/matieres')
      ])
      setEleves(elevesRes.data.filter((e: Eleve) => e.statut === 'actif'))
      setClasses(classesRes.data)
      setMatieres(matieresRes.data)
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        eleve: formData.eleveId,
        classe: formData.classeId,
        matiere: formData.matiereId || undefined,
        date: formData.date,
        periode: formData.periode,
        justifiee: formData.justifiee,
        motif: formData.motif || undefined,
        anneeScolaire: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
      }

      await api.post('/absences', data)
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'absence', error)
      alert(error.response?.data?.message || 'Erreur lors de la création de l\'absence')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      eleveId: '',
      classeId: '',
      matiereId: '',
      date: new Date().toISOString().split('T')[0],
      periode: 'Toute la journée',
      justifiee: false,
      motif: ''
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer une absence" size="lg">
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
                  <option key={eleve._id} value={eleve._id}>
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
                onChange={(e) => setFormData({ ...formData, classeId: e.target.value })}
              >
                <option value="">Sélectionner une classe...</option>
                {classes.map((classe) => (
                  <option key={classe._id} value={classe._id}>
                    {classe.nom} - {classe.cycle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
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
                <option value="Matin">Matin</option>
                <option value="Après-midi">Après-midi</option>
                <option value="Toute la journée">Toute la journée</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matière (optionnel)
              </label>
              <select
                className="input"
                value={formData.matiereId}
                onChange={(e) => setFormData({ ...formData, matiereId: e.target.value })}
              >
                <option value="">Toutes les matières</option>
                {matieres.map((matiere) => (
                  <option key={matiere._id} value={matiere._id}>
                    {matiere.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Justification */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Justification</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="justifiee"
                className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                checked={formData.justifiee}
                onChange={(e) => setFormData({ ...formData, justifiee: e.target.checked })}
              />
              <label htmlFor="justifiee" className="ml-2 block text-sm text-gray-700">
                Absence justifiée
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif {formData.justifiee && <span className="text-red-500">*</span>}
              </label>
              <textarea
                className="input"
                rows={3}
                required={formData.justifiee}
                placeholder="Ex: Maladie, rendez-vous médical, événement familial..."
                value={formData.motif}
                onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
              />
            </div>
          </div>
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
