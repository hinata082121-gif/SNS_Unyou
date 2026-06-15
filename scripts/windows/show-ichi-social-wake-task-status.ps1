param([string]$TaskPath = "\ICHI-Social\")

$tasks = Get-ScheduledTask -TaskPath $TaskPath -ErrorAction SilentlyContinue |
  Sort-Object TaskName

$rows = foreach ($task in $tasks) {
  $info = Get-ScheduledTaskInfo -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction SilentlyContinue
  [pscustomobject]@{
    TaskName = $task.TaskName
    State = $task.State
    Enabled = ($task.State -ne "Disabled")
    WakeToRun = [bool]$task.Settings.WakeToRun
    StartWhenAvailable = [bool]$task.Settings.StartWhenAvailable
    NetworkRequired = [bool]$task.Settings.RunOnlyIfNetworkAvailable
    MultipleInstances = $task.Settings.MultipleInstances
    LastTaskResult = $info.LastTaskResult
    NextRunTime = $info.NextRunTime
  }
}

$summary = [pscustomobject]@{
  taskCount = @($rows).Count
  enabledCount = @($rows | Where-Object Enabled).Count
  wakeToRunCount = @($rows | Where-Object WakeToRun).Count
  startWhenAvailableCount = @($rows | Where-Object StartWhenAvailable).Count
  failedTaskCount = @($rows | Where-Object { $_.LastTaskResult -notin @(0, 267011, $null) }).Count
  nextCriticalRun = @($rows | Where-Object { $_.NextRunTime } | Sort-Object NextRunTime | Select-Object -First 1).NextRunTime
}

$summary | ConvertTo-Json -Depth 4
$rows | Format-Table -AutoSize
