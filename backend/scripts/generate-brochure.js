const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputDir = path.join(__dirname, '..', '..', 'docs');
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, 'brochure-gestion-ecole.pdf');
const imagesDir = path.join(outputDir, 'brochure-images');
const doc = new PDFDocument({ size: 'A4', margin: 50 });
doc.pipe(fs.createWriteStream(outputPath));

const colors = {
  primary: '#0a7a3c',
  primaryDark: '#0a5a2c',
  accent: '#f0f9f3',
  text: '#1f2937',
  muted: '#6b7280'
};

const pageWidth = doc.page.width;

function ensureSpace(height) {
  if (doc.y + height > doc.page.height - 40) {
    doc.addPage();
  }
}

function sectionTitle(text) {
  ensureSpace(40);
  doc.moveDown(0.6);
  doc.fontSize(14).fillColor(colors.primary).text(text, { underline: false });
  doc.moveDown(0.2);
}

function paragraph(text) {
  doc.fontSize(10.5).fillColor(colors.text).text(text, {
    width: pageWidth - 100,
    lineGap: 2
  });
  doc.moveDown(0.4);
}

function bullets(items) {
  items.forEach((item) => {
    doc.fontSize(10.5).fillColor(colors.text).text(`- ${item}`, {
      indent: 10,
      lineGap: 2
    });
  });
  doc.moveDown(0.3);
}

function infoBox(title, lines) {
  ensureSpace(120);
  const boxY = doc.y;
  const boxWidth = pageWidth - 100;
  const boxHeight = 18 + lines.length * 16 + 14;
  doc.save();
  doc.roundedRect(50, boxY, boxWidth, boxHeight, 6).fill(colors.accent);
  doc.restore();
  doc.fontSize(11).fillColor(colors.primaryDark).text(title, 62, boxY + 10);
  let y = boxY + 28;
  lines.forEach((line) => {
    doc.fontSize(10).fillColor(colors.text).text(`- ${line}`, 62, y);
    y += 16;
  });
  doc.moveDown(0.4);
  doc.y = boxY + boxHeight + 6;
}

