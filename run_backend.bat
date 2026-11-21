@echo off
echo ==============================================
echo   Starting .env Keeper FastAPI Backend
echo ==============================================
cd backend
call venv\Scripts\activate.bat
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
