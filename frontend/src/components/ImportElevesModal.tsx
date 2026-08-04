import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Upload, X } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../contexts/ToastContext'

interface ParsedRow {
  nom: string
  prenom: string
  sexe: string
  dateNaissance: string
  lieuNaissance: string
  classe: string
  tuteurNom: string
  tuteurPrenom: string
  tuteurTelephone: string
  _raw: string[]
  _error?: string
}

interface ImportResult {
  imported: number
  errors: Array<{ ligne: number; message: string }>
}

// Colonnes reconnues (variantes acceptées)
const COL_ALIASES: Record<keyof Omit<ParsedRow, '_raw' | '_error'>, string[]> = {
  nom:              ['nom', 'name', 'last_name', 'lastname'],
  prenom:           ['prenom', 'prénom', 'first_name', 'firstname', 'given_name'],
  sexe:             ['sexe', 'genre', 'sex', 'gender'],
  dateNaissance:    ['date_naissance', 'datenaissance', 'date naissance', 'date_de_naissance', 'naissance', 'birth_date', 'birthdate'],
  lieuNaissance:    ['lieu_naissance', 'lieunaissance', 'lieu naissance', 'lieu_de_naissance', 'lieu', 'birth_place'],
  classe:           ['classe', 'class', 'niveau', 'group'],
  tuteurNom:        ['tuteur_nom', 'tuteurnom', 'tuteur nom', 'tuteur', 'parent', 'parent_nom', 'parent_name'],
  tuteurPrenom:     ['tuteur_prenom', 'tuteurprenom', 'tuteur prenom', 'tuteur_prénom', 'parent_prenom', 'parent_prénom'],
  tuteurTelephone:  ['tuteur_telephone', 'tuteur_tel', 'telephone', 'tel', 'phone', 'contact']
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let inQuotes = false
    let cell = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cell += '"'; i++ }
        else inQuotes = !inQuotes
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        cells.push(cell.trim())
        cell = ''
      } else {
        cell += ch
      }
    }
    cells.push(cell.trim())
    rows.push(cells)
  }
  return rows
}

function detectColumnIndices(header: string[]): Record<keyof Omit<ParsedRow, '_raw' | '_error'>, number> {
  const idx: Record<string, number> = {}
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    const colIndex = header.findIndex(h =>
      aliases.includes(h.toLowerCase().replace(/[^a-z_éèêà ]/g, '').trim())
    )
    idx[field] = colIndex
  }
  return idx as any
}

function mapRow(raw: string[], indices: Record<string, number>): ParsedRow {
  const get = (field: string) => (indices[field] >= 0 ? (raw[indices[field]] || '').trim() : '')
  const row: ParsedRow = {
    nom: get('nom'),
    prenom: get('prenom'),
    sexe: get('sexe').toUpperCase(),
    dateNaissance: get('dateNaissance'),
    lieuNaissance: get('lieuNaissance'),
    classe: get('classe'),
    tuteurNom: get('tuteurNom'),
    tuteurPrenom: get('tuteurPrenom'),
    tuteurTelephone: get('tuteurTelephone'),
    _raw: raw
  }
  if (!row.nom) row._error = 'Nom manquant'
  else if (!row.prenom) row._error = 'Prénom manquant'
  else if (row.sexe && !['M', 'F'].includes(row.sexe)) row._error = `Sexe invalide: "${row.sexe}"`
  return row
}

const TEMPLATE_HEADERS = [
  'Nom',
  'Prénom',
  'Sexe',
  'Date_Naissance',
  'Lieu_Naissance',
  'Classe',
  'Tuteur_Nom',
  'Tuteur_Prenom',
  'Tuteur_Tel',
]

const TEMPLATE_EXAMPLES = [
  ['Kouma',     'Koffi',   'M', '2010-05-12', 'Lomé',     'CM2 A',     'Kouma',      'Yao',   '90 11 22 33'],
  ['Amevor',    'Akosua',  'F', '2011-09-03', 'Kpalimé',  'CM1 B',     'Amevor',     'Edoh',  '91 44 55 66'],
  ['Agbeko',    'Kossi',   'M', '2009-11-28', 'Atakpamé', '6ème A',    'Agbeko',     'Mawuli','92 77 88 99'],
  ['Mawutor',   'Kafui',   'F', '2012-01-17', 'Sokodé',   'CE2 A',     'Mawutor',    'Afi',   '93 00 11 22'],
  ['Dzivaguru', 'Edem',    'M', '2008-07-30', 'Dapaong',  'Seconde A', 'Dzivaguru',  'Selom', '94 33 44 55'],
]

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadTemplate() {
  const lines = [
    TEMPLATE_HEADERS.map(escapeCsvCell).join(','),
    ...TEMPLATE_EXAMPLES.map(row => row.map(escapeCsvCell).join(',')),
  ]
  // BOM UTF-8 pour ouverture correcte dans Excel (accents, caractères spéciaux)
  const csv = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modele_import_eleves.csv'
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  anneeScolaire?: string
}