function drawImageBox(imagePath, caption, x, y, boxWidth, boxHeight) {
  const padding = 8;
  const innerX = x + padding;
  const innerY = y + padding;
  const innerWidth = boxWidth - padding * 2;
  const innerHeight = boxHeight - padding * 2 - 22;

  doc.save();
  doc.roundedRect(x, y, boxWidth, boxHeight, 6).stroke('#e5e7eb');
  doc.restore();

  if (fs.existsSync(imagePath)) {
    doc.image(imagePath, innerX, innerY, {
      fit: [innerWidth, innerHeight],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc.fontSize(9).fillColor(colors.muted).text('Capture manquante', innerX, innerY + innerHeight / 2 - 6, {
      width: innerWidth,
      align: 'center'
    });
  }

  doc.fontSize(9.5).fillColor(colors.text).text(caption, innerX, y + boxHeight - 18, {
    width: innerWidth,
    align: 'center'
  });
}

function drawPanel(title, lines, x, y, w, h, options = {}) {
  const bg = options.bg || '#f8fafc';
  const border = options.border || '#e5e7eb';
  const titleColor = options.titleColor || colors.primaryDark;
  const textColor = options.textColor || colors.text;
  const padding = 10;

  doc.save();
  doc.roundedRect(x, y, w, h, 6).fill(bg);
  doc.roundedRect(x, y, w, h, 6).stroke(border);
  doc.restore();

  doc.fontSize(11).fillColor(titleColor).text(title, x + padding, y + padding);
  let ty = y + padding + 16;
  lines.forEach((line) => {
    doc.fontSize(10).fillColor(textColor).text(`- ${line}`, x + padding, ty, {
      width: w - padding * 2,
      lineGap: 2
    });
    ty = doc.y + 4;
  });
}

// Header band
doc.rect(0, 0, pageWidth, 90).fill(colors.primary);
doc.fillColor('white').fontSize(24).text('Gestion Ecole', 50, 26);
doc.fontSize(12).text('La gestion scolaire simple, fiable et moderne', 50, 56);

doc.moveDown(2.4);
paragraph(
  "Gestion Ecole est une application complete pour les etablissements scolaires au Togo. " +
  "Elle centralise la scolarite, les notes, les paiements et les bulletins dans un seul espace, " +
  "pour gagner du temps, reduire les erreurs et piloter l'ecole en toute confiance."
);

sectionTitle('Gestion financiere');
paragraph(
  "Suivez les recettes et la scolarite en temps reel, reperez les impayes et facilitez " +
  "les relances. Les responsables voient tout de suite ce qui est paye, ce qui reste a payer " +
  "et les eleves a risque."
);
bullets([
  "Saisie des paiements par eleve, par type et par periode",
  "Suivi des impayes et des paiements partiels",
  "Tableaux par classe pour une lecture rapide",
  "Export Excel propre pour controle et comptabilite"
]);

sectionTitle('Notes et evaluations');
paragraph(
  "La saisie des notes est structuree par classe, matiere et periode. Les coefficients sont " +
  "pris en compte automatiquement pour donner des moyennes fiables."
);
bullets([
  "Saisie des notes par classe avec filtrage par matiere",
  "Coefficients automatiques selon la matiere",
  "Periodes adaptees: trimestre au primaire/college, semestre au lycee",
  "Calculs ponderees transparents pour les moyennes"
]);

sectionTitle('Bulletins et resultats');
paragraph(
  "Les bulletins sont generes a partir des notes pour les classes du college et lycee " +
  "(6e a Tle). Les informations sont claires, conformes et prêtes a etre imprimees."
);
bullets([
  "Moyennes par matiere et moyenne generale",
  "Rang de l'eleve, mentions et appreciations",
  "Impression simple pour la remise aux parents"
]);

sectionTitle('Gestion des eleves');
paragraph(
  "Chaque eleve dispose d'un dossier clair: identite, classe, tuteur, historique des notes " +
  "et paiements. Tout est retrouve en quelques secondes."
);
bullets([
  "Dossiers complets eleves et tuteurs",
  "Recherche rapide et filtres par classe",
  "Suivi des absences et consultation des historiques"
]);

infoBox('Ce que l\'appli fait en extra', [
  "Tableaux de bord simples et lisibles",
  "Exports Excel dans un format professionnel",
  "Controle d'acces par role (administration vs enseignants)",
  "Organisation claire par cycles et classes"
]);

sectionTitle('Captures d\'ecran');
paragraph(
  "Quelques vues reelles de l'application pour montrer la simplicite, la clarte " +
  "et la puissance des modules cles."
);

const screenshots = [
  { file: 'dashboard.png', caption: 'Tableau de bord et indicateurs' },
  { file: 'configuration.png', caption: 'Configuration et personnalisation' },
  { file: 'matieres.png', caption: 'Parametrage des matieres par cycle' },
  { file: 'sauvegarde.png', caption: 'Sauvegarde et restauration' },
  { file: 'rapports.png', caption: 'Rapports et statistiques' },
  { file: 'notes.png', caption: 'Notes, evaluations et moyennes' }
];

// Fallback filename if the matieres capture is missing
if (!fs.existsSync(path.join(imagesDir, 'matieres.png')) && fs.existsSync(path.join(imagesDir, 'matieres-1.png'))) {
  const idx = screenshots.findIndex((s) => s.file === 'matieres.png');
  if (idx >= 0) screenshots[idx].file = 'matieres-1.png';
}

const colGap = 16;
const boxWidth = (pageWidth - 100 - colGap) / 2;
const boxHeight = 175;
let x = 50;
let y = doc.y;
const afterGridGap = 22;

screenshots.forEach((shot, index) => {
  if (y + boxHeight > doc.page.height - 60) {
    doc.addPage();
    y = 50;
  }
  drawImageBox(path.join(imagesDir, shot.file), shot.caption, x, y, boxWidth, boxHeight);
  if (index % 2 === 0) {
    x += boxWidth + colGap;
  } else {
    x = 50;
    y += boxHeight + 14;
  }
});

// Add breathing room after the last row of images
if (screenshots.length % 2 === 1) {
  doc.y = y + boxHeight + afterGridGap;
} else {
  doc.y = y + afterGridGap;
}

sectionTitle('Pour qui et demande de demo');
ensureSpace(130);
const panelGap = 16;
const panelWidth = (pageWidth - 100 - panelGap) / 2;
const panelHeight = 104;
const panelY = doc.y;

drawPanel(
  'Pour qui ?',
  [
    "Directeurs d'etablissement",
    "Censeurs et responsables administratifs",
    "Equipes pedagogiques"
  ],
  50,
  panelY,
  panelWidth,
  panelHeight
);

drawPanel(
  'Demandez une demo',
  [
    "Presentation rapide de l'application",
    "Mise en place accompagnee",
    "Prise en main simple et rapide"
  ],
  50 + panelWidth + panelGap,
  panelY,
  panelWidth,
  panelHeight
);

doc.y = panelY + panelHeight + 12;

// Ensure the contacts block fits on the page
ensureSpace(130);

drawPanel(
  'Contacts',
  [
    "MAATHEY K. Caringthon, DG de OPS CORPORATION",
    'Telephone: +228 93914694',
    'Email: cmaathey@gmail.com'
  ],
  50,
  doc.y,
  pageWidth - 100,
  118,
  { bg: colors.primary, border: colors.primary, titleColor: '#ffffff', textColor: '#ffffff' }
);

doc.end();
console.log(`Brochure generee: ${outputPath}`);
