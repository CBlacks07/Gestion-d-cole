import { useState } from 'react'
import Modal from './Modal'
import api from '../services/api'

interface EnseignantFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EnseignantFormModal({ isOpen, onClose, onSuccess }: EnseignantFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    sexe: 'M',
    telephone: '',
    email: '',
    adresse: '',
    typeContrat: 'contractuel',
    statut: 'actif',
    salaire: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        ...formData,
        salaire: formData.salaire ? parseFloat(formData.salaire) : undefined,
        dateRecrutement: new Date().toISOString(),
        diplomes: [],
        specialites: []
      }

      await api.post('/enseignants', data)
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'enseignant', error)
      alert(error.response?.data?.message || 'Erreur lors de la création de l\'enseignant')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      dateNaissance: '',
      sexe: 'M',
      telephone: '',
      email: '',
      adresse: '',
      typeContrat: 'contractuel',
      statut: 'actif',
      salaire: ''
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un nouvel enseignant" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations personnelles */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations personnelles</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.dateNaissance}
                onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sexe <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.sexe}
                onChange={(e) => setFormData({ ...formData, sexe: e.target.value as 'M' | 'F' })}
              >
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                className="input"
                placeholder="+228 00 00 00 00"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                className="input"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Informations professionnelles */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations professionnelles</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de contrat <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.typeContrat}
                onChange={(e) => setFormData({ ...formData, typeContrat: e.target.value })}
              >
                <option value="permanent">Permanent</option>
                <option value="contractuel">Contractuel</option>
                <option value="vacataire">Vacataire</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                className="input"
                value={formData.statut}
                onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
              >
                <option value="actif">Actif</option>
                <option value="conge">En congé</option>
                <option value="suspendu">Suspendu</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salaire mensuel (FCFA)
              </label>
              <input
                type="number"
                className="input"
                placeholder="150000"
                value={formData.salaire}
                onChange={(e) => setFormData({ ...formData, salaire: e.target.value })}
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
