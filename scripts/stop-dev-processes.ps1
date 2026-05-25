$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$processNames = @('node.exe', 'electron.exe')

$targets = Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine.Contains($projectRoot) -and
    ($processNames -contains $_.Name)
  }

foreach ($process in $targets) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    Write-Host "Stopped $($process.Name) $($process.ProcessId)"
  } catch {
    Write-Host "Skipped $($process.Name) $($process.ProcessId): $($_.Exception.Message)"
  }
}
