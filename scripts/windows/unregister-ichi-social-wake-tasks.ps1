param([string]$TaskPath = "\ICHI-Social\")

$names = @(
  "ICHI-Threads-Plan-1050",
  "ICHI-Threads-Post-1100",
  "ICHI-Threads-Verify-1110",
  "ICHI-Threads-Plan-1850",
  "ICHI-Threads-Post-1900",
  "ICHI-Threads-Verify-1910",
  "ICHI-Threads-Weekly-Friday-2000",
  "ICHI-Gmail-Candidates-1030",
  "ICHI-Gmail-ReadyCheck-1125",
  "ICHI-Gmail-PreflightMonitor-1135",
  "ICHI-Gmail-SendResult-1210",
  "ICHI-Gmail-KPI-1230",
  "ICHI-Gmail-PrepareTomorrow-1720",
  "ICHI-Gmail-TomorrowCheck-1730",
  "ICHI-Hermes-Gateway-Startup",
  "ICHI-Hermes-Gateway-Logon",
  "ICHI-Wake-Test"
)

foreach ($name in $names) {
  Unregister-ScheduledTask -TaskPath $TaskPath -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
}
