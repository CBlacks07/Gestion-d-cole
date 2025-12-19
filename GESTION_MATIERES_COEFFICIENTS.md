# Gestion des Matières et Coefficients

## 📚 Architecture Actuelle

### Structure de la Base de Données

Dans le système actuel, les **matières** sont définies globalement et associées aux **cycles** et **niveaux**, pas directement aux classes.

```sql
CREATE TABLE matieres (
    id UUID PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    coefficient INTEGER DEFAULT 1,        -- Coefficient global
    niveaux niveau_enum[],                -- Ex: ['CP1', 'CP2', 'CE1']
    cycles cycle_enum[],                  -- Ex: ['PRIMAIRE']
    couleur VARCHAR(20) DEFAULT '#3B82F6'
);
```

### Fonctionnement Actuel

1. **Les matières sont créées globalement** dans la table `matieres`
2. **Chaque matière peut être associée à plusieurs niveaux et cycles**
   - Ex: "Mathématiques" → Cycles: [PRIMAIRE, COLLEGE, LYCEE] → Niveaux: [CP1, CP2, ..., TERMINALE]
3. **Le coefficient est défini au niveau de la matière**, pas de la classe
4. **Lors de la saisie des notes**, le système utilise:
   - La classe de l'élève pour filtrer les matières applicables
   - Le coefficient de la matière pour calculer les moyennes

---

## ⚠️ Limitation Identifiée

**Problème** : Les coefficients sont globaux par matière, pas spécifiques par classe.

**Exemple du problème** :
- Mathématiques CP1 : devrait avoir coefficient 3
- Mathématiques CM2 : devrait avoir coefficient 4
- Actuellement : un seul coefficient pour toutes les classes

---

## ✅ Solutions Proposées

### Option 1: Table de Liaison `classe_matieres` (Recommandé)

Créer une table intermédiaire pour gérer les matières par classe avec coefficients personnalisés :

```sql
CREATE TABLE classe_matieres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
    coefficient INTEGER DEFAULT 1,
    obligatoire BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(classe_id, matiere_id)
);
```

**Avantages** :
- ✅ Coefficient personnalisé par classe
- ✅ Contrôle des matières enseignées dans chaque classe
- ✅ Possibilité de marquer des matières comme optionnelles
- ✅ Historique et traçabilité

**Workflow** :
1. Créer/Modifier une classe
2. Assigner les matières à cette classe avec leurs coefficients
3. Lors de la saisie des notes, charger uniquement les matières assignées
4. Utiliser le coefficient de `classe_matieres` pour les calculs

---

### Option 2: Garder le Système Actuel (Plus Simple)

Continuer avec le système actuel où :
- Les matières sont filtrées par cycle/niveau
- Le coefficient est global par matière
- Lors de la saisie des notes, on peut surcharger le coefficient

**Avantages** :
- ✅ Simplicité
- ✅ Pas de migration de base de données
- ✅ Fonctionne pour la plupart des cas

**Inconvénient** :
- ❌ Moins de flexibilité
- ❌ Pas de contrôle strict sur les matières par classe

---

## 🚀 Implémentation Recommandée (Option 1)

### Étape 1: Migration SQL

```sql
-- Créer la table de liaison
CREATE TABLE classe_matieres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classe_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    matiere_id UUID REFERENCES matieres(id) ON DELETE CASCADE,
    coefficient INTEGER DEFAULT 1,
    obligatoire BOOLEAN DEFAULT true,
    heures_semaine DECIMAL(4,2),  -- Optionnel: volume horaire
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(classe_id, matiere_id)
);

CREATE INDEX idx_classe_matieres_classe ON classe_matieres(classe_id);
CREATE INDEX idx_classe_matieres_matiere ON classe_matieres(matiere_id);
```

### Étape 2: Backend - Controller

