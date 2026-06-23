$ErrorActionPreference = "Stop"

$scriptPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path "scripts\windows\register-ichi-social-wake-tasks.ps1"
$raw = Get-Content -LiteralPath $scriptPath -Raw -Encoding UTF8
$null = [scriptblock]::Create($raw)

$j = $null
$malformed = "{"
try {
  $j = $malformed | ConvertFrom-Json
  $parseSucceeded = $true
} catch {
  $j = $null
  $parseSucceeded = $false
}
if ($parseSucceeded -or $null -ne $j) {
  throw "stale ConvertFrom-Json variable was reused"
}

$nameMatches = [regex]::Matches($raw, 'Name="([^"]+)"')
$allNames = @($nameMatches | ForEach-Object { [string]$_.Groups[1].Value })
$threadNames = @($allNames | Where-Object { $_ -like "ICHI-Threads-*" })
$gmailNamesInThreads = @($threadNames | Where-Object { $_ -like "ICHI-Gmail-*" })
$gatewayNamesInThreads = @($threadNames | Where-Object { $_ -like "ICHI-Hermes-Gateway-*" })

$summary = [pscustomobject]@{
  ok = $true
  scopeParameterPresent = [bool]($raw -match 'ValidateSet\("All", "Threads", "Gmail", "Gateway"\)')
  targetTasksUsesHashtableName = [bool]($raw -match '\$_\["Name"\]')
  threadsTaskCount = $threadNames.Count
  gmailGatewayTouchedByThreadsScope = (($gmailNamesInThreads.Count + $gatewayNamesInThreads.Count) -gt 0)
  staleJsonVariableReuseCount = 0
  manualTaskStartCount = 0
  registerTaskExecuted = $false
}

if (-not $summary.scopeParameterPresent) { throw "Scope parameter missing" }
if (-not $summary.targetTasksUsesHashtableName) { throw "Hashtable Name accessor missing" }
if ($summary.threadsTaskCount -lt 1) { throw "Threads task list missing" }
if ($summary.gmailGatewayTouchedByThreadsScope) { throw "Threads scope includes Gmail/Gateway" }

$summary | ConvertTo-Json -Compress
