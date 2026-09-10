$raw = ipconfig | Select-String -Pattern 'IPv4'
$ips = @()
foreach ($line in $raw) {
  $parts = $line -split ':', 2
  if ($parts.Count -lt 2) { continue }
  $ip = $parts[1].Trim()
  if ($ip -and $ip -notlike '127.*' -and $ip -notlike '169.254.*') {
    $ips += $ip
  }
}

if ($ips.Count -eq 0) {
  Write-Host 'No LAN IPv4 address found. Are you connected to Wi-Fi?' -ForegroundColor Red
  exit 1
}

$lan = $ips[0]

Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ' School Bus Check-in · LAN Access Helper   ' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host ('Detected LAN IP : ' + $lan) -ForegroundColor Green
if ($ips.Count -gt 1) {
  Write-Host ('Other IPs       : ' + ($ips[1..($ips.Count-1)] -join ', ')) -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'Open in your PHONE BROWSER (must be on the same Wi-Fi):' -ForegroundColor White
Write-Host ''
Write-Host ('  http://' + $lan + ':3000                <- Landing page') -ForegroundColor Cyan
Write-Host ('  http://' + $lan + ':3000/nanny          <- Nanny mobile UI') -ForegroundColor Cyan
Write-Host ('  http://' + $lan + ':3000/admin          <- Admin dashboard') -ForegroundColor Cyan
Write-Host ('  http://' + $lan + ':3000/admin/students <- Student manager') -ForegroundColor Cyan
Write-Host ('  http://' + $lan + ':3000/admin/qr-codes <- QR code batch print') -ForegroundColor Cyan
Write-Host ''
Write-Host 'CAMERA PERMISSION:' -ForegroundColor White
Write-Host '  - Browsers require HTTPS for camera access on remote hosts.' -ForegroundColor Yellow
Write-Host '  - If the QR scanner does NOT open, use a tunnel instead:' -ForegroundColor Yellow
Write-Host '      npm run dev:tunnel' -ForegroundColor Magenta
Write-Host '    This will print a public https://*.trycloudflare.com URL.' -ForegroundColor Yellow
Write-Host ''