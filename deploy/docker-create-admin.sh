#!/bin/bash
# ============================================================
#  Créer le compte administrateur (via Docker)
#  Exécuter UNE SEULE FOIS après le premier déploiement
# ============================================================
set -e

cd "$(dirname "$0")/.."

echo "=== Création du compte administrateur ==="
echo ""

read -p "Email          : " ADMIN_EMAIL
read -p "Nom            : " ADMIN_NOM
read -p "Prénom         : " ADMIN_PRENOM
read -p "Téléphone      : " ADMIN_TEL
read -s -p "Mot de passe   : " ADMIN_PASS
echo ""
read -s -p "Confirmer MDP  : " ADMIN_PASS2
echo ""

if [ "$ADMIN_PASS" != "$ADMIN_PASS2" ]; then
  echo "Erreur : les mots de passe ne correspondent pas."
  exit 1
fi

docker compose exec -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_NOM="$ADMIN_NOM" \
  -e ADMIN_PRENOM="$ADMIN_PRENOM" \
  -e ADMIN_TELEPHONE="$ADMIN_TEL" \
  -e ADMIN_PASSWORD="$ADMIN_PASS" \
  backend node scripts/create-admin.js

echo ""
LOCAL_IP="192.168.1.250"
echo "Compte créé ! Connectez-vous sur : http://$LOCAL_IP"