export default function ImportElevesModal({ isOpen, onClose, onImported, anneeScolaire }: Props) {
  const { success, error: toastError } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  if (!isOpen) return null

  const validRows = rows.filter(r => !r._error)
  const invalidRows = rows.filter(r => r._error)

  const handleFile = (file: File) => {
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rawRows = parseCSV(text)
      if (rawRows.length < 2) {
        toastError('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données')
        return
      }
      const header = rawRows[0].map(h => h.toLowerCase().replace(/[^a-z_éèêà ]/g, '').trim())
      const indices = detectColumnIndices(header)
      const parsed = rawRows.slice(1).map(raw => mapRow(raw, indices))
      setRows(parsed)
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const res = await api.post('/eleves/batch', {
        eleves: validRows.map(r => ({
          nom: r.nom,
          prenom: r.prenom,
          sexe: r.sexe || undefined,
          dateNaissance: r.dateNaissance || undefined,
          lieuNaissance: r.lieuNaissance || undefined,
          classe: r.classe || undefined,
          tuteurNom: r.tuteurNom || undefined,
          tuteurPrenom: r.tuteurPrenom || undefined,
          tuteurTelephone: r.tuteurTelephone || undefined
        })),
        anneeScolaire
      })
      setResult(res.data)
      if (res.data.imported > 0) {
        success(`${res.data.imported} élève(s) importé(s) avec succès`)
        onImported()
      }
      if (res.data.errors.length === 0) {
        onClose()
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Erreur lors de l\'importation')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setRows([])
    setFileName('')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-800 shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4 shrink-0">
          <div>
            <h3 className="text-lg font-display font-bold text-gray-900 dark:text-gray-100">Importer des élèves</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Importation en masse depuis un fichier CSV</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Template download */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
            <div className="flex items-center justify-between gap-4 mb-2">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Modèle CSV à télécharger</p>
              <button
                onClick={downloadTemplate}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Modèle
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Nom', note: '' },
                { label: 'Prénom', note: '' },
                { label: 'Sexe', note: 'M ou F' },
                { label: 'Date_Naissance', note: 'AAAA-MM-JJ' },
                { label: 'Lieu_Naissance', note: '' },
                { label: 'Classe', note: 'ex : CM2 A' },
                { label: 'Tuteur_Nom', note: '' },
                { label: 'Tuteur_Prenom', note: '' },
                { label: 'Tuteur_Tel', note: '' },
              ].map(({ label, note }) => (
                <span key={label} className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-800/40 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300">
                  {label}
                  {note && <span className="opacity-60">({note})</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          {rows.length === 0 && (
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliquez ou déposez un fichier CSV</p>
              <p className="text-xs text-gray-400 mt-1">Séparateur virgule ou point-virgule, encodage UTF-8</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {rows.length} lignes
                  </span>
                  {validRows.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {validRows.length} valides
                    </span>
                  )}
                  {invalidRows.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {invalidRows.length} erreurs
                    </span>
                  )}
                </div>
                <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  Changer de fichier
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Nom</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Prénom</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Sexe</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Classe</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Tuteur</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className={row._error ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{row.nom || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.prenom || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.sexe || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.classe || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.tuteurNom || '—'}</td>
                        <td className="px-3 py-2">
                          {row._error
                            ? <span className="text-xs text-red-600 dark:text-red-400">{row._error}</span>
                            : <span className="text-xs text-green-600 dark:text-green-400">OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
                    … et {rows.length - 50} autres lignes (toutes seront importées)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {result.imported} élève(s) importé(s) avec succès
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{result.errors.length} erreur(s)</p>
                  </div>
                  <ul className="mt-1 space-y-0.5 pl-6">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400">
                        Ligne {e.ligne} : {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4 shrink-0">
          <button onClick={onClose} className="btn btn-secondary">
            {result ? 'Fermer' : 'Annuler'}
          </button>
          {rows.length > 0 && !result && (
            <button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              className="btn btn-primary flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importation...' : `Importer ${validRows.length} élève(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
