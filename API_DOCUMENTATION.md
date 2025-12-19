# Documentation API

Base URL: `http://localhost:5000/api`

## Authentification

Toutes les routes (sauf /auth/login et /auth/register) nécessitent un token JWT dans le header:

```
Authorization: Bearer <token>
```

### Endpoints d'authentification

#### POST /auth/register
Créer un nouvel utilisateur

**Body:**
```json
{
  "nom": "Doe",
  "prenom": "John",
  "email": "john@example.com",
  "motDePasse": "password123",
  "role": "secretaire",
  "telephone": "+228 12 34 56 78"
}
```

**Réponse:**
```json
{
  "_id": "...",
  "nom": "Doe",
  "prenom": "John",
  "email": "john@example.com",
  "role": "secretaire",
  "token": "JWT_TOKEN_SERA_GENERE_ICI"
}
```

#### POST /auth/login
Se connecter

**Body:**
```json
{
  "email": "john@example.com",
  "motDePasse": "password123"
}
```

#### GET /auth/me
Obtenir le profil de l'utilisateur connecté

## Élèves

#### GET /eleves
Liste tous les élèves

**Query params:**
- `classe`: ID de la classe
- `statut`: actif | inactif | transfere | diplome
- `anneeScolaire`: 2023-2024
- `search`: recherche textuelle

#### GET /eleves/:id
Détails d'un élève

#### POST /eleves
Créer un élève

**Body:**
```json
{
  "matricule": "EL2024001",
  "nom": "Kouassi",
  "prenom": "Ama",
  "dateNaissance": "2010-05-15",
  "lieuNaissance": "Lomé",
  "sexe": "F",
  "classe": "65abc123...",
  "tuteur": {
    "nom": "Kouassi",
    "prenom": "Pierre",
    "telephone": "+228 90 12 34 56",
    "email": "pierre.kouassi@email.com",
    "adresse": "Lomé, Tokoin"
  },
  "anneeScolaire": "2024-2025"
}
```

#### PUT /eleves/:id
Mettre à jour un élève

#### DELETE /eleves/:id
Supprimer un élève

#### GET /eleves/stats
Statistiques des élèves

## Enseignants

#### GET /enseignants
Liste tous les enseignants

#### GET /enseignants/:id
Détails d'un enseignant

#### POST /enseignants
Créer un enseignant

#### PUT /enseignants/:id
Mettre à jour un enseignant

#### DELETE /enseignants/:id
Supprimer un enseignant

## Classes

#### GET /classes
Liste toutes les classes

**Query params:**
- `cycle`: Primaire | Collège | Lycée
- `anneeScolaire`: 2024-2025

#### GET /classes/:id
Détails d'une classe avec la liste des élèves

#### POST /classes
Créer une classe

**Body:**
```json
{
  "nom": "CP1 A",
  "niveau": "CP1",
  "cycle": "Primaire",
  "anneeScolaire": "2024-2025",
  "enseignantPrincipal": "65abc123...",
  "effectifMax": 40,
  "salle": "Salle 12",
  "fraisScolarite": {
    "montantInscription": 25000,
    "montantMensuel": 15000,
    "devise": "XOF"
  }
}
```

#### PUT /classes/:id
Mettre à jour une classe

#### DELETE /classes/:id
Supprimer une classe

## Matières

#### GET /matieres
Liste toutes les matières

**Query params:**
- `cycle`: Primaire | Collège | Lycée
- `niveau`: CP1, CP2, etc.

#### POST /matieres
Créer une matière

**Body:**
```json
{
  "nom": "Mathématiques",
  "code": "MATH",
  "coefficient": 3,
  "niveaux": ["6ème", "5ème", "4ème", "3ème"],
  "cycles": ["Collège"]
}
```

## Notes

#### GET /notes
Liste toutes les notes

**Query params:**
- `eleve`: ID de l'élève
- `classe`: ID de la classe
- `matiere`: ID de la matière
- `periode`: 1er Trimestre | 2ème Trimestre | 3ème Trimestre
- `anneeScolaire`: 2024-2025

