import { useState, useMemo, useEffect } from 'react'
import Modal from './Modal'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'

// ── Données du système togolais ──────────────────────────────────────────────

const PRIMAIRE = [
  { label: 'CP1', enum: 'CP1' },
  { label: 'CP2', enum: 'CP2' },
  { label: 'CE1', enum: 'CE1' },
  { label: 'CE2', enum: 'CE2' },
  { label: 'CM1', enum: 'CM1' },
  { label: 'CM2', enum: 'CM2' }
]

const COLLEGE = [
  { label: '6ème', enum: 'SIXIEME' },
  { label: '5ème', enum: 'CINQUIEME' },
  { label: '4ème', enum: 'QUATRIEME' },
  { label: '3ème', enum: 'TROISIEME' }
]

const LYCEE_NIVEAUX = [
  { label: '2nde', enum: 'SECONDE' },
  { label: '1ère', enum: 'PREMIERE' },
  { label: 'Terminale', enum: 'TERMINALE' }
]

const SERIES_GENERAL = ['A', 'B', 'C', 'D']
const SERIES_TECHNIQUE = ['E', 'F1', 'F2', 'F3', 'F4', 'G1', 'G2', 'G3']
const SECTION_PRESETS = ['A', 'B', 'C', 'D', 'E', 'F']

// ── Types ────────────────────────────────────────────────────────────────────

