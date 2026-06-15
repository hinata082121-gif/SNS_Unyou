$ErrorActionPreference = "Continue"

function Invoke-Capture([string]$Command, [string[]]$ArgumentList) {
  try {
    & $Command @ArgumentList 2>&1 | Out-String
  } catch {
    $_.Exception.Message
  }
}

$activeScheme = Invoke-Capture "powercfg" @("/GETACTIVESCHEME")
$sleepQuery = Invoke-Capture "powercfg" @("/QUERY", "SCHEME_CURRENT", "SUB_SLEEP")
$wakeTimers = Invoke-Capture "powercfg" @("/waketimers")
$lastWake = Invoke-Capture "powercfg" @("/lastwake")
$availableSleep = Invoke-Capture "powercfg" @("/a")

$rtcWakeAcEnabled = $sleepQuery -match '(?s)(Allow wake timers|RTCWAKE|スリープ解除タイマー).*?(Current AC Power Setting Index|現在の AC 電源設定のインデックス):\s*0x00000001'
$rtcWakeDcEnabled = $sleepQuery -match '(?s)(Allow wake timers|RTCWAKE|スリープ解除タイマー).*?(Current DC Power Setting Index|現在の DC 電源設定のインデックス):\s*0x00000001'
$taskRows = Get-ScheduledTask -TaskPath "\ICHI-Social\" -ErrorAction SilentlyContinue

[pscustomobject]@{
  checkedAt = (Get-Date).ToString("o")
  activeScheme = (($activeScheme -split "`r?`n") | Select-Object -First 1) -join ""
  wakeTimersAcEnabled = [bool]$rtcWakeAcEnabled
  wakeTimersDcEnabled = [bool]$rtcWakeDcEnabled
  ichiTaskCount = @($taskRows).Count
  wakeToRunCount = @($taskRows | Where-Object { $_.Settings.WakeToRun }).Count
  startWhenAvailableCount = @($taskRows | Where-Object { $_.Settings.StartWhenAvailable }).Count
  wakeTimersSummary = (($wakeTimers -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 6) -join " | "
  lastWakeSummary = (($lastWake -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 6) -join " | "
  sleepAvailabilitySummary = (($availableSleep -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 10) -join " | "
  suggestedEnableWakeTimers = @(
    "powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1",
    "powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1",
    "powercfg /SETACTIVE SCHEME_CURRENT"
  )
  notes = @(
    "Battery use may increase.",
    "Tasks cannot run when the PC is fully powered off.",
    "Wake from lid-closed sleep depends on hardware and firmware.",
    "Codex did not change power settings."
  )
} | ConvertTo-Json -Depth 4