#### POST /notes
Créer une note

**Body:**
```json
{
  "eleve": "65abc123...",
  "matiere": "65def456...",
  "classe": "65ghi789...",
  "typeEvaluation": "Devoir",
  "periode": "1er Trimestre",
  "anneeScolaire": "2024-2025",
  "note": 15,
  "noteMax": 20,
  "coefficient": 1,
  "commentaire": "Bon travail"
}
```

#### GET /notes/bulletin/:eleveId
Bulletin d'un élève

**Query params:**
- `periode`: 1er Trimestre | 2ème Trimestre | 3ème Trimestre (requis)
- `anneeScolaire`: 2024-2025 (requis)

**Réponse:**
```json
{
  "eleve": {...},
  "periode": "1er Trimestre",
  "anneeScolaire": "2024-2025",
  "notesParMatiere": [
    {
      "matiere": {...},
      "notes": [...],
      "moyenne": 14.5
    }
  ],
  "moyenneGenerale": "13.75",
  "totalCoefficients": 20
}
```

## Absences

#### GET /absences
Liste toutes les absences

**Query params:**
- `eleve`: ID de l'élève
- `classe`: ID de la classe
- `date`: YYYY-MM-DD
- `anneeScolaire`: 2024-2025
- `justifiee`: true | false

#### POST /absences
Enregistrer une absence

**Body:**
```json
{
  "eleve": "65abc123...",
  "classe": "65def456...",
  "date": "2024-12-16",
  "periode": "Matin",
  "justifiee": false,
  "anneeScolaire": "2024-2025"
}
```

#### GET /absences/stats/:eleveId
Statistiques d'absences d'un élève

## Paiements

#### GET /paiements
Liste tous les paiements

**Query params:**
- `eleve`: ID de l'élève
- `typePaiement`: Inscription | Scolarité | Cantine | Transport | Uniforme | Autres
- `anneeScolaire`: 2024-2025
- `statut`: Validé | En attente | Annulé

#### POST /paiements
Enregistrer un paiement

**Body:**
```json
{
  "eleve": "65abc123...",
  "typePaiement": "Scolarité",
  "montant": 15000,
  "moisConcerne": "Janvier 2025",
  "anneeScolaire": "2024-2025",
  "modePaiement": "Mobile Money",
  "numeroPiece": "TXN123456789"
}
```

#### GET /paiements/historique/:eleveId
Historique des paiements d'un élève

#### GET /paiements/stats
Statistiques globales des paiements

## Rapports

#### GET /rapports/dashboard
Tableau de bord général

**Réponse:**
```json
{
  "totalEleves": 450,
  "totalClasses": 18,
  "elevesParCycle": [
    {"_id": "Primaire", "count": 200},
    {"_id": "Collège", "count": 150},
    {"_id": "Lycée", "count": 100}
  ],
  "recettesTotal": 12500000,
  "devise": "XOF"
}
```

#### GET /rapports/classe/:classeId
Rapport détaillé d'une classe

**Query params:**
- `periode`: 1er Trimestre | 2ème Trimestre | 3ème Trimestre
- `anneeScolaire`: 2024-2025

#### GET /rapports/financier
Rapport financier

**Query params:**
- `anneeScolaire`: 2024-2025
- `mois`: Janvier 2025

#### GET /rapports/assiduite
Rapport d'assiduité

**Query params:**
- `classeId`: ID de la classe
- `anneeScolaire`: 2024-2025

## Codes d'erreur

- `200`: Succès
- `201`: Créé avec succès
- `400`: Requête invalide
- `401`: Non autorisé (token manquant ou invalide)
- `403`: Accès refusé (permissions insuffisantes)
- `404`: Ressource non trouvée
- `500`: Erreur serveur

## Rôles et permissions

- `admin`: Accès complet
- `directeur`: Lecture complète, modification élèves/enseignants/classes
- `enseignant`: Lecture complète, création/modification notes et absences
- `secretaire`: Gestion élèves, paiements, absences
