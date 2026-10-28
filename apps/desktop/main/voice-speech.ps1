param([ValidateSet('voices','synthesize')][string]$Operation)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        if ($Operation -eq 'voices') {
            $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { @{ id=$_.VoiceInfo.Name; name=$_.VoiceInfo.Name; language=$_.VoiceInfo.Culture.Name } })
            @{ voices=$voices } | ConvertTo-Json -Depth 4 -Compress
        } else {
            $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
            if ($request.text.Length -gt 700 -or $request.text.Length -lt 1) { throw 'Réponse parlée hors limites.' }
            if ($request.voice) { $synth.SelectVoice([string]$request.voice) }
            else { $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet, [System.Speech.Synthesis.VoiceAge]::NotSet, 0, [Globalization.CultureInfo]::GetCultureInfo($request.language)) }
            $synth.Rate = [Math]::Max(-10, [Math]::Min(10, [Math]::Round(($request.speed - 1) * 10)))
            $synth.Volume = 100
            $audio = New-Object IO.MemoryStream
            try {
                $synth.SetOutputToWaveStream($audio)
                $synth.Speak([string]$request.text)
                $synth.SetOutputToNull()
                @{ wav=[Convert]::ToBase64String($audio.ToArray()); voice=$synth.Voice.Name } | ConvertTo-Json -Compress
            } finally { $audio.Dispose() }
        }
    } finally { $synth.Dispose() }
} catch {
    @{ error=$_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
