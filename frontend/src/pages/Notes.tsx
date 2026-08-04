import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { Note } from '../types'
import { Download, FileText, Plus, Search, Trash2, User } from 'lucide-react'
import InfoTip from '../components/InfoTip'
import { format } from 'date-fns'
import NoteFormClasseModal from '../components/NoteFormClasseModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../contexts/ToastContext'
import { exportNotesDetaillees } from '../utils/exportExcel'

type ClasseItem = { id: string; nom: string; cycle?: string; niveau?: string }

type NoteView = Note & {
  classeId: string
  eleveRefId: string
  displayBrute: number
  normalizedOn20: number
  weightedNote: number
  weightedMax: number
}

const numberFmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function formatDateSafe(value: string): string {
  try { return format(new Date(value), 'dd/MM/yyyy') } catch { return '-' }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return numberFmt.format(value)
}

const normalizeCycle = (value: unknown) =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

const normalizeText = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export default function Notes() {
  const { success, error: toastError } = useToast()
  const [notes, setNotes] = useState<NoteView[]>([])
  const [classes, setClasses] = useState<ClasseItem[]>([])
  const [selectedClasseId, setSelectedClasseId] = useState('')
  const [selectedEleveId, setSelectedEleveId] = useState('')
  const [anneeActive, setAnneeActive] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; eleve: string; matiere: string } | null>(null)
  const [eleveSearch, setEleveSearch] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [notesRes, classesRes, anneeRes] = await Promise.all([
        api.get('/notes'),
        api.get('/classes'),
        api.get('/annees/active')
      ])

      const mappedNotes: NoteView[] = notesRes.data.map((data: any) => {
        const rawNote = Number(data.note ?? 0)
        const rawNoteMax = Number(data.note_max ?? data.noteMax ?? 20)
        const noteMax = Number.isFinite(rawNoteMax) && rawNoteMax > 0 ? rawNoteMax : 20
        const rawCoef = Number(data.coefficient ?? data.matiere?.coefficient ?? 1)
        const coefficient = Number.isFinite(rawCoef) && rawCoef > 0 ? rawCoef : 1

        const classe = data.classe || { id: data.classe_id, nom: data.classe_nom || 'Sans classe', niveau: data.classe_niveau, cycle: data.classe_cycle }
        const eleve = data.eleve || { id: data.eleve_id, nom: data.eleve_nom, prenom: data.eleve_prenom, matricule: data.eleve_matricule }
        const matiere = data.matiere || { id: data.matiere_id, nom: data.matiere_nom, code: data.matiere_code }

        const normalizedOn20 = noteMax > 0 ? (rawNote / noteMax) * 20 : 0
        const typeEvaluation = String(data.type_evaluation || data.typeEvaluation || '').toUpperCase()
        const isLycee = normalizeCycle(classe?.cycle) === 'LYCEE'
        const displayBrute = isLycee ? normalizedOn20 : rawNote

        return {
          id: data.id,
          eleveId: data.eleve_id || data.eleveId,
          matiereId: data.matiere_id || data.matiereId,
          typeEvaluation,
          periode: data.periode,
          anneeScolaire: data.annee_scolaire || data.anneeScolaire,
          note: rawNote, noteMax, coefficient,
          commentaire: data.commentaire,
          dateEvaluation: data.date_evaluation || data.dateEvaluation,
          eleve, matiere, classe,
          classeId: classe?.id || '',
          eleveRefId: String(data.eleve_id || data.eleveId || eleve?.id || ''),
          displayBrute, normalizedOn20,
          weightedNote: normalizedOn20 * coefficient,
          weightedMax: 20 * coefficient
        }
      })

      const mappedClasses: ClasseItem[] = classesRes.data
        .map((c: any) => ({ id: c.id, nom: c.nom, cycle: c.cycle, niveau: c.niveau }))
        .sort((a: ClasseItem, b: ClasseItem) => a.nom.localeCompare(b.nom, 'fr'))

      setNotes(mappedNotes)
      setClasses(mappedClasses)
      setAnneeActive(anneeRes.data?.annee || '')

      setSelectedClasseId((prev) => {
        if (prev && mappedClasses.some((c) => c.id === prev)) return prev
        return ''
      })
    } catch (error) {
      console.error('Erreur lors du chargement des notes', error)
    } finally {
      setLoading(false)
    }
  }

  const statsByClasse = useMemo(() => {
    const stats: Record<string, { count: number }> = {}
    for (const note of notes) {
      if (!note.classeId) continue
      if (!stats[note.classeId]) stats[note.classeId] = { count: 0 }
      stats[note.classeId].count += 1
    }
    return stats
  }, [notes])

  const selectedClasse = useMemo(() => classes.find((c) => c.id === selectedClasseId) || null, [classes, selectedClasseId])
  const notesClasse = useMemo(() => notes.filter((note) => note.classeId === selectedClasseId), [notes, selectedClasseId])

  const elevesClasseData = useMemo(() => {
    const byEleve: Record<string, { id: string; eleve: any; notes: NoteView[]; moyenne: number | null }> = {}
    for (const note of notesClasse) {
      const id = String(note.eleve?.id || note.eleveRefId || '')
      if (!id) continue
      if (!byEleve[id]) byEleve[id] = { id, eleve: note.eleve, notes: [], moyenne: null }
      byEleve[id].notes.push(note)
    }
    // Calculer moyenne par élève
    for (const item of Object.values(byEleve)) {
      const sumW = item.notes.reduce((s, n) => s + n.normalizedOn20 * n.coefficient, 0)
      const sumC = item.notes.reduce((s, n) => s + n.coefficient, 0)
      item.moyenne = sumC > 0 ? sumW / sumC : null
    }
    return Object.values(byEleve).sort((a, b) =>
      `${a.eleve?.nom || ''} ${a.eleve?.prenom || ''}`.localeCompare(`${b.eleve?.nom || ''} ${b.eleve?.prenom || ''}`, 'fr', { sensitivity: 'base' })
    )
  }, [notesClasse])

  const filteredEleves = useMemo(() => {
    if (!eleveSearch.trim()) return elevesClasseData
    const term = normalizeText(eleveSearch)
    return elevesClasseData.filter(item =>
      normalizeText(`${item.eleve?.prenom || ''} ${item.eleve?.nom || ''} ${item.eleve?.matricule || ''}`).includes(term)
    )
  }, [elevesClasseData, eleveSearch])

  useEffect(() => {
    setSelectedEleveId((prev) =>
      elevesClasseData.some((item) => item.id === prev) ? prev : ''
    )
    setEleveSearch('')
    setMobileView('list')
  }, [elevesClasseData])

  const selectedEleveData = useMemo(
    () => elevesClasseData.find((item) => item.id === selectedEleveId) || null,
    [elevesClasseData, selectedEleveId]
  )

  const groupedByType = useMemo(() => {
    if (!selectedEleveData) return {}
    return selectedEleveData.notes.reduce((acc, note) => {
      const key = note.typeEvaluation || 'AUTRE'
      if (!acc[key]) acc[key] = []
      acc[key].push(note)
      return acc
    }, {} as Record<string, NoteView[]>)
  }, [selectedEleveData])

  const formatTypeLabel = (value: string) => {
    const k = String(value || '').toUpperCase()
    if (k === 'DEVOIR') return 'Devoir'
    if (k === 'INTERROGATION') return 'Interrogation'
    if (k === 'COMPOSITION') return 'Composition'
    if (k === 'EXAMEN') return 'Examen'
    if (k === 'TP') return 'TP'
    return value
  }

  const formatPeriodeLabel = (value: string) => {
    const map: Record<string, string> = {
      PREMIER_TRIMESTRE: '1er Trim.', DEUXIEME_TRIMESTRE: '2e Trim.', TROISIEME_TRIMESTRE: '3e Trim.',
      PREMIER_SEMESTRE: '1er Sem.', DEUXIEME_SEMESTRE: '2e Sem.'
    }
    return map[String(value || '').toUpperCase()] || value
  }

  const getMoyenneColor = (m: number | null) => {
    if (m === null) return 'text-gray-400'
    if (m >= 14) return 'text-emerald-600'
    if (m >= 10) return 'text-amber-600'
    return 'text-red-600'
  }

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return
    try {
      await api.delete(`/notes/${noteToDelete.id}`)
      success('Note supprimée avec succès')
      await loadData()
    } catch {
      toastError('Erreur lors de la suppression de la note')
    } finally {
      setNoteToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-display font-bold text-gray-900">Notes et Évaluations</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportNotesDetaillees(notesClasse as unknown as Record<string, unknown>[], { classe: selectedClasse?.nom, anneeScolaire: anneeActive })}
            className="btn btn-secondary"
            disabled={!notesClasse.length}
            title="Exporter les notes de la classe"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exporter</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Saisir des notes
          </button>
        </div>
      </div>

      {/* ── Sélecteur de classe ── */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-48">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Classe
            </label>
            <select
              className="input"
              value={selectedClasseId}
              onChange={(e) => setSelectedClasseId(e.target.value)}
            >
              <option value="">— Choisir une classe —</option>
              {classes.map((classe) => {
                const count = statsByClasse[classe.id]?.count || 0
                return (
                  <option key={classe.id} value={classe.id}>
                    {classe.nom} — {classe.cycle} ({count} note{count > 1 ? 's' : ''})
                  </option>
                )
              })}
            </select>
          </div>
          {anneeActive && (
            <div className="rounded-lg bg-primary-50 px-3 py-2 text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-400">Année active</p>
              <p className="text-sm font-bold text-primary-700">{anneeActive}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Contenu conditionnel ── */}
      {!selectedClasseId ? (
        /* Aucune classe sélectionnée */
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <FileText className="h-7 w-7 text-primary-400" />
          </div>
          <p className="font-semibold text-gray-700">Choisissez une classe</p>
          <p className="text-sm text-gray-400 mt-1">
            Sélectionnez une classe ci-dessus pour consulter ou saisir des notes.
          </p>
        </div>
      ) : notesClasse.length === 0 ? (
        /* Classe sélectionnée mais aucune note */
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <FileText className="h-7 w-7 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-700">Aucune note dans <span className="text-primary-600">{selectedClasse?.nom}</span></p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Commencez par saisir les premières évaluations.</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary mx-auto">
            <Plus className="h-4 w-4" />
            Saisir des notes
          </button>
        </div>
      ) : (
        /* Layout deux colonnes */
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* ── Colonne gauche — liste élèves (cachée sur mobile quand détail ouvert) ── */}
          <div className={`w-full lg:w-64 lg:flex-shrink-0 card-flush lg:sticky lg:top-4 ${mobileView === 'detail' ? 'hidden lg:block' : 'block'}`}>
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {elevesClasseData.length} élève{elevesClasseData.length > 1 ? 's' : ''}
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher un élève..."
                  value={eleveSearch}
                  onChange={e => setEleveSearch(e.target.value)}
                  className="input input-sm pl-8"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-56 lg:max-h-[calc(100vh-300px)]">
              {filteredEleves.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Aucun résultat</p>
              ) : filteredEleves.map((item) => {
                const isSelected = item.id === selectedEleveId
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedEleveId(item.id)
                      setMobileView('detail')
                    }}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-0 transition-colors ${
                      isSelected ? 'bg-primary-50 border-l-2 border-l-primary-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>
                          {item.eleve?.prenom} {item.eleve?.nom}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{item.eleve?.matricule || '-'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {item.moyenne !== null ? (
                          <p className={`text-sm font-bold ${getMoyenneColor(item.moyenne)}`}>{formatNumber(item.moyenne)}</p>
                        ) : (
                          <p className="text-xs text-gray-400">—</p>
                        )}
                        <p className="text-[10px] text-gray-400">{item.notes.length} note{item.notes.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Colonne droite — notes de l'élève (cachée sur mobile quand liste ouverte) ── */}
          <div className={`flex-1 min-w-0 space-y-3 ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
            {selectedEleveData ? (
              <>
                {/* Bandeau élève + retour mobile */}
                <div className="card flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Bouton retour mobile uniquement */}
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="lg:hidden btn btn-secondary btn-xs"
                    >
                      ← Liste
                    </button>
                    <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedEleveData.eleve?.prenom} {selectedEleveData.eleve?.nom}
                      </p>
                      <p className="text-xs text-gray-400">
                        {selectedEleveData.eleve?.matricule || '-'} · {selectedEleveData.notes.length} note(s)
                      </p>
                    </div>
                  </div>
                  {selectedEleveData.moyenne !== null && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Moyenne</p>
                      <p className={`text-2xl font-bold leading-none mt-0.5 ${getMoyenneColor(selectedEleveData.moyenne)}`}>
                        {formatNumber(selectedEleveData.moyenne)}
                        <span className="text-sm font-normal text-gray-400">/20</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Tables par type d'évaluation */}
                {Object.entries(groupedByType)
                  .sort(([a], [b]) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
                  .map(([type, rows]) => (
                    <div key={type} className="card-flush">
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800">{formatTypeLabel(type)}</p>
                        <span className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
                          {rows.length} note{rows.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/40">
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Matière</th>
                              <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 sm:table-cell">Période</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Note</th>
                              <th className="hidden px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 sm:table-cell">
                                <span className="inline-flex items-center gap-1">
                                  Coef.
                                  <InfoTip text="Coefficient de la matière (multiplicateur de la note)" />
                                </span>
                              </th>
                              <th className="hidden px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 md:table-cell">
                                <span className="inline-flex items-center gap-1">
                                  Pondérée
                                  <InfoTip text="Note ramenée sur 20 × coefficient. Ex : 15/20 avec coef. 2 = 15 pts pondérés sur 40" />
                                </span>
                              </th>
                              <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 md:table-cell">Date</th>
                              <th className="px-3 py-2 w-10" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {rows
                              .slice()
                              .sort((a, b) => String(a.matiere?.nom || '').localeCompare(String(b.matiere?.nom || ''), 'fr'))
                              .map((note) => (
                                <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{note.matiere?.nom}</td>
                                  <td className="hidden px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap sm:table-cell">
                                    {formatPeriodeLabel(String(note.periode || ''))}
                                  </td>
                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span className={`text-sm font-bold ${note.normalizedOn20 >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {formatNumber(note.displayBrute)}
                                      {normalizeCycle(note.classe?.cycle) === 'LYCEE' ? '/20' : ''}
                                    </span>
                                  </td>
                                  <td className="hidden px-3 py-2.5 text-center text-sm text-gray-600 sm:table-cell">{formatNumber(note.coefficient)}</td>
                                  <td className="hidden px-3 py-2.5 text-center text-sm font-medium text-gray-900 whitespace-nowrap md:table-cell">
                                    {formatNumber(note.weightedNote)}/{formatNumber(note.weightedMax)}
                                  </td>
                                  <td className="hidden px-3 py-2.5 text-sm text-gray-400 whitespace-nowrap md:table-cell">{formatDateSafe(note.dateEvaluation)}</td>
                                  <td className="px-3 py-2.5">
                                    <button
                                      onClick={() => setNoteToDelete({ id: note.id, eleve: `${note.eleve?.prenom} ${note.eleve?.nom}`, matiere: note.matiere?.nom || '' })}
                                      className="icon-btn-danger"
                                      title="Supprimer cette note"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </>
            ) : (
              /* Aucun élève sélectionné (desktop uniquement, mobile ne peut pas être ici) */
              <div className="card p-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <User className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">Sélectionnez un élève</p>
                <p className="text-xs text-gray-400 mt-1">Cliquez sur un élève dans la liste à gauche.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <NoteFormClasseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadData}
        defaultClasseId={selectedClasseId}
      />

      <ConfirmDialog
        isOpen={!!noteToDelete}
        title="Supprimer cette note"
        message={noteToDelete ? `Confirmer la suppression de la note de ${noteToDelete.matiere} pour ${noteToDelete.eleve} ?` : ''}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={confirmDeleteNote}
        onCancel={() => setNoteToDelete(null)}
        variant="danger"
      />
    </div>
  )
}

