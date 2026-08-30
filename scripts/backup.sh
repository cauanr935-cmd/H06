#!/usr/bin/env bash
#
# Backup do DocuSeal (Postgres + volume app_data). Roda NO SERVIDOR
# (/opt/docuseal), via systemd timer (docuseal-backup.timer) ou manualmente.
#
# Gera em backups/:
#   postgres_<timestamp>.dump      (pg_dump -Fc, verificado com pg_restore --list)
#   app_data_<timestamp>.tar.gz    (tar do volume docuseal_app_data)
#
# Retenção local: 7 dias. Credenciais lidas de .env, nunca hardcoded.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCUSEAL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$DOCUSEAL_DIR/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MIN_FREE_GB=5
RETENTION_DAYS=7

PG_DUMP_FILE="$BACKUP_DIR/postgres_${TIMESTAMP}.dump"
APP_DATA_FILE="$BACKUP_DIR/app_data_${TIMESTAMP}.tar.gz"

cleanup_on_failure() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    echo "[backup] falhou (exit $exit_code) — removendo artefatos parciais desta execução" >&2
    rm -f "$PG_DUMP_FILE" "$APP_DATA_FILE"
  fi
  exit "$exit_code"
}
trap cleanup_on_failure EXIT

cd "$DOCUSEAL_DIR"

avail_kb="$(df --output=avail -k "$DOCUSEAL_DIR" | tail -1 | tr -d ' ')"
avail_gb=$((avail_kb / 1024 / 1024))
if [ "$avail_gb" -lt "$MIN_FREE_GB" ]; then
  echo "[backup] erro: só ${avail_gb}GB livres em $DOCUSEAL_DIR, mínimo ${MIN_FREE_GB}GB — abortando" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

set -a
# shellcheck source=/dev/null
source "$DOCUSEAL_DIR/.env"
set +a

echo "[backup] dump do Postgres (${POSTGRES_DB})..."
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" >"$PG_DUMP_FILE"

echo "[backup] verificando integridade do dump..."
toc="$(docker run --rm -v "$BACKUP_DIR:/backups:ro" postgres:15-alpine \
  pg_restore --list "/backups/postgres_${TIMESTAMP}.dump")"
if ! grep -q ' TABLE ' <<<"$toc"; then
  echo "[backup] erro: pg_restore --list não encontrou nenhuma tabela no dump — abortando" >&2
  exit 1
fi

echo "[backup] compactando volume docuseal_app_data..."
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v docuseal_app_data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/app_data_${TIMESTAMP}.tar.gz" -C /data .

echo "[backup] removendo backups com mais de ${RETENTION_DAYS} dias..."
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.tar.gz' \) -mtime "+${RETENTION_DAYS}" -delete

echo "[backup] concluído: $PG_DUMP_FILE / $APP_DATA_FILE"
