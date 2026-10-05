param(
    [ValidateSet('move','down','up','click','shortcut')][string]$Action,
    [int]$X = 0,
    [int]$Y = 0,
    [string]$Shortcut = 'Control+Alt+Space'
)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class AetherTestInput {
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
    [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
}
'@
[void][AetherTestInput]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
if ($Action -eq 'move') { [void][AetherTestInput]::SetCursorPos($X, $Y); Start-Sleep -Milliseconds 100 }
if ($Action -in @('down','click')) { [AetherTestInput]::mouse_event(2,0,0,0,[UIntPtr]::Zero) }
if ($Action -eq 'click') { Start-Sleep -Milliseconds 60 }
if ($Action -in @('up','click')) { [AetherTestInput]::mouse_event(4,0,0,0,[UIntPtr]::Zero) }
if ($Action -eq 'shortcut') {
    $codes = foreach ($part in $Shortcut.Split('+')) {
        switch ($part) {
            'Control' { 0x11 }
            'CommandOrControl' { 0x11 }
            'Alt' { 0x12 }
            'Shift' { 0x10 }
            'Super' { 0x5B }
            'Space' { 0x20 }
            default { if ($part -match '^F([0-9]+)$') { 0x6F + [int]$Matches[1] } elseif ($part -match '^[A-Z0-9]$') { [int][char]$part } else { throw 'Unsupported test shortcut' } }
        }
    }
    try { foreach ($code in $codes) { [AetherTestInput]::keybd_event([byte]$code,0,0,[UIntPtr]::Zero) }; Start-Sleep -Milliseconds 100 }
    finally { [array]::Reverse($codes); foreach ($code in $codes) { [AetherTestInput]::keybd_event([byte]$code,0,2,[UIntPtr]::Zero) } }
}
