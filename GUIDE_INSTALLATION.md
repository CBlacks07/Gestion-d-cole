# Guide d'Installation

## Prérequis

- Node.js (version 18 ou supérieure)
- PostgreSQL (version 14 ou supérieure)
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

#### Installation de PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Télécharger et installer PostgreSQL depuis https://www.postgresql.org/download/windows/

#### Créer la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Dans le shell PostgreSQL, créer l'utilisateur et la base de données:
CREATE USER gestion_user WITH PASSWORD 'votre_mot_de_passe_securise';
CREATE DATABASE gestion_ecole_togo OWNER gestion_user;
GRANT ALL PRIVILEGES ON DATABASE gestion_ecole_togo TO gestion_user;
\q
```

### 4. Configuration du backend

Créer un fichier `.env` dans le dossier `backend/`:

```bash
cd backend
cp .env.example .env
```

Modifier le fichier `.env` avec vos paramètres PostgreSQL:

```env
PORT=5000
DATABASE_URL="postgresql://gestion_user:votre_mot_de_passe_securise@localhost:5432/gestion_ecole_togo?schema=public"
JWT_SECRET=votre_secret_jwt_tres_securise_ici_changez_moi
NODE_ENV=development
```

**Important:**
- Changez `votre_mot_de_passe_securise` par le mot de passe que vous avez créé
- Changez `JWT_SECRET` par une chaîne aléatoire sécurisée

### 5. Initialiser la base de données avec Prisma

```bash
# Toujours dans le dossier backend/
npx prisma generate
npx prisma migrate dev --name init
```

Ces commandes vont :
- Générer le client Prisma
- Créer toutes les tables dans PostgreSQL
- Appliquer le schéma de base de données

### 6. (Optionnel) Visualiser la base de données

Prisma Studio permet de visualiser et éditer les données :

```bash
cd backend
npm run prisma:studio
```

Cela ouvrira une interface web sur http://localhost:5555

### 7. Créer un utilisateur administrateur

Une fois le backend démarré, créez un utilisateur admin :

```bash
# Démarrer le backend (dans un terminal)
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
3. Se connecter avec les identifiants créés:
   - Email: admin@ecole.tg
   - Mot de passe: Admin123!

## Scripts Prisma utiles

```bash
cd backend

# Générer le client Prisma après modification du schéma
npm run prisma:generate

# Créer une nouvelle migration
npm run prisma:migrate

# Ouvrir Prisma Studio (interface graphique)
npm run prisma:studio

# Réinitialiser la base de données (⚠️ supprime toutes les données)
npx prisma migrate reset
```

## Résolution de problèmes

### Erreur de connexion PostgreSQL

```bash
# Vérifier que PostgreSQL est en cours d'exécution
sudo systemctl status postgresql

# Redémarrer PostgreSQL si nécessaire
sudo systemctl restart postgresql

# Vérifier que vous pouvez vous connecter
psql -U gestion_user -d gestion_ecole_togo -h localhost
```

### Erreur "DATABASE_URL not found"

Vérifiez que le fichier `.env` existe dans le dossier `backend/` et contient la variable `DATABASE_URL`.

### Erreur de migration Prisma

```bash
# Réinitialiser complètement la base de données
cd backend
npx prisma migrate reset

# Puis recréer les tables
npx prisma migrate dev --name init
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
rm package-lock.json backend/package-lock.json frontend/package-lock.json
npm run install-all
```

### Problème d'authentification PostgreSQL

Si vous avez des erreurs d'authentification, éditez le fichier de configuration PostgreSQL:

```bash
# Ubuntu/Debian
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Changez la ligne pour localhost en:
# local   all   all   md5
# host    all   all   127.0.0.1/32   md5

# Redémarrez PostgreSQL
sudo systemctl restart postgresql
```

## Migration des données (MongoDB → PostgreSQL)

Si vous aviez des données dans MongoDB et voulez les migrer :

1. Exportez vos données de MongoDB en JSON
2. Créez un script de migration utilisant Prisma
3. Importez les données en adaptant les structures

**Note:** Les IDs changeront (ObjectId → UUID)

## Données de test

Pour tester l'application, vous pouvez :

1. Utiliser Prisma Studio pour ajouter des données manuellement
2. Créer un script de seed (optionnel)
3. Utiliser l'interface web pour ajouter des données

## Support

Pour toute question ou problème :
- Consultez la documentation Prisma: https://www.prisma.io/docs
- Consultez la documentation PostgreSQL: https://www.postgresql.org/docs/
- Créez une issue sur le dépôt GitHub
