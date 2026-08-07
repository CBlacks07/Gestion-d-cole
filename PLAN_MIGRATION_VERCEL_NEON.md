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
- **Étape actuelle** : étapes 1 et 2 terminées (migration SQL + les 16
  controllers backend migrés vers `queryScoped`/filtres explicites). Voir
  section "État d'avancement" plus bas.

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
- Login : **email unique GLOBALEMENT** (pas par école). Correction par rapport
  à la version précédente de ce plan : sans sous-domaine ni sélecteur d'école
  au login (décision actée section "points ouverts"), un email unique
  seulement par école rendrait le login ambigu — impossible de savoir à
  quelle école authentifier un email présent dans plusieurs écoles. Email
  global = login inchangé (email + mot de passe), `login_attempts` reste
  clé par email sans modification. Réévaluable si un sélecteur d'école /
  sous-domaine est ajouté plus tard.

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

**Points tranchés (2026-08-04) :**
- Rôle `SUPER_ADMIN` : ajouté à `role_enum` dès maintenant (coût quasi nul),
  panel plateforme non construit pour l'instant.
- Email : unique globalement (voir section 3, corrigé suite à test de
  cohérence avec l'absence de sous-domaine).
- Domaine : un seul domaine, login par email, pas de sous-domaine par école
  au MVP.

## État d'avancement

- [x] **Étape 1 — Migration SQL** : `backend/database/migration_multi_ecole.sql`.
      Table `ecoles`, `ecole_id` sur toutes les tables métier (backfill vers
      une "école par défaut" pour les données existantes), contraintes
      d'unicité passées de globales à par-école (matricules, codes matières,
      années scolaires), RLS avec `FORCE ROW LEVEL SECURITY` + policy
      `ecole_id = current_setting('app.ecole_id')`.
      **Testé en conditions réelles** : schéma complet rejoué dans un
      Postgres 16 jetable (Docker), migration exécutée deux fois (idempotence
      confirmée), isolation vérifiée sous un rôle non-superuser — 0 ligne
      sans `app.ecole_id`, chaque école ne voit que ses données, et une
      tentative d'INSERT avec un `ecole_id` forgé vers une autre école est
      rejetée par la base (RLS `WITH CHECK`, pas seulement le code
      applicatif).
      Nouveau helper `queryScoped(ecoleId, sql, params)` dans
      `backend/src/lib/db.js` : ouvre une transaction, fait
      `SET LOCAL app.ecole_id`, exécute la requête, refuse de s'exécuter si
      `ecoleId` est absent ou n'est pas un UUID valide.
      Script ajouté : `npm run db:migrate:multi-ecole` (backend).
- [x] **Étape 2 — Controllers** : les 16 controllers backend audités et migrés.
      - `middleware/auth.js` : attache `req.ecoleId` depuis `users.ecole_id`
        (lookup par id, hors RLS — sûr par construction) ; rejette les
        utilisateurs sans école (sauf `SUPER_ADMIN`).
      - `eleve`, `enseignant`, `classe`, `classe-matiere`, `matiere`, `note`,
        `absence`, `paiement`, `annee`, `rapport`, `bulletin`, `search` :
        tous les `db.query` remplacés par `queryScoped(req.ecoleId, ...)` ;
        `ecole_id` ajouté à chaque INSERT (y compris les inserts multi-lignes
        dynamiques comme `enseignant_matieres`).
      - `users`, `auditLog` : tables hors RLS forcée (voir étape 1) → filtre
        `ecole_id` explicite ajouté dans chaque requête (lecture, update,
        delete). `logAuditEvent` (`lib/audit.js`) tague désormais chaque
        entrée avec `req.ecoleId`.
      - `auth.controller.js` : `register` crée les nouveaux comptes avec
        `ecole_id = req.ecoleId` (l'école du créateur) ; login/refresh/me
        restent par id/email (email global, voir section 3) — pas de
        changement nécessaire.
      - `backup.controller.js` : **problème de sécurité trouvé et corrigé**
        — l'export/restore/backups planifiés opéraient sur TOUTE la base
        (toutes les écoles mélangées), y compris un `TRUNCATE ... CASCADE`
        sur restauration qui aurait effacé les données de toutes les écoles.
        `exportBackup`/`restoreBackup` (routes ADMIN/DIRECTEUR) sont
        maintenant scopés à `req.ecoleId` (DELETE ciblé au lieu de TRUNCATE,
        `ecole_id` forcé sur les lignes réinjectées, jamais celui du fichier
        importé). Les sauvegardes planifiées (`/auto/*`, dump multi-écoles
        par design) sont restreintes à `SUPER_ADMIN` dans `backup.routes.js`.
      - `health.routes.js` : la sonde `/health/ready` vérifiait "exactement
        1 année scolaire active" — invariant mono-école obsolète (et de
        toute façon plus lisible sans contexte école vu la RLS) ; simplifiée
        à une simple vérification de connectivité DB.
      - **Vérifié** : `node --check` sur tous les fichiers modifiés, et un
        test fonctionnel contre un vrai Postgres (toutes les requêtes
        INSERT à paramètres dynamiques rejouées avec succès, y compris la
        formule de placeholders multi-lignes de `enseignant_matieres`).
      - **Pas encore fait** : adapter le frontend pour gérer un
        `SUPER_ADMIN` sans école (aucune UI actuelle ne le permet), et créer
        un premier compte `SUPER_ADMIN` réel (aucun endpoint de provisioning
        pour l'instant — à faire à l'étape 3).
