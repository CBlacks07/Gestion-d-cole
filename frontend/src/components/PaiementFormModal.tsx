import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve } from '../types'

interface PaiementFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function PaiementFormModal({ isOpen, onClose, onSuccess }: PaiementFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [formData, setFormData] = useState({
    eleveId: '',
    typePaiement: 'Scolarité',
    montant: '',
    datePaiement: new Date().toISOString().split('T')[0],
    moisConcerne: '',
    modePaiement: 'Espèces',
    numeroPiece: '',
    remarques: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadEleves()
    }
  }, [isOpen])

  const loadEleves = async () => {
    try {
      const response = await api.get('/eleves')

      // Mapper les élèves (backend snake_case -> frontend camelCase)
      const mappedEleves = response.data
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
    } catch (error) {
      console.error('Erreur lors du chargement des élèves', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        eleveId: formData.eleveId,
        typePaiement: formData.typePaiement,
        montant: parseFloat(formData.montant),
        devise: 'XOF',
        datePaiement: formData.datePaiement,
        moisConcerne: formData.moisConcerne && formData.moisConcerne.trim() !== '' ? formData.moisConcerne : undefined,
        modePaiement: formData.modePaiement,
        numeroPiece: formData.numeroPiece && formData.numeroPiece.trim() !== '' ? formData.numeroPiece : undefined,
        statut: 'VALIDE',
        remarques: formData.remarques && formData.remarques.trim() !== '' ? formData.remarques : undefined,
        anneeScolaire: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
      }

      await api.post('/paiements', data)
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la création du paiement', error)
      alert(error.response?.data?.message || 'Erreur lors de la création du paiement')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      eleveId: '',
      typePaiement: 'Scolarité',
      montant: '',
      datePaiement: new Date().toISOString().split('T')[0],
      moisConcerne: '',
      modePaiement: 'Espèces',
      numeroPiece: '',
      remarques: ''
    })
  }

  const mois = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un paiement" size="lg">
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
                Type de paiement <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.typePaiement}
                onChange={(e) => setFormData({ ...formData, typePaiement: e.target.value })}
              >
                <option value="Inscription">Inscription</option>
                <option value="Scolarité">Scolarité</option>
                <option value="Cantine">Cantine</option>
                <option value="Transport">Transport</option>
                <option value="Uniforme">Uniforme</option>
                <option value="Autres">Autres</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant (FCFA) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                className="input"
                placeholder="25000"
                value={formData.montant}
                onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de paiement <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.datePaiement}
                onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })}
              />
            </div>
            {formData.typePaiement === 'Scolarité' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mois concerné
                </label>
                <select
                  className="input"
                  value={formData.moisConcerne}
                  onChange={(e) => setFormData({ ...formData, moisConcerne: e.target.value })}
                >
                  <option value="">Sélectionner un mois...</option>
                  {mois.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Mode de paiement */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Mode de paiement</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mode de paiement <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.modePaiement}
                onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value })}
              >
                <option value="Espèces">Espèces</option>
                <option value="Chèque">Chèque</option>
                <option value="Virement">Virement</option>
                <option value="Mobile Money">Mobile Money</option>
              </select>
            </div>
            {formData.modePaiement !== 'Espèces' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de pièce
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={
                    formData.modePaiement === 'Chèque'
                      ? 'Numéro de chèque'
                      : formData.modePaiement === 'Virement'
                      ? 'Référence virement'
                      : 'Référence transaction'
                  }
                  value={formData.numeroPiece}
                  onChange={(e) => setFormData({ ...formData, numeroPiece: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>

        {/* Remarques */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarques
          </label>
          <textarea
            className="input"
            rows={3}
            placeholder="Remarques éventuelles sur ce paiement..."
            value={formData.remarques}
            onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
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
