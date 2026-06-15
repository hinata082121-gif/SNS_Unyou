param(
  [string]$TaskPath = "\ICHI-Social\",
  [int]$MinutesFromNow = 5
)

$ErrorActionPreference = "Stop"
$logDir = Join-Path $env:LOCALAPPDATA "ICHI-Social\scheduled-task-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$testScript = Join-Path $logDir "ichi-wake-test.ps1"
$testLog = Join-Path $logDir "ichi-wake-test-result.json"
@"
`$result = @{
  taskName = "ICHI-Wake-Test"
  ranAt = (Get-Date).ToString("o")
  ok = `$true
  sensitiveDataLogged = `$false
}
`$result | ConvertTo-Json | Set-Content -LiteralPath "$testLog" -Encoding UTF8
"@ | Set-Content -LiteralPath $testScript -Encoding UTF8

$triggerAt = (Get-Date).AddMinutes($MinutesFromNow)
$action = New-ScheduledTaskAction -Execute (Get-Command powershell.exe).Source -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$testScript`""
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$settings.AllowHardTerminate = $true
$trigger = New-ScheduledTaskTrigger -Once -At $triggerAt
Register-ScheduledTask -TaskPath $TaskPath -TaskName "ICHI-Wake-Test" -Action $action -Trigger $trigger -Settings $settings -Description "One-time ICHI wake timer test. Writes a timestamp only." -Force | Out-Null

[pscustomobject]@{
  taskName = "ICHI-Wake-Test"
  scheduledAt = $triggerAt.ToString("o")
  wakeToRun = $true
  logPath = $testLog
  manualInstructions = @(
    "Put the PC to sleep manually before the scheduled time.",
    "After the scheduled time, sign in and check the logPath.",
    "Remove the test task with unregister-ichi-social-wake-tasks.ps1 or Task Scheduler."
  )
} | ConvertTo-Json -Depth 4
