interface BulletinData {
  eleve: { nom: string; prenom: string; matricule: string; date_naissance?: string; sexe?: string }
  classe: { nom: string; niveau?: string; cycle?: string }
  effectif: number
  periodeLabel: string
  anneeScolaire: string
  lignes: Array<{
    matiereNom: string
    matiereCode?: string
    inter: number | null
    devoir: number | null
    moyenneClasse: number | null
    composition: number | null
    noteSur20: number | null
    coefficient: number
    noteCoefficient: number | null
    noteCoefficientMax: number | null
    rang: number | null
    professeur: string | null
    appreciation: string | null
  }>
  resume: {
    totalCoefficients: number
    totalPoints: number
    totalPointsMax: number
    moyenneGenerale: number | null
    rangClasse: number | null
    mention: string | null
    moyenneClasseGenerale: number | null
    meilleureMoyenne: number | null
    plusFaibleMoyenne: number | null
    absences: number
    absencesJustifiees: number
    absencesNonJustifiees: number
    retards: number
  }
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(2)
}

function getMentionColor(moyenne: number | null): string {
  if (!moyenne) return '#374151'
  if (moyenne >= 16) return '#059669'
  if (moyenne >= 14) return '#2563EB'
  if (moyenne >= 12) return '#7C3AED'
  if (moyenne >= 10) return '#D97706'
  return '#DC2626'
}

function getNoteColor(note: number | null): string {
  if (note === null || note === undefined) return ''
  if (note >= 14) return '#059669'
  if (note >= 10) return '#1F2937'
  return '#DC2626'
}

