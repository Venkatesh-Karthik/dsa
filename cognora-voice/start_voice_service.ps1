# Cognora Voice Service Startup Script
# Starts the local Chatterbox-Turbo TTS service on http://127.0.0.1:5005
#
# Usage:
#   From the repo root:  .\cognora-voice\start_voice_service.ps1
#   From cognora-voice:  .\start_voice_service.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"
$ServerScript = Join-Path $ScriptDir "server.py"

if (-not (Test-Path $VenvPython)) {
    Write-Error "[COGNORA][VOICE][STARTUP] .venv not found at: $VenvPython"
    Write-Error "Create it with:  cd cognora-voice && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt"
    exit 1
}

if (-not (Test-Path $ServerScript)) {
    Write-Error "[COGNORA][VOICE][STARTUP] server.py not found at: $ServerScript"
    exit 1
}

Write-Host "[COGNORA][VOICE][STARTUP] Starting Chatterbox-Turbo voice service..." -ForegroundColor Cyan
Write-Host "[COGNORA][VOICE][STARTUP] Python: $VenvPython" -ForegroundColor Gray
Write-Host "[COGNORA][VOICE][STARTUP] Server: $ServerScript" -ForegroundColor Gray
Write-Host "[COGNORA][VOICE][STARTUP] Endpoint: http://127.0.0.1:5005" -ForegroundColor Gray
Write-Host ""

# Set working directory to cognora-voice so relative imports work
Set-Location $ScriptDir

& $VenvPython $ServerScript
