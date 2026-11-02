#!/usr/bin/env bash
#
# Выкладка сайта на хостинг REG.RU по FTP.
# Настройки подключения — в .deploy.env (файл не попадает в git).
#
#   ./deploy.sh              обычная выкладка
#   DRY_RUN=1 ./deploy.sh    показать, что будет загружено, ничего не меняя
#   DELETE=1 ./deploy.sh     удалить на хостинге файлы, которых нет локально
#
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .deploy.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.deploy.env
  set +a
fi

: "${FTP_HOST:?Укажите FTP_HOST в .deploy.env (образец — .deploy.env.example)}"
: "${FTP_USER:?Укажите FTP_USER в .deploy.env}"
: "${FTP_PASS:?Укажите FTP_PASS в .deploy.env}"

REMOTE_DIR="${REMOTE_DIR:-www/karanelly.space}"
FTP_TLS="${FTP_TLS:-1}"
DELETE="${DELETE:-0}"
DRY_RUN="${DRY_RUN:-0}"

if ! command -v lftp >/dev/null 2>&1; then
  echo "Не найден lftp. Установите его: brew install lftp" >&2
  exit 1
fi

FLAGS="-R --verbose=1 --parallel=4"
FLAGS="$FLAGS --exclude-glob .git --exclude-glob .git/*"
FLAGS="$FLAGS --exclude-glob .github --exclude-glob .github/*"
FLAGS="$FLAGS --exclude-glob .deploy.env --exclude-glob .deploy.env.example"
FLAGS="$FLAGS --exclude-glob deploy.sh --exclude-glob README.md"
FLAGS="$FLAGS --exclude-glob .DS_Store"
FLAGS="$FLAGS --exclude-glob .well-known --exclude-glob .well-known/*"
FLAGS="$FLAGS --exclude-glob cgi-bin --exclude-glob error_docs"

[ "$DELETE" = "1" ] && FLAGS="$FLAGS --delete"
[ "$DRY_RUN" = "1" ] && FLAGS="$FLAGS --dry-run"

SCRIPT="$(mktemp)"
{
  echo "set net:timeout 25"
  echo "set net:max-retries 3"
  if [ "$FTP_TLS" = "1" ]; then
    echo "set ftp:ssl-force true"
    echo "set ftp:ssl-protect-data true"
    echo "set ssl:verify-certificate no"
  fi
  printf 'cd "%s"\n' "$REMOTE_DIR"
  printf 'mirror %s . .\n' "$FLAGS"
  echo "bye"
} > "$SCRIPT"

echo "→ $FTP_USER@$FTP_HOST:$REMOTE_DIR  (TLS=$FTP_TLS, delete=$DELETE, dry-run=$DRY_RUN)"

set +e
LFTP_PASSWORD="$FTP_PASS" lftp -u "$FTP_USER" "$FTP_HOST" -f "$SCRIPT"
STATUS=$?
set -e
rm -f "$SCRIPT"

if [ "$STATUS" -ne 0 ]; then
  echo
  echo "Выкладка не удалась (код $STATUS)." >&2
  echo "Проверьте FTP_HOST, FTP_USER, FTP_PASS и REMOTE_DIR в .deploy.env." >&2
  echo "Если хостинг не поддерживает FTPS — поставьте FTP_TLS=0." >&2
  exit "$STATUS"
fi

echo
echo "Готово. Проверьте https://karanelly.space/"
