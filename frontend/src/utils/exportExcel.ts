// ── Palette SchoolTogo (voir tailwind.config.js) ────────────────────────────
const COLOR_FOREST_900 = 'FF14251C' // fond bandeau titre
const COLOR_GOLD_500 = 'FFC99A3E'   // fond en-tête colonnes
const COLOR_CREAM_50 = 'FFFAF6EC'   // bande alternée
const COLOR_CREAM_300 = 'FFE6DFC9'  // bordures
const COLOR_WHITE = 'FFFFFFFF'

type ColumnType = 'text' | 'number' | 'currency' | 'date'

export interface ExcelColumn {
  path: string
  label: string
  type?: ColumnType
}

/** Résout un chemin pointé sur un objet imbriqué, ex: 'eleve.nom' → obj.eleve.nom */
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc !== null && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/** Convertit une valeur brute vers le type de cellule Excel attendu par la colonne */
function cellValue(raw: unknown, type: ColumnType): string | number | Date {
  if (raw === null || raw === undefined || raw === '') return ''

  if (type === 'date') {
    const str = String(raw).trim()
    const d = new Date(str)
    return isNaN(d.getTime()) ? str : d
  }

  if (type === 'number' || type === 'currency') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
    return isNaN(n) ? '' : n
  }

  return String(raw).trim()
}

