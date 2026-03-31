#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:?missing APP_BASE_URL}"
CRON_SECRET="${CRON_SECRET:?missing CRON_SECRET}"


curl -sS -X POST \
  "${APP_BASE_URL}/api/cron/student-sync" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json"