import { useState, useEffect, useRef, useCallback } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { Save, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

interface NoteFormClasseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultClasseId?: string
}

interface Eleve {
  id: string
  matricule: string
  nom: string
  prenom: string
  note: string
  commentaire: string
}

interface MatiereClasse {
  id: string
  nom: string
  code: string
  coefficient: number
}

const TYPE_OPTIONS = ['Devoir', 'Composition', 'Interrogation', 'TP', 'Examen']
const TRIMESTRE_OPTIONS = ['1er Trimestre', '2eme Trimestre', '3eme Trimestre']
const SEMESTRE_OPTIONS = ['1er Semestre', '2eme Semestre']

const normalizeCycle = (value: unknown) =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

const defaultPeriodeByCycle = (cycle: unknown) =>
  normalizeCycle(cycle) === 'LYCEE' ? SEMESTRE_OPTIONS[0] : TRIMESTRE_OPTIONS[0]

const noteMaxFromContext = (cycle: unknown, coefficient?: number) => {
  if (normalizeCycle(cycle) === 'LYCEE') return 20
  const coef = Number(coefficient)
  if (!Number.isFinite(coef) || coef <= 0) return 20
  return coef * 10
}

function getNoteStatus(note: string, noteMax: number): 'empty' | 'valid_high' | 'valid_low' | 'invalid' {
  const val = parseFloat(note)
  if (!Number.isFinite(val) || note.trim() === '') return 'empty'
  if (val > noteMax) return 'invalid'
  return (val / noteMax) * 20 >= 10 ? 'valid_high' : 'valid_low'
}

function getNoteOn20(note: string, noteMax: number): string {
  const val = parseFloat(note)
  if (!Number.isFinite(val) || note.trim() === '' || noteMax === 20) return ''
  return `${((val / noteMax) * 20).toFixed(2)}/20`
}

