#!/bin/bash
# ============================================================
#  COMMANDES DOCKER UTILES — Gestion courante
# ============================================================

# ── État ────────────────────────────────────────────────
docker compose ps                        # état des conteneurs
docker compose logs -f                   # logs en temps réel
docker compose logs -f backend           # logs backend uniquement
docker compose logs --tail=50 backend    # 50 dernières lignes

# ── Redémarrage ──────────────────────────────────────────
docker compose restart backend           # redémarrer le backend
docker compose restart                   # redémarrer tout
docker compose down && docker compose up -d   # arrêt + redémarrage complet

# ── Base de données ──────────────────────────────────────
# Ouvrir une console PostgreSQL
docker compose exec postgres psql -U ecole_user -d ECOLE

# Sauvegarde PostgreSQL native (dump SQL)
docker compose exec postgres pg_dump -U ecole_user ECOLE > backup_$(date +%Y%m%d).sql

# Restaurer depuis un dump SQL
docker compose exec -T postgres psql -U ecole_user -d ECOLE < backup_20250101.sql

# ── Sauvegardes automatiques (fichiers JSON) ─────────────
# Voir les fichiers de sauvegarde
docker compose exec backend ls -lh /backups/

# Copier les sauvegardes vers le PC local
docker cp ecole-backend:/backups ./backups-local/

# ── Mise à jour ──────────────────────────────────────────
bash deploy/docker-update.sh

# ── Arrêt complet ────────────────────────────────────────
docker compose down                      # arrête les conteneurs (données préservées)
docker compose down -v                   # DANGER : supprime aussi les volumes (données perdues)

# ── Espace disque ────────────────────────────────────────
docker system df                         # espace utilisé par Docker
docker volume ls                         # liste des volumes