const BULLETIN_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; }
  .bulletin-page { padding: 16mm; }
  @media print {
    body { padding: 0; }
    @page { size: A4 landscape; margin: 0; }
    .bulletin-page { padding: 10mm; page-break-after: always; }
    .bulletin-page:last-child { page-break-after: auto; }
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1D4ED8; padding-bottom: 10px; margin-bottom: 12px; }
  .school-info h1 { font-size: 16px; font-weight: 700; color: #1D4ED8; }
  .school-info p { font-size: 11px; color: #6B7280; }
  .bulletin-title { text-align: center; }
  .bulletin-title h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .bulletin-title p { font-size: 11px; color: #6B7280; }
  .student-info { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; display: flex; gap: 30px; flex-wrap: wrap; }
  .student-info .item { display: flex; flex-direction: column; gap: 1px; }
  .student-info .label { font-size: 10px; color: #6B7280; text-transform: uppercase; }
  .student-info .value { font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  thead tr { background: #1D4ED8; color: white; }
  thead th { padding: 5px 6px; font-size: 10px; text-align: center; font-weight: 600; }
  thead th:first-child { text-align: left; }
  tbody tr:nth-child(even) { background: #F9FAFB; }
  .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .summary-box { border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 12px; }
  .summary-box .s-label { font-size: 10px; color: #6B7280; text-transform: uppercase; margin-bottom: 2px; }
  .summary-box .s-value { font-size: 13px; font-weight: 700; }
  .summary-box .s-sub { font-size: 10px; color: #6B7280; margin-top: 2px; }
  .moyenne-generale { font-size: 22px !important; }
  .mention { color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; display: inline-block; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 24px; border-top: 1px solid #E5E7EB; padding-top: 16px; }
  .sig-box { text-align: center; }
  .sig-box .sig-label { font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 40px; }
  .sig-box .sig-line { border-bottom: 1px solid #9CA3AF; margin: 0 10px; }
  .sig-box .sig-name { font-size: 10px; color: #9CA3AF; margin-top: 4px; }
  .print-btn { position: fixed; top: 12px; right: 12px; background: #1D4ED8; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; z-index: 999; }
  .print-btn:hover { background: #1E40AF; }
  @media print { .print-btn { display: none; } }
`

function getAppSettings(): { appName: string; appTagline: string; logoUrl: string } {
  try {
    const stored = localStorage.getItem('app:settings:v1')
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        appName: parsed.appName || 'Etablissement Scolaire',
        appTagline: parsed.appTagline || 'République Togolaise',
        logoUrl: parsed.logoUrl || '',
      }
    }
  } catch { /* ignore */ }
  return { appName: 'Etablissement Scolaire', appTagline: 'République Togolaise', logoUrl: '' }
}

function buildBulletinPageHTML(data: BulletinData): string {
  const { eleve, classe, effectif, periodeLabel, anneeScolaire, lignes, resume } = data
  const mentionColor = getMentionColor(resume.moyenneGenerale)
  const { appName, appTagline, logoUrl } = getAppSettings()

  const lignesHTML = lignes.map(l => `
    <tr>
      <td style="padding:4px 6px;font-weight:500;border-bottom:1px solid #E5E7EB">${l.matiereNom}</td>
      <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E5E7EB">${fmt(l.inter)}</td>
      <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E5E7EB">${fmt(l.devoir)}</td>
      <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E5E7EB">${fmt(l.moyenneClasse)}</td>
      <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E5E7EB">${fmt(l.composition)}</td>
      <td style="padding:4px 6px;text-align:center;font-weight:700;color:${getNoteColor(l.noteSur20)};border-bottom:1px solid #E5E7EB">${fmt(l.noteSur20)}</td>
      <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E5E7EB">${fmt(l.coefficient)}</td>
      <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E5E7EB">
        ${fmt(l.noteCoefficient)}${l.noteCoefficientMax ? '/' + fmt(l.noteCoefficientMax) : ''}
      </td>
      <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #E5E7EB">${l.rang ?? '-'}</td>
      <td style="padding:4px 6px;font-size:11px;color:#6B7280;border-bottom:1px solid #E5E7EB">${l.professeur || '-'}</td>
      <td style="padding:4px 6px;font-size:11px;border-bottom:1px solid #E5E7EB">${l.appreciation || '-'}</td>
    </tr>
  `).join('')

  return `
  <div class="bulletin-page">
    <div class="header">
      <div class="school-info">
        <h1>${appName}</h1>
        <p>${appTagline}</p>
        <p>Ministère de l'Education</p>
      </div>
      <div class="bulletin-title">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:48px;max-width:120px;object-fit:contain;margin:0 auto 6px;display:block;" />` : ''}
        <h2>Bulletin de Notes</h2>
        <p>${periodeLabel} — Année scolaire ${anneeScolaire}</p>
      </div>
      <div style="text-align:right;font-size:11px;color:#6B7280;">
        <p>Classe : <strong>${classe.nom}</strong></p>
        <p>Effectif : <strong>${effectif}</strong> élèves</p>
      </div>
    </div>

    <div class="student-info">
      <div class="item">
        <span class="label">Nom et Prénom</span>
        <span class="value">${eleve.nom} ${eleve.prenom}</span>
      </div>
      <div class="item">
        <span class="label">Matricule</span>
        <span class="value">${eleve.matricule}</span>
      </div>
      ${eleve.date_naissance ? `<div class="item"><span class="label">Né(e) le</span><span class="value">${new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}</span></div>` : ''}
      <div class="item">
        <span class="label">Sexe</span>
        <span class="value">${eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : '-'}</span>
      </div>
      <div class="item">
        <span class="label">Classe</span>
        <span class="value">${classe.nom} — ${classe.cycle || ''}</span>
      </div>
      <div class="item">
        <span class="label">Rang</span>
        <span class="value">${resume.rangClasse ? resume.rangClasse + 'e / ' + effectif : '-'}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left;min-width:120px">Matières</th>
          <th>Inter.</th>
          <th>Devoirs</th>
          <th>M. Cl.</th>
          <th>Compo.</th>
          <th>Note /20</th>
          <th>Coef.</th>
          <th>Note ×C</th>
          <th>Rg</th>
          <th>Professeur</th>
          <th>Appréciation</th>
        </tr>
      </thead>
      <tbody>
        ${lignesHTML}
      </tbody>
      <tfoot>
        <tr style="background:#F3F4F6;font-weight:700;">
          <td colspan="6" style="padding:5px 6px;text-align:right;font-size:11px;color:#6B7280;">Totaux</td>
          <td style="padding:5px 6px;text-align:center;">${fmt(resume.totalCoefficients)}</td>
          <td style="padding:5px 6px;text-align:center;">${fmt(resume.totalPoints)}/${fmt(resume.totalPointsMax)}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>

    <div class="summary">
      <div class="summary-box" style="border-color:#BFDBFE;background:#EFF6FF;">
        <div class="s-label">Moyenne générale</div>
        <div class="s-value moyenne-generale" style="color:${mentionColor}">${fmt(resume.moyenneGenerale)}<span style="font-size:14px;font-weight:400">/20</span></div>
        <div class="s-sub">Rang : <strong>${resume.rangClasse ? resume.rangClasse + 'e' : '-'}</strong> sur ${effectif}</div>
        <div style="margin-top:4px"><span class="mention" style="background:${mentionColor}">${resume.mention || '-'}</span></div>
      </div>
      <div class="summary-box">
        <div class="s-label">Résultats de la classe</div>
        <div class="s-sub" style="margin-bottom:4px">Moy. classe : <strong>${fmt(resume.moyenneClasseGenerale)}/20</strong></div>
        <div class="s-sub">Meilleure : <strong>${fmt(resume.meilleureMoyenne)}/20</strong></div>
        <div class="s-sub">Plus faible : <strong>${fmt(resume.plusFaibleMoyenne)}/20</strong></div>
      </div>
      <div class="summary-box">
        <div class="s-label">Assiduité</div>
        <div class="s-sub">Total absences : <strong>${resume.absences}</strong></div>
        <div class="s-sub">Justifiées : <strong>${resume.absencesJustifiees}</strong></div>
        <div class="s-sub">Non justifiées : <strong>${resume.absencesNonJustifiees}</strong></div>
        <div class="s-sub">Retards : <strong>${resume.retards}</strong></div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">Signature du Professeur Principal</div>
        <div class="sig-line"></div>
        <div class="sig-name">Date : _______________</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Signature du Directeur</div>
        <div class="sig-line"></div>
        <div class="sig-name">Date : _______________</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Signature du Parent / Tuteur</div>
        <div class="sig-line"></div>
        <div class="sig-name">Date : _______________</div>
      </div>
    </div>
  </div>`
}

export function printBulletin(data: BulletinData): void {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Bulletin — ${data.eleve.prenom} ${data.eleve.nom}</title>
  <style>${BULLETIN_CSS}</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimer / PDF</button>
  ${buildBulletinPageHTML(data)}
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=1100,height=750')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
}

export function printBulletinsClasse(bulletins: BulletinData[]): void {
  if (!bulletins.length) return
  const pagesHTML = bulletins.map(b => buildBulletinPageHTML(b)).join('\n')
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Bulletins de classe (${bulletins.length})</title>
  <style>${BULLETIN_CSS}</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimer tous (${bulletins.length} bulletins)</button>
  ${pagesHTML}
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=1100,height=750')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
}
