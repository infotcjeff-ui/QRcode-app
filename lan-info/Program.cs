using System;
using System.Net;
using System.Net.NetworkInformation;

class Program
{
    static int Main()
    {
        NetworkInterface[] nics = NetworkInterface.GetAllNetworkInterfaces();
        string lan = null;
        string nicName = null;

        foreach (NetworkInterface nic in nics)
        {
            if (nic.OperationalStatus != OperationalStatus.Up) continue;
            if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

            IPAddress ip = null;
            foreach (UnicastIPAddressInformation ua in nic.GetIPProperties().UnicastAddresses)
            {
                if (ua.Address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) continue;
                string s = ua.Address.ToString();
                if (s.StartsWith("169.254.")) continue;
                ip = ua.Address;
                break;
            }
            if (ip != null)
            {
                lan = ip.ToString();
                nicName = nic.Name;
                break;
            }
        }

        if (lan == null)
        {
            Console.WriteLine("No LAN IPv4 address found. Are you connected to Wi-Fi?");
            return 1;
        }

        Console.WriteLine();
        Console.WriteLine("===========================================");
        Console.WriteLine(" School Bus Check-in · LAN Access Helper   ");
        Console.WriteLine("===========================================");
        Console.WriteLine();
        Console.WriteLine("Network Interface : " + nicName);
        Console.WriteLine();
        Console.WriteLine("Detected LAN IP : " + lan);
        Console.WriteLine();
        Console.WriteLine("Open in your PHONE BROWSER (must be on the same Wi-Fi):");
        Console.WriteLine();
        Console.WriteLine("  http://" + lan + ":3000                <- Landing page");
        Console.WriteLine("  http://" + lan + ":3000/nanny          <- Nanny mobile UI");
        Console.WriteLine("  http://" + lan + ":3000/admin          <- Admin dashboard");
        Console.WriteLine("  http://" + lan + ":3000/admin/students <- Student manager");
        Console.WriteLine("  http://" + lan + ":3000/admin/qr-codes <- QR code batch print");
        Console.WriteLine();
        Console.WriteLine("CAMERA PERMISSION:");
        Console.WriteLine("  - Browsers require HTTPS for camera access on remote hosts.");
        Console.WriteLine("  - If the QR scanner does NOT open, use a tunnel instead:");
        Console.WriteLine("      npm run dev:tunnel");
        Console.WriteLine("    This will print a public https://*.trycloudflare.com URL.");
        Console.WriteLine();
        return 0;
    }
}