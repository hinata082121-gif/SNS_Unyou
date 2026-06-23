param(
  [string]$TaskPath = "\ICHI-Social\",
  [ValidateSet("All", "Threads", "Gmail", "Gateway")]
  [string]$Scope = "All"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$powerShell = (Get-Command powershell.exe).Source

function New-ActionForScript([string]$ScriptPath, [string]$Arguments = "") {
  $fullPath = Join-Path $root $ScriptPath
  $arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$fullPath`""
  if ($Arguments) { $arg = "$arg $Arguments" }
  New-ScheduledTaskAction -Execute $powerShell -Argument $arg -WorkingDirectory $root
}

function New-TaskSettings([int]$MaxMinutes, [int]$RestartMinutes, [int]$RestartCount, [bool]$Wake) {
  $settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes $MaxMinutes) `
    -RestartInterval (New-TimeSpan -Minutes $RestartMinutes) `
    -RestartCount $RestartCount
  $settings.AllowHardTerminate = $true
  $settings.RunOnlyIfNetworkAvailable = $true
  if ($Wake) { $settings.WakeToRun = $true }
  return $settings
}

function Register-ICHIWakeTask($Task) {
  $action = New-ActionForScript $Task.Script $Task.Arguments
  $settings = New-TaskSettings $Task.MaxMinutes $Task.RestartMinutes $Task.RestartCount $Task.Wake
  try {
    Register-ScheduledTask `
      -TaskPath $TaskPath `
      -TaskName $Task.Name `
      -Action $action `
      -Trigger $Task.Trigger `
      -Settings $settings `
      -Description $Task.Description `
      -Force `
      -ErrorAction Stop | Out-Null
    return [pscustomobject]@{
      taskName = $Task.Name
      registered = $true
      wakeToRun = $Task.Wake
      error = ""
    }
  } catch {
    return [pscustomobject]@{
      taskName = $Task.Name
      registered = $false
      wakeToRun = $Task.Wake
      error = "registration_failed"
    }
  }
}

function Test-TaskInScope($Task, [string]$SelectedScope) {
  if ($SelectedScope -eq "All") { return $true }
  if ($SelectedScope -eq "Threads") { return $Task.Name -like "ICHI-Threads-*" }
  if ($SelectedScope -eq "Gmail") { return $Task.Name -like "ICHI-Gmail-*" }
  if ($SelectedScope -eq "Gateway") { return $Task.Name -like "ICHI-Hermes-Gateway-*" }
  return $false
}

function Get-RegisteredTaskSummary($Task) {
  $registered = Get-ScheduledTask -TaskPath $TaskPath -TaskName $Task.Name -ErrorAction SilentlyContinue
  if ($null -eq $registered) {
    return [pscustomobject]@{
      taskName = $Task.Name
      found = $false
      wakeToRun = $false
      startWhenAvailable = $false
      multipleInstances = ""
      executionTimeLimit = ""
    }
  }
  return [pscustomobject]@{
    taskName = $Task.Name
    found = $true
    wakeToRun = [bool]$registered.Settings.WakeToRun
    startWhenAvailable = [bool]$registered.Settings.StartWhenAvailable
    multipleInstances = [string]$registered.Settings.MultipleInstances
    executionTimeLimit = [string]$registered.Settings.ExecutionTimeLimit
  }
}

$tasks = @(
  @{ Name="ICHI-Threads-Plan-1050"; Script="scripts\windows\tasks\threads-plan-check.ps1"; Arguments="-Slot 1100"; Trigger=(New-ScheduledTaskTrigger -Daily -At "10:50"); MaxMinutes=10; RestartMinutes=5; RestartCount=2; Wake=$true; Description="ICHI Social Threads 11:00 plan check. No secret/body logging." },
  @{ Name="ICHI-Threads-Post-1100"; Script="scripts\windows\tasks\threads-post-11.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "11:00"); MaxMinutes=5; RestartMinutes=5; RestartCount=1; Wake=$true; Description="ICHI Social Threads 11:00 publish task with top-level time window and duplicate guard." },
  @{ Name="ICHI-Threads-Verify-1110"; Script="scripts\windows\tasks\threads-result-check.ps1"; Arguments="-Slot 1100"; Trigger=(New-ScheduledTaskTrigger -Daily -At "11:10"); MaxMinutes=10; RestartMinutes=10; RestartCount=2; Wake=$true; Description="ICHI Social Threads 11:00 result check." },
  @{ Name="ICHI-Threads-Plan-1850"; Script="scripts\windows\tasks\threads-plan-check.ps1"; Arguments="-Slot 1900"; Trigger=(New-ScheduledTaskTrigger -Daily -At "18:50"); MaxMinutes=10; RestartMinutes=5; RestartCount=2; Wake=$true; Description="ICHI Social Threads 19:00 plan check. No secret/body logging." },
  @{ Name="ICHI-Threads-Post-1900"; Script="scripts\windows\tasks\threads-post-19.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "19:00"); MaxMinutes=5; RestartMinutes=5; RestartCount=1; Wake=$true; Description="ICHI Social Threads 19:00 publish task with top-level time window and duplicate guard." },
  @{ Name="ICHI-Threads-Verify-1910"; Script="scripts\windows\tasks\threads-result-check.ps1"; Arguments="-Slot 1900"; Trigger=(New-ScheduledTaskTrigger -Daily -At "19:10"); MaxMinutes=10; RestartMinutes=10; RestartCount=2; Wake=$true; Description="ICHI Social Threads 19:00 result check." },
  @{ Name="ICHI-Threads-Daily-Audit-1940"; Script="scripts\windows\tasks\threads-daily-audit.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "19:40"); MaxMinutes=10; RestartMinutes=10; RestartCount=1; Wake=$true; Description="ICHI Social Threads daily two-post audit. Records missing slots only; no compensation publishing." },
  @{ Name="ICHI-Threads-Weekly-Friday-2000"; Script="scripts\windows\tasks\threads-weekly-review.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At "20:00"); MaxMinutes=15; RestartMinutes=10; RestartCount=2; Wake=$true; Description="ICHI Social Friday Threads/KPI weekly review." },
  @{ Name="ICHI-Gmail-Candidates-1030"; Script="scripts\windows\tasks\gmail-candidate-check.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "10:30"); MaxMinutes=15; RestartMinutes=5; RestartCount=3; Wake=$true; Description="ICHI Gmail candidate shortage check. No Gmail sending." },
  @{ Name="ICHI-Gmail-ReadyCheck-1125"; Script="scripts\windows\tasks\gmail-today-ready-check.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "11:25"); MaxMinutes=15; RestartMinutes=5; RestartCount=3; Wake=$true; Description="ICHI Gmail today outbox and sheet readiness check. No Gmail sending." },
  @{ Name="ICHI-Gmail-PreflightMonitor-1135"; Script="scripts\windows\tasks\gmail-preflight-monitor.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "11:35"); MaxMinutes=15; RestartMinutes=5; RestartCount=3; Wake=$true; Description="ICHI Gmail preflight monitor. No Apps Script trigger changes." },
  @{ Name="ICHI-Gmail-SendResult-1210"; Script="scripts\windows\tasks\gmail-send-result-monitor.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "12:10"); MaxMinutes=15; RestartMinutes=10; RestartCount=2; Wake=$true; Description="ICHI Gmail send result monitor. No Gmail sending." },
  @{ Name="ICHI-Gmail-KPI-1230"; Script="scripts\windows\tasks\gmail-kpi-summary.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "12:30"); MaxMinutes=15; RestartMinutes=5; RestartCount=3; Wake=$true; Description="ICHI Gmail KPI summary." },
  @{ Name="ICHI-Gmail-PrepareTomorrow-1720"; Script="scripts\windows\tasks\gmail-prepare-tomorrow.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "17:20"); MaxMinutes=30; RestartMinutes=5; RestartCount=3; Wake=$true; Description="ICHI Gmail next-day outbox generation and sheet sync path. No Gmail sending." },
  @{ Name="ICHI-Gmail-TomorrowCheck-1730"; Script="scripts\windows\tasks\gmail-tomorrow-check.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -Daily -At "17:30"); MaxMinutes=15; RestartMinutes=5; RestartCount=3; Wake=$true; Description="ICHI Gmail next-day preparation result check. No Gmail sending." },
  @{ Name="ICHI-Hermes-Gateway-Startup"; Script="scripts\windows\tasks\hermes-gateway-ensure.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -AtStartup); MaxMinutes=5; RestartMinutes=2; RestartCount=1; Wake=$false; Description="Ensure a single Hermes Gateway process at Windows startup." },
  @{ Name="ICHI-Hermes-Gateway-Logon"; Script="scripts\windows\tasks\hermes-gateway-ensure.ps1"; Arguments=""; Trigger=(New-ScheduledTaskTrigger -AtLogOn); MaxMinutes=5; RestartMinutes=2; RestartCount=1; Wake=$false; Description="Ensure a single Hermes Gateway process at user logon." }
)

$targetTasks = @($tasks | Where-Object { Test-TaskInScope $_ $Scope })

if ($targetTasks.Count -eq 0) {
  throw "No tasks matched Scope=$Scope"
}

Write-Host "Registering ICHI Social scheduled tasks"
Write-Host ("Scope: {0}" -f $Scope)
Write-Host "Target tasks:"
$targetTasks | ForEach-Object { Write-Host ("- {0}" -f $_.Name) }

$results = foreach ($task in $targetTasks) {
  Register-ICHIWakeTask $task
}

$verification = foreach ($task in $targetTasks) {
  Get-RegisteredTaskSummary $task
}

[pscustomobject]@{
  scope = $Scope
  expectedTaskCount = $targetTasks.Count
  targetTasks = @($targetTasks | ForEach-Object { [string]$_["Name"] })
  registeredCount = @($results | Where-Object registered).Count
  failedCount = @($results | Where-Object { -not $_.registered }).Count
  failedTasks = @($results | Where-Object { -not $_.registered } | Select-Object -ExpandProperty taskName)
  verification = @($verification)
  note = "Gateway startup/logon tasks can require administrator registration on this Windows profile."
} | ConvertTo-Json -Depth 4
