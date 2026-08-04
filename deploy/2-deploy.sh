#!/bin/bash
# ============================================================
#  GESTION ÉCOLE — Script de déploiement / mise à jour
#  À exécuter depuis le dossier du projet sur le PC dev,
#  ou directement sur le serveur après avoir copié les sources.
#
#  Usage :
#    Sur le serveur : sudo bash 2-deploy.sh
#    Depuis le PC   : voir section "Transfert" ci-dessous
# ============================================================
set -e

APP_DIR="/var/www/ecole"
BACKEND_SRC="$(dirname "$0")/../backend"
FRONTEND_SRC="$(dirname "$0")/../frontend"

echo "============================================"
echo "  Déploiement Gestion École"
echo "============================================"

# ── 1. Build du frontend ──────────────────────────────────
echo "[1/5] Build du frontend..."
cd "$FRONTEND_SRC"
npm install --silent
npm run build

echo "[1/5] Copie des fichiers frontend..."
rm -rf "$APP_DIR/frontend"
mkdir -p "$APP_DIR/frontend"
cp -r dist/* "$APP_DIR/frontend/"

# ── 2. Backend ────────────────────────────────────────────
echo "[2/5] Copie du backend..."
rsync -av --exclude='node_modules' --exclude='.env' --exclude='backups' \
  "$BACKEND_SRC/" "$APP_DIR/backend/"

echo "[3/5] Installation des dépendances backend..."
cd "$APP_DIR/backend"
npm install --production --silent

# ── 3. Base de données ────────────────────────────────────
echo "[4/5] Application du schéma de base de données..."
# Charger les variables d'environnement
set -a; source "$APP_DIR/backend/.env"; set +a

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
  -f "$APP_DIR/backend/database/schema.sql" 2>/dev/null || true

# Migrations optionnelles (ignorées si déjà appliquées)
for migration in "$APP_DIR/backend/database"/migration_*.sql; do
  echo "    Migration : $(basename $migration)"
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -f "$migration" 2>/dev/null || true
done

# ── 4. PM2 ────────────────────────────────────────────────
echo "[5/5] (Re)démarrage du serveur Node.js..."
mkdir -p /var/log/ecole
chown -R www-data:www-data "$APP_DIR"

if pm2 describe gestion-ecole > /dev/null 2>&1; then
  pm2 reload "$APP_DIR/backend/ecosystem.config.js" --update-env
else
  pm2 start "$APP_DIR/backend/ecosystem.config.js"
fi
pm2 save

# ── Vérification ──────────────────────────────────────────
sleep 2
LOCAL_IP="$(hostname -I | awk '{print $1}')"

if curl -sf "http://localhost/health" > /dev/null; then
  echo ""
  echo "============================================"
  echo "  Déploiement réussi !"
  echo "  Application accessible sur :"
  echo "    http://$LOCAL_IP          (réseau local)"
  echo "    http://localhost           (serveur)"
  echo "============================================"
else
  echo ""
  echo "  ATTENTION : Le serveur ne répond pas."
  echo "  Vérifiez les logs : pm2 logs gestion-ecole"
fi
