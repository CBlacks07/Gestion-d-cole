import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Enseignant } from '../types'

interface ClasseFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ClasseFormModal({ isOpen, onClose, onSuccess }: ClasseFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [formData, setFormData] = useState({
    nom: '',
    niveau: '',
    cycle: 'Primaire',
    section: '',
    enseignantPrincipal: '',
    effectifMax: '',
    salle: '',
    montantInscription: '',
    montantMensuel: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadEnseignants()
    }
  }, [isOpen])

  const loadEnseignants = async () => {
    try {
      const response = await api.get('/enseignants')
      setEnseignants(response.data.filter((e: Enseignant) => e.statut === 'actif'))
    } catch (error) {
      console.error('Erreur lors du chargement des enseignants', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        nom: formData.nom,
        niveau: formData.niveau,
        cycle: formData.cycle,
        section: formData.section || undefined,
        enseignantPrincipalId: formData.enseignantPrincipal || undefined,
        effectifMax: parseInt(formData.effectifMax),
        salle: formData.salle || undefined,
        anneeScolaire: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
        montantInscription: parseFloat(formData.montantInscription),
        montantMensuel: parseFloat(formData.montantMensuel),
        devise: 'XOF'
      }

      await api.post('/classes', data)
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la création de la classe', error)
      alert(error.response?.data?.message || 'Erreur lors de la création de la classe')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nom: '',
      niveau: '',
      cycle: 'Primaire',
      section: '',
      enseignantPrincipal: '',
      effectifMax: '',
      salle: '',
      montantInscription: '',
      montantMensuel: ''
    })
  }

  const niveauxParCycle: Record<string, string[]> = {
    Primaire: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'],
    Collège: ['6ème', '5ème', '4ème', '3ème'],
    Lycée: ['2nde', '1ère', 'Terminale']
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une nouvelle classe" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations de base */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations de base</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cycle <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={formData.cycle}
                onChange={(e) => setFormData({ ...formData, cycle: e.target.value, niveau: '' })}
              >
                <option value="Primaire">Primaire</option>
                <option value="Collège">Collège</option>
                <option value="Lycée">Lycée</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Niveau <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="input"
                value={formData.niveau}
                onChange={(e) => setFormData({ ...formData, niveau: e.target.value })}
              >
                <option value="">Sélectionner...</option>
                {niveauxParCycle[formData.cycle].map((niveau) => (
                  <option key={niveau} value={niveau}>
                    {niveau}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la classe <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Ex: CM1 A"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ex: A, B, C"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effectif maximum <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                className="input"
                placeholder="40"
                value={formData.effectifMax}
                onChange={(e) => setFormData({ ...formData, effectifMax: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salle
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ex: Salle 101"
                value={formData.salle}
                onChange={(e) => setFormData({ ...formData, salle: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enseignant principal
              </label>
              <select
                className="input"
                value={formData.enseignantPrincipal}
                onChange={(e) => setFormData({ ...formData, enseignantPrincipal: e.target.value })}
              >
                <option value="">Sélectionner un enseignant...</option>
                {enseignants.map((ens) => (
                  <option key={ens.id} value={ens.id}>
                    {ens.prenom} {ens.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Frais de scolarité */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Frais de scolarité</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant inscription (FCFA) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                className="input"
                placeholder="50000"
                value={formData.montantInscription}
                onChange={(e) => setFormData({ ...formData, montantInscription: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant mensuel (FCFA) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                className="input"
                placeholder="25000"
                value={formData.montantMensuel}
                onChange={(e) => setFormData({ ...formData, montantMensuel: e.target.value })}
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
