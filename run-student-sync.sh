#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="http://127.0.0.1:3002"
CRON_SECRET="shan237426"


curl -sS -X POST \
  "${APP_BASE_URL}/api/cron/student-sync" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json"