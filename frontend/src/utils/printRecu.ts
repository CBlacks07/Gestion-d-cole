function nombreEnLettres(n: number): string {
  if (n < 0) return 'moins ' + nombreEnLettres(-n)
  n = Math.round(n)
  if (n === 0) return 'zéro'

  const u = [
    '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf'
  ]
  const diz = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

  function cents(num: number): string {
    if (num === 0) return ''
    if (num < 20) return u[num]
    const t = Math.floor(num / 10), r = num % 10
    if (t === 7) return r === 0 ? 'soixante-dix' : r === 1 ? 'soixante-et-onze' : 'soixante-' + u[10 + r]
    if (t === 8) return r === 0 ? 'quatre-vingts' : 'quatre-vingt-' + u[r]
    if (t === 9) return r === 0 ? 'quatre-vingt-dix' : 'quatre-vingt-' + u[10 + r]
    if (r === 0) return diz[t]
    if (r === 1) return diz[t] + '-et-un'
    return diz[t] + '-' + u[r]
  }

  function conv(num: number): string {
    if (num === 0) return ''
    if (num < 100) return cents(num)
    if (num < 1000) {
      const h = Math.floor(num / 100), r = num % 100
      const hs = h === 1 ? 'cent' : u[h] + '-cent'
      if (r === 0) return h === 1 ? 'cent' : u[h] + '-cents'
      return hs + '-' + cents(r)
    }
    if (num < 1000000) {
      const m = Math.floor(num / 1000), r = num % 1000
      return (m === 1 ? 'mille' : conv(m) + '-mille') + (r > 0 ? '-' + conv(r) : '')
    }
    const m = Math.floor(num / 1000000), r = num % 1000000
    return (m === 1 ? 'un million' : conv(m) + ' millions') + (r > 0 ? ' ' + conv(r) : '')
  }

  const s = conv(n)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function printRecu(paiement: {
  id?: string
  eleve?: { nom: string; prenom: string; matricule?: string; classe?: { nom: string } }
  typePaiement?: string
  montant: number
  devise?: string
  datePaiement?: string
  modePaiement?: string
  moisConcerne?: string
  numeroPiece?: string
  remarques?: string
  statut?: string
  montantDu?: number
  totalPayeAnnuel?: number
}) {
  let appName = 'Gestion École'
  let appTagline = 'Système de gestion scolaire'
  let logoUrl = ''
  try {
    const stored = localStorage.getItem('app:settings:v1')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.appName) appName = parsed.appName
      if (parsed.appTagline) appTagline = parsed.appTagline
      if (parsed.logoUrl) logoUrl = parsed.logoUrl
    }
  } catch { /* ignore */ }

  const nom = paiement.eleve ? `${paiement.eleve.prenom} ${paiement.eleve.nom}` : '-'
  const matricule = paiement.eleve?.matricule || '-'
  const classe = paiement.eleve?.classe?.nom || '-'
  const devise = paiement.devise || 'XOF'
  const montant = Number(paiement.montant || 0)
  const montantStr = montant.toLocaleString('fr-FR')
  const montantLettres = nombreEnLettres(montant)
  const now = paiement.datePaiement ? new Date(paiement.datePaiement) : new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const heureStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const numero = paiement.numeroPiece || `REC-${Date.now().toString().slice(-8)}`

  // Reste à payer
  const montantDu = Number(paiement.montantDu || 0)
  const totalPayeAnnuel = Number(paiement.totalPayeAnnuel || 0)
  const resteApayer = montantDu > 0 ? montantDu - totalPayeAnnuel : 0
  const isSolde = montantDu > 0 && resteApayer <= 0

  const typeLabels: Record<string, string> = {
    INSCRIPTION: "Frais d'inscription",
    SCOLARITE: 'Frais de scolarité',
    CANTINE: 'Cantine',
    TRANSPORT: 'Transport',
    UNIFORME: 'Uniforme',
    AUTRES: 'Autres frais',
  }
  const modeLabels: Record<string, string> = {
    ESPECES: 'Espèces',
    CHEQUE: 'Chèque',
    VIREMENT: 'Virement bancaire',
    MOBILE_MONEY: 'Mobile Money',
  }
  const type = typeLabels[paiement.typePaiement || ''] || paiement.typePaiement || '-'
  const mode = modeLabels[paiement.modePaiement || ''] || paiement.modePaiement || 'Espèces'
  const statut = String(paiement.statut || 'VALIDE').toUpperCase()

  const statutBadge = statut === 'VALIDE'
    ? `<div class="badge badge-ok">✓ PAIEMENT VALIDÉ</div>`
    : statut === 'EN_ATTENTE'
    ? `<div class="badge badge-wait">⏳ EN ATTENTE</div>`
    : `<div class="badge badge-cancel">✗ ANNULÉ</div>`

  const soldeSection = montantDu > 0 ? `
    <hr class="sep">
    <div class="solde-box">
      <div class="row">
        <span class="label">Tarif annuel</span>
        <span class="value">${montantDu.toLocaleString('fr-FR')} ${devise}</span>
      </div>
      <div class="row">
        <span class="label">Total versé</span>
        <span class="value">${totalPayeAnnuel.toLocaleString('fr-FR')} ${devise}</span>
      </div>
      <div class="row solde-row">
        <span class="label">${resteApayer <= 0 ? 'Excédent' : 'Solde restant'}</span>
        <span class="value ${resteApayer <= 0 ? 'solde-ok' : 'solde-red'}">${Math.abs(resteApayer).toLocaleString('fr-FR')} ${devise}</span>
      </div>
    </div>
    ${isSolde ? `<div class="badge badge-solde">★ COMPTE SOLDÉ ★</div>` : ''}
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu — ${numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #111;
      background: #fff;
    }
    .ticket {
      width: 88mm;
      margin: 3mm auto;
      padding: 4mm 5mm;
      background: #fff;
    }

    /* ——— LOGO + EN-TÊTE ——— */
    .header {
      text-align: center;
      padding-bottom: 2mm;
    }
    .logo {
      max-width: 22mm;
      max-height: 22mm;
      object-fit: contain;
      margin-bottom: 2mm;
    }
    .school-name {
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #1e3a5f;
    }
    .school-tagline {
      font-size: 9px;
      color: #777;
      margin-top: 0.5mm;
      font-style: italic;
    }
    .recu-title {
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 2mm;
      color: #1e3a5f;
    }

    /* ——— SÉPARATEURS ——— */
    .sep {
      border: none;
      border-top: 1px dashed #aaa;
      margin: 2mm 0;
    }
    .sep-solid {
      border: none;
      border-top: 2px solid #1e3a5f;
      margin: 2mm 0;
    }

    /* ——— NUMÉRO + DATE ——— */
    .meta {
      text-align: center;
      font-size: 10px;
      color: #555;
      line-height: 1.5;
    }
    .meta strong { color: #111; }

    /* ——— ÉLÈVE ——— */
    .eleve {
      background: #f0f4f8;
      border-radius: 4px;
      padding: 2mm 3mm;
      margin: 1.5mm 0;
    }
    .eleve-name {
      font-size: 13px;
      font-weight: bold;
      color: #1e3a5f;
      text-align: center;
    }
    .eleve-sub {
      font-size: 10px;
      color: #555;
      text-align: center;
      margin-top: 0.5mm;
    }

    /* ——— LIGNES DE DÉTAIL ——— */
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1mm 0;
      font-size: 11px;
    }
    .row .label { color: #555; }
    .row .value { font-weight: 600; color: #111; text-align: right; }

    /* ——— MONTANT TOTAL ——— */
    .montant-box {
      background: #1e3a5f;
      color: #fff;
      border-radius: 5px;
      padding: 2.5mm 4mm;
      margin: 2mm 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .montant-box .m-label { font-size: 11px; font-weight: bold; letter-spacing: 0.5px; }
    .montant-box .m-value { font-size: 19px; font-weight: bold; letter-spacing: 1px; }

    /* ——— MONTANT EN LETTRES ——— */
    .lettres {
      font-size: 9px;
      color: #666;
      text-align: center;
      font-style: italic;
      margin: 1mm 0;
    }

    /* ——— SOLDE ——— */
    .solde-box {
      background: #f8f9fa;
      border-radius: 4px;
      padding: 2mm 3mm;
      margin: 1.5mm 0;
    }
    .solde-row { border-top: 1px solid #ddd; margin-top: 1mm; padding-top: 1mm; }
    .solde-ok { color: #166534 !important; }
    .solde-red { color: #991b1b !important; }

    /* ——— BADGE STATUT ——— */
    .badge {
      display: block;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      border-radius: 4px;
      padding: 1.5mm 3mm;
      margin: 1.5mm 0;
      letter-spacing: 0.5px;
    }
    .badge-ok     { background: #dcfce7; color: #166534; }
    .badge-wait   { background: #fef9c3; color: #854d0e; }
    .badge-cancel { background: #fee2e2; color: #991b1b; }
    .badge-solde  { background: #166534; color: #fff; font-size: 12px; letter-spacing: 1.5px; }

    /* ——— PIED ——— */
    .footer {
      text-align: center;
      margin-top: 2mm;
    }
    .signature-line {
      width: 45mm;
      border-bottom: 1px solid #333;
      margin: 4mm auto 1mm;
    }
    .signature-label { font-size: 9px; color: #666; }
    .keep-msg {
      font-size: 9px;
      color: #999;
      margin-top: 2mm;
      font-style: italic;
    }

    @media print {
      html, body { height: auto !important; overflow: visible; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: auto; margin: 4mm; }
      .ticket { margin: 0 auto; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="ticket">

    <!-- EN-TÊTE -->
    <div class="header">
      ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo">` : ''}
      <div class="school-name">${appName}</div>
      <div class="school-tagline">${appTagline}</div>
      <div class="recu-title">★ Reçu de paiement ★</div>
    </div>

    <hr class="sep-solid">

    <!-- NUMÉRO + DATE -->
    <div class="meta">
      <strong>N° ${numero}</strong><br>
      ${dateStr} &nbsp;|&nbsp; ${heureStr}
    </div>

    <hr class="sep">

    <!-- ÉLÈVE -->
    <div class="eleve">
      <div class="eleve-name">${nom}</div>
      <div class="eleve-sub">Matr. ${matricule} &nbsp;·&nbsp; Classe : ${classe}</div>
    </div>

    <hr class="sep">

    <!-- DÉTAILS -->
    <div class="row">
      <span class="label">Type</span>
      <span class="value">${type}${paiement.moisConcerne ? ` (${paiement.moisConcerne})` : ''}</span>
    </div>
    <div class="row">
      <span class="label">Mode</span>
      <span class="value">${mode}</span>
    </div>
    ${paiement.numeroPiece ? `
    <div class="row">
      <span class="label">Réf. pièce</span>
      <span class="value">${paiement.numeroPiece}</span>
    </div>` : ''}

    <hr class="sep">

    <!-- MONTANT -->
    <div class="montant-box">
      <span class="m-label">MONTANT REÇU</span>
      <span class="m-value">${montantStr} ${devise}</span>
    </div>

    <!-- MONTANT EN LETTRES -->
    <p class="lettres">${montantLettres} ${devise}</p>

    <!-- STATUT -->
    ${statutBadge}

    ${paiement.remarques ? `<hr class="sep"><p style="font-size:11px;color:#555;text-align:center;font-style:italic">${paiement.remarques}</p>` : ''}

    <!-- SOLDE -->
    ${soldeSection}

    <hr class="sep">

    <!-- PIED -->
    <div class="footer">
      <div class="signature-line"></div>
      <div class="signature-label">Signature &amp; cachet</div>
      <div class="keep-msg">Conservez ce reçu — Merci</div>
    </div>

  </div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=420,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}
