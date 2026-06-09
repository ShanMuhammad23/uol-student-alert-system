param(
  [string]$AppBaseUrl = "http://127.0.0.1:3000",
  [string]$CronSecret = "shan2374",
  [int]$RetryCount = 3,
  [int]$RetryDelaySeconds = 10,
  [int]$TimeoutSeconds = 1800
)

$ErrorActionPreference = "Stop"

$endpoints = @(
  "/api/cron/student-sync",
  "/api/cron/alert-counts",
  "/api/cron/effectiveness"
)

$facultyConfigs = @(
  @{ FacultyId = "50000175"; EnrollmentFacultyId = "1120" }
  
)

function Invoke-EtlEndpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Endpoint,
    [Parameter(Mandatory = $true)][string]$FacultyId,
    [Parameter(Mandatory = $true)][string]$EnrollmentFacultyId
  )

  $queryJoin = if ($Endpoint.Contains("?")) { "&" } else { "?" }
  $url = "$($AppBaseUrl.TrimEnd('/'))$Endpoint$queryJoin" +
    "facultyId=$([uri]::EscapeDataString($FacultyId))&enrollmentFacultyId=$([uri]::EscapeDataString($EnrollmentFacultyId))"
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
      $payload = @{
        facultyId = $FacultyId
        enrollmentFacultyId = $EnrollmentFacultyId
      } | ConvertTo-Json -Compress

      $resp = Invoke-WebRequest -Method POST -Uri $url -Headers $headers -Body $payload -TimeoutSec $TimeoutSeconds
      Write-Host "SUCCESS $Endpoint (facultyId=$FacultyId, enrollmentFacultyId=$EnrollmentFacultyId) -> Status: $($resp.StatusCode)"
      Write-Host "Body: $($resp.Content)"
      return @{
        Endpoint = $Endpoint
        FacultyId = $FacultyId
        EnrollmentFacultyId = $EnrollmentFacultyId
        Success  = $true
        Status   = [int]$resp.StatusCode
      }
    } catch {
      $status = 0
      $body = $_.Exception.Message

      if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Close()
      }

      Write-Host "FAILED $Endpoint (facultyId=$FacultyId, enrollmentFacultyId=$EnrollmentFacultyId) -> Status: $status"
      Write-Host "Body: $body"

      if ($attempt -lt $RetryCount) {
        Write-Host "Retrying in $RetryDelaySeconds second(s)..."
        Start-Sleep -Seconds $RetryDelaySeconds
      }
    }

    $attempt++
  }

  return @{
    Endpoint = $Endpoint
    FacultyId = $FacultyId
    EnrollmentFacultyId = $EnrollmentFacultyId
    Success  = $false
    Status   = 0
  }
}

function Invoke-GpaImport {
  param(
    [Parameter(Mandatory = $true)][string]$EnrollmentFacultyId
  )

  $attempt = 1
  while ($attempt -le $RetryCount) {
    Write-Host ""
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Running GPA import for enrollmentFacultyId=$EnrollmentFacultyId (attempt $attempt/$RetryCount)"
    $previousFacCode = $env:SAP_FAC_CODE
    try {
      $env:SAP_FAC_CODE = $EnrollmentFacultyId
      npm run import:gpa:history | Out-Host
      if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS GPA import (enrollmentFacultyId=$EnrollmentFacultyId)"
        return $true
      }
      Write-Host "FAILED GPA import (enrollmentFacultyId=$EnrollmentFacultyId) -> Exit code: $LASTEXITCODE"
    } catch {
      Write-Host "FAILED GPA import (enrollmentFacultyId=$EnrollmentFacultyId) -> $($_.Exception.Message)"
    } finally {
      if ($null -eq $previousFacCode) {
        Remove-Item Env:SAP_FAC_CODE -ErrorAction SilentlyContinue
      } else {
        $env:SAP_FAC_CODE = $previousFacCode
      }
    }

    if ($attempt -lt $RetryCount) {
      Write-Host "Retrying GPA import in $RetryDelaySeconds second(s)..."
      Start-Sleep -Seconds $RetryDelaySeconds
    }
    $attempt++
  }

  return $false
}

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ETL run started"
$results = @()
$gpaFailed = $false

foreach ($facultyConfig in $facultyConfigs) {
  $facultyId = [string]$facultyConfig.FacultyId
  $enrollmentFacultyId = [string]$facultyConfig.EnrollmentFacultyId
  Write-Host "Running ETL endpoints for facultyId=$facultyId, enrollmentFacultyId=$enrollmentFacultyId"
  if (-not (Invoke-GpaImport -EnrollmentFacultyId $enrollmentFacultyId)) {
    $gpaFailed = $true
    continue
  }
  foreach ($ep in $endpoints) {
    $results += Invoke-EtlEndpoint -Endpoint $ep -FacultyId $facultyId -EnrollmentFacultyId $enrollmentFacultyId
  }
}

$failed = $results | Where-Object { -not $_.Success }

Write-Host ""
Write-Host "================ ETL SUMMARY ================"
foreach ($r in $results) {
  $state = if ($r.Success) { "PASS" } else { "FAIL" }
  Write-Host ("{0}  {1} (facultyId={2}, enrollmentFacultyId={3})" -f $state.PadRight(5), $r.Endpoint, $r.FacultyId, $r.EnrollmentFacultyId)
}
Write-Host "============================================="

if ($failed.Count -gt 0 -or $gpaFailed) {
  Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ETL run finished with errors"
  exit 1
}

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ETL run completed successfully"
exit 0
