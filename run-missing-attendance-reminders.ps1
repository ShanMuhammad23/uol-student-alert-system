param(
  [string]$AppBaseUrl = "http://127.0.0.1:3000",
  [string]$CronSecret = "",
  [string]$FacultyId = "50000175",
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

$endpoint = "/api/cron/missing-attendance-reminders"
$queryJoin = if ($endpoint.Contains("?")) { "&" } else { "?" }
$url = "$($AppBaseUrl.TrimEnd('/'))$endpoint$queryJoin" +
  "facultyId=$([uri]::EscapeDataString($FacultyId))" +
  "&minMissing=$MinMissing" +
  $(if ($DryRun) { "&dryRun=1" } else { "" })

$payload = @{
  facultyId         = $FacultyId
  minMissingEntries = $MinMissing
  dryRun            = [bool]$DryRun
} | ConvertTo-Json -Compress

$attempt = 1
while ($attempt -le $RetryCount) {
  Write-Host ""
  Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Calling $url (attempt $attempt/$RetryCount)"

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