```javascript
// backend/src/controllers/classe.controller.js

// Ajouter une matière à une classe
exports.addMatiereToClasse = async (req, res) => {
  try {
    const { classeId } = req.params;
    const { matiereId, coefficient, obligatoire } = req.body;

    const result = await query(
      `INSERT INTO classe_matieres (classe_id, matiere_id, coefficient, obligatoire)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (classe_id, matiere_id)
       DO UPDATE SET coefficient = $3, obligatoire = $4
       RETURNING *`,
      [classeId, matiereId, coefficient || 1, obligatoire !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Obtenir les matières d'une classe
exports.getMatieresClasse = async (req, res) => {
  try {
    const { classeId } = req.params;

    const result = await query(
      `SELECT cm.*, m.nom, m.code, m.description, m.couleur
       FROM classe_matieres cm
       JOIN matieres m ON cm.matiere_id = m.id
       WHERE cm.classe_id = $1
       ORDER BY m.nom`,
      [classeId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

### Étape 3: Frontend - Composant de Gestion

Créer un composant `ClasseMatieresManager.tsx` dans la page de détails de la classe :

```typescript
// Permet de:
// 1. Voir la liste des matières assignées
// 2. Ajouter/Retirer des matières
// 3. Modifier les coefficients
// 4. Marquer comme obligatoire/optionnelle
```

### Étape 4: Modification de la Saisie des Notes

Modifier `NoteFormClasseModal.tsx` pour charger les matières depuis `classe_matieres` :

```typescript
const loadMatieresClasse = async (classeId: string) => {
  try {
    const response = await api.get(`/classes/${classeId}/matieres`);
    setMatieres(response.data); // Contient déjà le coefficient personnalisé
  } catch (error) {
    console.error('Erreur lors du chargement des matières', error);
  }
};
```

---

## 📋 État Actuel du Projet

### ✅ Ce qui fonctionne :
- Création et modification de classes
- Saisie des notes par classe
- Calcul des moyennes avec les coefficients des matières
- Filtrage des matières par cycle/niveau

### ⚠️ À améliorer :
- Gestion des matières par classe avec coefficients personnalisés
- Interface de configuration des matières dans chaque classe
- Documentation pour les administrateurs

---

## 🎯 Prochaines Étapes Recommandées

1. **Migration de la base de données** : Créer la table `classe_matieres`
2. **Backend** : Ajouter les routes `/classes/:id/matieres`
3. **Frontend** : Créer le composant de gestion des matières par classe
4. **Migration des données** : Peupler `classe_matieres` automatiquement
5. **Tests** : Vérifier la cohérence des notes et moyennes

---

## 💡 Utilisation Temporaire

En attendant l'implémentation complète, voici comment gérer les coefficients :

1. **Dans la base de données** :
   - Définir le coefficient moyen pour chaque matière
   - Ex: Mathématiques → coefficient = 3

2. **Lors de la saisie des notes** :
   - Le système utilise automatiquement le coefficient de la matière
   - Pour un cas spécial, on peut modifier le coefficient dans la table `notes`

3. **Pour les calculs de moyenne** :
   - Le système utilise le coefficient enregistré avec chaque note
   - Moyenne = Σ(note × coefficient) / Σ(coefficient)

---

## 📞 Questions Fréquentes

**Q: Pourquoi les enseignants ne s'affichent pas dans les dropdowns ?**
R: Problème corrigé - le filtre vérifiait `statut === 'actif'` (minuscule) alors que la base stocke `'ACTIF'` (majuscule).

**Q: Comment ajouter une nouvelle matière ?**
R: Aller dans la page "Matières" et utiliser le bouton "Nouvelle matière". Définir les cycles et niveaux applicables.

**Q: Peut-on avoir des coefficients différents pour la même matière dans deux classes ?**
R: Actuellement non sans la table `classe_matieres`. C'est l'amélioration proposée dans ce document.

---

**Dernière mise à jour** : 2025-12-19
**Version** : 1.0
