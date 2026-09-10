$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$dest = 'C:\Users\User\Desktop\Bus_qrcode\cloudflared.exe'
$url  = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'

if (Test-Path $dest) {
  Write-Host ('Already exists: ' + (Get-Item $dest).Length + ' bytes')
  exit 0
}

Write-Host 'Downloading cloudflared...'
try {
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 120
  Write-Host ('Downloaded: ' + (Get-Item $dest).Length + ' bytes')
} catch {
  Write-Host ('Download FAILED: ' + $_.Exception.Message)
  exit 1
}