const prisma = require('../lib/prisma');

exports.getEnseignants = async (req, res) => {
  try {
    const { statut, search } = req.query;
    let where = {};

    if (statut) where.statut = statut.toUpperCase();
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { matricule: { contains: search, mode: 'insensitive' } }
      ];
    }

    const enseignants = await prisma.enseignant.findMany({
      where,
      include: {
        specialites: {
          include: {
            matiere: true
          }
        },
        classesCommeResponsable: true
      },
      orderBy: [
        { nom: 'asc' },
        { prenom: 'asc' }
      ]
    });

    res.json(enseignants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEnseignantById = async (req, res) => {
  try {
    const enseignant = await prisma.enseignant.findUnique({
      where: { id: req.params.id },
      include: {
        specialites: {
          include: {
            matiere: true
          }
        },
        classesCommeResponsable: true
      }
    });

    if (!enseignant) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    res.json(enseignant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createEnseignant = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();
    if (data.typeContrat) data.typeContrat = data.typeContrat.toUpperCase();

    const enseignant = await prisma.enseignant.create({ data });
    res.status(201).json(enseignant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateEnseignant = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.statut) data.statut = data.statut.toUpperCase();
    if (data.sexe) data.sexe = data.sexe.toUpperCase();
    if (data.typeContrat) data.typeContrat = data.typeContrat.toUpperCase();

    const enseignant = await prisma.enseignant.update({
      where: { id: req.params.id },
      data
    });

    res.json(enseignant);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.deleteEnseignant = async (req, res) => {
  try {
    await prisma.enseignant.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Enseignant supprimé avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }
    res.status(500).json({ message: error.message });
  }
};
