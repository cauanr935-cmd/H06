#!/usr/bin/env bash
#
# Restaura o DocuSeal (Postgres + volume app_data) a partir de backups
# gerados por backup.sh. Roda NO SERVIDOR (/opt/docuseal).
#
# DESTRUTIVO: apaga e recria o banco de dados e o conteúdo do volume
# app_data. Exige confirmação interativa antes de fazer qualquer coisa.
#
# Uso: ./restore.sh <postgres_TIMESTAMP.dump> <app_data_TIMESTAMP.tar.gz>

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "uso: $0 <postgres_TIMESTAMP.dump> <app_data_TIMESTAMP.tar.gz>" >&2
  exit 1
fi

PG_DUMP_FILE="$1"
APP_DATA_FILE="$2"

[ -f "$PG_DUMP_FILE" ] || { echo "erro: $PG_DUMP_FILE não existe" >&2; exit 1; }
[ -f "$APP_DATA_FILE" ] || { echo "erro: $APP_DATA_FILE não existe" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCUSEAL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PG_DUMP_FILE="$(cd "$(dirname "$PG_DUMP_FILE")" && pwd)/$(basename "$PG_DUMP_FILE")"
APP_DATA_DIR="$(cd "$(dirname "$APP_DATA_FILE")" && pwd)"
APP_DATA_BASENAME="$(basename "$APP_DATA_FILE")"

cd "$DOCUSEAL_DIR"

set -a
# shellcheck source=/dev/null
source "$DOCUSEAL_DIR/.env"
set +a

echo "ATENÇÃO: isso vai APAGAR o banco de dados atual (${POSTGRES_DB}) e todo o"
echo "conteúdo de app_data, substituindo pelo conteúdo de:"
echo "  Postgres:  $PG_DUMP_FILE"
echo "  app_data:  $APP_DATA_DIR/$APP_DATA_BASENAME"
echo
read -r -p "Digite 'restaurar' para confirmar: " confirm
if [ "$confirm" != "restaurar" ]; then
  echo "abortado."
  exit 1
fi

echo "[restore] parando o app para evitar escrita durante a restauração..."
docker compose stop app

echo "[restore] restaurando Postgres (drop + recreate + pg_restore)..."
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" <"$PG_DUMP_FILE"

echo "[restore] restaurando volume docuseal_app_data..."
docker run --rm \
  -v docuseal_app_data:/data \
  -v "$APP_DATA_DIR:/backup:ro" \
  alpine sh -c "find /data -mindepth 1 -delete && tar xzf /backup/${APP_DATA_BASENAME} -C /data"

echo "[restore] subindo o app de novo..."
docker compose up -d app

echo "[restore] concluído. Confira https://${DOMAIN} e o admin do DocuSeal."
