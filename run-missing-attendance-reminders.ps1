param(
  [string]$AppBaseUrl = "http://127.0.0.1:3000",
  [string]$CronSecret = "",
  # Empty = all faculties with enrollment on snapshot date
  [string]$FacultyId = "",
  [int]$MinMissing = 4,
  [switch]$DryRun,
  [int]$RetryCount = 3,
  [int]$RetryDelaySeconds = 10,
  [int]$TimeoutSeconds = 7200
)

$ErrorActionPreference = "Stop"

if (-not $CronSecret) {
  $CronSecret = $env:CRON_SECRET
}
if (-not $CronSecret) {
  throw "CRON_SECRET is required (parameter or env)."
}

if (-not $FacultyId -and $env:MISSING_ATTENDANCE_FACULTY_ID) {
  $FacultyId = $env:MISSING_ATTENDANCE_FACULTY_ID
}

$endpoint = "/api/cron/missing-attendance-reminders"
$queryJoin = if ($endpoint.Contains("?")) { "&" } else { "?" }
$query = "minMissing=$MinMissing"
if ($FacultyId) {
  $query = "facultyId=$([uri]::EscapeDataString($FacultyId))&$query"
}
if ($DryRun) {
  $query = "$query&dryRun=1"
}
$url = "$($AppBaseUrl.TrimEnd('/'))$endpoint$queryJoin$query"

$payloadObj = @{
  minMissingEntries = $MinMissing
  dryRun            = [bool]$DryRun
}
if ($FacultyId) {
  $payloadObj.facultyId = $FacultyId
}
$payload = $payloadObj | ConvertTo-Json -Compress

$attempt = 1
while ($attempt -le $RetryCount) {
  $scope = if ($FacultyId) { "faculty=$FacultyId" } else { "all faculties" }
  Write-Host ""
  Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Calling $url ($scope, attempt $attempt/$RetryCount)"

  try {
    $headers = @{
      Authorization   = "Bearer $CronSecret"
      "x-cron-secret" = $CronSecret
      "Content-Type"  = "application/json"
    }
    $resp = Invoke-WebRequest -Method POST -Uri $url -Headers $headers -Body $payload -TimeoutSec $TimeoutSeconds
    Write-Host "SUCCESS -> Status: $($resp.StatusCode)"
    Write-Host "Body: $($resp.Content)"
    exit 0
  } catch {
    $status = 0
    $body = $_.Exception.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
      $reader.Close()
    }
    Write-Host "FAILED -> Status: $status"
    Write-Host "Body: $body"
    if ($attempt -lt $RetryCount) {
      Write-Host "Retrying in $RetryDelaySeconds second(s)..."
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }

  $attempt++
}

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Missing attendance reminder run finished with errors"
exit 1
