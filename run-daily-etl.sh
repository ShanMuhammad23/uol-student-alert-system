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
    exit 1
  fi

  log "ETL run completed successfully"
}


main "$@"