export default function NoteFormClasseModal({ isOpen, onClose, onSuccess, defaultClasseId }: NoteFormClasseModalProps) {
  const user = useAuthStore(s => s.user)
  const isEnseignant = user?.role?.toUpperCase() === 'ENSEIGNANT'
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState<any[]>([])
  const [matieres, setMatieres] = useState<MatiereClasse[]>([])
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [anneeActive, setAnneeActive] = useState<any>(null)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [formData, setFormData] = useState({
    classeId: '',
    matiereId: '',
    typeEvaluation: 'Devoir',
    periode: '1er Trimestre',
    dateEvaluation: new Date().toISOString().split('T')[0]
  })
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const selectedClasse = classes.find((c) => c.id === formData.classeId)
  const selectedMatiere = matieres.find(m => m.id === formData.matiereId)
  const calculatedNoteMax = noteMaxFromContext(selectedClasse?.cycle, selectedMatiere?.coefficient)
  const isLycee = normalizeCycle(selectedClasse?.cycle) === 'LYCEE'
  const periodeOptions = isLycee ? SEMESTRE_OPTIONS : TRIMESTRE_OPTIONS
  const notesSaisies = eleves.filter(e => e.note.trim() !== '').length
  const notesValides = eleves.filter(e => {
    const v = parseFloat(e.note)
    return Number.isFinite(v) && v >= 0 && v <= calculatedNoteMax
  }).length
  const hasInvalid = notesSaisies > notesValides

  useEffect(() => {
    if (isOpen) loadData()
  }, [isOpen, defaultClasseId])

  const loadData = async () => {
    try {
      const [classesRes, anneeRes] = await Promise.all([api.get('/classes'), api.get('/annees/active')])
      const sortedClasses = [...classesRes.data].sort((a: any, b: any) =>
        String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'))
      setClasses(sortedClasses)
      setMatieres([])
      setAnneeActive(anneeRes.data)
      const defaultExists = Boolean(defaultClasseId && sortedClasses.some((c: any) => c.id === defaultClasseId))
      const classeToSelect = defaultExists ? String(defaultClasseId) : ''
      const selectedCl = sortedClasses.find((c: any) => c.id === classeToSelect)
      const defaultPeriode = defaultPeriodeByCycle(selectedCl?.cycle)
      setFormData(prev => ({ ...prev, classeId: classeToSelect, matiereId: '', periode: defaultPeriode }))
      if (classeToSelect) {
        await Promise.all([
          loadElevesClasse(classeToSelect),
          anneeRes.data?.annee ? loadMatieresClasse(classeToSelect, anneeRes.data.annee) : Promise.resolve()
        ])
      } else {
        setEleves([])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données', error)
    }
  }

  const loadMatieresClasse = async (classeId: string, annee: string) => {
    try {
      const response = await api.get(`/classe-matieres/classe/${classeId}`, { params: { annee_scolaire: annee } })
      let rows = response.data
      if (isEnseignant && user?.enseignantId) {
        rows = rows.filter((row: any) => row.enseignant_id === user.enseignantId)
      }
      const mapped = rows
        .map((row: any) => ({ id: row.matiere_id, nom: row.nom, code: row.code, coefficient: row.coefficient }))
        .sort((a: MatiereClasse, b: MatiereClasse) => a.nom.localeCompare(b.nom, 'fr'))
      setMatieres(mapped)
    } catch { setMatieres([]) }
  }

  const loadElevesClasse = async (classeId: string) => {
    try {
      setLoading(true)
      const response = await api.get('/eleves', { params: { classe: classeId, limit: 500 } })
      const rawData = Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
      const elevesData = rawData
        .filter((e: any) => String(e.statut || '').toUpperCase() === 'ACTIF')
        .map((e: any) => ({ id: e.id, matricule: e.matricule, nom: e.nom, prenom: e.prenom, note: '', commentaire: '' }))
        .sort((a: Eleve, b: Eleve) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
      setEleves(elevesData)
    } catch { setEleves([]) } finally { setLoading(false) }
  }

  const handleClasseChange = (classeId: string) => {
    const selectedCl = classes.find((c) => c.id === classeId)
    const defaultPeriode = defaultPeriodeByCycle(selectedCl?.cycle)
    setFormData(prev => ({ ...prev, classeId, matiereId: '', periode: defaultPeriode }))
    setMatieres([])
    setSaveMessage(null)
    if (!classeId) { setEleves([]); return }
    loadElevesClasse(classeId)
    if (anneeActive?.annee) loadMatieresClasse(classeId, anneeActive.annee)
  }

  const handleNoteChange = (index: number, field: string, value: string) => {
    setEleves(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const next = inputRefs.current[index + 1]
      if (next) next.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveMessage(null)
    const notesToSave = eleves.filter(eleve => eleve.note.trim() !== '')
    if (notesToSave.length === 0) { setSaveMessage({ type: 'error', text: 'Veuillez saisir au moins une note.' }); return }
    if (!formData.matiereId) { setSaveMessage({ type: 'error', text: 'Veuillez sélectionner une matière.' }); return }
    if (!anneeActive?.annee) { setSaveMessage({ type: 'error', text: 'Aucune année scolaire active.' }); return }
    const invalidNote = notesToSave.find(e => { const v = parseFloat(e.note); return Number.isFinite(v) && v > calculatedNoteMax })
    if (invalidNote) { setSaveMessage({ type: 'error', text: `Une note dépasse le maximum autorisé (${calculatedNoteMax}).` }); return }
    setLoading(true)
    try {
      const notes = notesToSave.map(eleve => ({
        eleveId: eleve.id, matiereId: formData.matiereId, classeId: formData.classeId,
        typeEvaluation: formData.typeEvaluation, periode: formData.periode,
        note: parseFloat(eleve.note), noteMax: calculatedNoteMax,
        coefficient: selectedMatiere?.coefficient || 1,
        commentaire: eleve.commentaire || undefined,
        dateEvaluation: formData.dateEvaluation, anneeScolaire: anneeActive.annee
      }))
      const { data } = await api.post('/notes/batch', { notes })
      setSaveMessage({ type: 'success', text: `${data.saved} note(s) enregistrée(s) avec succès.` })
      onSuccess()
      setTimeout(() => { onClose(); resetForm() }, 1200)
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Erreur lors de l\'enregistrement.' })
    } finally { setLoading(false) }
  }

  const resetForm = () => {
    setFormData({ classeId: '', matiereId: '', typeEvaluation: 'Devoir', periode: TRIMESTRE_OPTIONS[0], dateEvaluation: new Date().toISOString().split('T')[0] })
    setMatieres([])
    setEleves([])
    setSaveMessage(null)
  }

  const loadExistingNotes = useCallback(async (
    classeId: string, matiereId: string, typeEvaluation: string, periode: string, annee: string
  ) => {
    try {
      const res = await api.get('/notes', { params: { classe: classeId, matiere: matiereId, periode, anneeScolaire: annee } })
      const filtered: any[] = res.data.filter((n: any) => n.type_evaluation === typeEvaluation.toUpperCase())
      if (filtered.length === 0) return
      const noteMap: Record<string, { note: string; commentaire: string }> = {}
      for (const n of filtered) {
        const eleveId = n.eleve_id || n.eleve?.id
        if (eleveId && !noteMap[eleveId]) {
          noteMap[eleveId] = { note: String(n.note ?? ''), commentaire: n.commentaire || '' }
        }
      }
      setEleves(prev => prev.map(e => noteMap[e.id] ? { ...e, ...noteMap[e.id] } : e))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const { classeId, matiereId, typeEvaluation, periode } = formData
    if (!classeId || !matiereId || !anneeActive?.annee) return
    setEleves(prev => prev.map(e => ({ ...e, note: '', commentaire: '' })))
    loadExistingNotes(classeId, matiereId, typeEvaluation, periode, anneeActive.annee)
  }, [formData.matiereId, formData.typeEvaluation, formData.periode, anneeActive])

  const handleEffacerNotes = useCallback(() => {
    setEleves(prev => prev.map(e => ({ ...e, note: '', commentaire: '' })))
  }, [])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saisir des notes" size="xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* ── Bloc paramètres ── */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">

          {/* Ligne 1 : Classe + Année */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Classe <span className="text-red-500">*</span></label>
              <div className="relative">
                <select
                  value={formData.classeId}
                  onChange={(e) => handleClasseChange(e.target.value)}
                  required
                  className="input pr-8 appearance-none font-medium"
                >
                  <option value="">Sélectionner une classe...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} — {c.cycle}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Année active</p>
              <p className="text-sm font-bold text-primary-700">{anneeActive?.annee || '—'}</p>
            </div>
          </div>

          {/* Ligne 2 : Matière + Note max badge */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Matière <span className="text-red-500">*</span></label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <select
                  value={formData.matiereId}
                  onChange={(e) => setFormData(prev => ({ ...prev, matiereId: e.target.value }))}
                  required
                  className="input pr-8 appearance-none"
                  disabled={!formData.classeId}
                >
                  <option value="">Sélectionner une matière...</option>
                  {matieres.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              {selectedMatiere && (
                <div className="shrink-0 flex items-center gap-2">
                  <span className="rounded-lg bg-white border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600">
                    Coef. {selectedMatiere.coefficient}
                  </span>
                  <span className="rounded-lg bg-primary-100 border border-primary-200 px-2.5 py-1.5 text-xs font-bold text-primary-700">
                    /{calculatedNoteMax}
                  </span>
                </div>
              )}
            </div>
            {formData.classeId && matieres.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Aucune matière rattachée à cette classe pour l'année active.</p>
            )}
          </div>

          {/* Ligne 3 : Type d'évaluation — pills */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type d'évaluation</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, typeEvaluation: type }))}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                    formData.typeEvaluation === type
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Ligne 4 : Période — pills + Date */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Période</label>
              <div className="flex flex-wrap gap-2">
                {periodeOptions.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, periode: p }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                      formData.periode === p
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="shrink-0">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date</label>
              <input
                type="date"
                value={formData.dateEvaluation}
                onChange={(e) => setFormData(prev => ({ ...prev, dateEvaluation: e.target.value }))}
                className="input input-sm"
              />
            </div>
          </div>
        </div>

        {/* ── Grille de saisie des notes ── */}
        {formData.classeId && (
          <div>
            {/* En-tête grille */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-display font-semibold text-gray-900">Notes des élèves</h3>
                {eleves.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-24 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all"
                        style={{ width: `${eleves.length > 0 ? (notesSaisies / eleves.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{notesSaisies}/{eleves.length}</span>
                    {hasInvalid && (
                      <span className="text-xs text-red-500 flex items-center gap-0.5">
                        <AlertCircle className="h-3 w-3" /> note invalide
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">↵ Entrée pour passer à l'élève suivant</span>
                {notesSaisies > 0 && (
                  <>
                    <span className="text-xs text-primary-600 font-medium bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5">
                      {notesSaisies} chargée{notesSaisies > 1 ? 's' : ''}
                    </span>
                    <button type="button" onClick={handleEffacerNotes} className="text-xs text-red-400 hover:text-red-600 underline">
                      Effacer tout
                    </button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <div className="text-sm">Chargement des élèves...</div>
              </div>
            ) : eleves.length > 0 ? (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Élève</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-28">
                          Note <span className="text-gray-400">/ {calculatedNoteMax}</span>
                        </th>
                        {!isLycee && (
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 w-20">/ 20</th>
                        )}
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Commentaire</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {eleves.map((eleve, index) => {
                        const status = getNoteStatus(eleve.note, calculatedNoteMax)
                        const on20 = getNoteOn20(eleve.note, calculatedNoteMax)
                        const inputStyle = {
                          empty: 'border-gray-200 bg-white text-gray-700 focus:border-primary-400',
                          valid_high: 'border-emerald-300 bg-emerald-50 text-emerald-700 font-bold',
                          valid_low: 'border-amber-300 bg-amber-50 text-amber-700 font-bold',
                          invalid: 'border-red-300 bg-red-50 text-red-700 font-bold',
                        }[status]
                        return (
                          <tr key={eleve.id} className={`transition-colors ${status !== 'empty' ? 'bg-gray-50/40' : 'hover:bg-gray-50'}`}>
                            <td className="px-3 py-2 text-xs text-gray-400 font-mono">{index + 1}</td>
                            <td className="px-3 py-2">
                              <p className="text-sm font-semibold text-gray-900">{eleve.prenom} {eleve.nom}</p>
                              <p className="text-xs text-gray-400">{eleve.matricule}</p>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                ref={el => { inputRefs.current[index] = el }}
                                type="number"
                                value={eleve.note}
                                onChange={(e) => handleNoteChange(index, 'note', e.target.value)}
                                onKeyDown={(e) => handleNoteKeyDown(e, index)}
                                className={`w-20 rounded-lg border px-2 py-1.5 text-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 ${inputStyle}`}
                                min="0"
                                max={calculatedNoteMax}
                                step="0.25"
                                placeholder="—"
                              />
                            </td>
                            {!isLycee && (
                              <td className="px-3 py-2 text-center">
                                {status === 'invalid' ? (
                                  <span className="text-xs text-red-500 font-medium">dépassé</span>
                                ) : on20 ? (
                                  <span className={`text-xs font-semibold ${status === 'valid_high' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {on20}
                                  </span>
                                ) : null}
                              </td>
                            )}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={eleve.commentaire}
                                onChange={(e) => handleNoteChange(index, 'commentaire', e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent placeholder-gray-300"
                                placeholder="Appréciation..."
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                Aucun élève actif dans cette classe
              </div>
            )}
          </div>
        )}

        {/* Message de retour */}
        {saveMessage && (
          <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {saveMessage.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />}
            {saveMessage.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className={`text-sm ${notesSaisies > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {notesSaisies > 0
              ? `${notesSaisies} note${notesSaisies > 1 ? 's' : ''} prête${notesSaisies > 1 ? 's' : ''} à enregistrer`
              : 'Aucune note saisie'}
          </span>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>Annuler</button>
            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2"
              disabled={loading || !formData.classeId || !formData.matiereId || eleves.length === 0 || notesSaisies === 0}
            >
              <Save className="h-4 w-4" />
              {loading ? 'Enregistrement...' : `Enregistrer (${notesSaisies})`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