/**
 * Exporte un tableau de données vers un fichier Excel (.xlsx) mis en forme :
 * bandeau de titre, en-têtes colorés, lignes alternées, montants/dates
 * formatés et alignés, ligne d'en-tête figée, filtre automatique.
 *
 * @param data       Tableau d'objets
 * @param filename   Nom du fichier sans extension
 * @param sheetName  Nom de l'onglet (et titre affiché en haut du tableau)
 * @param columns    Colonnes ordonnées { path, label, type }
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Données',
  columns: ExcelColumn[]
): Promise<void> {
  if (!data.length) return

  // Chargé à la demande : exceljs est lourd, on évite de l'inclure dans le
  // bundle principal pour un export utilisé sur quelques pages seulement.
  const { default: ExcelJS } = await import('exceljs')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SchoolTogo'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
  })

  const colCount = columns.length

  // ── Ligne 1 : bandeau de titre ──────────────────────────────────────────
  sheet.mergeCells(1, 1, 1, colCount)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `SchoolTogo — ${sheetName}`
  titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: COLOR_WHITE } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FOREST_900 } }
  sheet.getRow(1).height = 26

  // ── Ligne 2 : sous-titre (date + nombre de lignes) ──────────────────────
  sheet.mergeCells(2, 1, 2, colCount)
  const subtitleCell = sheet.getCell(2, 1)
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  subtitleCell.value = `Généré le ${dateStr} — ${data.length} ligne${data.length > 1 ? 's' : ''}`
  subtitleCell.font = { name: 'Calibri', italic: true, size: 9.5, color: { argb: 'FF5B6B5F' } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CREAM_50 } }
  sheet.getRow(2).height = 18

  // ── Ligne 3 : en-têtes de colonnes ───────────────────────────────────────
  const headerRow = sheet.getRow(3)
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.label
    cell.font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: COLOR_FOREST_900 } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GOLD_500 } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: COLOR_CREAM_300 } },
      bottom: { style: 'thin', color: { argb: COLOR_CREAM_300 } },
      left: { style: 'thin', color: { argb: COLOR_CREAM_300 } },
      right: { style: 'thin', color: { argb: COLOR_CREAM_300 } },
    }
  })
  headerRow.height = 20

  // ── Lignes de données ─────────────────────────────────────────────────
  data.forEach((rowData, rowIndex) => {
    const row = sheet.getRow(4 + rowIndex)
    const banded = rowIndex % 2 === 1
    columns.forEach((col, i) => {
      const type = col.type || 'text'
      const cell = row.getCell(i + 1)
      cell.value = cellValue(getPath(rowData, col.path), type)
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF2A2A2A' } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: type === 'number' || type === 'currency' ? 'right' : type === 'date' ? 'center' : 'left',
      }
      if (type === 'currency') cell.numFmt = '#,##0" XOF"'
      else if (type === 'number') cell.numFmt = '#,##0'
      else if (type === 'date') cell.numFmt = 'dd/mm/yyyy'
      if (banded) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CREAM_50 } }
      }
      cell.border = {
        bottom: { style: 'hair', color: { argb: COLOR_CREAM_300 } },
        left: { style: 'hair', color: { argb: COLOR_CREAM_300 } },
        right: { style: 'hair', color: { argb: COLOR_CREAM_300 } },
      }
    })
  })

  // ── Largeur des colonnes (auto, min 12, max 40) ─────────────────────────
  columns.forEach((col, i) => {
    const contentLengths = data.map((rowData) => {
      const v = cellValue(getPath(rowData, col.path), col.type || 'text')
      return v instanceof Date ? 10 : String(v ?? '').length
    })
    sheet.getColumn(i + 1).width = Math.min(40, Math.max(12, col.label.length + 2, ...contentLengths) + 2)
  })

  // ── Filtre automatique sur la ligne d'en-tête ───────────────────────────
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: colCount },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Helpers métier ────────────────────────────────────────────────────────────

export function exportEleves(eleves: Record<string, unknown>[]): void {
  void exportToExcel(
    eleves,
    `eleves_${new Date().toISOString().split('T')[0]}`,
    'Élèves',
    [
      { path: 'matricule',        label: 'Matricule' },
      { path: 'nom',              label: 'Nom' },
      { path: 'prenom',           label: 'Prénom' },
      { path: 'sexe',             label: 'Sexe' },
      { path: 'dateNaissance',    label: 'Date de naissance', type: 'date' },
      { path: 'lieuNaissance',    label: 'Lieu de naissance' },
      { path: 'classe.nom',       label: 'Classe' },
      { path: 'statut',           label: 'Statut' },
      { path: 'tuteur.nom',       label: 'Tuteur (nom)' },
      { path: 'tuteur.telephone', label: 'Tuteur (tél.)' },
      { path: 'anneeScolaire',    label: 'Année scolaire' },
    ]
  )
}

export function exportEnseignants(enseignants: Record<string, unknown>[]): void {
  void exportToExcel(
    enseignants,
    `enseignants_${new Date().toISOString().split('T')[0]}`,
    'Enseignants',
    [
      { path: 'matricule',   label: 'Matricule' },
      { path: 'nom',         label: 'Nom' },
      { path: 'prenom',      label: 'Prénom' },
      { path: 'sexe',        label: 'Sexe' },
      { path: 'telephone',   label: 'Téléphone' },
      { path: 'email',       label: 'Email' },
      { path: 'specialite',  label: 'Spécialité' },
      { path: 'typeContrat', label: 'Type contrat' },
      { path: 'statut',      label: 'Statut' },
    ]
  )
}

export function exportPaiements(paiements: Record<string, unknown>[]): void {
  void exportToExcel(
    paiements,
    `paiements_${new Date().toISOString().split('T')[0]}`,
    'Paiements',
    [
      { path: 'datePaiement',    label: 'Date', type: 'date' },
      { path: 'eleve.matricule', label: 'Matricule élève' },
      { path: 'eleve.nom',       label: 'Nom élève' },
      { path: 'eleve.prenom',    label: 'Prénom élève' },
      { path: 'typePaiement',    label: 'Type de paiement' },
      { path: 'montant',         label: 'Montant', type: 'currency' },
      { path: 'devise',          label: 'Devise' },
      { path: 'modePaiement',    label: 'Mode de paiement' },
      { path: 'statut',          label: 'Statut' },
      { path: 'anneeScolaire',   label: 'Année scolaire' },
    ]
  )
}

export function exportImpayes(
  impayes: Record<string, unknown>[],
  meta?: { anneeScolaire?: string; devise?: string }
): void {
  const rows = impayes.map((item) => {
    const classe = (item as Record<string, unknown>).classe as Record<string, unknown> | null | undefined
    return {
      anneeScolaire: meta?.anneeScolaire || '',
      classe: classe?.nom || 'Sans classe',
      matricule: (item as Record<string, unknown>).matricule || '',
      nom: (item as Record<string, unknown>).nom || '',
      prenom: (item as Record<string, unknown>).prenom || '',
      totalDu: (item as Record<string, unknown>).totalDu ?? '',
      totalPaye: (item as Record<string, unknown>).totalPaye ?? '',
      resteAPayer: (item as Record<string, unknown>).resteAPayer ?? '',
      devise: meta?.devise || (item as Record<string, unknown>).devise || 'XOF'
    }
  })

  void exportToExcel(
    rows as Record<string, unknown>[],
    `impayes_${new Date().toISOString().split('T')[0]}`,
    'Impayés',
    [
      { path: 'anneeScolaire', label: 'Année scolaire' },
      { path: 'classe',        label: 'Classe' },
      { path: 'matricule',     label: 'Matricule élève' },
      { path: 'nom',           label: 'Nom' },
      { path: 'prenom',        label: 'Prénom' },
      { path: 'totalDu',       label: 'Total dû', type: 'currency' },
      { path: 'totalPaye',     label: 'Total payé', type: 'currency' },
      { path: 'resteAPayer',   label: 'Reste à payer', type: 'currency' },
      { path: 'devise',        label: 'Devise' },
    ]
  )
}

export function exportNotesDetaillees(
  notes: Record<string, unknown>[],
  meta?: { classe?: string; anneeScolaire?: string }
): void {
  const rows = notes.map((note) => {
    const classe = (note as Record<string, unknown>).classe as Record<string, unknown> | undefined
    const eleve = (note as Record<string, unknown>).eleve as Record<string, unknown> | undefined
    const matiere = (note as Record<string, unknown>).matiere as Record<string, unknown> | undefined
    return {
      anneeScolaire: meta?.anneeScolaire || (note as Record<string, unknown>).anneeScolaire || '',
      classe: classe?.nom || meta?.classe || '',
      cycle: classe?.cycle || '',
      eleveMatricule: eleve?.matricule || '',
      eleveNom: eleve?.nom || '',
      elevePrenom: eleve?.prenom || '',
      matiere: matiere?.nom || '',
      type: (note as Record<string, unknown>).typeEvaluation || '',
      periode: (note as Record<string, unknown>).periode || '',
      noteBrute: (note as Record<string, unknown>).displayBrute ?? (note as Record<string, unknown>).note ?? '',
      noteMax: (note as Record<string, unknown>).noteMax ?? '',
      coefficient: (note as Record<string, unknown>).coefficient ?? '',
      notePonderee: (note as Record<string, unknown>).weightedNote ?? '',
      notePondereeMax: (note as Record<string, unknown>).weightedMax ?? '',
      dateEvaluation: (note as Record<string, unknown>).dateEvaluation || ''
    }
  })

  void exportToExcel(
    rows as Record<string, unknown>[],
    `notes_${new Date().toISOString().split('T')[0]}`,
    'Notes',
    [
      { path: 'anneeScolaire',     label: 'Année scolaire' },
      { path: 'classe',            label: 'Classe' },
      { path: 'cycle',             label: 'Cycle' },
      { path: 'eleveMatricule',    label: 'Matricule élève' },
      { path: 'eleveNom',          label: 'Nom élève' },
      { path: 'elevePrenom',       label: 'Prénom élève' },
      { path: 'matiere',           label: 'Matière' },
      { path: 'type',              label: 'Type' },
      { path: 'periode',           label: 'Période' },
      { path: 'noteBrute',         label: 'Note brute', type: 'number' },
      { path: 'noteMax',           label: 'Note maximale', type: 'number' },
      { path: 'coefficient',       label: 'Coefficient', type: 'number' },
      { path: 'notePonderee',      label: 'Note pondérée', type: 'number' },
      { path: 'notePondereeMax',   label: 'Pondérée max', type: 'number' },
      { path: 'dateEvaluation',    label: 'Date', type: 'date' },
    ]
  )
}

export function exportAbsences(absences: Record<string, unknown>[]): void {
  const rows = absences.map((a) => {
    const eleve = (a as Record<string, unknown>).eleve as Record<string, unknown> | undefined
    const classe = (a as Record<string, unknown>).classe as Record<string, unknown> | undefined
    return {
      date: (a as Record<string, unknown>).date || '',
      eleve_matricule: eleve?.matricule || '',
      eleve_nom: eleve?.nom || '',
      eleve_prenom: eleve?.prenom || '',
      classe_nom: classe?.nom || '',
      periode: (a as Record<string, unknown>).periode || '',
      statut: (a as Record<string, unknown>).justifiee ? 'Justifiée' : 'Non justifiée',
      motif: (a as Record<string, unknown>).motif || ''
    }
  })

  void exportToExcel(
    rows as Record<string, unknown>[],
    `absences_${new Date().toISOString().split('T')[0]}`,
    'Absences',
    [
      { path: 'date',            label: 'Date', type: 'date' },
      { path: 'eleve_matricule', label: 'Matricule élève' },
      { path: 'eleve_nom',       label: 'Nom élève' },
      { path: 'eleve_prenom',    label: 'Prénom élève' },
      { path: 'classe_nom',      label: 'Classe' },
      { path: 'periode',         label: 'Période' },
      { path: 'statut',          label: 'Statut' },
      { path: 'motif',           label: 'Motif' },
    ]
  )
}
