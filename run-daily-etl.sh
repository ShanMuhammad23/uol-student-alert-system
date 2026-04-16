#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="http://127.0.0.1:3002"
CRON_SECRET="shan2374"
ETL_ENDPOINTS="/api/cron/student-sync,/api/cron/alert-counts"
FACULTY_CONFIGS="50000172:1117,50000178:1123"
CURL_CONNECT_TIMEOUT="10"
CURL_MAX_TIME="1800"
RETRY_COUNT="3"
RETRY_DELAY_SECONDS="10"
LOG_DIR="/var/log/student-alert-system"
PIPELINE_NAME="daily_etl_shell"
LOG_BUFFER_MAX_CHARS="120000"
ETL_RUN_ID=""
ETL_FINALIZED="0"
LOG_BUFFER=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETL_ENV_FILE="${ETL_ENV_FILE:-${SCRIPT_DIR}/.env}"

load_env_file() {
  local env_file="$1"
  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi

  # Load KEY=VALUE pairs for this shell process.
  # shellcheck disable=SC1090
  set -a
  source "${env_file}"
  set +a
}

if [[ -z "${APP_BASE_URL}" ]]; then
  echo "ERROR: APP_BASE_URL is required" >&2
  exit 1
fi

if [[ -z "${CRON_SECRET}" ]]; then
  echo "ERROR: CRON_SECRET is required" >&2
  exit 1
fi

load_env_file "${ETL_ENV_FILE}"

mkdir -p "${LOG_DIR}" 
LOG_FILE="${LOG_DIR}/etl-$(date +%Y-%m-%d).log"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  local line="[$(timestamp)] $*"
  echo "${line}" | tee -a "${LOG_FILE}"
  LOG_BUFFER+="${line}"$'\n'
  if (( ${#LOG_BUFFER} > LOG_BUFFER_MAX_CHARS )); then
    LOG_BUFFER="${LOG_BUFFER: -LOG_BUFFER_MAX_CHARS}"
  fi
}

require_etl_db_logging() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL is required for ETL run logging" >&2
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "ERROR: psql is required for ETL run logging" >&2
    exit 1
  fi
}

start_etl_run() {
  require_etl_db_logging
  ETL_RUN_ID="$(psql "${DATABASE_URL}" -X -A -t -q -v ON_ERROR_STOP=1 \
    -v pipeline_name="${PIPELINE_NAME}" \
    -c "INSERT INTO etl_runs (pipeline_name, status, error_message) VALUES (:'pipeline_name', 'running', '') RETURNING id;")"
  ETL_RUN_ID="$(echo "${ETL_RUN_ID}" | tr -d '[:space:]')"
  if [[ -z "${ETL_RUN_ID}" ]]; then
    echo "ERROR: Failed to create etl_runs row" >&2
    exit 1
  fi
}

finalize_etl_run() {
  local final_status="$1"
  local summary="$2"
  [[ -z "${ETL_RUN_ID}" ]] && return 0

  psql "${DATABASE_URL}" -X -q -v ON_ERROR_STOP=1 \
    -v run_id="${ETL_RUN_ID}" \
    -v status="${final_status}" \
    -v summary="${summary}" \
    -v run_log="${LOG_BUFFER}" \
    -c "UPDATE etl_runs
        SET completed_at = NOW(),
            status = :'status',
            error_message = CONCAT(
              COALESCE(:'summary', ''),
              CASE WHEN COALESCE(:'summary', '') <> '' THEN E'\n\n' ELSE '' END,
              COALESCE(:'run_log', '')
            )
        WHERE id = :'run_id'::bigint;" >/dev/null
  ETL_FINALIZED="1"
}

on_exit() {
  local exit_code="$1"
  if [[ "${ETL_FINALIZED}" == "1" ]]; then
    return
  fi

  if (( exit_code == 0 )); then
    finalize_etl_run "success" "ETL run completed successfully"
  else
    finalize_etl_run "failed" "ETL run finished with errors"
  fi
}

call_endpoint() {
  local endpoint="$1"
  local faculty_id="$2"
  local enrollment_faculty_id="$3"
  local delimiter='?'
  [[ "${endpoint}" == *\?* ]] && delimiter='&'
  local url="${APP_BASE_URL%/}${endpoint}${delimiter}facultyId=${faculty_id}&enrollmentFacultyId=${enrollment_faculty_id}"
  local payload
  payload="$(printf '{"facultyId":"%s","enrollmentFacultyId":"%s"}' "${faculty_id}" "${enrollment_faculty_id}")"
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
      --data "${payload}" \
      -w "\nHTTP_STATUS:%{http_code}")" || true

    http_code="$(echo "${response}" | awk -F: '/HTTP_STATUS/ {print $2}' | tr -d '[:space:]')"
    local body
    body="$(echo "${response}" | sed '/HTTP_STATUS:/d')"

    if [[ "${http_code}" == "200" ]]; then
      log "SUCCESS ${endpoint} (facultyId=${faculty_id}, enrollmentFacultyId=${enrollment_faculty_id}) -> ${body}"
      return 0
    fi

    log "FAILED ${endpoint} (facultyId=${faculty_id}, enrollmentFacultyId=${enrollment_faculty_id}, status=${http_code:-unknown}) -> ${body}"

    if (( attempt < RETRY_COUNT )); then
      log "Retrying in ${RETRY_DELAY_SECONDS}s..."
      sleep "${RETRY_DELAY_SECONDS}"
    fi
    (( attempt++ ))
  done

  return 1
}

