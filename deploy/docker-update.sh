#!/bin/bash
# ============================================================
#  Mise à jour de l'application (nouvelle version du code)
# ============================================================
set -e

cd "$(dirname "$0")/.."

echo "=== Mise à jour Gestion École ==="

echo "[1/3] Rebuild des images..."
docker compose build --no-cache

echo "[2/3] Redémarrage sans coupure..."
docker compose up -d

echo "[3/3] Nettoyage des anciennes images..."
docker image prune -f

echo ""
echo "Mise à jour terminée !"
echo "Logs : docker compose logs -f"
