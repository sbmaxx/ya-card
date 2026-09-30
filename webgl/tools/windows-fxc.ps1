param([Parameter(Mandatory=$true)][string]$InputHlsl, [Parameter(Mandatory=$true)][string]$OutputPrefix, [uint32]$Flags = 0)
# D3DCompile/D3DDisassemble are FXC's APIs. Use the installed DLL when SDK fxc.exe is absent.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CardFxc {
    [DllImport("d3dcompiler_47.dll", CallingConvention=CallingConvention.StdCall)]
    public static extern int D3DCompile(byte[] data, UIntPtr size, string source, IntPtr defines, IntPtr include, string entry, string target, uint flags1, uint flags2, out IntPtr code, out IntPtr errors);
    [DllImport("d3dcompiler_47.dll", CallingConvention=CallingConvention.StdCall)]
    public static extern int D3DDisassemble(byte[] data, UIntPtr size, uint flags, string comments, out IntPtr result);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate IntPtr GetPointer(IntPtr self);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate UIntPtr GetSize(IntPtr self);
    public static byte[] ReadBlob(IntPtr blob) {
        if (blob == IntPtr.Zero) return new byte[0];
        IntPtr table=Marshal.ReadIntPtr(blob);
        var pointer=Marshal.GetDelegateForFunctionPointer<GetPointer>(Marshal.ReadIntPtr(table, 3*IntPtr.Size));
        var size=Marshal.GetDelegateForFunctionPointer<GetSize>(Marshal.ReadIntPtr(table, 4*IntPtr.Size));
        byte[] bytes=new byte[checked((int)size(blob).ToUInt64())];
        Marshal.Copy(pointer(blob), bytes, 0, bytes.Length); Marshal.Release(blob); return bytes;
    }
}
'@
$inputText = Get-Content -LiteralPath $InputHlsl -Raw
$match = [regex]::Match($inputText, '(?s)// COMPILER INPUT HLSL BEGIN\s*(.*?)// COMPILER INPUT HLSL END')
if ($match.Success) { $inputText = $match.Groups[1].Value }
$bytes = [Text.Encoding]::UTF8.GetBytes($inputText)
[IO.File]::WriteAllText("$OutputPrefix.input.hlsl", $inputText)
$code = [IntPtr]::Zero; $errors = [IntPtr]::Zero
$timer = [Diagnostics.Stopwatch]::StartNew()
$hr = [CardFxc]::D3DCompile($bytes, [UIntPtr]$bytes.Length, $InputHlsl, [IntPtr]::Zero, [IntPtr]::Zero, 'main', 'ps_5_0', $Flags, 0, [ref]$code, [ref]$errors)
$timer.Stop()
$messages = [Text.Encoding]::UTF8.GetString([CardFxc]::ReadBlob($errors))
[IO.File]::WriteAllText("$OutputPrefix.compiler.txt", $messages)
$binary = [CardFxc]::ReadBlob($code)
$assembly = ''
if ($binary.Length) {
    [IO.File]::WriteAllBytes("$OutputPrefix.dxbc", $binary)
    $listing=[IntPtr]::Zero
    $disassembled=[CardFxc]::D3DDisassemble($binary, [UIntPtr]$binary.Length, 0, $null, [ref]$listing)
    $assembly=[Text.Encoding]::UTF8.GetString([CardFxc]::ReadBlob($listing))
    [IO.File]::WriteAllText("$OutputPrefix.asm", $assembly)
}
$report=[ordered]@{input=$InputHlsl; target='ps_5_0'; entry='main'; flags=$Flags; elapsedMs=$timer.Elapsed.TotalMilliseconds; hresult=$hr; bytes=$binary.Length; loops=([regex]::Matches($assembly,'(?m)^\s*loop\s*$')).Count; instructionSummary=([regex]::Matches($assembly,'(?m)^// Approximately.*$') | ForEach-Object {$_.Value}); messages=$messages; compiler=(Get-Item C:\Windows\System32\d3dcompiler_47.dll).VersionInfo.FileVersion}
$report | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$OutputPrefix.json"
$report | ConvertTo-Json -Depth 5
if ($hr -lt 0) { exit 1 }