interface ClassePayload {
  nom: string
  niveau: string
  cycle: string
  section: string
  anneeScolaire: string
  effectifMax: number
  devise: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// ── Sous-composant : toggle chip ─────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-semibold border transition-colors ${
        active
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400 hover:text-primary-600'
      }`}
    >
      {label}
    </button>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function ImportClassesModal({ isOpen, onClose, onSuccess }: Props) {
  const { success, error: toastError } = useToast()

  const [anneeScolaire, setAnneeScolaire] = useState('')
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState(0)

  // Sélections Primaire
  const [primNiveaux, setPrimNiveaux] = useState<Set<string>>(new Set())
  const [primSections, setPrimSections] = useState<Set<string>>(new Set(['A']))

  // Sélections Collège
  const [colNiveaux, setColNiveaux] = useState<Set<string>>(new Set())
  const [colSections, setColSections] = useState<Set<string>>(new Set(['A']))

  // Sélections Lycée
  const [lycNiveaux, setLycNiveaux] = useState<Set<string>>(new Set())
  const [lycSeries, setLycSeries] = useState<Set<string>>(new Set())

  // Chargement de l'année scolaire active
  useEffect(() => {
    if (!isOpen) return
    api.get('/annees/active')
      .then(r => setAnneeScolaire(r.data?.annee || ''))
      .catch(() => setAnneeScolaire(''))
  }, [isOpen])

  // Reset à la fermeture
  useEffect(() => {
    if (!isOpen) {
      setPrimNiveaux(new Set())
      setPrimSections(new Set(['A']))
      setColNiveaux(new Set())
      setColSections(new Set(['A']))
      setLycNiveaux(new Set())
      setLycSeries(new Set())
      setProgress(0)
    }
  }, [isOpen])

  // ── Helpers toggles ────────────────────────────────────────────────────────

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set)
    next.has(val) ? next.delete(val) : next.add(val)
    setter(next)
  }

  function toggleAll<T>(items: T[], set: Set<T>, setter: (s: Set<T>) => void) {
    setter(set.size === items.length ? new Set() : new Set(items))
  }

  // ── Calcul des classes à créer ─────────────────────────────────────────────

  const classesToCreate = useMemo<ClassePayload[]>(() => {
    const result: ClassePayload[] = []

    // Primaire
    for (const n of PRIMAIRE) {
      if (!primNiveaux.has(n.enum)) continue
      for (const s of primSections) {
        result.push({
          nom: `${n.label} ${s}`,
          niveau: n.enum,
          cycle: 'PRIMAIRE',
          section: s,
          anneeScolaire,
          effectifMax: 50,
          devise: 'XOF'
        })
      }
    }

    // Collège
    for (const n of COLLEGE) {
      if (!colNiveaux.has(n.enum)) continue
      for (const s of colSections) {
        result.push({
          nom: `${n.label} ${s}`,
          niveau: n.enum,
          cycle: 'COLLEGE',
          section: s,
          anneeScolaire,
          effectifMax: 50,
          devise: 'XOF'
        })
      }
    }

    // Lycée
    for (const n of LYCEE_NIVEAUX) {
      if (!lycNiveaux.has(n.enum)) continue
      for (const serie of [...SERIES_GENERAL, ...SERIES_TECHNIQUE]) {
        if (!lycSeries.has(serie)) continue
        result.push({
          nom: `${n.label} ${serie}`,
          niveau: n.enum,
          cycle: 'LYCEE',
          section: serie,
          anneeScolaire,
          effectifMax: 50,
          devise: 'XOF'
        })
      }
    }

    return result
  }, [primNiveaux, primSections, colNiveaux, colSections, lycNiveaux, lycSeries, anneeScolaire])

  // ── Création ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!anneeScolaire) {
      toastError('Aucune année scolaire active. Activez-en une dans Configuration.')
      return
    }
    if (classesToCreate.length === 0) return

    setCreating(true)
    setProgress(0)
    const errors: string[] = []
    let count = 0

    for (const classe of classesToCreate) {
      try {
        await api.post('/classes', classe)
        count++
        setProgress(Math.round((count / classesToCreate.length) * 100))
      } catch {
        errors.push(classe.nom)
      }
    }

    setCreating(false)
    if (count > 0) {
      success(`${count} classe(s) créée(s) avec succès`)
      onSuccess()
      onClose()
    }
    if (errors.length > 0) {
      toastError(`Erreur pour : ${errors.join(', ')}`)
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Création rapide des classes" size="lg">
      <div className="space-y-5 py-1">

        {/* Année scolaire */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 shrink-0">Année scolaire</label>
          <input
            value={anneeScolaire}
            onChange={e => setAnneeScolaire(e.target.value)}
            placeholder="ex: 2025-2026"
            className="input h-8 text-sm w-36"
          />
          {!anneeScolaire && (
            <span className="text-xs text-amber-600">Aucune année active détectée</span>
          )}
        </div>

        {/* ── Primaire ── */}
        <Section
          title="Primaire"
          color="green"
          active={primNiveaux.size > 0}
        >
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Niveaux</span>
                <button
                  type="button"
                  onClick={() => toggleAll(PRIMAIRE.map(n => n.enum), primNiveaux, setPrimNiveaux)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {primNiveaux.size === PRIMAIRE.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRIMAIRE.map(n => (
                  <Chip
                    key={n.enum}
                    label={n.label}
                    active={primNiveaux.has(n.enum)}
                    onClick={() => toggle(primNiveaux, n.enum, setPrimNiveaux)}
                  />
                ))}
              </div>
            </div>
            {primNiveaux.size > 0 && (
              <SectionChips
                label="Sections"
                presets={SECTION_PRESETS}
                selected={primSections}
                setSelected={setPrimSections}
              />
            )}
          </div>
        </Section>

        {/* ── Collège ── */}
        <Section
          title="Collège"
          color="blue"
          active={colNiveaux.size > 0}
        >
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Niveaux</span>
                <button
                  type="button"
                  onClick={() => toggleAll(COLLEGE.map(n => n.enum), colNiveaux, setColNiveaux)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {colNiveaux.size === COLLEGE.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {COLLEGE.map(n => (
                  <Chip
                    key={n.enum}
                    label={n.label}
                    active={colNiveaux.has(n.enum)}
                    onClick={() => toggle(colNiveaux, n.enum, setColNiveaux)}
                  />
                ))}
              </div>
            </div>
            {colNiveaux.size > 0 && (
              <SectionChips
                label="Sections"
                presets={SECTION_PRESETS}
                selected={colSections}
                setSelected={setColSections}
              />
            )}
          </div>
        </Section>

        {/* ── Lycée ── */}
        <Section
          title="Lycée"
          color="purple"
          active={lycNiveaux.size > 0}
        >
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Niveaux</span>
                <button
                  type="button"
                  onClick={() => toggleAll(LYCEE_NIVEAUX.map(n => n.enum), lycNiveaux, setLycNiveaux)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {lycNiveaux.size === LYCEE_NIVEAUX.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {LYCEE_NIVEAUX.map(n => (
                  <Chip
                    key={n.enum}
                    label={n.label}
                    active={lycNiveaux.has(n.enum)}
                    onClick={() => toggle(lycNiveaux, n.enum, setLycNiveaux)}
                  />
                ))}
              </div>
            </div>

            {lycNiveaux.size > 0 && (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Séries générales</span>
                    <button
                      type="button"
                      onClick={() => toggleAll(SERIES_GENERAL, lycSeries, setLycSeries)}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {SERIES_GENERAL.every(s => lycSeries.has(s)) ? 'Désélect.' : 'Tout'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SERIES_GENERAL.map(s => (
                      <Chip
                        key={s}
                        label={`Série ${s}`}
                        active={lycSeries.has(s)}
                        onClick={() => toggle(lycSeries, s, setLycSeries)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Séries techniques</span>
                    <button
                      type="button"
                      onClick={() => toggleAll(SERIES_TECHNIQUE, lycSeries, setLycSeries)}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {SERIES_TECHNIQUE.every(s => lycSeries.has(s)) ? 'Désélect.' : 'Tout'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SERIES_TECHNIQUE.map(s => (
                      <Chip
                        key={s}
                        label={`Série ${s}`}
                        active={lycSeries.has(s)}
                        onClick={() => toggle(lycSeries, s, setLycSeries)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* ── Aperçu ── */}
        {classesToCreate.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">
                Aperçu — {classesToCreate.length} classe(s) à créer
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {classesToCreate.map(c => (
                <span
                  key={`${c.cycle}-${c.niveau}-${c.section}`}
                  className="rounded bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-700"
                >
                  {c.nom}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Barre de progression */}
        {creating && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Création en cours...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Boutons */}
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="btn btn-secondary"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || classesToCreate.length === 0}
            className="btn btn-primary"
          >
            {creating
              ? `Création... (${progress}%)`
              : classesToCreate.length > 0
                ? `Créer ${classesToCreate.length} classe(s)`
                : 'Sélectionner des classes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Composant Section (bloc avec titre coloré) ───────────────────────────────

function Section({
  title,
  color,
  active,
  children
}: {
  title: string
  color: 'green' | 'blue' | 'purple'
  active: boolean
  children: React.ReactNode
}) {
  const colorMap = {
    green: { bg: 'bg-green-50', border: 'border-green-100', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    blue:  { bg: 'bg-blue-50',  border: 'border-blue-100',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
    purple:{ bg: 'bg-purple-50',border: 'border-purple-100',badge: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' }
  }
  const c = colorMap[color]

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2.5 w-2.5 rounded-full ${active ? c.dot : 'bg-gray-300'}`} />
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {active && (
          <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
            Sélectionné
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Composant SectionChips (sélection des sections lettres) ──────────────────

function SectionChips({
  label,
  presets,
  selected,
  setSelected
}: {
  label: string
  presets: string[]
  selected: Set<string>
  setSelected: (s: Set<string>) => void
}) {
  const [custom, setCustom] = useState('')

  function toggle(val: string) {
    const next = new Set(selected)
    next.has(val) ? next.delete(val) : next.add(val)
    setSelected(next)
  }

  function addCustom() {
    const val = custom.trim().toUpperCase()
    if (!val) return
    const next = new Set(selected)
    next.add(val)
    setSelected(next)
    setCustom('')
  }

  // sections hors presets
  const extras = [...selected].filter(s => !presets.includes(s))

  return (
    <div>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">{label}</span>
      <div className="flex flex-wrap gap-2 items-center">
        {presets.map(s => (
          <Chip key={s} label={s} active={selected.has(s)} onClick={() => toggle(s)} />
        ))}
        {extras.map(s => (
          <Chip key={s} label={s} active onClick={() => toggle(s)} />
        ))}
        <div className="flex items-center gap-1">
          <input
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Autre..."
            className="input h-8 w-20 text-sm"
          />
          <button
            type="button"
            onClick={addCustom}
            className="h-8 px-2 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
