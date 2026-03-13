@echo off
echo.
echo =====================================================
echo   TonerPro Ultra v4.2 - Python Backend Setup
echo =====================================================
echo.

cd /d "%~dp0backend"

echo [Step 1] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Python not found. Install from https://python.org
    pause
    exit /b 1
)

echo [Step 2] Activating virtual environment...
call venv\Scripts\activate.bat

echo [Step 3] Installing Python packages...
pip install -r requirements.txt

echo [Step 4] Copying .env file...
if not exist ".env" (
    copy .env.example .env
    echo   -> .env created. EDIT IT with your DB password before continuing!
    echo.
    echo   Open: backend\.env  and set DB_PASSWORD=your_postgres_password
    echo.
    pause
)

echo [Step 5] Running database setup...
python db/setup.py
if errorlevel 1 (
    echo ERROR: Database setup failed. Check your .env file.
    pause
    exit /b 1
)

echo.
echo [Step 6] Starting server...
echo   Open http://localhost:4000 in your browser
echo   Press Ctrl+C to stop the server
echo.
python main.py

pause
