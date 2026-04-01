#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="http://127.0.0.1:3000"
CRON_SECRET="shan2374"
ETL_ENDPOINTS="/api/cron/student-sync,/api/cron/alert-counts"
CURL_CONNECT_TIMEOUT="10"
CURL_MAX_TIME="1800"
RETRY_COUNT="3"
RETRY_DELAY_SECONDS="10"
LOG_DIR="/var/log/student-alert-system"

if [[ -z "${APP_BASE_URL}" ]]; then
  echo "ERROR: APP_BASE_URL is required" >&2
  exit 1
fi

if [[ -z "${CRON_SECRET}" ]]; then
  echo "ERROR: CRON_SECRET is required" >&2
  exit 1
fi

mkdir -p "${LOG_DIR}" 
LOG_FILE="${LOG_DIR}/etl-$(date +%Y-%m-%d).log"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $*" | tee -a "${LOG_FILE}"
}

call_endpoint() {
  local endpoint="$1"
  local url="${APP_BASE_URL%/}${endpoint}"
  local attempt=1

  while (( attempt <= RETRY_COUNT )); do
    log "Calling ${url} (attempt ${attempt}/${RETRY_COUNT})"

    local response
    local http_code
    response="$(curl -sS \
      --connect-timeout "${CURL_CONNECT_TIMEOUT}" \
      --max-time "${CURL_MAX_TIME}" \
      -X POST "${url}" \
      -H "Authorization: Bearer ${CRON_SECRET}" \
      -H "x-cron-secret: ${CRON_SECRET}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP_STATUS:%{http_code}")" || true

    http_code="$(echo "${response}" | awk -F: '/HTTP_STATUS/ {print $2}' | tr -d '[:space:]')"
    local body
    body="$(echo "${response}" | sed '/HTTP_STATUS:/d')"

    if [[ "${http_code}" == "200" ]]; then
      log "SUCCESS ${endpoint} -> ${body}"
      return 0
    fi

    log "FAILED ${endpoint} (status=${http_code:-unknown}) -> ${body}"

    if (( attempt < RETRY_COUNT )); then
      log "Retrying in ${RETRY_DELAY_SECONDS}s..."
      sleep "${RETRY_DELAY_SECONDS}"
    fi
    (( attempt++ ))
  done

  return 1
}

main() {
  log "ETL run started"
  local failed=0
  IFS=',' read -r -a endpoints <<< "${ETL_ENDPOINTS}"

  for endpoint in "${endpoints[@]}"; do
    endpoint="$(echo "${endpoint}" | xargs)"
    [[ -z "${endpoint}" ]] && continue
    if ! call_endpoint "${endpoint}"; then
      failed=1
    fi
  done

  if (( failed == 1 )); then
    log "ETL run finished with errors"
    exit 1
  fi

  log "ETL run completed successfully"
}

main "$@"
