const prisma = require('../lib/prisma');

exports.getMatieres = async (req, res) => {
  try {
    const { cycle, niveau } = req.query;
    let where = {};

    // Les cycles et niveaux sont des arrays dans Prisma
    if (cycle) where.cycles = { has: cycle.toUpperCase() };
    if (niveau) where.niveaux = { has: niveau.toUpperCase() };

    const matieres = await prisma.matiere.findMany({
      where,
      orderBy: { nom: 'asc' }
    });

    res.json(matieres);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMatiereById = async (req, res) => {
  try {
    const matiere = await prisma.matiere.findUnique({
      where: { id: req.params.id }
    });

    if (!matiere) {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }

    res.json(matiere);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createMatiere = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules pour les arrays
    if (data.cycles && Array.isArray(data.cycles)) {
      data.cycles = data.cycles.map(c => c.toUpperCase());
    }
    if (data.niveaux && Array.isArray(data.niveaux)) {
      data.niveaux = data.niveaux.map(n => n.toUpperCase());
    }

    const matiere = await prisma.matiere.create({ data });
    res.status(201).json(matiere);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateMatiere = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules pour les arrays
    if (data.cycles && Array.isArray(data.cycles)) {
      data.cycles = data.cycles.map(c => c.toUpperCase());
    }
    if (data.niveaux && Array.isArray(data.niveaux)) {
      data.niveaux = data.niveaux.map(n => n.toUpperCase());
    }

    const matiere = await prisma.matiere.update({
      where: { id: req.params.id },
      data
    });

    res.json(matiere);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.deleteMatiere = async (req, res) => {
  try {
    await prisma.matiere.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Matière supprimée avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Matière non trouvée' });
    }
    res.status(500).json({ message: error.message });
  }
};
