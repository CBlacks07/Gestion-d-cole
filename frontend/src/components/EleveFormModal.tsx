import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Loader2, UserPlus, Save } from 'lucide-react'
import Modal from './Modal'
import FormStepper from './FormStepper'
import api from '../services/api'
import { Classe, Eleve } from '../types'
import { useToast } from '../contexts/ToastContext'

interface EleveFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  eleve?: Eleve | null
}

const STEPS = ['Identité', 'Scolarité', 'Tuteur']
type Step = 1 | 2 | 3

const LBL = 'mb-1 block text-sm font-medium text-gray-600 dark:text-gray-300'

function Req() {
  return <span className="text-red-400 ml-0.5">*</span>
}

export default function EleveFormModal({ isOpen, onClose, onSuccess, eleve }: EleveFormModalProps) {
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [classes, setClasses] = useState<Classe[]>([])

  const [formData, setFormData] = useState({
    nom: '', prenom: '', dateNaissance: '', lieuNaissance: '',
    sexe: 'M', groupeSanguin: '',
    classeId: '', statut: 'actif',
    tuteur: { nom: '', prenom: '', telephone: '', email: '', profession: '', adresse: '' }
  })

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setCompleted(new Set())
      loadClasses()
      if (eleve) {
        setFormData({
          nom: eleve.nom || '',
          prenom: eleve.prenom || '',
          dateNaissance: eleve.dateNaissance?.split('T')[0] || '',
          lieuNaissance: eleve.lieuNaissance || '',
          sexe: eleve.sexe || 'M',
          groupeSanguin: eleve.groupeSanguin || '',
          classeId: eleve.classe?.id || '',
          statut: eleve.statut || 'actif',
          tuteur: {
            nom: eleve.tuteur?.nom || '',
            prenom: eleve.tuteur?.prenom || '',
            telephone: eleve.tuteur?.telephone || '',
            email: eleve.tuteur?.email || '',
            profession: eleve.tuteur?.profession || '',
            adresse: eleve.tuteur?.adresse || ''
          }
        })
        setCompleted(new Set([1, 2]))
      } else {
        resetForm()
      }
    }
  }, [isOpen, eleve])

  const loadClasses = async () => {
    try {
      const res = await api.get('/classes')
      setClasses(res.data.map((d: any) => ({ id: d.id, nom: d.nom, cycle: d.cycle, niveau: d.niveau })))
    } catch { /* silent */ }
  }

  const resetForm = () => {
    setFormData({
      nom: '', prenom: '', dateNaissance: '', lieuNaissance: '',
      sexe: 'M', groupeSanguin: '',
      classeId: '', statut: 'actif',
      tuteur: { nom: '', prenom: '', telephone: '', email: '', profession: '', adresse: '' }
    })
  }

  const validateStep = (s: Step): string[] => {
    const missing: string[] = []
    if (s === 1) {
      if (!formData.nom.trim())           missing.push('Nom')
      if (!formData.prenom.trim())        missing.push('Prénom')
      if (!formData.dateNaissance)        missing.push('Date de naissance')
      if (!formData.lieuNaissance.trim()) missing.push('Lieu de naissance')
    }
    if (s === 3) {
      if (!formData.tuteur.nom.trim())       missing.push('Nom du tuteur')
      if (!formData.tuteur.prenom.trim())    missing.push('Prénom du tuteur')
      if (!formData.tuteur.telephone.trim()) missing.push('Téléphone du tuteur')
      if (!formData.tuteur.adresse.trim())   missing.push('Adresse du tuteur')
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
    setStep(s => (Math.min(s + 1, 3) as Step))
  }

  const goPrev = () => setStep(s => (Math.max(s - 1, 1) as Step))

  const goToStep = (s: number) => {
    if (completed.has(s)) setStep(s as Step)
  }

  const handleSubmit = async () => {
    const missing = validateStep(step)
    if (missing.length > 0) {
      toastError(`Champs requis : ${missing.join(', ')}`)
      return
    }
    setLoading(true)
    try {
      const { classeId, ...rest } = formData
      const data = {
        ...rest,
        classe: classeId || undefined,
        anneeScolaire: eleve?.anneeScolaire || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        dateInscription: eleve?.dateInscription || new Date().toISOString()
      }
      if (eleve) {
        await api.put(`/eleves/${eleve.id}`, data)
      } else {
        await api.post('/eleves', data)
      }
      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      toastError(error.response?.data?.message || `Erreur lors de ${eleve ? 'la modification' : "l'enregistrement"}`)
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string, value: string) =>
    setFormData(f => ({ ...f, [field]: value }))
  const setTuteur = (field: string, value: string) =>
    setFormData(f => ({ ...f, tuteur: { ...f.tuteur, [field]: value } }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={eleve ? "Modifier l'élève" : 'Nouvel élève'}
      size="md"
    >
      <FormStepper steps={STEPS} current={step} completed={completed} onStepClick={goToStep} />

      {/* ── Étape 1 : Identité ── */}
      {step === 1 && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className={LBL}>Nom <Req /></label>
              <input className="input" value={formData.nom} onChange={e => set('nom', e.target.value)} placeholder="KODJO" />
            </div>
            <div>
              <label className={LBL}>Prénom <Req /></label>
              <input className="input" value={formData.prenom} onChange={e => set('prenom', e.target.value)} placeholder="Koffi" />
            </div>
            <div>
              <label className={LBL}>Date de naissance <Req /></label>
              <input type="date" className="input" value={formData.dateNaissance} onChange={e => set('dateNaissance', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Lieu de naissance <Req /></label>
              <input className="input" value={formData.lieuNaissance} onChange={e => set('lieuNaissance', e.target.value)} placeholder="Lomé" />
            </div>
            <div>
              <label className={LBL}>Sexe <Req /></label>
              <select className="input" value={formData.sexe} onChange={e => set('sexe', e.target.value)}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div>
              <label className={LBL}>Groupe sanguin</label>
              <select className="input" value={formData.groupeSanguin} onChange={e => set('groupeSanguin', e.target.value)}>
                <option value="">— Inconnu —</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Étape 2 : Scolarité ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <label className={LBL}>Classe</label>
                <select className="input" value={formData.classeId} onChange={e => set('classeId', e.target.value)}>
                  <option value="">— Sélectionner une classe —</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.nom}{c.cycle ? ` — ${c.cycle}` : ''}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">Laissez vide si la classe sera assignée plus tard.</p>
              </div>
              <div>
                <label className={LBL}>Statut</label>
                <select className="input" value={formData.statut} onChange={e => set('statut', e.target.value)}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="transfere">Transféré</option>
                  <option value="diplome">Diplômé</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${formData.sexe === 'M' ? 'bg-blue-500' : 'bg-pink-500'}`}>
              {(formData.prenom?.[0] ?? '').toUpperCase()}{(formData.nom?.[0] ?? '').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{formData.prenom} {formData.nom}</p>
              <p className="text-xs text-gray-400">{formData.dateNaissance} · {formData.lieuNaissance} · {formData.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Étape 3 : Tuteur ── */}
      {step === 3 && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className={LBL}>Nom du tuteur <Req /></label>
              <input className="input" value={formData.tuteur.nom} onChange={e => setTuteur('nom', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Prénom du tuteur <Req /></label>
              <input className="input" value={formData.tuteur.prenom} onChange={e => setTuteur('prenom', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Téléphone <Req /></label>
              <input type="tel" className="input" placeholder="+228 90 00 00 00" value={formData.tuteur.telephone} onChange={e => setTuteur('telephone', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Email</label>
              <input type="email" className="input" value={formData.tuteur.email} onChange={e => setTuteur('email', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Profession</label>
              <input className="input" value={formData.tuteur.profession} onChange={e => setTuteur('profession', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>Adresse <Req /></label>
              <input className="input" value={formData.tuteur.adresse} onChange={e => setTuteur('adresse', e.target.value)} />
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

        {step < 3 ? (
          <button type="button" onClick={goNext} className="btn btn-primary">
            Suivant <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className="btn btn-primary">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
              : eleve
                ? <><Save className="h-4 w-4" /> Enregistrer</>
                : <><UserPlus className="h-4 w-4" /> Créer l'élève</>}
          </button>
        )}
      </div>
    </Modal>
  )
}
