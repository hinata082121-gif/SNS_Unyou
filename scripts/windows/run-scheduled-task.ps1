param(
  [Parameter(Mandatory = $true)][string]$TaskName,
  [Parameter(Mandatory = $true)][string]$Command,
  [string]$WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [int]$MaxMinutes = 15,
  [switch]$AllowLivePublish,
  [switch]$AllowSheetSync
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

function Get-SafeName([string]$Value) {
  return ($Value -replace '[^a-zA-Z0-9_.-]', '_')
}

function Redact-Text([string]$Value) {
  if ([string]::IsNullOrEmpty($Value)) { return "" }
  $redacted = $Value
  $redacted = $redacted -replace '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[REDACTED_EMAIL]'
  $redacted = $redacted -replace '(?i)(api[_-]?key|token|authorization|bearer|password|secret|client[_-]?secret|threads_user_id|sheet_id)\s*[:=]\s*["'']?[^"''\s,}]+', '$1=[REDACTED]'
  $redacted = $redacted -replace '(?i)(https?://\S*(script\.google|hooks\.slack|webhook|spreadsheets)\S*)', '[REDACTED_URL]'
  return $redacted
}

function Write-JsonLog($Path, $Object) {
  Write-Utf8NoBomText $Path ($Object | ConvertTo-Json -Depth 8)
}

function Write-Utf8NoBomText([string]$Path, [string]$Value) {
  [System.IO.File]::WriteAllText($Path, $Value, $utf8NoBom)
}

$safeTaskName = Get-SafeName $TaskName
$baseDir = Join-Path $env:LOCALAPPDATA "ICHI-Social"
$logDir = Join-Path $baseDir "scheduled-task-logs"
$lockDir = Join-Path $baseDir "locks"
New-Item -ItemType Directory -Force -Path $logDir, $lockDir | Out-Null

$startedAt = Get-Date
$logPath = Join-Path $logDir ("{0}-{1}.json" -f $safeTaskName, $startedAt.ToString("yyyyMMdd-HHmmss"))
$lockPath = Join-Path $lockDir ("{0}.lock" -f $safeTaskName)
$timeoutSeconds = [Math]::Max(60, $MaxMinutes * 60)

$deniedPatterns = @(
  'runDailyGmailSalesSend',
  'runScheduledDailySend',
  'setupDailyAutoSendTriggers',
  'npm\s+run\s+gmail:send',
  'node\s+scripts/gmail/.*send'
)

foreach ($pattern in $deniedPatterns) {
  if ($Command -match $pattern) {
    Write-JsonLog $logPath @{
      taskName = $TaskName
      startedAt = $startedAt.ToString("o")
      finishedAt = (Get-Date).ToString("o")
      exitCode = 90
      ok = $false
      blockedReason = "gmail_live_send_command_denied"
      sensitiveDataLogged = $false
    }
    exit 90
  }
}

if (-not (Test-Path -LiteralPath $WorkingDirectory)) {
  throw "Working directory not found: $WorkingDirectory"
}

$envLocalExists = Test-Path -LiteralPath (Join-Path $WorkingDirectory ".env.local")
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCmd) { throw "node was not found in PATH" }
if (-not $npmCmd) { throw "npm.cmd was not found in PATH" }

if (Test-Path -LiteralPath $lockPath) {
  $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockPath).LastWriteTime
  if ($lockAge.TotalMinutes -lt ([Math]::Max(30, $MaxMinutes * 3))) {
    Write-JsonLog $logPath @{
      taskName = $TaskName
      startedAt = $startedAt.ToString("o")
      finishedAt = (Get-Date).ToString("o")
      exitCode = 0
      ok = $true
      skipped = $true
      skipReason = "lock_exists"
      lockAgeMinutes = [Math]::Round($lockAge.TotalMinutes, 2)
      sensitiveDataLogged = $false
    }
    exit 0
  }
  Remove-Item -LiteralPath $lockPath -Force
}

[System.IO.File]::WriteAllText($lockPath, [string]$PID, [System.Text.ASCIIEncoding]::new())
$stdoutPath = Join-Path $logDir ("{0}-{1}.stdout.log" -f $safeTaskName, $startedAt.ToString("yyyyMMdd-HHmmss"))
$stderrPath = Join-Path $logDir ("{0}-{1}.stderr.log" -f $safeTaskName, $startedAt.ToString("yyyyMMdd-HHmmss"))

try {
  if (-not $AllowLivePublish) {
    $env:THREADS_PUBLISH_ENABLED = $env:THREADS_PUBLISH_ENABLED
  }
  if (-not $AllowSheetSync -and $Command -match 'gmail:outbox:prepare-and-sync-tomorrow') {
    if (-not $env:GMAIL_SHEET_SYNC_ENABLED) { $env:GMAIL_SHEET_SYNC_ENABLED = "false" }
  }

  Push-Location $WorkingDirectory
  $process = Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/s", "/c", $Command) `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

  $completed = $process.WaitForExit($timeoutSeconds * 1000)
  if (-not $completed) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    $exitCode = 124
  } else {
    $process.WaitForExit()
    $process.Refresh()
    $exitCode = [int]$process.ExitCode
  }
} finally {
  Pop-Location -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}

$finishedAt = Get-Date
$stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8 } else { "" }
$stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw -Encoding UTF8 } else { "" }
$safeStdout = Redact-Text $stdout
$safeStderr = Redact-Text $stderr
Write-Utf8NoBomText $stdoutPath $safeStdout
Write-Utf8NoBomText $stderrPath $safeStderr

Write-JsonLog $logPath @{
  taskName = $TaskName
  commandType = if ($Command -match '^npm ') { "npm" } else { "shell" }
  startedAt = $startedAt.ToString("o")
  finishedAt = $finishedAt.ToString("o")
  durationMs = [int](($finishedAt - $startedAt).TotalMilliseconds)
  exitCode = $exitCode
  ok = ($exitCode -eq 0)
  timedOut = ($exitCode -eq 124)
  envLocalExists = $envLocalExists
  nodeResolved = [bool]$nodeCmd
  npmResolved = [bool]$npmCmd
  stdoutLog = $stdoutPath
  stderrLog = $stderrPath
  stdoutPreview = ($safeStdout -split "`r?`n" | Select-Object -First 8) -join "`n"
  stderrPreview = ($safeStderr -split "`r?`n" | Select-Object -First 8) -join "`n"
  sensitiveDataLogged = $false
}

exit $exitCode
