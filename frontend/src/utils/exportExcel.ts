import * as XLSX from 'xlsx'

/** Résout un chemin pointé sur un objet imbriqué, ex: 'eleve.nom' → obj.eleve.nom */
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc !== null && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/** Formate une valeur pour l'affichage Excel */
function fmt(value: unknown): string | number {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') return value
  const str = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(str)) {
    try {
      const d = new Date(str)
      if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      }
    } catch { /* keep original */ }
  }
  return str
}

/**
 * Exporte un tableau de données vers un fichier Excel (.xlsx).
 *
 * @param data       Tableau d'objets
 * @param filename   Nom du fichier sans extension
 * @param sheetName  Nom de l'onglet
 * @param columns    Tableau ordonné de { path: 'clé.imbriquée', label: 'En-tête colonne' }
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Données',
  columns?: Array<{ path: string; label: string }>
): void {
  if (!data.length) return

  let rows: Record<string, unknown>[]

  if (columns) {
    rows = data.map((row) => {
      const mapped: Record<string, unknown> = {}
      columns.forEach(({ path, label }) => {
        mapped[label] = fmt(getPath(row, path))
      })
      return mapped
    })
  } else {
    rows = data.map((row) => {
      const mapped: Record<string, unknown> = {}
      Object.keys(row).forEach((k) => { mapped[k] = fmt(row[k]) })
      return mapped
    })
  }

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // Largeur de colonne automatique (min 12, max 40 caractères)
  const headers = Object.keys(rows[0] || {})
  worksheet['!cols'] = headers.map((h) => ({
    wch: Math.min(40, Math.max(12, h.length + 2,
      ...rows.map((r) => String(r[h] ?? '').length + 1)
    )),
  }))

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

// ── Helpers métier ────────────────────────────────────────────────────────────

export function exportEleves(eleves: Record<string, unknown>[]): void {
  exportToExcel(
    eleves,
    `eleves_${new Date().toISOString().split('T')[0]}`,
    'Élèves',
    [
      { path: 'matricule',        label: 'Matricule' },
      { path: 'nom',              label: 'Nom' },
      { path: 'prenom',           label: 'Prénom' },
      { path: 'sexe',             label: 'Sexe' },
      { path: 'dateNaissance',    label: 'Date de naissance' },
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
  exportToExcel(
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
  exportToExcel(
    paiements,
    `paiements_${new Date().toISOString().split('T')[0]}`,
    'Paiements',
    [
      { path: 'datePaiement',    label: 'Date' },
      { path: 'eleve.matricule', label: 'Matricule élève' },
      { path: 'eleve.nom',       label: 'Nom élève' },
      { path: 'eleve.prenom',    label: 'Prénom élève' },
      { path: 'typePaiement',    label: 'Type de paiement' },
      { path: 'montant',         label: 'Montant' },
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

  exportToExcel(
    rows as Record<string, unknown>[],
    `impayes_${new Date().toISOString().split('T')[0]}`,
    'Impayes',
    [
      { path: 'anneeScolaire', label: 'Année scolaire' },
      { path: 'classe', label: 'Classe' },
      { path: 'matricule', label: 'Matricule élève' },
      { path: 'nom', label: 'Nom' },
      { path: 'prenom', label: 'Prénom' },
      { path: 'totalDu', label: 'Total dû' },
      { path: 'totalPaye', label: 'Total payé' },
      { path: 'resteAPayer', label: 'Reste à  payer' },
      { path: 'devise', label: 'Devise' }
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

  exportToExcel(
    rows as Record<string, unknown>[],
    `notes_${new Date().toISOString().split('T')[0]}`,
    'Notes',
    [
      { path: 'anneeScolaire', label: 'Année scolaire' },
      { path: 'classe', label: 'Classe' },
      { path: 'cycle', label: 'Cycle' },
      { path: 'eleveMatricule', label: 'Matricule élève' },
      { path: 'eleveNom', label: 'Nom élève' },
      { path: 'elevePrenom', label: 'Prénom élève' },
      { path: 'matiere', label: 'Matière' },
      { path: 'type', label: 'Type' },
      { path: 'periode', label: 'Période' },
      { path: 'noteBrute', label: 'Note brute' },
      { path: 'noteMax', label: 'Note maximale' },
      { path: 'coefficient', label: 'Coefficient' },
      { path: 'notePonderee', label: 'Note pondérée' },
      { path: 'notePondereeMax', label: 'Pondérée max' },
      { path: 'dateEvaluation', label: 'Date' }
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
      statut: (a as Record<string, unknown>).justifiee ? 'Justifiee' : 'Non justifiee',
      motif: (a as Record<string, unknown>).motif || ''
    }
  })

  exportToExcel(
    rows as Record<string, unknown>[],
    `absences_${new Date().toISOString().split('T')[0]}`,
    'Absences',
    [
      { path: 'date', label: 'Date' },
      { path: 'eleve_matricule', label: 'Matricule eleve' },
      { path: 'eleve_nom', label: 'Nom eleve' },
      { path: 'eleve_prenom', label: 'Prenom eleve' },
      { path: 'classe_nom', label: 'Classe' },
      { path: 'periode', label: 'Periode' },
      { path: 'statut', label: 'Statut' },
      { path: 'motif', label: 'Motif' }
    ]
  )
}
