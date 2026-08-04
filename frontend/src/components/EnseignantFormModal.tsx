import { useState, useEffect } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Loader2, UserPlus, Save, X } from 'lucide-react'
import Modal from './Modal'
import FormStepper from './FormStepper'
import api from '../services/api'
import { Enseignant } from '../types'
import { useToast } from '../contexts/ToastContext'

interface EnseignantFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  enseignant?: Enseignant | null
}

interface MatiereOption {
  id: string
  nom: string
  code: string
}

const STEPS = ['Identité', 'Profil pro']
type Step = 1 | 2

const LBL = 'mb-1 block text-sm font-medium text-gray-600 dark:text-gray-300'

function Req() {
  return <span className="text-red-400 ml-0.5">*</span>
}

export default function EnseignantFormModal({ isOpen, onClose, onSuccess, enseignant }: EnseignantFormModalProps) {
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [allMatieres, setAllMatieres] = useState<MatiereOption[]>([])
  const [selectedMatiereIds, setSelectedMatiereIds] = useState<Set<string>>(new Set())

  const [formData, setFormData] = useState({
    nom: '', prenom: '', dateNaissance: '', sexe: 'M',
    telephone: '', email: '', adresse: '',
    typeContrat: 'contractuel', statut: 'actif', salaire: ''
  })

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setCompleted(new Set())
      loadMatieres()
      if (enseignant) {
        setFormData({
          nom: enseignant.nom || '',
          prenom: enseignant.prenom || '',
          dateNaissance: enseignant.dateNaissance?.split('T')[0] || '',
          sexe: enseignant.sexe || 'M',
          telephone: enseignant.telephone || '',
          email: enseignant.email || '',
          adresse: enseignant.adresse || '',
          typeContrat: enseignant.typeContrat || 'contractuel',
          statut: enseignant.statut || 'actif',
          salaire: enseignant.salaire ? String(enseignant.salaire) : ''
        })
        const existingIds = new Set(
          (enseignant.specialites || []).map((s: any) => s.matiere?.id || s.matiere_id || s.id).filter(Boolean)
        )
        setSelectedMatiereIds(existingIds)
        setCompleted(new Set([1]))
      } else {
        resetForm()
        setSelectedMatiereIds(new Set())
      }
    }
  }, [isOpen, enseignant])

  const loadMatieres = async () => {
    try {
      const res = await api.get('/matieres')
      const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      setAllMatieres(
        data.map((m: any) => ({ id: m.id, nom: m.nom, code: m.code }))
            .sort((a: MatiereOption, b: MatiereOption) => a.nom.localeCompare(b.nom, 'fr'))
      )
    } catch { /* silent */ }
  }

  const toggleMatiere = (id: string) => {
    setSelectedMatiereIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resetForm = () => {
    setFormData({
      nom: '', prenom: '', dateNaissance: '', sexe: 'M',
      telephone: '', email: '', adresse: '',
      typeContrat: 'contractuel', statut: 'actif', salaire: ''
    })
  }

  const validateStep = (s: Step): string[] => {
    const missing: string[] = []
    if (s === 1) {
      if (!formData.nom.trim())          missing.push('Nom')
      if (!formData.prenom.trim())       missing.push('Prénom')
      if (!formData.dateNaissance)       missing.push('Date de naissance')
      if (!formData.telephone.trim())    missing.push('Téléphone')
    }
    return missing
  }

  const goNext = () => {
    const missing = validateStep(step)
    if (missing.length > 0) {
      toastError(`Champs requis : ${missing.join(', ')}`)
      return
    }
    setCompleted(prev => new Set([...prev, step]))
    setStep(2)
  }

  const goPrev = () => setStep(1)

  const goToStep = (s: number) => {
    if (completed.has(s)) setStep(s as Step)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const data: any = {
        ...formData,
        salaire: formData.salaire ? parseFloat(formData.salaire) : undefined,
        dateRecrutement: enseignant?.dateRecrutement || new Date().toISOString(),
        diplomes: enseignant?.diplomes || [],
        specialiteIds: Array.from(selectedMatiereIds)
      }
      if (enseignant) {
        await api.put(`/enseignants/${enseignant.id}`, data)
      } else {
        await api.post('/enseignants', data)
      }
      onSuccess()
      onClose()
      resetForm()
      setSelectedMatiereIds(new Set())
    } catch (error: any) {
      toastError(error.response?.data?.message || "Erreur lors de l'enregistrement")
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string, value: string) =>
    setFormData(f => ({ ...f, [field]: value }))

  const unselectedMatieres = allMatieres.filter(m => !selectedMatiereIds.has(m.id))
  const selectedMatieres = allMatieres.filter(m => selectedMatiereIds.has(m.id))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={enseignant ? "Modifier l'enseignant" : 'Nouvel enseignant'}
      size="md"
    >
      <FormStepper steps={STEPS} current={step} completed={completed} onStepClick={goToStep} />

      {/* ── Étape 1 : Identité ── */}
      {step === 1 && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className={LBL}>Nom <Req /></label>
              <input className="input" value={formData.nom} onChange={e => set('nom', e.target.value)} placeholder="AGBEKO" />
            </div>
            <div>
              <label className={LBL}>Prénom <Req /></label>
              <input className="input" value={formData.prenom} onChange={e => set('prenom', e.target.value)} placeholder="Amélé" />
            </div>
            <div>
              <label className={LBL}>Date de naissance <Req /></label>
              <input type="date" className="input" value={formData.dateNaissance} onChange={e => set('dateNaissance', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Sexe <Req /></label>
              <select className="input" value={formData.sexe} onChange={e => set('sexe', e.target.value)}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div>
              <label className={LBL}>Téléphone <Req /></label>
              <input type="tel" className="input" placeholder="+228 90 00 00 00" value={formData.telephone} onChange={e => set('telephone', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Email</label>
              <input type="email" className="input" value={formData.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={LBL}>Adresse</label>
              <input className="input" value={formData.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Quartier, Ville" />
            </div>
          </div>
        </div>
      )}

      {/* ── Étape 2 : Profil professionnel ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className={LBL}>Type de contrat <Req /></label>
                <select className="input" value={formData.typeContrat} onChange={e => set('typeContrat', e.target.value)}>
                  <option value="permanent">Permanent</option>
                  <option value="contractuel">Contractuel</option>
                  <option value="vacataire">Vacataire</option>
                </select>
              </div>
              <div>
                <label className={LBL}>Statut</label>
                <select className="input" value={formData.statut} onChange={e => set('statut', e.target.value)}>
                  <option value="actif">Actif</option>
                  <option value="conge">En congé</option>
                  <option value="suspendu">Suspendu</option>
                  <option value="demissionne">Démissionné</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={LBL}>Salaire mensuel (FCFA)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="150 000"
                  min="0"
                  value={formData.salaire}
                  onChange={e => set('salaire', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Matières / Spécialités */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary-500" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Matières enseignées</p>
              {selectedMatiereIds.size > 0 && (
                <span className="ml-auto text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
                  {selectedMatiereIds.size} sélectionnée{selectedMatiereIds.size > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Selected matières as chips */}
            {selectedMatieres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMatieres.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMatiere(m.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 pl-2.5 pr-1.5 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors"
                  >
                    {m.nom}
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </div>
            )}

            {/* Dropdown to add */}
            {unselectedMatieres.length > 0 && (
              <select
                className="input input-sm text-gray-500"
                value=""
                onChange={e => {
                  if (e.target.value) toggleMatiere(e.target.value)
                }}
              >
                <option value="">+ Ajouter une matière...</option>
                {unselectedMatieres.map(m => (
                  <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>
                ))}
              </select>
            )}

            {allMatieres.length === 0 && (
              <p className="text-xs text-gray-400">Aucune matière disponible. Créez d'abord des matières dans Configuration.</p>
            )}
          </div>

          {/* Récap identité */}
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${formData.sexe === 'M' ? 'bg-blue-500' : 'bg-pink-500'}`}>
              {(formData.prenom?.[0] ?? '').toUpperCase()}{(formData.nom?.[0] ?? '').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{formData.prenom} {formData.nom}</p>
              <p className="text-xs text-gray-400">
                {formData.telephone}
                {formData.email ? ` · ${formData.email}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={step === 1 ? onClose : goPrev}
          className="btn btn-ghost"
          disabled={loading}
        >
          {step === 1 ? 'Annuler' : <><ChevronLeft className="h-4 w-4" /> Précédent</>}
        </button>

        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${
              i + 1 === step ? 'w-5 bg-primary-500' : i + 1 < step || completed.has(i + 1) ? 'w-1.5 bg-primary-300' : 'w-1.5 bg-gray-200'
            }`} />
          ))}
        </div>

        {step < 2 ? (
          <button type="button" onClick={goNext} className="btn btn-primary">
            Suivant <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className="btn btn-primary">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
              : enseignant
                ? <><Save className="h-4 w-4" /> Enregistrer</>
                : <><UserPlus className="h-4 w-4" /> Créer l'enseignant</>}
          </button>
        )}
      </div>
    </Modal>
  )
}
