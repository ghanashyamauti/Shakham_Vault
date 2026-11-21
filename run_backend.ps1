Write-Host "==============================================" -ForegroundColor Green
Write-Host "  Starting .env Keeper FastAPI Backend" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\backend"
& ".\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
