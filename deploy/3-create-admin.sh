#!/bin/bash
# ============================================================
#  Créer le compte administrateur initial
#  Exécuter UNE SEULE FOIS après le premier déploiement
# ============================================================
set -e

APP_DIR="/var/www/ecole/backend"

echo "=== Création du compte administrateur ==="
echo ""

read -p "Email admin      : " ADMIN_EMAIL
read -p "Nom              : " ADMIN_NOM
read -p "Prénom           : " ADMIN_PRENOM
read -p "Téléphone        : " ADMIN_TEL
read -s -p "Mot de passe     : " ADMIN_PASS
echo ""
read -s -p "Confirmer le MDP : " ADMIN_PASS2
echo ""

if [ "$ADMIN_PASS" != "$ADMIN_PASS2" ]; then
  echo "Erreur : les mots de passe ne correspondent pas."
  exit 1
fi

# Injecter les variables et exécuter le script
set -a; source "$APP_DIR/.env"; set +a

ADMIN_EMAIL="$ADMIN_EMAIL" \
ADMIN_NOM="$ADMIN_NOM" \
ADMIN_PRENOM="$ADMIN_PRENOM" \
ADMIN_TELEPHONE="$ADMIN_TEL" \
ADMIN_PASSWORD="$ADMIN_PASS" \
  node "$APP_DIR/scripts/create-admin.js"

echo ""
echo "Compte administrateur créé avec succès !"
echo "Connectez-vous sur : http://$(hostname -I | awk '{print $1}')"
