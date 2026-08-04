#!/bin/bash
# ============================================================
#  COMMANDES UTILES — Gestion courante du serveur local
#  (copier-coller dans le terminal du serveur)
# ============================================================

# ── État de l'application ────────────────────────────────
pm2 status                        # état du processus Node.js
pm2 logs gestion-ecole            # logs en temps réel
pm2 logs gestion-ecole --lines 50 # 50 dernières lignes
systemctl status nginx            # état de Nginx

# ── Redémarrage ──────────────────────────────────────────
pm2 restart gestion-ecole         # redémarrer Node.js
pm2 reload gestion-ecole          # redémarrer sans coupure (0-downtime)
systemctl restart nginx           # redémarrer Nginx

# ── Base de données ──────────────────────────────────────
# Se connecter à PostgreSQL
sudo -u postgres psql -d ECOLE

# Sauvegarde manuelle PostgreSQL (format SQL natif)
sudo -u postgres pg_dump ECOLE > /root/backup_$(date +%Y%m%d).sql

# Restaurer depuis un dump SQL
sudo -u postgres psql -d ECOLE < /root/backup_20250101.sql

# ── Adresse IP du serveur ────────────────────────────────
hostname -I | awk '{print $1}'    # affiche l'IP locale

# ── Mise à jour de l'application ────────────────────────
# (depuis le dossier du projet sur le PC de dev)
# Transférer les fichiers puis exécuter :
sudo bash /chemin/vers/2-deploy.sh

# ── Transfert fichiers depuis le PC Windows ──────────────
# (dans PowerShell ou Git Bash sur le PC dev)
# scp -r "c:\Users\CCL\Desktop\Gestion Ecole\backend" user@IP_SERVEUR:/tmp/ecole-deploy/
# scp -r "c:\Users\CCL\Desktop\Gestion Ecole\frontend" user@IP_SERVEUR:/tmp/ecole-deploy/
# scp -r "c:\Users\CCL\Desktop\Gestion Ecole\deploy" user@IP_SERVEUR:/tmp/ecole-deploy/

# ── Voir les sauvegardes auto ────────────────────────────
ls -lh /var/www/ecole/backups/

# ── Espace disque ────────────────────────────────────────
df -h /                           # espace disque total
du -sh /var/www/ecole/backups/    # taille des sauvegardes
