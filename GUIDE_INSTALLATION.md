# Guide d'Installation

## Prérequis

- Node.js (version 18 ou supérieure)
- MongoDB (version 6 ou supérieure)
- Git

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd Gestion-d-cole
```

### 2. Installer les dépendances

```bash
npm run install-all
```

Cette commande installera les dépendances pour le projet principal, le backend et le frontend.

### 3. Configuration de la base de données

#### Installation de MongoDB

**Ubuntu/Debian:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
sudo apt-get install mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
Télécharger et installer MongoDB depuis https://www.mongodb.com/try/download/community

### 4. Configuration du backend

Créer un fichier `.env` dans le dossier `backend/`:

```bash
cd backend
cp .env.example .env
```

Modifier le fichier `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gestion-ecole-togo
JWT_SECRET=votre_secret_jwt_tres_securise_ici_changez_moi
NODE_ENV=development
```

**Important:** Changez `JWT_SECRET` par une chaîne aléatoire sécurisée.

### 5. Créer un utilisateur administrateur

Vous pouvez créer un utilisateur admin via l'API une fois le serveur démarré:

```bash
# Démarrer le backend
cd backend
npm run dev
```

Puis dans un autre terminal:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Admin",
    "prenom": "Système",
    "email": "admin@ecole.tg",
    "motDePasse": "Admin123!",
    "role": "admin",
    "telephone": "+228 00 00 00 00"
  }'
```

## Lancement de l'application

### Mode développement

Dans le répertoire racine du projet:

```bash
npm run dev
```

Cela lance:
- Backend sur http://localhost:5000
- Frontend sur http://localhost:3000

### Mode production

```bash
# Build du frontend
npm run build

# Démarrer le backend
npm start
```

Le backend servira également le frontend buildé.

## Accès à l'application

1. Ouvrir votre navigateur
2. Aller sur http://localhost:3000
3. Se connecter avec les identifiants créés

## Données de test (optionnel)

Pour tester l'application, vous pouvez créer des données de test via l'interface ou utiliser un script de seed.

## Résolution de problèmes

### Erreur de connexion MongoDB

```bash
# Vérifier que MongoDB est en cours d'exécution
sudo systemctl status mongod

# Redémarrer MongoDB si nécessaire
sudo systemctl restart mongod
```

### Port déjà utilisé

Si le port 5000 ou 3000 est déjà utilisé:

```bash
# Backend: modifier PORT dans backend/.env
# Frontend: modifier le port dans frontend/vite.config.ts
```

### Erreur de dépendances

```bash
# Nettoyer et réinstaller
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install-all
```

## Support

Pour toute question ou problème, créer une issue sur le dépôt GitHub.