run_gpa_import() {
  local enrollment_faculty_id="$1"
  local attempt=1

  while (( attempt <= RETRY_COUNT )); do
    log "Running GPA import for enrollmentFacultyId=${enrollment_faculty_id} (attempt ${attempt}/${RETRY_COUNT})"
    if SAP_FAC_CODE="${enrollment_faculty_id}" npm run import:gpa:history >> "${LOG_FILE}" 2>&1; then
      log "SUCCESS GPA import (enrollmentFacultyId=${enrollment_faculty_id})"
      return 0
    fi

    log "FAILED GPA import (enrollmentFacultyId=${enrollment_faculty_id})"
    if (( attempt < RETRY_COUNT )); then
      log "Retrying GPA import in ${RETRY_DELAY_SECONDS}s..."
      sleep "${RETRY_DELAY_SECONDS}"
    fi
    (( attempt++ ))
  done

  return 1
}

main() {
  start_etl_run
  log "ETL run started"
  local failed=0
  IFS=',' read -r -a endpoints <<< "${ETL_ENDPOINTS}"
  IFS=',' read -r -a faculty_configs <<< "${FACULTY_CONFIGS}"

  for faculty_config in "${faculty_configs[@]}"; do
    faculty_config="$(echo "${faculty_config}" | xargs)"
    [[ -z "${faculty_config}" ]] && continue

    IFS=':' read -r faculty_id enrollment_faculty_id <<< "${faculty_config}"
    faculty_id="$(echo "${faculty_id}" | xargs)"
    enrollment_faculty_id="$(echo "${enrollment_faculty_id}" | xargs)"

    if [[ -z "${faculty_id}" || -z "${enrollment_faculty_id}" ]]; then
      log "Skipping invalid faculty config: ${faculty_config}"
      failed=1
      continue
    fi

    log "Running ETL endpoints for facultyId=${faculty_id}, enrollmentFacultyId=${enrollment_faculty_id}"
    if ! run_gpa_import "${enrollment_faculty_id}"; then
      failed=1
      continue
    fi

    for endpoint in "${endpoints[@]}"; do
      endpoint="$(echo "${endpoint}" | xargs)"
      [[ -z "${endpoint}" ]] && continue
      if ! call_endpoint "${endpoint}" "${faculty_id}" "${enrollment_faculty_id}"; then
        failed=1
      fi
    done
  done

  if (( failed == 1 )); then
    log "ETL run finished with errors"
    return 1
  fi

  log "ETL run completed successfully"
  return 0
}


trap 'on_exit $?' EXIT
main "$@"
