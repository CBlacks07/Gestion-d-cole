const prisma = require('../lib/prisma');

exports.getPaiements = async (req, res) => {
  try {
    const { eleve, typePaiement, anneeScolaire, statut } = req.query;
    let where = {};

    if (eleve) where.eleveId = eleve;
    if (typePaiement) where.typePaiement = typePaiement.toUpperCase();
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;
    if (statut) where.statut = statut.toUpperCase();

    const paiements = await prisma.paiement.findMany({
      where,
      include: {
        eleve: true,
        enregistrePar: {
          select: {
            nom: true,
            prenom: true
          }
        }
      },
      orderBy: { datePaiement: 'desc' }
    });

    res.json(paiements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPaiementById = async (req, res) => {
  try {
    const paiement = await prisma.paiement.findUnique({
      where: { id: req.params.id },
      include: {
        eleve: true,
        enregistrePar: true
      }
    });

    if (!paiement) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json(paiement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPaiement = async (req, res) => {
  try {
    const data = {
      ...req.body,
      enregistreParId: req.user.id
    };

    // Convertir les enums en majuscules
    if (data.typePaiement) data.typePaiement = data.typePaiement.toUpperCase();
    if (data.modePaiement) data.modePaiement = data.modePaiement.toUpperCase();
    if (data.statut) data.statut = data.statut.toUpperCase();

    const paiement = await prisma.paiement.create({
      data,
      include: {
        eleve: true
      }
    });

    res.status(201).json(paiement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePaiement = async (req, res) => {
  try {
    const data = { ...req.body };

    // Convertir les enums en majuscules
    if (data.typePaiement) data.typePaiement = data.typePaiement.toUpperCase();
    if (data.modePaiement) data.modePaiement = data.modePaiement.toUpperCase();
    if (data.statut) data.statut = data.statut.toUpperCase();

    const paiement = await prisma.paiement.update({
      where: { id: req.params.id },
      data
    });

    res.json(paiement);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.deletePaiement = async (req, res) => {
  try {
    await prisma.paiement.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Paiement supprimé avec succès' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Obtenir l'historique des paiements d'un élève
exports.getHistoriquePaiements = async (req, res) => {
  try {
    const { eleveId } = req.params;
    const { anneeScolaire } = req.query;

    const where = { eleveId: eleveId };
    if (anneeScolaire) where.anneeScolaire = anneeScolaire;

    const paiements = await prisma.paiement.findMany({
      where,
      orderBy: { datePaiement: 'desc' }
    });

    const totalPaye = paiements
      .filter(p => p.statut === 'VALIDE')
      .reduce((sum, p) => sum + Number(p.montant), 0);

    res.json({
      paiements,
      totalPaye,
      devise: 'XOF'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Statistiques des paiements
exports.getPaiementStats = async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const where = anneeScolaire
      ? { anneeScolaire, statut: 'VALIDE' }
      : { statut: 'VALIDE' };

    const totalPaiements = await prisma.paiement.count({ where });

    const montantTotalResult = await prisma.paiement.aggregate({
      where,
      _sum: {
        montant: true
      }
    });

    const parType = await prisma.paiement.groupBy({
      by: ['typePaiement'],
      where,
      _sum: {
        montant: true
      },
      _count: {
        typePaiement: true
      }
    });

    res.json({
      totalPaiements,
      montantTotal: Number(montantTotalResult._sum.montant || 0),
      devise: 'XOF',
      parType: parType.map(item => ({
        _id: item.typePaiement,
        total: Number(item._sum.montant || 0),
        count: item._count.typePaiement
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