- [x] **Étape 3 — Onboarding multi-école** :
      - `backend/src/lib/tokens.js` : extraction des helpers JWT/refresh
        token (`generateAccessToken`, `generateRefreshToken`, `hashToken`,
        `COOKIE_OPTS`, `storeRefreshToken`) depuis `auth.controller.js`, pour
        les réutiliser dans le nouvel endpoint de création d'école.
      - `POST /api/v1/ecoles` (`ecole.controller.js` / `ecole.routes.js`,
        route publique, rate-limitée) : self-service SaaS — crée
        l'établissement + son premier compte ADMIN en une seule requête,
        connecte automatiquement (access token + refresh cookie), comme un
        signup classique. Slug auto-généré depuis le nom si non fourni,
        unicité vérifiée (slug + email global).
      - `create-admin.js` (script CLI existant, utilisé au déploiement) :
        cassé par l'étape 1 (créait des users avec `ecole_id` NULL, rejetés
        au login). Corrigé : rattache par défaut à la première école
        existante (ou celle de `ADMIN_ECOLE_SLUG`), ou crée un
        `SUPER_ADMIN` sans école si `ADMIN_ROLE=SUPER_ADMIN`.
      - **2 bugs réels trouvés et corrigés par test end-to-end** (serveur
        Express réellement démarré contre un Postgres jetable, rôle
        non-superuser comme sur Neon, requêtes HTTP réelles) :
        1. `backup.controller.js` : l'export utilisait `query()` brut sur
           des tables sous `FORCE ROW LEVEL SECURITY` → retournait
           silencieusement 0 ligne (RLS bloque tout sans
           `app.ecole_id`/bypass actif, le filtre `WHERE ecole_id` seul ne
           suffit pas). Corrigé avec `queryScoped`/nouveau
           `queryBypassRls` (`lib/db.js`) ; policy RLS étendue avec une
           clause `OR app.bypass_rls = 'true'`, échappatoire explicite
           réservée au dump planifié SUPER_ADMIN (jamais un attribut de
           rôle `BYPASSRLS`, qui désactiverait la RLS partout).
        2. `restoreBackup` utilisait `SET session_replication_role =
           'replica'` pour contourner l'ordre des FK — **interdit à un
           rôle non-superuser** (donc cassé sur Neon). Corrigé en
           réordonnant `EXPORT_ORDER`/`TRUNCATE_ORDER` pour respecter les
           FK par construction (`users` déplacé après `enseignants`, avant
           `classes`), rendant le contournement inutile.
      - **Vérifié de bout en bout** via un vrai serveur Express + Postgres
        16 (rôle non-superuser, propriétaire des tables comme sur Neon) :
        création de 2 écoles via l'API, login, isolation confirmée sur
        `/eleves` (École B ne voit rien d'École A), réutilisation du même
        matricule dans les 2 écoles (contrainte unique par école), export
        scopé (1 élève, la bonne école), export planifié SUPER_ADMIN (2
        élèves, les deux écoles), restauration destructive d'École A sans
        impact sur École B, et blocage 403 d'un ADMIN d'école sur
        `/backup/auto/*`.
- [x] **Étape 4 — Adaptation serverless** :
      - `backend/src/app.js` (nouveau) : app Express extraite de
        `server.js`, sans `app.listen()` — source unique partagée par le
        déploiement classique et Vercel.
      - `backend/src/server.js` : ne fait plus que `require('./app')` +
        bootstrap classique (`app.listen`, `setInterval` de nettoyage,
        SIGINT/SIGTERM). Inchangé pour Docker/VM.
      - `backend/api/index.js` (nouveau, point d'entrée Vercel) : pas de
        `app.listen()`, initialisation du schéma mémoïsée par instance
        "chaude" (pas de re-CREATE TABLE à chaque requête).
      - `backend/vercel.json` (nouveau) : rewrite catch-all vers `/api`,
        + Vercel Cron quotidien vers `/api/v1/internal/cleanup-tokens`
        (nécessite un plan Vercel Pro+ — les Cron Jobs ne sont pas
        disponibles sur le plan Hobby, à vérifier avant déploiement).
      - `backend/src/lib/tokenCleanup.js` (nouveau) + `routes/internal.routes.js`
        (nouveau) : nettoyage des refresh tokens expirés, partagé entre le
        `setInterval` classique et la route cron protégée par
        `CRON_SECRET` (fail-closed : 404 si le secret n'est pas configuré).
      - `lib/logger.js` : plus d'écriture fichier (`fs.mkdirSync`/`error.log`)
        en serverless (détecté via `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME`) —
        aurait planté au cold start (`EROFS`, disque en lecture seule).
        Console uniquement, capturée nativement par Vercel.
      - `backup.controller.js` / `backup.routes.js` : même souci que le
        logger (`ensureBackupsDir()` + `node-cron` au chargement du
        module) — **aurait empêché TOUTE l'app de démarrer sur Vercel**,
        pas seulement les routes de sauvegarde. Guardé derrière
        `isServerless` ; les routes `/auto/*` répondent 501 explicite sur
        Vercel plutôt qu'un crash disque brut. `exportBackup`/`restoreBackup`
        (par école, aucune écriture disque) restent disponibles partout.
      - `middleware/rateLimit.js` : backend Redis (Upstash) activé
        automatiquement si `UPSTASH_REDIS_REST_URL`/`_TOKEN` sont définis
        (fail-open si Redis indisponible), sinon repli sur la Map mémoire
        existante (suffisante pour Docker/VM). Packages `@upstash/ratelimit`
        + `@upstash/redis` ajoutés à `package.json`.
      - `lib/db.js` : `max` du pool réduit à 1 par défaut en serverless
        (configurable via `DB_POOL_MAX`) — Neon recommande `max: 1` sur son
        endpoint "pooled" (PgBouncer côté Neon fait déjà le multiplexage).
        Pas de changement de driver : `pg` standard fonctionne avec la
        connection string "pooled" de Neon pour des fonctions Node.js
        serverless (contrairement à l'edge runtime, qui nécessiterait
        `@neondatabase/serverless`).
      - **Vérifié de bout en bout** : le mode classique (`server.js`)
        retesté après extraction d'`app.js` (création école + login +
        lecture, identique à l'étape 3). Le mode Vercel (`api/index.js`)
        testé avec un vrai `http.Server` Node délégant au handler exporté
        (simulation fidèle du runtime Vercel Node.js) : health check,
        création d'école, lecture scopée, et confirmation que la
        mémoïsation évite de rejouer `ensureSecuritySchema` sur une
        instance "chaude". Route cron testée avec/sans le bon secret.
      - **Pas testé** (nécessite de vrais comptes) : Upstash Redis réel,
        déploiement Vercel réel, Neon réel.
- [x] **Étape 5 (partielle) — Vraie base Neon** :
      - **Trouvaille critique** : le rôle par défaut `neondb_owner` a
        `BYPASSRLS = true` sur Neon. Si l'app se connectait avec ce rôle,
        toute la protection RLS (FORCE ROW LEVEL SECURITY) serait
        silencieusement inopérante — un rôle avec BYPASSRLS ignore les
        policies, y compris FORCE. **Ne jamais utiliser `neondb_owner`
        comme rôle applicatif.**
      - Un rôle dédié `gestion_app` a été créé sur la base Neon réelle
        (`neondb`), sans BYPASSRLS, propriétaire de toutes les tables
        (schéma + migrations appliqués en se connectant directement avec
        ce rôle). `CREATE EXTENSION pgcrypto` a dû être fait une fois avec
        `neondb_owner` au préalable (seul le propriétaire de la base peut
        créer une extension), le reste tourne avec `gestion_app`.
      - `lib/db.js` : `connectionTimeoutMillis` par défaut relevé à 10s en
        serverless (`DB_CONNECTION_TIMEOUT_MS` réglable) — 2s (ancien
        défaut) provoquait des échecs de connexion contre un compute Neon
        suspendu (autosuspend après inactivité, réveil pas instantané).
      - **Bug trouvé et corrigé** : `ecole.controller.js#createEcole`
        (route publique, sans `protect`) ne renseignait pas `req.ecoleId`
        avant d'appeler `logAuditEvent` → l'événement `ECOLE_CREATE` de
        chaque nouvelle école était tagué `ecole_id = NULL`, invisible
        dans le journal d'audit de cette école. Corrigé (`req.ecoleId` fixé
        juste après la création de l'école, avant le log).
      - **Vérifié contre la vraie base** (pas un Postgres jetable local) :
        schéma + 9 migrations appliqués sans erreur, RLS confirmée
        `enabled=true forced=true` sur les bonnes tables, 2 écoles créées
        via l'API réelle (handler Vercel simulé), isolation confirmée
        (chaque école ne voit que ses données, même matricule réutilisable
        entre écoles), audit log correctement tagué. Données de test
        nettoyées après vérification — seule la donnée de seed légitime
        (École par défaut, 19 matières, 1 année scolaire) reste en base.
      - Connection string réelle (rôle `gestion_app`, mot de passe généré)
        **jamais écrite dans le repo** — communiquée à l'utilisateur pour
        qu'il la mette dans les variables d'environnement Vercel lui-même.
      - `frontend/src/pages/Signup.tsx` (nouveau) + route `/signup` : page
        self-service "Créer votre établissement", branchée sur
        `POST /api/ecoles` — comble le vide relevé plus haut ("UI frontend
        pour le signup d'école"). Résout le problème "poule et œuf" du tout
        premier compte admin sans intervention manuelle en base.
      - **Pas fait / hors de portée sans accès** : création du projet
        Vercel, configuration réelle de ses variables d'environnement,
        Upstash Redis réel, déploiement réel — nécessite les identifiants
        Vercel de l'utilisateur (dashboard ou token CLI), pas disponibles
        dans cet environnement.

### Variables d'environnement à configurer dans Vercel (projet backend)
| Variable | Valeur |
|---|---|
| `DATABASE_URL` | Connection string Neon **pooled**, avec le rôle `gestion_app` (jamais `neondb_owner` — voir ci-dessus). Fournie séparément, pas dans ce fichier. |
| `JWT_SECRET` | Générer une nouvelle valeur aléatoire ≥32 caractères (`openssl rand -base64 48`), différente de tout secret de dev/test. |
| `JWT_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_DAYS` | `7` |
| `CORS_ORIGIN` | URL(s) du frontend Vercel, séparées par virgules |
| `CRON_SECRET` | Générer une valeur aléatoire — Vercel l'injecte automatiquement en `Authorization: Bearer` sur les appels Cron s'il est défini au niveau projet |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optionnel — sans eux, repli automatique sur le rate-limiting en mémoire (fonctionne mais pas partagé entre instances) |
| `NODE_ENV` | `production` |

- [ ] **Étape 6** : déploiement de test réel, vérification isolation en prod.
- [ ] **Étape 7** : bascule production.
