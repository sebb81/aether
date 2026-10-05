param([Parameter(Mandatory=$true)][string]$EncodedScope,[Parameter(Mandatory=$true)][int]$ParentProcessId)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$scope = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($EncodedScope)) | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class EchoForeground {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint id);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flag);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
}
'@
$shell = New-Object -ComObject Shell.Application
function In-Scope([string]$root,[string]$path) { return $path.Equals($root,[StringComparison]::OrdinalIgnoreCase) -or $path.StartsWith($root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) }
while ($true) {
 if (-not (Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue)) { break }
 $result = @{allowed=$false;application=$null;folder=$null;windowTitle=$null;reason='Explorer autorisé doit être au premier plan.'}
 try {
  $handle = [EchoForeground]::GetForegroundWindow()
  [uint32]$foregroundProcessId = 0
  [void][EchoForeground]::GetWindowThreadProcessId($handle,[ref]$foregroundProcessId)
  $processName = (Get-Process -Id $foregroundProcessId -ErrorAction Stop).ProcessName + '.exe'
  if ($processName -eq 'explorer.exe' -and $scope.exclusions.processes -notcontains $processName) {
   $eligible=@($shell.Windows() | Where-Object { [EchoForeground]::GetAncestor([IntPtr]::new([long]$_.HWND),2) -eq $handle -and [EchoForeground]::IsWindowVisible([IntPtr]::new([long]$_.HWND)) })
   if($eligible.Count -ne 1){ $result.reason='Contexte Explorer ambigu : utilisez une seule fenêtre et un seul onglet.' }
   foreach ($window in $eligible) {
    if($eligible.Count -ne 1){ break }
    $folderPath = [string]$window.Document.Folder.Self.Path
    if (-not (In-Scope $scope.root $folderPath)) { break }
    $blocked = $false
    foreach ($excludedFolder in $scope.exclusions.folders) { if (In-Scope $excludedFolder $folderPath) { $blocked=$true;break } }
    # A new junction below the authorized root cannot expose another folder's title.
    $cursor=$folderPath
    while(-not $blocked -and (In-Scope $scope.root $cursor)){
     $entry=Get-Item -LiteralPath $cursor -Force
     if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){$blocked=$true;break}
     if($cursor.Equals($scope.root,[StringComparison]::OrdinalIgnoreCase)){break}
     $cursor=[IO.Path]::GetDirectoryName($cursor)
    }
    if ($blocked) { break }
    $title = New-Object Text.StringBuilder 512
    [void][EchoForeground]::GetWindowText($handle,$title,512)
    foreach ($term in $scope.exclusions.windows) { if ($title.ToString().IndexOf($term,[StringComparison]::OrdinalIgnoreCase) -ge 0) { $blocked=$true;break } }
    if (-not $blocked) { $result=@{allowed=$true;application='explorer.exe';folder=$folderPath;windowTitle=$title.ToString();reason='Contexte Explorer dans le dossier autorisé.'} }
    break
   }
  }
 } catch { $result.reason='Contexte Explorer inaccessible : observation suspendue.' }
 [Console]::WriteLine(($result | ConvertTo-Json -Compress -Depth 4))
 Start-Sleep -Milliseconds 250
}
