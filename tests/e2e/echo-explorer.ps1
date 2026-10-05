param([ValidateSet('open','procedure','rename','picker','capture','close','inspect')][string]$Action,[string]$Folder,[string]$DateFolder='2026-10-05',[string[]]$Files=@('audio_01.wav','audio_02.wav'),[string]$NewName='2026-10-05_audio_01',[string]$OutputPath,[int]$ApplicationProcessId=0)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class EchoRecipeWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h,int id);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder text,int count);
 public delegate bool EnumCallback(IntPtr h,IntPtr extra);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumCallback callback,IntPtr extra);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flag);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder name,int count);
 [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr SetActiveWindow(IntPtr h);
 public static bool FocusTestWindow(IntPtr h) {
  for(int attempt=0;attempt<10;attempt++) {
   uint owner;uint current=GetCurrentThreadId();uint foreground=GetWindowThreadProcessId(GetForegroundWindow(),out owner);uint target=GetWindowThreadProcessId(h,out owner);
   bool a=current!=foreground && AttachThreadInput(current,foreground,true);
   bool b=current!=target && target!=foreground && AttachThreadInput(current,target,true);
   try { ShowWindowAsync(h,9);BringWindowToTop(h);SetForegroundWindow(h);System.Threading.Thread.Sleep(150); }
   finally { if(b)AttachThreadInput(current,target,false);if(a)AttachThreadInput(current,foreground,false); }
   if(GetForegroundWindow()==h)return true;
   System.Threading.Thread.Sleep(100);
  }
  return false;
 }
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 public struct Rect { public int left,top,right,bottom; }
}
'@
$shell=New-Object -ComObject Shell.Application
$keys=New-Object -ComObject WScript.Shell
if($Action -eq 'inspect'){
 $script:captions=New-Object 'Collections.Generic.List[string]'
 [void][EchoRecipeWindow]::EnumWindows({param($h,$extra) [uint32]$windowProcessId=0;[void][EchoRecipeWindow]::GetWindowThreadProcessId($h,[ref]$windowProcessId);if($windowProcessId -eq $ApplicationProcessId){$caption=New-Object Text.StringBuilder 512;[void][EchoRecipeWindow]::GetWindowText($h,$caption,512);$script:captions.Add($h.ToInt64().ToString()+' : '+$caption.ToString())};return $true},[IntPtr]::Zero)
 $script:captions;exit
}
function Text-Key([string]$value) { $escaped='';foreach($char in $value.ToCharArray()){if($char -in @('+','^','%','~','(',')','[',']','{','}')){$escaped+='{'+$char+'}'}else{$escaped+=$char}};$keys.SendKeys($escaped) }
function Find-Window([string]$path){foreach($candidate in $shell.Windows()){try{
 $rootHandle=[EchoRecipeWindow]::GetAncestor([IntPtr]::new([long]$candidate.HWND),2)
 $className=New-Object Text.StringBuilder 120;[void][EchoRecipeWindow]::GetClassName($rootHandle,$className,120)
 if($className.ToString() -ne 'CabinetWClass' -or -not [EchoRecipeWindow]::IsWindowVisible($rootHandle) -or -not [EchoRecipeWindow]::IsWindowEnabled($rootHandle)){continue}
 if([string]$candidate.Document.Folder.Self.Path -eq $path){return $candidate}
}catch{}};return $null}
function Activate($window){
 $handle=[EchoRecipeWindow]::GetAncestor([IntPtr]::new([long]$window.HWND),2)
 $caption=New-Object Text.StringBuilder 512;[void][EchoRecipeWindow]::GetWindowText($handle,$caption,512)
 [void]$keys.AppActivate($caption.ToString())
 [void][EchoRecipeWindow]::FocusTestWindow($handle)
 [void][EchoRecipeWindow]::ShowWindowAsync($handle,9);[void][EchoRecipeWindow]::SetForegroundWindow($handle);Start-Sleep -Milliseconds 300
 if([EchoRecipeWindow]::GetForegroundWindow() -ne $handle){
  # Windows foreground lock can reject SetForegroundWindow. Click only the returned test window.
  [void][EchoRecipeWindow]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
  [void][EchoRecipeWindow]::SetWindowPos($handle,[IntPtr]::new(-1),0,0,0,0,0x53)
  Start-Sleep -Milliseconds 250
  $rect=New-Object EchoRecipeWindow+Rect;[void][EchoRecipeWindow]::GetWindowRect($handle,[ref]$rect)
  [void][EchoRecipeWindow]::SetCursorPos($rect.left+180,$rect.top+20)
  Start-Sleep -Milliseconds 150
  [EchoRecipeWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 70;[EchoRecipeWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 250
  [void][EchoRecipeWindow]::SetWindowPos($handle,[IntPtr]::new(-2),0,0,0,0,0x53);Start-Sleep -Milliseconds 300
 }
 if([EchoRecipeWindow]::GetForegroundWindow() -ne $handle){throw ('Native Explorer window could not receive focus: expected '+$handle.ToInt64()+', foreground '+[EchoRecipeWindow]::GetForegroundWindow().ToInt64())}
}
function Navigate($window,[string]$path){Activate $window;$window.Navigate2($path);Start-Sleep -Milliseconds 1200}
if($Action -eq 'picker'){
 Start-Sleep -Milliseconds 400
 $script:picker=[IntPtr]::Zero
 [void][EchoRecipeWindow]::EnumWindows({param($h,$extra) $caption=New-Object Text.StringBuilder 512;[void][EchoRecipeWindow]::GetWindowText($h,$caption,512);if($caption.ToString() -like 'Dossier de test*' -or $caption.ToString() -like 'Dossier *exclure*'){ $script:picker=$h };return $true},[IntPtr]::Zero)
 if($script:picker -eq [IntPtr]::Zero){throw 'Expected AETHER native folder picker not found'}
 [void][EchoRecipeWindow]::SetForegroundWindow($script:picker);Start-Sleep -Milliseconds 300
 $picker=$script:picker
 # The fixture supplies the initial folder. Confirm through the actual native button.
 # The native common dialog exposes its actual confirmation button as IDOK (1).
 $confirm=[EchoRecipeWindow]::GetDlgItem($picker,1)
 if($confirm -eq [IntPtr]::Zero){throw 'The foreground window is not the expected native folder picker'}
 [void][EchoRecipeWindow]::PostMessage($confirm,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)
 Start-Sleep -Milliseconds 400
 Write-Output 'Native directory picker keyboard sequence sent';exit
}
$window=Find-Window $Folder
if($Action -eq 'open' -or (-not $window -and $Action -eq 'procedure')){
 if(-not $window){Start-Process explorer.exe -ArgumentList ('"'+$Folder+'"');for($attempt=0;$attempt -lt 25;$attempt++){Start-Sleep -Milliseconds 200;$window=Find-Window $Folder;if($window){break}}}
 if(-not $window){throw 'Test Explorer folder did not open'}
 Activate $window
 if($Action -eq 'open'){Write-Output 'Explorer test folder active';exit}
}
if(-not $window){throw 'No Explorer window for the explicit test folder'}
Activate $window
if($Action -eq 'rename'){
 $item=$window.Document.Folder.ParseName($Files[0]);if(-not $item){throw 'Test file absent'};$window.Document.SelectItem($item,29);Start-Sleep -Milliseconds 200;$keys.SendKeys('{F2}');Start-Sleep -Milliseconds 250;Text-Key $NewName;$keys.SendKeys('{ENTER}');Start-Sleep -Milliseconds 700
}
if($Action -eq 'procedure'){
 foreach($name in $Files){$item=$window.Document.Folder.ParseName($name);if(-not $item){throw ('Test file absent: '+$name)};$window.Document.SelectItem($item,29);Start-Sleep -Milliseconds 200;$keys.SendKeys('{F2}');Start-Sleep -Milliseconds 250;Text-Key ($DateFolder+'_'+[IO.Path]::GetFileNameWithoutExtension($name));$keys.SendKeys('{ENTER}');Start-Sleep -Milliseconds 650}
 $keys.SendKeys('^+n');Start-Sleep -Milliseconds 400;Text-Key $DateFolder;$keys.SendKeys('{ENTER}');Start-Sleep -Milliseconds 700
 $flag=29
 foreach($name in $Files){$renamed=$DateFolder+'_'+$name;$item=$window.Document.Folder.ParseName($renamed);if(-not $item){throw ('Renamed test file absent: '+$renamed)};$window.Document.SelectItem($item,$flag);$flag=25}
 Start-Sleep -Milliseconds 200;$keys.SendKeys('^x');Start-Sleep -Milliseconds 300;Navigate $window (Join-Path $Folder $DateFolder);$keys.SendKeys('^v');Start-Sleep -Milliseconds 1000
 foreach($name in $Files){if(-not (Test-Path -LiteralPath (Join-Path (Join-Path $Folder $DateFolder) ($DateFolder+'_'+$name)))){Get-ChildItem -LiteralPath $Folder -Recurse | Select-Object -ExpandProperty FullName | Write-Output;throw 'Native cut/paste did not move the test file into the expected folder'}}
 Write-Output 'Real Explorer rename, create-folder, cut/paste procedure completed'
}
if($Action -eq 'capture'){
 Add-Type -AssemblyName System.Drawing
 $rect=New-Object EchoRecipeWindow+Rect;[void][EchoRecipeWindow]::GetWindowRect([IntPtr]::new([long]$window.HWND),[ref]$rect)
 $bitmap=New-Object Drawing.Bitmap(($rect.right-$rect.left),($rect.bottom-$rect.top));$graphics=[Drawing.Graphics]::FromImage($bitmap);$graphics.CopyFromScreen($rect.left,$rect.top,0,0,$bitmap.Size);$bitmap.Save($OutputPath,[Drawing.Imaging.ImageFormat]::Png);$graphics.Dispose();$bitmap.Dispose()
}
if($Action -eq 'close'){$window.Quit()}
