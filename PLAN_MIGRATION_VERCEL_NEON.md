# Plan de migration — Vercel + Neon + multi-école (SaaS)

Objectif : transformer Gestion École (actuellement mono-école, Docker Compose)
en plateforme multi-école, hébergée sur Vercel (frontend + backend serverless)
avec Neon comme base Postgres, chaque école isolée dans une base partagée via
`ecole_id`.

Décisions déjà actées :
- **Isolation des données** : schéma Postgres partagé, colonne `ecole_id` sur
  chaque table métier (pas une base par école).
- **Backend** : converti en fonctions serverless Vercel (pas de serveur Express
  long-vivant séparé).
- **Étape actuelle** : ce document. Aucun code n'a encore été modifié.

---

## 1. Modèle de données

### 1.1 Nouvelle table `ecoles`
```sql
CREATE TABLE ecoles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,   -- ex: "college-st-joseph"
  logo_url      TEXT,
  statut        VARCHAR(20) DEFAULT 'actif',    -- actif / suspendu
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 1.2 Ajout de `ecole_id` partout
Sur toutes les tables métier existantes : `eleves`, `enseignants`, `classes`,
`matieres`, `classe_matieres`, `notes`, `absences`, `paiements`,
`annees_scolaires`, `utilisateurs`, `audit_logs`, `parametres`/`configuration`...

```sql
ALTER TABLE <table> ADD COLUMN ecole_id UUID REFERENCES ecoles(id);
CREATE INDEX idx_<table>_ecole_id ON <table>(ecole_id);
```

`refresh_tokens` n'a pas besoin de sa propre colonne : elle est déjà liée à
`utilisateurs`, qui porte `ecole_id`.

### 1.3 Migration des données existantes
1. Créer une ligne dans `ecoles` pour l'école actuelle.
2. `UPDATE <table> SET ecole_id = '<id-ecole-actuelle>'` sur chaque table.
3. `ALTER TABLE <table> ALTER COLUMN ecole_id SET NOT NULL`.

---

## 2. Isolation au niveau base : Row-Level Security (recommandé, en plus du filtre applicatif)

Le risque principal du modèle "schéma partagé" est un `WHERE ecole_id = ...`
oublié dans un des 16 controllers → fuite de données d'une école vers une
autre (élèves, paiements). Deux filets de sécurité complémentaires :

1. **Filtre applicatif** : chaque requête SQL scope explicitement par
   `req.ecoleId` (détail section 3).
2. **RLS Postgres** (garde-fou au niveau base, indépendant du code applicatif) :
   ```sql
   ALTER TABLE eleves ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON eleves
     USING (ecole_id = current_setting('app.ecole_id')::uuid);
   ```
   et en début de chaque requête (ou transaction) :
   ```sql
   SET app.ecole_id = '<ecole-id-de-l-utilisateur-connecte>';
   ```
   Même si un développeur oublie le filtre dans une requête, RLS bloque
   l'accès aux lignes d'une autre école. Recommandé vu la sensibilité des
   données (notes, paiements d'élèves mineurs).

---

## 3. Backend — auth et scoping

- Le JWT inclut désormais `ecoleId` (en plus de `userId`, `role`).
- `middleware/auth.js` attache `req.ecoleId` depuis le token décodé.
- Nouveau petit wrapper DB (`lib/db.js`) : une fonction `queryScoped(ecoleId, sql, params)`
  qui **refuse d'exécuter** si `ecoleId` est absent, et fait le `SET app.ecole_id`
  avant chaque requête (pour activer la policy RLS). Objectif : rendre l'oubli
  du scoping visible à la revue de code plutôt que silencieux.
- Chaque controller (16 fichiers) doit être audité pour utiliser ce wrapper au
  lieu de `db.query` direct.
- Table `utilisateurs` : un utilisateur appartient à une seule école
  (`ecole_id NOT NULL`), sauf un éventuel rôle `SUPER_ADMIN` plateforme
  (sans `ecole_id`) pour gérer la liste des écoles elles-mêmes — à confirmer
  si vous voulez ce rôle dès le départ ou plus tard.
- Login : email unique par école (`UNIQUE(ecole_id, email)`) plutôt qu'unique
  globalement, pour permettre à deux écoles différentes d'avoir un compte
  `admin@gmail.com` sans collision.

## 4. Provisioning d'une nouvelle école

Flow minimal pour le MVP :
- Formulaire "Créer mon établissement" (nom école + compte admin initial) →
  crée une ligne `ecoles` + un utilisateur `ADMIN` rattaché.
- Sélection de l'école au login différée à plus tard (v2) : pour le MVP, un
  utilisateur se connecte avec son email, le backend retrouve son `ecole_id`
  automatiquement (pas besoin de sous-domaine par école dès le départ).

## 5. Adaptation backend pour serverless Vercel

| Composant actuel | Problème sur Vercel | Adaptation |
|---|---|---|
| Winston → fichiers `./logs/*.log` | Système de fichiers éphémère, logs perdus | Transport console uniquement en prod ; Vercel capture stdout/stderr dans ses propres logs |
| Rate limiting en mémoire | Chaque invocation serverless a sa propre mémoire, le compteur ne persiste pas entre requêtes | Store partagé : Upstash Redis (intégration native Vercel) via `@upstash/ratelimit` |
| `pg` avec pool TCP classique | Pas de process long-vivant pour garder un pool ouvert | Driver `@neondatabase/serverless` (HTTP/WebSocket) ou connection string "pooled" Neon (PgBouncer) avec `max: 1` |
| `server.js` (`app.listen`) | Vercel attend un handler, pas un serveur qui écoute un port | `api/index.js` exportant l'app Express (`export default app`), toutes les routes passent par cette seule function |
| Cookie httpOnly refresh token | OK sur Vercel, RAS | Vérifier juste le domaine du cookie si sous-domaines par école plus tard |
| PDFKit (génération bulletin serveur) | Timeout serverless (10s Hobby / 60s Pro) | Non utilisé côté frontend actuellement (voir mémoire projet) — pas bloquant |

## 6. Configuration Vercel + Neon

- Deux projets Vercel séparés recommandé : `gestion-ecole-frontend` (statique,
  build Vite) et `gestion-ecole-api` (serverless, Express en `api/index.js`).
  Plus simple à débugger que de tout mettre dans un seul projet monorepo.
- Neon : un seul projet Neon, une seule base (schéma partagé multi-école).
  Récupérer la **connection string pooled** (PgBouncer) pour `DATABASE_URL`.
- Variables d'environnement Vercel (projet API) : `DATABASE_URL`, `JWT_SECRET`,
  `JWT_EXPIRES_IN`, `REFRESH_TOKEN_DAYS`, `CORS_ORIGIN` (URL du projet frontend),
  clés Upstash Redis.

## 7. Le bug rollup vu dans les logs

`Cannot find module @rollup/rollup-linux-x64-gnu` : `optionalDependencies` de
npm se résolvent selon la plateforme où `npm install` a été exécuté au moment
où le lockfile a été généré/commité. Un `package-lock.json` généré sous
Windows n'inclut pas le binaire Linux nécessaire sur les serveurs de build
Vercel.

Fix à appliquer avant le premier déploiement :
- Supprimer `node_modules` et `package-lock.json` du frontend, relancer
  `npm install` depuis un environnement Linux (WSL, ou laisser Vercel le faire
  au premier build sans lockfile figé), puis commiter le nouveau lockfile.
- Alternative si on veut garder un contrôle serré : `installCommand` custom
  dans `vercel.json` (`"installCommand": "rm -rf node_modules package-lock.json && npm install"`).

## 8. Ordre d'exécution recommandé

1. Migration SQL : table `ecoles` + `ecole_id` partout + migration des
   données existantes vers la première école.
2. Activer RLS + créer le wrapper `queryScoped`.
3. Auditer et adapter les 16 controllers un par un pour utiliser le scoping.
4. Auth : JWT avec `ecoleId`, endpoint de création d'école + admin initial.
5. Adapter le backend pour serverless (logging, rate limiting, driver DB,
   `api/index.js`).
6. Config Vercel (2 projets) + Neon + fix du lockfile rollup.
7. Déploiement de test avec 2 écoles fictives, vérification manuelle qu'aucune
   donnée ne fuite de l'une vers l'autre.
8. Bascule en production.

---

**Points encore ouverts, à trancher avant de coder l'étape 1 :**
- Rôle `SUPER_ADMIN` plateforme dès le MVP, ou plus tard ?
- Email unique par école ou globalement unique ?
- Nom de domaine : un seul domaine avec login par email, ou sous-domaine par
  école (`ecole1.monapp.com`) ?
