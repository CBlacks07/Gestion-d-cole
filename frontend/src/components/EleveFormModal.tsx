import { useState, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Classe, Eleve } from '../types'

interface EleveFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  eleve?: Eleve | null
}

export default function EleveFormModal({ isOpen, onClose, onSuccess, eleve }: EleveFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState<Classe[]>([])
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    lieuNaissance: '',
    sexe: 'M',
    classeId: '',
    tuteur: {
      nom: '',
      prenom: '',
      telephone: '',
      email: '',
      profession: '',
      adresse: ''
    },
    groupeSanguin: '',
    statut: 'actif'
  })

  useEffect(() => {
    if (isOpen) {
      loadClasses()
      if (eleve) {
        // Mode édition - pré-remplir le formulaire
        setFormData({
          nom: eleve.nom || '',
          prenom: eleve.prenom || '',
          dateNaissance: eleve.dateNaissance?.split('T')[0] || '',
          lieuNaissance: eleve.lieuNaissance || '',
          sexe: eleve.sexe || 'M',
          classeId: eleve.classe?.id || '',
          tuteur: {
            nom: eleve.tuteur?.nom || '',
            prenom: eleve.tuteur?.prenom || '',
            telephone: eleve.tuteur?.telephone || '',
            email: eleve.tuteur?.email || '',
            profession: eleve.tuteur?.profession || '',
            adresse: eleve.tuteur?.adresse || ''
          },
          groupeSanguin: eleve.groupeSanguin || '',
          statut: eleve.statut || 'actif'
        })
      } else {
        // Mode création - réinitialiser le formulaire
        resetForm()
      }
    }
  }, [isOpen, eleve])

  const loadClasses = async () => {
    try {
      const response = await api.get('/classes')

      // Mapper les classes (backend snake_case -> frontend camelCase)
      const mappedClasses = response.data.map((data: any) => ({
        id: data.id,
        nom: data.nom,
        cycle: data.cycle,
        niveau: data.niveau
      }))

      setClasses(mappedClasses)
    } catch (error) {
      console.error('Erreur lors du chargement des classes', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Préparer les données sans classeId (on utilise classe à la place)
      const { classeId, ...restFormData } = formData

      const data = {
        ...restFormData,
        classe: classeId || undefined,
        anneeScolaire: eleve?.anneeScolaire || (new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)),
        dateInscription: eleve?.dateInscription || new Date().toISOString()
      }

      if (eleve) {
        // Mode édition
        await api.put(`/eleves/${eleve.id}`, data)
      } else {
        // Mode création
        await api.post('/eleves', data)
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error(`Erreur lors de ${eleve ? 'la modification' : 'la création'} de l'élève`, error)
      alert(error.response?.data?.message || `Erreur lors de ${eleve ? 'la modification' : 'la création'} de l'élève`)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      dateNaissance: '',
      lieuNaissance: '',
      sexe: 'M',
      classeId: '',
      tuteur: {
        nom: '',
        prenom: '',
        telephone: '',
        email: '',
        profession: '',
        adresse: ''
      },
      groupeSanguin: '',
      statut: 'actif'
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={eleve ? "Modifier l'élève" : "Ajouter un nouvel élève"} size="lg">
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
                Lieu de naissance <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.lieuNaissance}
                onChange={(e) => setFormData({ ...formData, lieuNaissance: e.target.value })}
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
                Groupe sanguin
              </label>
              <select
                className="input"
                value={formData.groupeSanguin}
                onChange={(e) => setFormData({ ...formData, groupeSanguin: e.target.value })}
              >
                <option value="">Sélectionner...</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>
        </div>

        {/* Informations scolaires */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations scolaires</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Classe
              </label>
              <select
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
                Statut
              </label>
              <select
                className="input"
                value={formData.statut}
                onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
              >
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
                <option value="transfere">Transféré</option>
              </select>
            </div>
          </div>
        </div>

        {/* Informations du tuteur */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Informations du tuteur</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du tuteur <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.tuteur.nom}
                onChange={(e) => setFormData({
                  ...formData,
                  tuteur: { ...formData.tuteur, nom: e.target.value }
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom du tuteur <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.tuteur.prenom}
                onChange={(e) => setFormData({
                  ...formData,
                  tuteur: { ...formData.tuteur, prenom: e.target.value }
                })}
              />
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
                value={formData.tuteur.telephone}
                onChange={(e) => setFormData({
                  ...formData,
                  tuteur: { ...formData.tuteur, telephone: e.target.value }
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="input"
                value={formData.tuteur.email}
                onChange={(e) => setFormData({
                  ...formData,
                  tuteur: { ...formData.tuteur, email: e.target.value }
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profession
              </label>
              <input
                type="text"
                className="input"
                value={formData.tuteur.profession}
                onChange={(e) => setFormData({
                  ...formData,
                  tuteur: { ...formData.tuteur, profession: e.target.value }
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input"
                value={formData.tuteur.adresse}
                onChange={(e) => setFormData({
                  ...formData,
                  tuteur: { ...formData.tuteur, adresse: e.target.value }
                })}
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
            {loading ? (eleve ? 'Modification...' : 'Enregistrement...') : (eleve ? 'Modifier' : 'Enregistrer')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
