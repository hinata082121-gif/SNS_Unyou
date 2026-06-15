$ErrorActionPreference = "Stop"
$logDir = Join-Path $env:LOCALAPPDATA "ICHI-Social\scheduled-task-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$startedAt = Get-Date
$logPath = Join-Path $logDir ("Hermes-Gateway-Ensure-{0}.json" -f $startedAt.ToString("yyyyMMdd-HHmmss"))

function Write-SafeLog($Object) {
  $Object | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $logPath -Encoding UTF8
}

$statusText = ""
try {
  $statusText = (& hermes gateway status 2>&1 | Out-String)
} catch {
  $statusText = $_.Exception.Message
}

if ($statusText -match '(?i)running') {
  Write-SafeLog @{
    taskName = "Hermes-Gateway-Ensure"
    startedAt = $startedAt.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    ok = $true
    gatewayAlreadyRunning = $true
    startedGateway = $false
    sensitiveDataLogged = $false
  }
  exit 0
}

$stdout = Join-Path $logDir ("hermes-gateway-start-{0}.stdout.log" -f $startedAt.ToString("yyyyMMdd-HHmmss"))
$stderr = Join-Path $logDir ("hermes-gateway-start-{0}.stderr.log" -f $startedAt.ToString("yyyyMMdd-HHmmss"))
Start-Process -FilePath "hermes" `
  -ArgumentList @("gateway", "run") `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr | Out-Null
Start-Sleep -Seconds 3

Write-SafeLog @{
  taskName = "Hermes-Gateway-Ensure"
  startedAt = $startedAt.ToString("o")
  finishedAt = (Get-Date).ToString("o")
  ok = $true
  gatewayAlreadyRunning = $false
  startedGateway = $true
  sensitiveDataLogged = $false
}
