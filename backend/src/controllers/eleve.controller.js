const prisma = require('../lib/prisma');

// @desc    Obtenir tous les élèves
// @route   GET /api/eleves
exports.getEleves = async (req, res) => {
  try {
    const { classe, statut, anneeScolaire, search } = req.query;
    let where = {};

    if (classe) where.classeId = classe;
    if (statut) where.statut = statut.toUpperCase();
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { numeroMatricule: { contains: search, mode: 'insensitive' } }
      ];
    }

    const eleves = await prisma.eleve.findMany({
      where,
      include: { classe: true },
      orderBy: [
        { nom: 'asc' },
        { prenom: 'asc' }
      ]
    });

    res.json(eleves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir un élève par ID
// @route   GET /api/eleves/:id
exports.getEleveById = async (req, res) => {
  try {
    const eleve = await prisma.eleve.findUnique({
      where: { id: req.params.id },
      include: { classe: true }
    });

    if (!eleve) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    res.json(eleve);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer un nouvel élève
// @route   POST /api/eleves
exports.createEleve = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();

    const eleve = await prisma.eleve.create({ data });
    res.status(201).json(eleve);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Mettre à jour un élève
// @route   PUT /api/eleves/:id
exports.updateEleve = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();

    const eleve = await prisma.eleve.update({
      where: { id: req.params.id },
      data
    });

    res.json(eleve);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
    res.status(400).json({ message: error.message });
  }
};

// @desc    Supprimer un élève
// @route   DELETE /api/eleves/:id
exports.deleteEleve = async (req, res) => {
  try {
    await prisma.eleve.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Élève supprimé avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtenir les statistiques des élèves
// @route   GET /api/eleves/stats
exports.getElevesStats = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const where = anneeScolaire ? { anneeScolaire } : {};

    const total = await prisma.eleve.count({ where });
    const actifs = await prisma.eleve.count({
      where: { ...where, statut: 'ACTIF' }
    });

    const parSexe = await prisma.eleve.groupBy({
      by: ['sexe'],
      where,
      _count: { sexe: true }
    });

    res.json({
      total,
      actifs,
      parSexe: {
        masculin: parSexe.find(s => s.sexe === 'M')?._count.sexe || 0,
        feminin: parSexe.find(s => s.sexe === 'F')?._count.sexe || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
