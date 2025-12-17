# Système de Gestion d'Établissement Scolaire - Togo 🇹🇬

Application complète de gestion scolaire adaptée au système éducatif togolais pour les établissements du primaire, collège et lycée.

## 📋 Fonctionnalités

### Gestion des Élèves
- Inscription et profils des élèves
- Suivi académique
- Historique scolaire
- Gestion des absences

### Gestion des Classes
- **Primaire** : CP1, CP2, CE1, CE2, CM1, CM2
- **Collège** : 6ème, 5ème, 4ème, 3ème
- **Lycée** : 2nde, 1ère, Terminale

### Gestion Académique
- Notes et évaluations
- Bulletins scolaires
- Emplois du temps
- Matières par niveau

### Gestion Administrative
- Enseignants et personnel
- Frais de scolarité
- Paiements
- Rapports et statistiques

## 🚀 Technologies

- **Backend** : Node.js, Express, PostgreSQL, Prisma ORM
- **Frontend** : React, TypeScript, Tailwind CSS, Vite
- **Authentification** : JWT avec bcrypt
- **Base de données** : PostgreSQL 14+

## 📦 Installation

```bash
# Installer toutes les dépendances
npm run install-all

# Configuration
# Créer un fichier .env dans le dossier backend (voir backend/.env.example)
```

## 🔧 Développement

```bash
# Lancer le backend et frontend en mode développement
npm run dev

# Lancer uniquement le backend
npm run dev:backend

# Lancer uniquement le frontend
npm run dev:frontend
```

## 🏗️ Structure du Projet

```
gestion-ecole-togo/
├── backend/           # API Node.js + Express
│   ├── src/
│   │   ├── models/    # Modèles MongoDB
│   │   ├── routes/    # Routes API
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── utils/
│   └── package.json
├── frontend/          # Application React
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
└── package.json
```

## 🌍 Spécificités Togo

- Système éducatif togolais (6-5-3)
- Langue : Français
- Devise : Franc CFA (XOF)
- Calendrier scolaire togolais

## 📝 License

MIT
