Add-Type -AssemblyName System.Net.NetworkInformation
[System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
  Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -ne [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback } |
  ForEach-Object {
    $ip = $_.GetIPProperties().UnicastAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
    if ($ip) { '{0} -> {1}' -f $_.Name, $ip.Address }
  }