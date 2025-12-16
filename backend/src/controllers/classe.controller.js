const Classe = require('../models/Classe');
const Eleve = require('../models/Eleve');

exports.getClasses = async (req, res) => {
  try {
    const { cycle, anneeScolaire } = req.query;
    let query = {};

    if (cycle) query.cycle = cycle;
    if (anneeScolaire) query.anneeScolaire = anneeScolaire;

    const classes = await Classe.find(query)
      .populate('enseignantPrincipal')
      .sort({ cycle: 1, niveau: 1 });

    // Ajouter l'effectif actuel pour chaque classe
    const classesWithEffectif = await Promise.all(
      classes.map(async (classe) => {
        const effectif = await Eleve.countDocuments({
          classe: classe._id,
          statut: 'actif'
        });
        return {
          ...classe.toObject(),
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
    const classe = await Classe.findById(req.params.id)
      .populate('enseignantPrincipal');

    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    const eleves = await Eleve.find({ classe: classe._id, statut: 'actif' });

    res.json({
      ...classe.toObject(),
      eleves,
      effectifActuel: eleves.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createClasse = async (req, res) => {
  try {
    const classe = await Classe.create(req.body);
    res.status(201).json(classe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateClasse = async (req, res) => {
  try {
    const classe = await Classe.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    res.json(classe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteClasse = async (req, res) => {
  try {
    const classe = await Classe.findByIdAndDelete(req.params.id);

    if (!classe) {
      return res.status(404).json({ message: 'Classe non trouvée' });
    }

    res.json({ message: 'Classe supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
