#!/bin/bash
# ============================================================
#  GESTION ÉCOLE — Script d'installation serveur local
#  Ubuntu 22.04 LTS / Debian 12
#  Exécuter en tant que root : sudo bash 1-install.sh
# ============================================================
set -e

APP_DIR="/var/www/ecole"
DB_NAME="ECOLE"
DB_USER="ecole_user"
DB_PASS="$(openssl rand -base64 16)"
NODE_VERSION="20"

echo "============================================"
echo "  Installation Gestion École — Serveur local"
echo "============================================"

# ── 1. Mise à jour système ────────────────────────────────
echo "[1/8] Mise à jour du système..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 20 ────────────────────────────────────────
echo "[2/8] Installation de Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# ── 3. PM2 (gestionnaire de processus) ───────────────────
echo "[3/8] Installation de PM2..."
npm install -g pm2

# ── 4. Nginx ─────────────────────────────────────────────
echo "[4/8] Installation de Nginx..."
apt-get install -y nginx

# ── 5. PostgreSQL ─────────────────────────────────────────
echo "[5/8] Installation de PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Créer la base de données et l'utilisateur
echo "[5/8] Création de la base de données..."
sudo -u postgres psql <<SQL
CREATE DATABASE "$DB_NAME" ENCODING 'UTF8' LC_COLLATE 'fr_FR.UTF-8' LC_CTYPE 'fr_FR.UTF-8' TEMPLATE template0;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO $DB_USER;
ALTER DATABASE "$DB_NAME" OWNER TO $DB_USER;
SQL

# ── 6. Répertoire de l'application ────────────────────────
echo "[6/8] Préparation du répertoire..."
mkdir -p "$APP_DIR"/{backend,frontend,backups}
chown -R www-data:www-data "$APP_DIR"

# ── 7. Nginx — configuration ──────────────────────────────
echo "[7/8] Configuration de Nginx..."
cp /tmp/ecole-deploy/deploy/nginx.conf /etc/nginx/sites-available/ecole
ln -sf /etc/nginx/sites-available/ecole /etc/nginx/sites-enabled/ecole
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx

# ── 8. Variables d'environnement backend ──────────────────
echo "[8/8] Création du fichier .env..."
JWT_SECRET="$(openssl rand -base64 48)"
LOCAL_IP="$(hostname -I | awk '{print $1}')"

cat > "$APP_DIR/backend/.env" <<ENV
PORT=5001
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS

JWT_SECRET=$JWT_SECRET

# Adresse IP locale du serveur (modifier si nécessaire)
CORS_ORIGIN=http://$LOCAL_IP,http://localhost

API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=500
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=20
LOGIN_MAX_FAILED_ATTEMPTS=10
LOGIN_LOCK_DURATION_MINUTES=15
ENV

chmod 600 "$APP_DIR/backend/.env"

# ── PM2 au démarrage ──────────────────────────────────────
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── Résumé ────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Installation terminée !"
echo "============================================"
echo "  Base de données : $DB_NAME"
echo "  Utilisateur DB  : $DB_USER"
echo "  Mot de passe DB : $DB_PASS  <-- NOTEZ CE MOT DE PASSE"
echo "  IP du serveur   : $LOCAL_IP"
echo "  Application     : http://$LOCAL_IP"
echo ""
echo "  Étape suivante : exécutez 2-deploy.sh"
echo "============================================"

# Sauvegarder les infos dans un fichier
cat > /root/ecole-credentials.txt <<INFO
Date installation : $(date)
Base de données   : $DB_NAME
Utilisateur DB    : $DB_USER
Mot de passe DB   : $DB_PASS
JWT Secret        : $JWT_SECRET
IP serveur        : $LOCAL_IP
INFO
chmod 600 /root/ecole-credentials.txt
echo "  Identifiants sauvegardés dans /root/ecole-credentials.txt"
