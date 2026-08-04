const PDFDocument = require('pdfkit');
const { query } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * Génère et streame un bulletin de notes PDF côté serveur.
 * GET /api/v1/rapports/bulletin-pdf?eleveId=...&periode=...&anneeScolaire=...
 */
exports.generateBulletinPdf = async (req, res) => {
  const { eleveId, periode, anneeScolaire } = req.query;

  if (!eleveId || !anneeScolaire) {
    return res.status(400).json({ message: 'eleveId et anneeScolaire sont requis' });
  }

  try {
    // ── Données élève ──────────────────────────────────────────────────────
    const eleveResult = await query(
      `SELECT e.*, c.nom as classe_nom, c.niveau as classe_niveau, c.cycle as classe_cycle
       FROM eleves e
       LEFT JOIN classes c ON e.classe_id = c.id
       WHERE e.id = $1`,
      [eleveId]
    );

    if (eleveResult.rows.length === 0) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    const eleve = eleveResult.rows[0];

    // ── Notes ───────────────────────────────────────────────────────────────
    let notesWhere = `WHERE n.eleve_id = $1 AND n.annee_scolaire = $2`;
    const notesParams = [eleveId, anneeScolaire];

    if (periode) {
      notesWhere += ` AND n.periode = $3`;
      notesParams.push(periode);
    }

    const notesResult = await query(
      `SELECT n.note, n.note_max, n.periode, n.type_evaluation,
              m.nom as matiere_nom, m.coefficient as matiere_coeff,
              COALESCE(n.coefficient, m.coefficient, 1) as coeff_effectif
       FROM notes n
       JOIN matieres m ON n.matiere_id = m.id
       ${notesWhere}
       ORDER BY m.nom, n.periode`,
      notesParams
    );

    const notes = notesResult.rows;

    // ── Calcul des moyennes par matière ────────────────────────────────────
    const parMatiere = {};
    notes.forEach((n) => {
      if (!parMatiere[n.matiere_nom]) {
        parMatiere[n.matiere_nom] = { notes: [], coefficient: parseFloat(n.coeff_effectif || 1), noteMax: parseFloat(n.note_max || 20) };
      }
      if (n.note !== null && n.note !== undefined) {
        parMatiere[n.matiere_nom].notes.push(parseFloat(n.note));
      }
    });

    const lignes = Object.entries(parMatiere).map(([matiere, data]) => {
      const somme = data.notes.reduce((a, b) => a + b, 0);
      const moyenne = data.notes.length ? (somme / data.notes.length).toFixed(2) : '--';
      return { matiere, coefficient: data.coefficient, moyenne };
    });

    // Moyenne générale pondérée
    let totalCoeffPondere = 0;
    let totalCoeff = 0;
    lignes.forEach((l) => {
      if (l.moyenne !== '--') {
        totalCoeffPondere += parseFloat(l.moyenne) * l.coefficient;
        totalCoeff += l.coefficient;
      }
    });
    const moyenneGenerale = totalCoeff > 0 ? (totalCoeffPondere / totalCoeff).toFixed(2) : '--';

    // ── Génération du PDF ──────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bulletin_${eleve.matricule}_${anneeScolaire.replace('/', '-')}.pdf"`
    );
    doc.pipe(res);

    // En-tête
    doc.fontSize(16).font('Helvetica-Bold').text('BULLETIN DE NOTES', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(`Année scolaire : ${anneeScolaire}`, { align: 'center' });
    if (periode) doc.text(`Période : ${periode.replace(/_/g, ' ')}`, { align: 'center' });
    doc.moveDown(0.8);

    // Infos élève
    doc.font('Helvetica-Bold').fontSize(12).text('Informations élève');
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);

    const infoCol1X = 40;
    const infoCol2X = 300;
    const yStart = doc.y;

    doc.text(`Nom : ${eleve.nom} ${eleve.prenom}`, infoCol1X, yStart);
    doc.text(`Matricule : ${eleve.matricule}`, infoCol2X, yStart);
    doc.text(`Classe : ${eleve.classe_nom || '--'}`, infoCol1X, yStart + 18);
    doc.text(`Niveau : ${eleve.classe_niveau || '--'}`, infoCol2X, yStart + 18);
    doc.text(`Cycle : ${eleve.classe_cycle || '--'}`, infoCol1X, yStart + 36);
    doc.moveDown(3.2);

    // Tableau des notes
    doc.font('Helvetica-Bold').fontSize(12).text('Notes et moyennes');
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.5);

    // En-têtes tableau
    const col = { mat: 40, coeff: 340, moy: 450 };
    const rowH = 22;
    let ty = doc.y;

    doc.fillColor('#2d6a4f').rect(40, ty - 2, 515, rowH).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Matière', col.mat + 4, ty + 4, { width: 280 });
    doc.text('Coefficient', col.coeff, ty + 4, { width: 100, align: 'center' });
    doc.text('Moyenne', col.moy, ty + 4, { width: 100, align: 'center' });
    doc.fillColor('black');
    ty += rowH + 2;

    // Lignes
    lignes.forEach((l, i) => {
      const bg = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
      doc.fillColor(bg).rect(40, ty - 2, 515, rowH).fill();
      doc.fillColor('black').font('Helvetica').fontSize(9);
      doc.text(l.matiere, col.mat + 4, ty + 4, { width: 280 });
      doc.text(String(l.coefficient), col.coeff, ty + 4, { width: 100, align: 'center' });

      const moy = parseFloat(l.moyenne);
      const moyColor = isNaN(moy) ? 'black' : moy >= 10 ? '#2d6a4f' : '#c0392b';
      doc.fillColor(moyColor).font('Helvetica-Bold');
      doc.text(l.moyenne, col.moy, ty + 4, { width: 100, align: 'center' });
      doc.fillColor('black').font('Helvetica');
      ty += rowH;
    });

    // Ligne moyenne générale
    doc.fillColor('#2d6a4f').rect(40, ty, 515, rowH + 4).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
    doc.text('MOYENNE GÉNÉRALE', col.mat + 4, ty + 6, { width: 400 });
    doc.text(moyenneGenerale, col.moy, ty + 6, { width: 100, align: 'center' });
    ty += rowH + 8;
    doc.fillColor('black');

    // Appréciation
    doc.y = ty + 10;
    doc.moveDown(0.5);
    let appreciation = '';
    const mg = parseFloat(moyenneGenerale);
    if (!isNaN(mg)) {
      if (mg >= 16)      appreciation = 'Excellent';
      else if (mg >= 14) appreciation = 'Très bien';
      else if (mg >= 12) appreciation = 'Bien';
      else if (mg >= 10) appreciation = 'Assez bien';
      else if (mg >= 8)  appreciation = 'Insuffisant';
      else               appreciation = 'Très insuffisant';
    }

    if (appreciation) {
      doc.font('Helvetica-Bold').fontSize(10)
        .text(`Appréciation : ${appreciation}`, { align: 'left' });
    }

    // Pied de page
    doc.fontSize(8).fillColor('#888888')
      .text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} — Gestion École Togo`,
        40,
        doc.page.height - 50,
        { align: 'center', width: doc.page.width - 80 }
      );

    doc.end();
  } catch (error) {
    logger.error('Erreur génération PDF bulletin:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};
