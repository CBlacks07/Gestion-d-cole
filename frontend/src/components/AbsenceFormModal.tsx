import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Eleve, Classe } from '../types'
import { useToast } from '../contexts/ToastContext'

interface AbsenceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface MatiereClasse {
  id: string
  nom: string
  code: string
}

export default function AbsenceFormModal({ isOpen, onClose, onSuccess }: AbsenceFormModalProps) {
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [matieres, setMatieres] = useState<MatiereClasse[]>([])
  const [anneeActive, setAnneeActive] = useState<string>('')
  const [eleveSearch, setEleveSearch] = useState('')
  const [showEleveDropdown, setShowEleveDropdown] = useState(false)
  const eleveDropdownRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    eleveId: '',
    classeId: '',
    matiereId: '',
    date: new Date().toISOString().split('T')[0],
    periode: 'TOUTE_JOURNEE',
    justifiee: false,
    motif: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eleveDropdownRef.current && !eleveDropdownRef.current.contains(e.target as Node)) {
        setShowEleveDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredEleveSuggestions = eleveSearch.trim().length >= 1
    ? eleves.filter(e =>
        `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(eleveSearch.toLowerCase())
      ).slice(0, 8)
    : []

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
          code: row.code
        }))
        .sort((a: MatiereClasse, b: MatiereClasse) => a.nom.localeCompare(b.nom, 'fr'))

      setMatieres(mapped)
    } catch (error) {
      console.error('Erreur lors du chargement des matieres de la classe', error)
      setMatieres([])
    }
  }

  const handleClasseChange = (classeId: string) => {
    setFormData(prev => ({ ...prev, classeId, matiereId: '' }))
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
        classeId: formData.classeId,
        matiereId: formData.matiereId || undefined,
        date: formData.date,
        periode: formData.periode,
        justifiee: formData.justifiee,
        motif: formData.motif || undefined,
        anneeScolaire: anneeActive
      }

      await api.post('/absences', data)
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Erreur lors de la creation de l absence', error)
      toastError(error.response?.data?.message || 'Erreur lors de la création de l\'absence')
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
      periode: 'TOUTE_JOURNEE',
      justifiee: false,
      motif: ''
    })
    setMatieres([])
    setEleveSearch('')
    setShowEleveDropdown(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer une absence" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Informations de base</h3>
          <div className="grid grid-cols-2 gap-4">
            <div ref={eleveDropdownRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Élève <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required={!formData.eleveId}
                className="input"
                placeholder="Rechercher par nom ou matricule..."
                value={eleveSearch}
                onChange={(e) => {
                  setEleveSearch(e.target.value)
                  setShowEleveDropdown(true)
                  if (!e.target.value) {
                    setFormData(prev => ({ ...prev, eleveId: '', classeId: '', matiereId: '' }))
                  }
                }}
                onFocus={() => { if (eleveSearch) setShowEleveDropdown(true) }}
                autoComplete="off"
              />
              {formData.eleveId && (
                <p className="mt-1 text-xs text-green-700 font-medium">
                  ✓ {eleves.find(e => e.id === formData.eleveId)?.prenom} {eleves.find(e => e.id === formData.eleveId)?.nom}
                </p>
              )}
              {showEleveDropdown && filteredEleveSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto">
                  {filteredEleveSuggestions.map(eleve => (
                    <button
                      key={eleve.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0"
                      onClick={() => {
                        const classeId = eleve.classe?.id || ''
                        setFormData(prev => ({ ...prev, eleveId: eleve.id, classeId, matiereId: '' }))
                        setEleveSearch(`${eleve.prenom} ${eleve.nom}`)
                        setShowEleveDropdown(false)
                        loadMatieresClasse(classeId)
                      }}
                    >
                      <p className="text-sm font-medium text-gray-900">{eleve.prenom} {eleve.nom}</p>
                      <p className="text-xs text-gray-500">{eleve.matricule} · {eleve.classe?.nom || 'Sans classe'}</p>
                    </button>
                  ))}
                </div>
              )}
              {showEleveDropdown && eleveSearch.trim().length >= 1 && filteredEleveSuggestions.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-3 text-sm text-gray-500">
                  Aucun élève trouvé
                </div>
              )}
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
                <option value="MATIN">Matin</option>
                <option value="APRES_MIDI">Après-midi</option>
                <option value="TOUTE_JOURNEE">Toute la journée</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Matière (optionnel)</label>
              <select
                className="input"
                value={formData.matiereId}
                onChange={(e) => setFormData({ ...formData, matiereId: e.target.value })}
                disabled={!formData.classeId}
              >
                <option value="">Toutes les matieres</option>
                {matieres.map((matiere) => (
                  <option key={matiere.id} value={matiere.id}>
                    {matiere.nom}
                  </option>
                ))}
              </select>
              {formData.classeId && matieres.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Aucune matière rattachée à cette classe pour l'année active.
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-display font-semibold mb-4 text-gray-900">Justification</h3>
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
                placeholder="Ex: Maladie, rendez-vous medical, evenement familial..."
                value={formData.motif}
                onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
              />
            </div>
          </div>
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