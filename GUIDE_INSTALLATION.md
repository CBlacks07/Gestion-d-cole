# Guide d'Installation - Version Simplifiée (SQL Pur)

## Prérequis

- Node.js (version 18 ou supérieure)
- PostgreSQL (version 14 ou supérieure)
- Git

## Installation Rapide

### 1. Installer PostgreSQL

**Windows:**
1. Télécharger : https://www.postgresql.org/download/windows/
2. Installer avec les options par défaut
3. Mot de passe postgres : `Admin` (pendant l'installation)

**Linux:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

### 2. Créer la base de données

**Option A : Avec pgAdmin (Recommandé pour Windows)**

1. Ouvrir **pgAdmin 4**
2. Se connecter (mot de passe: `Admin`)
3. Créer l'utilisateur:
   - Clic droit sur "Login/Group Roles" → Create → Login/Group Role
   - Name: `gestion_user`
   - Password: `Admin`
   - Privileges: ✅ Can login
4. Créer la base:
   - Clic droit sur "Databases" → Create → Database
   - Database: `Ecole`
   - Owner: `gestion_user`

**Option B : Ligne de commande**

```bash
# Linux/Mac
sudo -u postgres psql

# Windows PowerShell
& "C:\Program Files\PostgreSQL\14\bin\psql.exe" -U postgres

# Dans psql:
CREATE USER gestion_user WITH PASSWORD 'Admin';
CREATE DATABASE "Ecole" OWNER gestion_user;
GRANT ALL PRIVILEGES ON DATABASE "Ecole" TO gestion_user;
\q
```

### 3. Cloner et installer le projet

```bash
git clone <url-du-repo>
cd Gestion-d-cole
npm run install-all
```

### 4. Configurer le backend

```bash
cd backend
copy .env.example .env    # Windows
# ou
cp .env.example .env      # Linux/Mac
```

Le fichier `.env` est déjà configuré avec:
```env
PORT=5000
DATABASE_URL="postgresql://[USERNAME]:[PASSWORD]@localhost:5432/Ecole?schema=public"
JWT_SECRET=votre_secret_jwt_tres_securise_ici
NODE_ENV=development

# Remplacer [USERNAME] par gestion_user et [PASSWORD] par votre mot de passe
```

### 5. Créer les tables (Simple !)

**Windows PowerShell:**
```powershell
# Se connecter et exécuter le script
& "C:\Program Files\PostgreSQL\14\bin\psql.exe" -U gestion_user -d Ecole -f database/schema.sql
```

**Linux/Mac:**
```bash
psql -U gestion_user -d Ecole -f database/schema.sql
# Mot de passe: Admin
```

Vous verrez plein de `CREATE TABLE`, `CREATE INDEX`, etc. C'est normal ! ✅

### 6. Lancer l'application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Vous verrez:
```
✅ Connexion PostgreSQL réussie
🚀 Serveur démarré sur le port 5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Vous verrez:
```
➜ Local: http://localhost:3000/
```

### 7. Créer un utilisateur admin

**Option A : Avec un outil API (Postman/Insomnia/Thunder Client)**
```
POST http://localhost:5000/api/auth/register

Body (JSON):
{
  "nom": "Admin",
  "prenom": "Système",
  "email": "admin@ecole.tg",
  "motDePasse": "Admin123!",
  "role": "admin",
  "telephone": "+228 00 00 00 00"
}
```

**Option B : Avec curl**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nom":"Admin","prenom":"Système","email":"admin@ecole.tg","motDePasse":"Admin123!","role":"admin","telephone":"+228 00 00 00 00"}'
```

### 8. Se connecter à l'application

🌐 Ouvrir: **http://localhost:3000**

```
📧 Email: admin@ecole.tg
🔑 Mot de passe: Admin123!
```

## ✅ Voilà, c'est tout !

Pas de Prisma, pas de migrations complexes, juste un script SQL et c'est parti ! 🚀

## 📝 Configuration Simple

| Paramètre | Valeur |
|-----------|---------|
| **Base de données** | `Ecole` |
| **Utilisateur** | `gestion_user` |
| **Mot de passe** | `Admin` |
| **Script SQL** | `backend/database/schema.sql` |
| **Backend** | http://localhost:5000 |
| **Frontend** | http://localhost:3000 |

## 🛠️ Commandes Utiles

```bash
# Réinitialiser la base de données
psql -U gestion_user -d Ecole -f backend/database/schema.sql

# Se connecter à PostgreSQL
psql -U gestion_user -d Ecole

# Voir les tables
\dt

# Voir les données d'une table
SELECT * FROM users;

# Quitter psql
\q
```

## 🚨 Problèmes Courants

### Erreur "psql: command not found"
**Windows**: Ajouter PostgreSQL au PATH:
```
C:\Program Files\PostgreSQL\14\bin
```

### Erreur "database Ecole does not exist"
Créer la base avec pgAdmin ou psql (voir étape 2)

### Port 5000 déjà utilisé
Changer dans `backend/.env`:
```env
PORT=5001
```

### Erreur de connexion
Vérifier que PostgreSQL est démarré:
```bash
# Windows
Get-Service postgresql*

# Linux
sudo systemctl status postgresql
```

## 🎯 Avantages de cette approche

✅ **Simple** : Pas de Prisma, pas de migrations complexes
✅ **Compatible** : Fonctionne sur TOUS les hébergeurs PostgreSQL
✅ **Rapide** : Installation en 5 minutes
✅ **Transparent** : Le SQL est visible dans `schema.sql`
✅ **Flexible** : Modifiez le SQL directement si besoin
✅ **Léger** : Moins de dépendances

## 📚 Ressources

- PostgreSQL: https://www.postgresql.org/docs/
- pgAdmin: https://www.pgadmin.org/docs/
- Module pg (Node.js): https://node-postgres.com/

## Support

Pour toute question, créez une issue sur GitHub !
