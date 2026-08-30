#!/usr/bin/env bash
#
# Deploy do VPS: sincroniza infra/ e scripts/ para /opt/docuseal e sobe os
# containers. Roda LOCAL (raiz do repo). Separado do deploy da LP (Vercel),
# que não passa por aqui.
#
# REMOTE pode ser sobrescrito, ex.: REMOTE=deploy@docuseal.h06.online ./scripts/deploy.sh
# (default assume o alias "docuseal" configurado em ~/.ssh/config).

set -euo pipefail

REMOTE="${REMOTE:-docuseal}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_DIR"

echo "[deploy] sincronizando infra/ para $REMOTE:/opt/docuseal/..."
rsync -av infra/ "$REMOTE:/opt/docuseal/"

echo "[deploy] sincronizando scripts de backup/restore para $REMOTE:/opt/docuseal/scripts/..."
rsync -av scripts/backup.sh scripts/restore.sh "$REMOTE:/opt/docuseal/scripts/"
rsync -av scripts/systemd/ "$REMOTE:/opt/docuseal/scripts/systemd/"
ssh "$REMOTE" 'chmod +x /opt/docuseal/scripts/backup.sh /opt/docuseal/scripts/restore.sh'

echo "[deploy] subindo os containers..."
ssh "$REMOTE" 'cd /opt/docuseal && docker compose up -d'

echo "[deploy] concluído."
echo "[deploy] lembrete: instalar/atualizar o timer de backup é manual — ver scripts/systemd/ e o CLAUDE.md."
