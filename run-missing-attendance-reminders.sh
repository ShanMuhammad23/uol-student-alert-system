#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3002}"
CRON_SECRET="${CRON_SECRET:-}"
FACULTY_ID="${MISSING_ATTENDANCE_FACULTY_ID:-}"
MIN_MISSING="${MISSING_ATTENDANCE_MIN_MISSING:-4}"
DRY_RUN="${MISSING_ATTENDANCE_DRY_RUN:-false}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
# One HTTP call sends all qualifying emails (5s pause between each).
CURL_MAX_TIME="${CURL_MAX_TIME:-7200}"
RETRY_COUNT="${RETRY_COUNT:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-10}"
LOG_DIR="${LOG_DIR:-/var/log/student-alert-system}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETL_ENV_FILE="${ETL_ENV_FILE:-${SCRIPT_DIR}/.env}"

load_env_file() {
  local env_file="$1"
  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line}" ]] && continue
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" != *=* ]] && continue

    local key="${line%%=*}"
    local value="${line#*=}"
    key="$(echo "${key}" | xargs)"
    [[ -z "${key}" ]] && continue
    [[ ! "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && continue

    if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "${key}=${value}"
  done < "${env_file}"
}

load_env_file "${ETL_ENV_FILE}"

# Re-read after loading .env so file values take effect.
CRON_SECRET="${CRON_SECRET:-}"
APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3002}"
FACULTY_ID="${MISSING_ATTENDANCE_FACULTY_ID:-}"
MIN_MISSING="${MISSING_ATTENDANCE_MIN_MISSING:-4}"
DRY_RUN="${MISSING_ATTENDANCE_DRY_RUN:-false}"

if [[ -z "${CRON_SECRET}" ]]; then
  echo "ERROR: CRON_SECRET is required" >&2
  exit 1
fi

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/missing-attendance-$(date +%Y-%m-%d).log"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $*" | tee -a "${LOG_FILE}"
}

endpoint="/api/cron/missing-attendance-reminders"
query="minMissing=${MIN_MISSING}"
if [[ -n "${FACULTY_ID}" ]]; then
  query="facultyId=$(printf '%s' "${FACULTY_ID}" | sed 's/ /%20/g')&${query}"
fi
if [[ "${DRY_RUN}" == "1" || "${DRY_RUN}" == "true" || "${DRY_RUN}" == "TRUE" ]]; then
  query="${query}&dryRun=1"
fi
url="${APP_BASE_URL%/}${endpoint}?${query}"

dry_run_json="false"
if [[ "${DRY_RUN}" == "1" || "${DRY_RUN}" == "true" || "${DRY_RUN}" == "TRUE" ]]; then
  dry_run_json="true"
fi

if [[ -n "${FACULTY_ID}" ]]; then
  payload="$(printf '{"facultyId":"%s","minMissingEntries":%s,"dryRun":%s}' \
    "${FACULTY_ID}" "${MIN_MISSING}" "${dry_run_json}")"
else
  payload="$(printf '{"minMissingEntries":%s,"dryRun":%s}' \
    "${MIN_MISSING}" "${dry_run_json}")"
fi

attempt=1
while (( attempt <= RETRY_COUNT )); do
  if [[ -n "${FACULTY_ID}" ]]; then
    log "Calling ${url} (faculty=${FACULTY_ID}, attempt ${attempt}/${RETRY_COUNT})"
  else
    log "Calling ${url} (all faculties, attempt ${attempt}/${RETRY_COUNT})"
  fi
  response="$(curl -sS \
    --connect-timeout "${CURL_CONNECT_TIMEOUT}" \
    --max-time "${CURL_MAX_TIME}" \
    -X POST "${url}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    --data "${payload}" \
    -w "\nHTTP_STATUS:%{http_code}")" || true

  http_code="$(echo "${response}" | awk -F: '/HTTP_STATUS/ {print $2}' | tr -d '[:space:]')"
  body="$(echo "${response}" | sed '/HTTP_STATUS:/d')"

  if [[ "${http_code}" == "200" ]]; then
    log "SUCCESS -> ${body}"
    exit 0
  fi

  log "FAILED (status=${http_code:-unknown}) -> ${body}"
  if (( attempt < RETRY_COUNT )); then
    log "Retrying in ${RETRY_DELAY_SECONDS}s..."
    sleep "${RETRY_DELAY_SECONDS}"
  fi
  (( attempt++ ))
done

log "Missing attendance reminder run finished with errors"
exit 1
