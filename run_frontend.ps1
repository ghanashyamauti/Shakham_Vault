Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Starting .env Keeper React Frontend (Vite)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\frontend"
npm run dev
