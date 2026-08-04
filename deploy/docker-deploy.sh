#!/bin/bash
# ============================================================
#  Gestion École — Déploiement Docker (Linux/Ubuntu)
#  Prérequis : Docker Engine installé
#  Exécuter : bash deploy/docker-deploy.sh
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# ── 1. Vérification de Docker ─────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "[!] Docker non trouvé. Installation..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# ── 2. Fichier .env ──────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "[!] Fichier .env introuvable."
  echo "    Copie du modèle..."
  cp .env.docker .env

  # Générer des secrets automatiquement
  DB_PASS="$(openssl rand -base64 20 | tr -d '=+/')"
  JWT_SEC="$(openssl rand -base64 48 | tr -d '=+/')"
  LOCAL_IP="192.168.1.250"

  sed -i "s/CHANGE_MOI_mot_de_passe_fort/$DB_PASS/" .env
  sed -i "s/CHANGE_MOI_secret_jwt_tres_long_et_aleatoire/$JWT_SEC/" .env
  sed -i "s|CORS_ORIGIN=http://localhost|CORS_ORIGIN=http://192.168.1.250,http://localhost|" .env

  echo "    .env créé avec des secrets générés automatiquement."
  echo "    DB_PASSWORD et JWT_SECRET ont été générés."
fi

# ── 3. Build & démarrage ─────────────────────────────────
echo "[1/3] Build des images Docker..."
docker compose build --no-cache

echo "[2/3] Démarrage des conteneurs..."
docker compose up -d

echo "[3/3] Attente du démarrage..."
sleep 5

# ── 4. Vérification ──────────────────────────────────────
LOCAL_IP="192.168.1.250"

if curl -sf "http://localhost/health" > /dev/null 2>&1; then
  echo ""
  echo "============================================"
  echo "  Déploiement réussi !"
  echo ""
  echo "  Accès : http://$LOCAL_IP"
  echo "          http://localhost"
  echo ""
  echo "  Créer le compte admin :"
  echo "  bash deploy/docker-create-admin.sh"
  echo "============================================"
else
  echo ""
  echo "  En cours de démarrage... Attendre 10-15 secondes"
  echo "  puis ouvrir : http://$LOCAL_IP"
  echo ""
  echo "  Voir les logs : docker compose logs -f"
fi
