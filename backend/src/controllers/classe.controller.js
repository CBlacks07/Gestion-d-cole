const prisma = require('../lib/prisma');

exports.getClasses = async (req, res) => {
  try {
    const { cycle, anneeScolaire } = req.query;
    let where = {};

    if (cycle) where.cycle = cycle.toUpperCase();
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;

    const classes = await prisma.classe.findMany({
      where,
      include: {
        enseignantPrincipal: true
      },
      orderBy: [
        { cycle: 'asc' },
        { niveau: 'asc' }
      ]
    });

    // Ajouter l'effectif actuel pour chaque classe
    const classesWithEffectif = await Promise.all(
      classes.map(async (classe) => {
        const effectif = await prisma.eleve.count({
          where: {
            classeId: classe.id,
            statut: 'ACTIF'
          }
        });
        return {
          ...classe,
          effectifActuel: effectif
        };
      })
    );

    res.json(classesWithEffectif);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getClasseById = async (req, res) => {
  try {
    const classe = await prisma.classe.findUnique({
      where: { id: req.params.id },
      include: {
        enseignantPrincipal: true
      }
    });

    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    const eleves = await prisma.eleve.findMany({
      where: {
        classeId: classe.id,
        statut: 'ACTIF'
      }
    });

    res.json({
      ...classe,
      eleves,
      effectifActuel: eleves.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createClasse = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.cycle) data.cycle = data.cycle.toUpperCase();
    if (data.niveau) data.niveau = data.niveau.toUpperCase();

    const classe = await prisma.classe.create({ data });
    res.status(201).json(classe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateClasse = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.cycle) data.cycle = data.cycle.toUpperCase();
    if (data.niveau) data.niveau = data.niveau.toUpperCase();

    const classe = await prisma.classe.update({
      where: { id: req.params.id },
      data
    });

    res.json(classe);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.deleteClasse = async (req, res) => {
  try {
    await prisma.classe.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Classe supprimée avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }
    res.status(500).json({ message: error.message });
  }
};
